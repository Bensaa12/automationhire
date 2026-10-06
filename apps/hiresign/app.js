import * as pdfjsLib from './vendor/pdf.min.mjs';
import {
  captureInk, drawIncrement, drawEnd, renderStroke, strokesToImage,
  trimCanvas, textToImage, loadImage,
} from './ink.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
const { PDFDocument, degrees } = window.PDFLib;
const api = window.hiresign;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid = () => Math.random().toString(36).slice(2, 10);
const DPR = () => window.devicePixelRatio || 1;

const viewer = $('#viewer');
const sizer = $('#sizer');
const stage = $('#stage');

const state = {
  doc: null,        // { type: 'pdf'|'docx'|'image', name, path, bytes }
  pages: [],        // { el, overlay, w, h (CSS px at 100%), ... }
  items: [],        // { id, page, x, y, w, h (fractions of page), src, aspect }
  zoom: 1,
  tool: 'select',
  armed: null,      // { src, aspect, widthPx, libId? }
  sel: null,
  history: [],
  dirty: false,
  ink: { color: '#111111', size: 3, penOnly: false },
  inkStrokes: new Map(),
  inkOrder: [],
};

// ===========================================================================
// Signature library (persisted locally)
// ===========================================================================
const LIB_KEY = 'hiresign.library.v1';
let library = [];
try { library = JSON.parse(localStorage.getItem(LIB_KEY)) || []; } catch { library = []; }
const saveLib = () => { try { localStorage.setItem(LIB_KEY, JSON.stringify(library)); } catch {} };

const X_ICON = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>';

function renderLib() {
  for (const kind of ['signature', 'initials']) {
    const box = kind === 'signature' ? $('#sigList') : $('#iniList');
    box.innerHTML = '';
    for (const e of library.filter(l => l.kind === kind)) {
      const d = document.createElement('div');
      d.className = 'sig-item' + (state.armed?.libId === e.id ? ' armed' : '');
      d.title = 'Click, then click on the page to place';
      d.innerHTML = `<img src="${e.src}" alt=""><button class="del" title="Delete">${X_ICON}</button>`;
      d.addEventListener('click', ev => {
        if (ev.target.closest('.del')) {
          if (confirm(`Delete this saved ${kind}?`)) {
            library = library.filter(l => l.id !== e.id);
            if (state.armed?.libId === e.id) disarm();
            saveLib(); renderLib();
          }
          return;
        }
        if (state.armed?.libId === e.id) { disarm(); return; }
        arm({ src: e.src, aspect: e.aspect, widthPx: kind === 'initials' ? 70 : 190, libId: e.id, label: kind });
      });
      box.append(d);
    }
  }
}

// ===========================================================================
// Opening documents
// ===========================================================================
function extOf(name) { return (name.match(/\.([^.\\/]+)$/)?.[1] || '').toLowerCase(); }

async function openDoc(doc) {
  if (!doc) return;
  if (state.dirty && !confirm('Discard the signatures you have not saved yet?')) return;
  const ext = extOf(doc.name);
  const type = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : ['png', 'jpg', 'jpeg'].includes(ext) ? 'image' : null;
  if (!type) {
    alert(ext === 'doc'
      ? 'Old .doc files are not supported. Open it in Word and "Save As" .docx or PDF first.'
      : `Unsupported file type: .${ext}`);
    return;
  }
  busy(true, 'Opening ' + doc.name + '…');
  try {
    finishInk(true);
    disarm();
    state.pdf?.destroy?.();
    Object.assign(state, { doc: { ...doc, type, ext }, pages: [], items: [], history: [], sel: null, pdf: null });
    state.inkStrokes.clear();
    state.inkOrder = [];
    stage.innerHTML = '';
    stage.style.width = '';
    stage.style.transform = '';
    $('#empty').hidden = true;
    sizer.hidden = false;
    if (type === 'pdf') await loadPdf(doc.data);
    else if (type === 'docx') await loadDocx(doc.data);
    else await loadImageDoc(doc.data, ext);
    for (const p of state.pages) wireOverlay(p);
    document.title = doc.name + ' — HireSign';
    $('#docName').textContent = doc.name;
    $('#zoomBox').hidden = false;
    setDirty(false);
    fitWidth(true);
    viewer.scrollTop = 0;
    renderItems();
    if (type === 'docx' && !lic.pro) toast('You can view this Word file. Saving signed Word documents needs HireSign Pro.', { label: 'See Pro', fn: () => openAbout('Signing Word documents is a Pro feature.') });
  } catch (err) {
    console.error(err);
    const msg = /password/i.test(err?.message || err?.name)
      ? 'This PDF is password-protected. Remove the password first, then open it again.'
      : 'Could not open this file:\n' + (err?.message || err);
    alert(msg);
    resetToEmpty();
  } finally {
    busy(false);
  }
}

function resetToEmpty() {
  state.doc = null; state.pages = []; state.items = [];
  stage.innerHTML = '';
  sizer.hidden = true;
  $('#empty').hidden = false;
  $('#docName').textContent = '';
  $('#zoomBox').hidden = true;
  $('#pageInfo').textContent = '';
  document.title = 'HireSign';
  updateButtons();
}

function makePage(w, h) {
  const el = document.createElement('div');
  el.className = 'page';
  el.style.width = w + 'px';
  el.style.height = h + 'px';
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  el.append(overlay);
  stage.append(el);
  return { el, overlay, w, h };
}

// ---- PDF -------------------------------------------------------------------
async function loadPdf(bytes) {
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  state.pdf = pdf;
  let maxW = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const pdfPage = await pdf.getPage(i);
    const vp = pdfPage.getViewport({ scale: 1 });
    const p = makePage(vp.width * 4 / 3, vp.height * 4 / 3);
    Object.assign(p, { pdfPage, vp, scale: 0 });
    state.pages.push(p);
    maxW = Math.max(maxW, p.w);
  }
  stage.style.width = maxW + 48 + 'px';
}

const wantScale = () => Math.min(4 / 3 * state.zoom * DPR(), 5);

async function renderPdfPage(p) {
  if (p.rendering || p.scale >= wantScale() * 0.95) return;
  p.rendering = true;
  const scale = wantScale();
  const vp = p.pdfPage.getViewport({ scale });
  const c = document.createElement('canvas');
  c.className = 'render';
  c.width = Math.floor(vp.width);
  c.height = Math.floor(vp.height);
  try {
    await p.pdfPage.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    p.canvas?.remove();
    p.el.insertBefore(c, p.overlay);
    p.canvas = c;
    p.scale = scale;
  } catch (e) {
    console.warn('render failed', e);
  } finally {
    p.rendering = false;
  }
  if (p.scale < wantScale() * 0.95 && nearView(p, 1)) renderPdfPage(p);
}

function nearView(p, screens) {
  const vr = viewer.getBoundingClientRect();
  const r = p.el.getBoundingClientRect();
  return r.bottom > vr.top - vr.height * screens && r.top < vr.bottom + vr.height * screens;
}

let visQueued = false;
function updateVisible() {
  if (visQueued) return;
  visQueued = true;
  requestAnimationFrame(() => {
    visQueued = false;
    if (!state.doc) return;
    const vr = viewer.getBoundingClientRect();
    let cur = 1;
    state.pages.forEach((p, i) => {
      const r = p.el.getBoundingClientRect();
      if (r.top < vr.top + vr.height * 0.4) cur = i + 1;
      if (state.doc.type !== 'pdf') return;
      if (nearView(p, 1)) renderPdfPage(p);
      else if (p.canvas && !nearView(p, 4)) { p.canvas.remove(); p.canvas = null; p.scale = 0; }
    });
    $('#pageInfo').textContent = `Page ${cur} / ${state.pages.length}`;
  });
}
viewer.addEventListener('scroll', updateVisible);
window.addEventListener('resize', () => { updateSizer(); updateVisible(); });

// ---- Word (.docx) ----------------------------------------------------------
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const SKIP_ANCESTORS = new Set(['txbxContent', 'AlternateContent', 'drawing', 'pict', 'object']);

// Paragraphs in document order, excluding those inside text boxes/shapes.
// Used identically for the preview copy and the export, so indexes line up.
function docxParagraphs(dom) {
  const body = dom.getElementsByTagNameNS(W_NS, 'body')[0];
  if (!body) return [];
  return [...body.getElementsByTagNameNS(W_NS, 'p')].filter(p => {
    for (let a = p.parentNode; a && a !== body; a = a.parentNode) if (SKIP_ANCESTORS.has(a.localName)) return false;
    return true;
  });
}

function insertAfterPPr(p, node) {
  const first = p.firstElementChild;
  if (first && first.localName === 'pPr') first.after(node);
  else p.prepend(node);
}

async function loadDocx(bytes) {
  // Tag every paragraph with an invisible bookmark so we can later tell which
  // paragraph sits on which rendered page (needed to anchor signatures in Word).
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('word/document.xml').async('string');
  const dom = new DOMParser().parseFromString(xml, 'application/xml');
  docxParagraphs(dom).forEach((p, i) => {
    const s = dom.createElementNS(W_NS, 'w:bookmarkStart');
    s.setAttributeNS(W_NS, 'w:id', String(880000 + i));
    s.setAttributeNS(W_NS, 'w:name', 'spk_' + i);
    const e = dom.createElementNS(W_NS, 'w:bookmarkEnd');
    e.setAttributeNS(W_NS, 'w:id', String(880000 + i));
    insertAfterPPr(p, e);
    insertAfterPPr(p, s);
  });
  zip.file('word/document.xml', new XMLSerializer().serializeToString(dom));
  const blob = await zip.generateAsync({ type: 'blob' });

  await window.docx.renderAsync(blob, stage, null, {
    className: 'docx',
    inWrapper: true,
    breakPages: true,
    ignoreLastRenderedPageBreak: false,
    experimental: true,
    useBase64URL: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
  });

  const pt = v => (/pt$/.test(v) ? parseFloat(v) : NaN);
  let maxW = 0;
  for (const sec of stage.querySelectorAll('section.docx')) {
    let ptW = pt(sec.style.width), ptH = pt(sec.style.minHeight);
    if (!ptW) ptW = sec.offsetWidth * 0.75;
    if (!ptH) ptH = sec.offsetHeight * 0.75;
    sec.style.height = ptH + 'pt';
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    sec.append(overlay);
    state.pages.push({ el: sec, overlay, w: ptW * 4 / 3, h: ptH * 4 / 3, ptW, ptH });
    maxW = Math.max(maxW, ptW * 4 / 3);
  }
  if (!state.pages.length) throw new Error('No pages could be rendered from this Word file.');
  stage.style.width = maxW + 48 + 'px';
}

// ---- Images ----------------------------------------------------------------
async function loadImageDoc(bytes, ext) {
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const img = await loadImage(url);
  const k = Math.min(1, 1000 / img.naturalWidth);
  const p = makePage(img.naturalWidth * k, img.naturalHeight * k);
  img.className = 'render';
  img.style.width = '100%';
  img.style.height = '100%';
  img.draggable = false;
  p.el.insertBefore(img, p.overlay);
  Object.assign(p, { img, natW: img.naturalWidth, natH: img.naturalHeight, mime });
  state.pages.push(p);
  stage.style.width = p.w + 48 + 'px';
}

// ===========================================================================
// Zoom
// ===========================================================================
function updateSizer() {
  if (!state.doc) return;
  sizer.style.width = stage.offsetWidth * state.zoom + 'px';
  sizer.style.height = stage.offsetHeight * state.zoom + 'px';
}

function setZoom(z, anchor) {
  if (!state.doc) return;
  z = clamp(z, 0.25, 4);
  const vr = viewer.getBoundingClientRect();
  const ax = anchor ? anchor.x - vr.left : viewer.clientWidth / 2;
  const ay = anchor ? anchor.y - vr.top : viewer.clientHeight / 2;
  const cx = (viewer.scrollLeft + ax - sizer.offsetLeft) / state.zoom;
  const cy = (viewer.scrollTop + ay - sizer.offsetTop) / state.zoom;
  state.zoom = z;
  stage.style.transform = `scale(${z})`;
  updateSizer();
  viewer.scrollLeft = cx * z + sizer.offsetLeft - ax;
  viewer.scrollTop = cy * z + sizer.offsetTop - ay;
  $('#zoomLabel').textContent = Math.round(z * 100) + '%';
  for (const p of state.pages) if (p.inkCanvas) sizeInkCanvas(p);
  updateVisible();
}

function fitWidth(initial) {
  const natural = stage.offsetWidth;
  if (!natural) return;
  let z = (viewer.clientWidth - 24) / natural;
  if (initial) z = Math.min(z, 1.4);
  setZoom(z);
}

$('#btnZoomIn').onclick = () => setZoom(state.zoom * 1.2);
$('#btnZoomOut').onclick = () => setZoom(state.zoom / 1.2);
$('#zoomLabel').onclick = () => fitWidth(false);
viewer.addEventListener('wheel', e => {
  if (!e.ctrlKey || !state.doc) return;
  e.preventDefault();
  setZoom(state.zoom * Math.exp(-e.deltaY * 0.0022), { x: e.clientX, y: e.clientY });
}, { passive: false });

// ===========================================================================
// Placed items
// ===========================================================================
function pushHistory() {
  state.history.push(state.items.map(i => ({ ...i })));
  if (state.history.length > 150) state.history.shift();
  updateButtons();
}

function undo() {
  if (state.tool === 'ink' && state.inkOrder.length) { undoInkStroke(); return; }
  const snap = state.history.pop();
  if (!snap) return;
  state.items = snap;
  state.sel = null;
  renderItems();
  setDirty(true);
}

function setDirty(v) {
  state.dirty = v;
  api.setDirty(v);
  updateButtons();
}

function updateButtons() {
  $('#btnSave').disabled = !state.doc || !state.items.length;
  $('#btnUndo').disabled = !state.history.length && !state.inkOrder.length;
}

function renderItems() {
  for (const p of state.pages) p.overlay.querySelectorAll('.item').forEach(n => n.remove());
  for (const it of state.items) {
    const p = state.pages[it.page];
    if (!p) continue;
    const d = document.createElement('div');
    d.className = 'item' + (it.id === state.sel ? ' sel' : '');
    d.dataset.id = it.id;
    d.innerHTML = `<img src="${it.src}" alt="" draggable="false"><div class="h"></div><button class="x" title="Remove">${X_ICON}</button>`;
    placeEl(d, it);
    p.overlay.append(d);
  }
  updateButtons();
}

function placeEl(d, it) {
  d.style.left = it.x * 100 + '%';
  d.style.top = it.y * 100 + '%';
  d.style.width = it.w * 100 + '%';
  d.style.height = it.h * 100 + '%';
}

function selectItem(id) {
  state.sel = id;
  $$('.item').forEach(n => n.classList.toggle('sel', n.dataset.id === id));
}

function removeItem(id) {
  pushHistory();
  state.items = state.items.filter(i => i.id !== id);
  if (state.sel === id) state.sel = null;
  renderItems();
  setDirty(true);
}

function addItem(pageIndex, fx, fy, a) {
  const p = state.pages[pageIndex];
  const w = clamp(a.widthPx / p.w, 0.01, 0.95);
  const h = w * a.aspect * (p.w / p.h);
  const it = {
    id: uid(), page: pageIndex, src: a.src,
    w, h,
    x: clamp(fx - w / 2, 0, 1 - w),
    y: clamp(fy - h / 2, 0, Math.max(0, 1 - h)),
  };
  pushHistory();
  state.items.push(it);
  state.sel = it.id;
  renderItems();
  setDirty(true);
  return it;
}

function wireOverlay(p) {
  const ov = p.overlay;
  const index = () => state.pages.indexOf(p);

  // Tap/click on the page: place the armed signature, or clear the selection.
  ov.addEventListener('click', e => {
    if (e.target.closest('.item') || state.tool === 'ink') return;
    const r = ov.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    if (state.armed) {
      addItem(index(), fx, fy, state.armed);
      if (!e.shiftKey) disarm();
    } else {
      selectItem(null);
    }
  });

  // Move / resize / delete items with mouse, pen or touch.
  ov.addEventListener('pointerdown', e => {
    const el = e.target.closest('.item');
    if (!el || state.tool === 'ink') return;
    const it = state.items.find(i => i.id === el.dataset.id);
    if (!it) return;
    e.stopPropagation();
    if (e.target.closest('.x')) return;
    e.preventDefault();
    selectItem(it.id);
    const mode = e.target.closest('.h') ? 'resize' : 'move';
    const r = ov.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, it: { ...it } };
    let moved = false;
    el.setPointerCapture(e.pointerId);
    const onMove = ev => {
      const dx = (ev.clientX - start.x) / r.width;
      const dy = (ev.clientY - start.y) / r.height;
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 3) return;
      if (!moved) { moved = true; pushHistory(); }
      if (mode === 'move') {
        it.x = clamp(start.it.x + dx, -start.it.w * 0.5, 1 - start.it.w * 0.5);
        it.y = clamp(start.it.y + dy, -start.it.h * 0.5, 1 - start.it.h * 0.5);
      } else {
        const ratio = start.it.h / start.it.w;
        it.w = clamp(start.it.w + Math.max(dx, dy / ratio), 0.015, 1);
        it.h = it.w * ratio;
      }
      placeEl(el, it);
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      if (moved) setDirty(true);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  });

  ov.addEventListener('click', e => {
    const x = e.target.closest('.x');
    if (x) removeItem(x.closest('.item').dataset.id);
  });

  // Freehand ink directly on the page.
  captureInk(ov, {
    accept: e => state.tool === 'ink' && !(state.ink.penOnly && e.pointerType === 'touch'),
    toLocal: e => {
      const r = ov.getBoundingClientRect();
      const u = 1000 / r.width;
      return { x: (e.clientX - r.left) * u, y: (e.clientY - r.top) * u };
    },
    style: () => ({
      color: state.ink.color,
      size: state.ink.size * 0.55 * 1000 / p.w,
      unit: ov.getBoundingClientRect().width / 1000,
    }),
    onStart: st => {
      ensureInkCanvas(p);
      if (!state.inkStrokes.has(p)) state.inkStrokes.set(p, []);
      state.inkStrokes.get(p).push(st);
      state.inkOrder.push(p);
      updateButtons();
    },
    onPoint: (st, i) => drawIncrement(p.inkCtx, st, i, p.inkCanvas.width / 1000),
    onEnd: st => drawEnd(p.inkCtx, st, p.inkCanvas.width / 1000),
  });
}

// ===========================================================================
// Tools & arming
// ===========================================================================
function arm(a) {
  if (!state.doc) { toast('Open a document first, then place your signature.'); return; }
  finishInk();
  state.armed = a;
  document.body.classList.add('armed');
  showHint(`Click or tap on the page to place ${a.label === 'initials' ? 'your initials' : a.label === 'signature' ? 'your signature' : 'it'}${api.isWeb ? '' : ' · Esc to cancel'}`);
  renderLib();
}

function disarm() {
  state.armed = null;
  document.body.classList.remove('armed');
  showHint(null);
  highlightTool(state.tool === 'ink' ? 'ink' : 'select');
  renderLib();
}

function highlightTool(t) {
  $$('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
}

function inkStyleColor() { return state.ink.color; }

function stampText(text, sizePx = 16, font = 'Segoe UI', weight = '400') {
  const r = textToImage(text, { font, size: 96, color: inkStyleColor(), weight });
  return r && { src: r.src, aspect: r.aspect, widthPx: r.width * (sizePx / 96) };
}

function selectTool(t) {
  if (t !== 'ink') finishInk();
  disarm();
  if (!state.doc && t !== 'select') { toast('Open a document first.'); t = 'select'; }
  state.tool = t === 'ink' ? 'ink' : 'select';
  highlightTool(t);
  if (t === 'ink') return enterInk();
  if (t === 'date') {
    const d = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    armStamp(stampText(d), 'date');
  } else if (t === 'check') {
    armStamp(stampText('✔', 20, 'Segoe UI Symbol'), 'check');
  } else if (t === 'cross') {
    armStamp(stampText('✘', 20, 'Segoe UI Symbol'), 'cross');
  } else if (t === 'text') {
    openTextDialog();
  }
}

function armStamp(a, tool) {
  if (!a) return;
  arm({ ...a, label: tool });
  highlightTool(tool);
}

$$('.tool').forEach(b => b.addEventListener('click', () => selectTool(b.dataset.tool)));

// ---- ink mode --------------------------------------------------------------
function enterInk() {
  document.body.classList.add('inking');
  document.body.classList.toggle('pen-only', state.ink.penOnly);
  $('#inkBar').hidden = false;
  selectItem(null);
}

function ensureInkCanvas(p) {
  if (!p.inkCanvas) {
    p.inkCanvas = document.createElement('canvas');
    p.inkCanvas.className = 'ink';
    p.overlay.prepend(p.inkCanvas);
    p.inkCtx = p.inkCanvas.getContext('2d');
    sizeInkCanvas(p);
  }
}

function sizeInkCanvas(p) {
  const r = p.overlay.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * DPR()));
  const h = Math.max(1, Math.round(r.height * DPR()));
  if (p.inkCanvas.width === w && p.inkCanvas.height === h) return;
  p.inkCanvas.width = w;
  p.inkCanvas.height = h;
  redrawInk(p);
}

function redrawInk(p) {
  const c = p.inkCanvas;
  if (!c) return;
  p.inkCtx.clearRect(0, 0, c.width, c.height);
  for (const st of state.inkStrokes.get(p) || []) renderStroke(p.inkCtx, st, c.width / 1000);
}

function undoInkStroke() {
  const p = state.inkOrder.pop();
  state.inkStrokes.get(p)?.pop();
  redrawInk(p);
  updateButtons();
}

// Convert the freehand strokes on each page into normal (movable) items.
function finishInk(discard = false) {
  if (!document.body.classList.contains('inking') && !state.inkStrokes.size) return;
  let added = false;
  for (const [p, strokes] of state.inkStrokes) {
    if (!discard && strokes.length && state.pages.includes(p)) {
      const res = strokesToImage(strokes, (3 * p.w) / 1000);
      if (res) {
        if (!added) { pushHistory(); added = true; }
        const ph = (1000 * p.h) / p.w;
        const b = res.bounds;
        state.items.push({
          id: uid(), page: state.pages.indexOf(p), src: res.src,
          x: b.x / 1000, y: b.y / ph, w: b.w / 1000, h: b.h / ph,
        });
      }
    }
    p.inkCanvas?.remove();
    p.inkCanvas = null;
  }
  state.inkStrokes.clear();
  state.inkOrder = [];
  document.body.classList.remove('inking', 'pen-only');
  $('#inkBar').hidden = true;
  if (state.tool === 'ink') { state.tool = 'select'; highlightTool('select'); }
  if (added) { renderItems(); setDirty(true); } else updateButtons();
}

$('#inkDone').onclick = () => finishInk();
$('#inkUndo').onclick = () => undoInkStroke();

// ---- ink colour / size -----------------------------------------------------
$('#inkColors').addEventListener('click', e => {
  const s = e.target.closest('.swatch');
  if (!s) return;
  state.ink.color = s.dataset.color;
  $$('#inkColors .swatch').forEach(b => b.classList.toggle('active', b === s));
});
$('#inkSize').oninput = e => { state.ink.size = +e.target.value; };
$('#penOnly').onchange = e => {
  state.ink.penOnly = e.target.checked;
  document.body.classList.toggle('pen-only', state.ink.penOnly && state.tool === 'ink');
};

// ===========================================================================
// Signature creator dialog
// ===========================================================================
const sigDlg = $('#sigDialog');
const pad = $('#pad');
const padCtx = pad.getContext('2d');
const padState = { kind: 'signature', tab: 'draw', strokes: [], color: '#111111', size: 4, font: null, upload: null };

function sizePad() {
  const r = pad.getBoundingClientRect();
  pad.width = Math.round(r.width * DPR());
  pad.height = Math.round(r.height * DPR());
  redrawPad();
}

function redrawPad() {
  padCtx.clearRect(0, 0, pad.width, pad.height);
  for (const st of padState.strokes) renderStroke(padCtx, st, DPR());
  $('#padPlaceholder').hidden = padState.strokes.length > 0;
}

captureInk(pad, {
  toLocal: e => { const r = pad.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; },
  style: () => ({ color: padState.color, size: padState.size, unit: 1 }),
  onStart: st => { padState.strokes.push(st); $('#padPlaceholder').hidden = true; },
  onPoint: (st, i) => drawIncrement(padCtx, st, i, DPR()),
  onEnd: st => drawEnd(padCtx, st, DPR()),
});
new ResizeObserver(() => { if (sigDlg.open) sizePad(); }).observe(pad);

$('#padUndo').onclick = () => { padState.strokes.pop(); redrawPad(); };
$('#padClear').onclick = () => { padState.strokes = []; redrawPad(); };
$('#padColors').addEventListener('click', e => {
  const s = e.target.closest('.swatch');
  if (!s) return;
  padState.color = s.dataset.color;
  $$('#padColors .swatch').forEach(b => b.classList.toggle('active', b === s));
  for (const st of padState.strokes) st.color = padState.color;
  redrawPad();
  renderFonts();
  if (padState.upload) processUpload();
});
$('#padSize').oninput = e => {
  const next = +e.target.value;
  const k = next / padState.size;
  padState.size = next;
  for (const st of padState.strokes) { st.size *= k; for (const pt of st.points) pt.w *= k; }
  redrawPad();
};

// Typed signatures use handwriting fonts already installed on Windows / Office.
const SCRIPT_FONTS = ['Segoe Script', 'Lucida Handwriting', 'Ink Free', 'Segoe Print', 'Brush Script MT',
  'Freestyle Script', 'Edwardian Script ITC', 'Vladimir Script', 'Mistral', 'Kunstler Script',
  'French Script MT', 'Monotype Corsiva', 'Bradley Hand ITC', 'Gabriola', 'Rage Italic', 'Palace Script MT'];

function fontInstalled(f) {
  const ctx = document.createElement('canvas').getContext('2d');
  const t = 'Signature Abcdefg 0123';
  return ['monospace', 'serif'].some(base => {
    ctx.font = `40px ${base}`;
    const a = ctx.measureText(t).width;
    ctx.font = `40px "${f}", ${base}`;
    return ctx.measureText(t).width !== a;
  });
}
const availableFonts = SCRIPT_FONTS.filter(fontInstalled);
padState.font = availableFonts[0] || 'cursive';

function renderFonts() {
  const name = $('#typeInput').value.trim() || (padState.kind === 'initials' ? 'AB' : 'Your Name');
  const list = $('#fontList');
  list.innerHTML = '';
  for (const f of availableFonts.length ? availableFonts : ['cursive']) {
    const b = document.createElement('button');
    b.className = 'font-opt' + (f === padState.font ? ' active' : '');
    b.style.fontFamily = `"${f}", cursive`;
    b.style.color = padState.color;
    b.textContent = name;
    b.onclick = () => { padState.font = f; renderFonts(); };
    list.append(b);
  }
}
$('#typeInput').addEventListener('input', renderFonts);

// Upload a photo/scan of a signature and knock out the paper background.
$('#uploadBtn').onclick = () => $('#uploadInput').click();
$('#uploadInput').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  padState.upload = await loadImage(URL.createObjectURL(f));
  processUpload();
};
$('#uploadThresh').oninput = () => processUpload();

function processUpload() {
  const img = padState.upload;
  if (!img) return;
  const k = Math.min(1, 1600 / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const id = ctx.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  const t = +$('#uploadThresh').value;
  const hex = padState.color;
  const cr = parseInt(hex.slice(1, 3), 16), cg = parseInt(hex.slice(3, 5), 16), cb = parseInt(hex.slice(5, 7), 16);
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const a = lum >= t ? 0 : clamp((t - lum) * 3.2, 0, 255);
    d[i] = cr; d[i + 1] = cg; d[i + 2] = cb;
    d[i + 3] = Math.round(a * (d[i + 3] / 255));
  }
  ctx.putImageData(id, 0, 0);
  const tr = trimCanvas(c, 6);
  padState.uploadResult = tr ? { src: tr.toDataURL('image/png'), aspect: tr.height / tr.width } : null;
  $('#uploadPreview').src = padState.uploadResult?.src || '';
}

const proLocked = tab => (tab === 'type' || tab === 'upload') && !lic.pro;

function setTab(tab) {
  padState.tab = tab;
  const locked = proLocked(tab);
  $$('#sigTabs .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('#sigDialog .pane').forEach(p => { p.hidden = p.dataset.pane !== (locked ? 'locked' : tab); });
  if (locked) {
    $('#lockedTitle').textContent = tab === 'type' ? 'Typed signatures are a Pro feature' : 'Uploaded signatures are a Pro feature';
    return;
  }
  if (tab === 'draw') requestAnimationFrame(sizePad);
  if (tab === 'type') { renderFonts(); $('#typeInput').focus(); }
}
$('#sigTabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) setTab(t.dataset.tab); });

function openSigDialog(kind) {
  finishInk();
  padState.kind = kind;
  padState.strokes = [];
  padState.upload = null;
  padState.uploadResult = null;
  $('#uploadPreview').removeAttribute('src');
  $('#typeInput').value = '';
  $('#sigTitle').textContent = kind === 'initials' ? 'Create initials' : 'Create signature';
  $('#typeInput').placeholder = kind === 'initials' ? 'Type your initials' : 'Type your full name';
  sigDlg.showModal();
  setTab('draw');
}

$$('[data-new]').forEach(b => b.addEventListener('click', () => openSigDialog(b.dataset.new)));
$('#sigCancel').onclick = () => sigDlg.close();

$('#lockedUpgrade').onclick = () => { sigDlg.close(); openAbout('Upgrade to Pro to type or upload your signature.'); };

$('#sigUse').onclick = () => {
  if (proLocked(padState.tab)) return toast('Draw your signature, or upgrade to Pro to type or upload it.');
  let out = null;
  if (padState.tab === 'draw') {
    const r = strokesToImage(padState.strokes, 3);
    out = r && { src: r.src, aspect: r.aspect };
    if (!out) return toast('Draw your signature in the box first.');
  } else if (padState.tab === 'type') {
    const text = $('#typeInput').value.trim();
    if (!text) { $('#typeInput').focus(); return toast('Type your name first.'); }
    const r = textToImage(text, { font: padState.font, size: 140, color: padState.color });
    out = r && { src: r.src, aspect: r.aspect };
  } else {
    out = padState.uploadResult;
    if (!out) return toast('Choose an image of your signature first.');
  }
  sigDlg.close();
  let libId;
  if ($('#sigRemember').checked) {
    libId = uid();
    library.push({ id: libId, kind: padState.kind, src: out.src, aspect: out.aspect });
    saveLib();
    renderLib();
  }
  if (state.doc) {
    arm({ ...out, widthPx: padState.kind === 'initials' ? 70 : 190, libId, label: padState.kind });
  } else {
    toast('Saved. Open a document, then click it to place it.');
  }
};

// ---- text dialog -------------------------------------------------------------
const textDlg = $('#textDialog');
function openTextDialog() {
  $('#textInput').value = '';
  textDlg.showModal();
  $('#textInput').focus();
}
$('#textCancel').onclick = () => { textDlg.close(); highlightTool('select'); };
const placeText = () => {
  const t = $('#textInput').value.trim();
  textDlg.close();
  if (t) armStamp(stampText(t), 'text');
  else highlightTool('select');
};
$('#textOk').onclick = placeText;
$('#textInput').addEventListener('keydown', e => { if (e.key === 'Enter') placeText(); });

// ===========================================================================
// Export
// ===========================================================================
async function exportPdfFromPdf() {
  const out = await PDFDocument.load(state.doc.data, { ignoreEncryption: true });
  const cache = new Map();
  for (const it of state.items) {
    const p = state.pages[it.page];
    const page = out.getPage(it.page);
    const vp = p.vp;
    const left = it.x * vp.width, top = it.y * vp.height;
    const w = it.w * vp.width, h = it.h * vp.height;
    const [x, y] = vp.convertToPdfPoint(left, top + h);
    if (!cache.has(it.src)) cache.set(it.src, await out.embedPng(it.src));
    page.drawImage(cache.get(it.src), { x, y, width: w, height: h, rotate: degrees(vp.rotation || 0) });
  }
  return out.save();
}

async function exportPdfFromImage() {
  const p = state.pages[0];
  const out = await PDFDocument.create();
  const bg = p.mime === 'image/png' ? await out.embedPng(state.doc.data) : await out.embedJpg(state.doc.data);
  const W = p.natW * 0.75, H = p.natH * 0.75;
  const page = out.addPage([W, H]);
  page.drawImage(bg, { x: 0, y: 0, width: W, height: H });
  for (const it of state.items) {
    const img = await out.embedPng(it.src);
    page.drawImage(img, { x: it.x * W, y: H - (it.y + it.h) * H, width: it.w * W, height: it.h * H });
  }
  return out.save();
}

async function exportPngFromImage() {
  const p = state.pages[0];
  const c = document.createElement('canvas');
  c.width = p.natW;
  c.height = p.natH;
  const ctx = c.getContext('2d');
  ctx.drawImage(p.img, 0, 0);
  for (const it of state.items) {
    const im = await loadImage(it.src);
    ctx.drawImage(im, it.x * c.width, it.y * c.height, it.w * c.width, it.h * c.height);
  }
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

async function exportPdfFromDocx() {
  const p0 = state.pages[0];
  const style = document.createElement('style');
  style.textContent = `@page { size: ${p0.ptW}pt ${p0.ptH}pt; margin: 0; }`;
  document.head.append(style);
  const prevSel = state.sel;
  selectItem(null);
  try {
    return await api.printToPdf();
  } finally {
    style.remove();
    selectItem(prevSel);
  }
}

const NS = {
  w: W_NS,
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
  ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
};
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

function anchorRunXml({ rid, id, x, y, cx, cy }) {
  return `<w:r xmlns:w="${NS.w}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}" xmlns:r="${NS.r}"><w:drawing>` +
    `<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${251660000 + id}" behindDoc="0" locked="0" layoutInCell="0" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/>` +
    `<wp:positionH relativeFrom="page"><wp:posOffset>${x}</wp:posOffset></wp:positionH>` +
    `<wp:positionV relativeFrom="page"><wp:posOffset>${y}</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    `<wp:docPr id="${id}" name="Signature ${id}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="signature${id}.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
}

async function exportDocxAsDocx() {
  const zip = await JSZip.loadAsync(state.doc.data);
  const parse = s => new DOMParser().parseFromString(s, 'application/xml');
  const ser = d => XML_DECL + new XMLSerializer().serializeToString(d).replace(/^<\?xml[^>]*\?>\s*/, '');
  const docDom = parse(await zip.file('word/document.xml').async('string'));
  const relPath = 'word/_rels/document.xml.rels';
  const relDom = parse(zip.file(relPath)
    ? await zip.file(relPath).async('string')
    : `<Relationships xmlns="${NS.rel}"/>`);
  const ctDom = parse(await zip.file('[Content_Types].xml').async('string'));
  const paras = docxParagraphs(docDom);

  if (![...ctDom.documentElement.children].some(e => e.localName === 'Default' && e.getAttribute('Extension')?.toLowerCase() === 'png')) {
    const d = ctDom.createElementNS(NS.ct, 'Default');
    d.setAttribute('Extension', 'png');
    d.setAttribute('ContentType', 'image/png');
    ctDom.documentElement.prepend(d);
  }

  const emu = pt => Math.round(pt * 12700);
  const stamp = Date.now().toString(36);
  let failed = 0;
  state.items.forEach((it, n) => {
    const pg = state.pages[it.page];
    const spans = [...pg.el.querySelectorAll('span[id^="spk_"]')];
    const pick = spans.find(s => !s.closest('td')) || spans[0];
    const para = pick && paras[+pick.id.slice(4)];
    if (!para) { failed++; return; }
    const rid = `rIdHireSign${stamp}${n}`;
    const file = `media/hiresign_${stamp}_${n}.png`;
    zip.file('word/' + file, it.src.split(',')[1], { base64: true });
    const rel = relDom.createElementNS(NS.rel, 'Relationship');
    rel.setAttribute('Id', rid);
    rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image');
    rel.setAttribute('Target', file);
    relDom.documentElement.append(rel);
    const run = parse(anchorRunXml({
      rid, id: 7300000 + n,
      x: emu(it.x * pg.ptW), y: emu(it.y * pg.ptH),
      cx: emu(it.w * pg.ptW), cy: emu(it.h * pg.ptH),
    })).documentElement;
    insertAfterPPr(para, docDom.importNode(run, true));
  });

  zip.file('word/document.xml', ser(docDom));
  zip.file(relPath, ser(relDom));
  zip.file('[Content_Types].xml', ser(ctDom));
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return { bytes, failed };
}

function saveOptions() {
  const t = state.doc?.type;
  if (t === 'pdf') return [{ ext: 'pdf', label: 'Signed PDF', fn: exportPdfFromPdf }];
  if (t === 'docx') return [
    { ext: 'pdf', label: 'PDF (recommended)', note: 'Locks the signature in place — best for sending', fn: exportPdfFromDocx },
    { ext: 'docx', label: 'Word document (.docx)', note: 'Signature added as a picture you can still edit', fn: exportDocxAsDocx },
  ];
  if (t === 'image') return [
    { ext: 'pdf', label: 'PDF', fn: exportPdfFromImage },
    { ext: 'png', label: 'PNG image', fn: exportPngFromImage },
  ];
  return [];
}

async function doSave(opt) {
  $('#saveMenu').hidden = true;
  finishInk();
  if (!state.items.length) return toast('Nothing to save yet — place a signature first.');
  await refreshLicense();
  if (!lic.licensed && lic.trialExpired) return openAbout();
  if (state.doc.type === 'docx' && !lic.pro) return openAbout('Signing Word documents is a Pro feature.');
  busy(true, 'Saving…');
  try {
    let result = await opt.fn();
    let failed = 0;
    if (result && result.bytes) ({ bytes: result, failed } = result);
    const base = (state.doc.path || state.doc.name).replace(/\.[^.\\/]+$/, '');
    busy(false);
    const saved = await api.saveDialog({ defaultPath: `${base} - signed.${opt.ext}`, ext: opt.ext, data: result, source: state.doc.type });
    if (saved?.blocked) { await refreshLicense(); return openAbout(saved.reason === 'pro' ? 'Signing Word documents is a Pro feature.' : null); }
    if (!saved) return;
    setDirty(false);
    toast(`Saved ${saved.split(/[\\/]/).pop()}`, api.isWeb ? undefined : { label: 'Show in folder', fn: () => api.showInFolder(saved) });
    if (failed) alert(`${failed} item(s) could not be anchored in the Word file (their page has no paragraph to attach to). Save as PDF to keep them.`);
  } catch (err) {
    console.error(err);
    alert('Saving failed:\n' + (err?.message || err));
  } finally {
    busy(false);
  }
}

$('#btnSave').addEventListener('click', e => {
  e.stopPropagation();
  const opts = saveOptions();
  if (opts.length === 1) return doSave(opts[0]);
  const m = $('#saveMenu');
  if (!m.hidden) { m.hidden = true; return; }
  m.innerHTML = '';
  for (const o of opts) {
    const b = document.createElement('button');
    b.innerHTML = `${o.label}${o.note ? `<small>${o.note}</small>` : ''}`;
    b.onclick = () => doSave(o);
    m.append(b);
  }
  m.hidden = false;
});
document.addEventListener('click', e => { if (!e.target.closest('.save-wrap')) $('#saveMenu').hidden = true; });

// ===========================================================================
// UI helpers
// ===========================================================================
function showHint(text) {
  const h = $('#hint');
  h.textContent = text || '';
  h.hidden = !text;
}

let toastTimer;
function toast(text, action) {
  const t = $('#toast');
  t.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = text;
  t.append(span);
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = () => { action.fn(); t.hidden = true; };
    t.append(b);
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, action ? 7000 : 3200);
}

function busy(on, text) {
  $('#busy').hidden = !on;
  if (text) $('#busyText').textContent = text;
}

// ===========================================================================
// Licence
// ===========================================================================
let lic = { licensed: false, trialDaysLeft: 14, trialExpired: false, version: '' };
const aboutDlg = $('#aboutDialog');

async function refreshLicense() {
  lic = await api.licenseStatus();
  renderLicense();
}

function renderLicense() {
  const badge = $('#licBadge');
  const basic = lic.licensed && lic.edition === 'Basic';
  const proOwned = lic.licensed && lic.edition === 'Pro';
  const days = n => `${n} day${n === 1 ? '' : 's'}`;
  badge.hidden = proOwned;
  badge.classList.toggle('expired', !!lic.trialExpired);
  badge.classList.toggle('basic', basic);
  badge.textContent = basic
    ? (lic.proTrial ? `Pro trial · ${days(lic.trialDaysLeft)} left` : 'Basic · Upgrade to Pro')
    : lic.trialExpired
      ? 'Trial ended · Activate'
      : `Free trial · ${lic.trialDaysLeft} day${lic.trialDaysLeft === 1 ? '' : 's'} left`;
  $$('#sigTabs .pro-tag').forEach(t => { t.hidden = proOwned; });
  $('#plans').hidden = proOwned;
  $('#plans [data-plan="Basic"]').hidden = basic;
  $$('#plans [data-price]').forEach(p => { p.textContent = lic.prices?.[p.dataset.price] || ''; });
  $('#aboutVersion').textContent = `Version ${lic.version}${lic.licensed ? ' · ' + lic.edition : ''}`;
  const st = $('#licState');
  st.className = 'lic-state ' + (lic.licensed ? 'ok' : lic.trialExpired ? 'bad' : 'warn');
  st.textContent = basic
    ? `HireSign Basic, licensed to ${lic.name || lic.email}. ${lic.proTrial ? `Pro features are included free for ${days(lic.trialDaysLeft)} more.` : 'Upgrade to Pro to sign Word documents and type or upload signatures.'} After buying Pro, paste your Pro key below.`
    : lic.licensed
    ? `Licensed to ${lic.name ? lic.name + (lic.email ? ' (' + lic.email + ')' : '') : lic.email}. Thank you for supporting HireSign!`
    : lic.trialExpired
      ? 'Your free trial has ended. You can still open and view documents — activate a licence to save signed copies.'
      : `You are using the free trial — ${lic.trialDaysLeft} day${lic.trialDaysLeft === 1 ? '' : 's'} left, with every Pro feature included.`;
  $('#licForm').hidden = proOwned;
  $('#licActivate').hidden = proOwned;
  $('#licRemove').hidden = !lic.licensed;
}

function openAbout(notice) {
  $('#licNotice').textContent = notice || '';
  $('#licNotice').hidden = !notice;
  $('#licError').hidden = true;
  $('#licKey').value = '';
  renderLicense();
  aboutDlg.showModal();
  if (!(lic.licensed && lic.edition === 'Pro')) $('#licKey').focus();
}

$('#btnAbout').onclick = () => openAbout();
$('#licBadge').onclick = () => openAbout();
$('#licKey').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#licActivate').click(); } });
$('#aboutClose').onclick = () => aboutDlg.close();
aboutDlg.addEventListener('click', e => {
  const buy = e.target.closest('[data-buy]');
  if (buy) { api.openExternal(buy.dataset.buy === 'pro' ? lic.buyUrlPro : lic.buyUrl); return; }
  const a = e.target.closest('[data-ext]');
  if (a) { e.preventDefault(); api.openExternal(a.dataset.ext); }
});
$('#licActivate').onclick = async () => {
  const r = await api.activate($('#licKey').value);
  if (!r.ok) {
    $('#licError').textContent = r.error;
    $('#licError').hidden = false;
    return;
  }
  lic = { ...r.status, version: lic.version };
  renderLicense();
  $('#licKey').value = '';
  $('#licNotice').hidden = true;
  toast(`HireSign ${lic.edition} is activated — thank you!`);
};
$('#licRemove').onclick = async () => {
  if (!confirm('Remove the licence from this computer? You can activate it again later with the same key.')) return;
  lic = { ...(await api.removeLicense()), version: lic.version };
  renderLicense();
};

// ===========================================================================
// Open / drag-drop / keyboard
// ===========================================================================
const openPicker = async () => openDoc(await api.openDialog());
$('#btnOpen').onclick = openPicker;
$('#btnOpen2').onclick = openPicker;
$('#btnUndo').onclick = undo;
api.onOpenFile(openDoc);

viewer.addEventListener('dragover', e => { e.preventDefault(); viewer.classList.add('dragover'); });
viewer.addEventListener('dragleave', e => { if (!viewer.contains(e.relatedTarget)) viewer.classList.remove('dragover'); });
viewer.addEventListener('drop', async e => {
  e.preventDefault();
  viewer.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (!f) return;
  const p = api.pathForFile(f);
  openDoc(p ? await api.readFile(p) : { name: f.name, path: null, data: new Uint8Array(await f.arrayBuffer()) });
});
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => e.preventDefault());

document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]')) return;
  const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 'o') { e.preventDefault(); openPicker(); return; }
  if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); if (!$('#btnSave').disabled) $('#btnSave').click(); return; }
  if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom(state.zoom * 1.2); return; }
  if (ctrl && e.key === '-') { e.preventDefault(); setZoom(state.zoom / 1.2); return; }
  if (ctrl && e.key === '0') { e.preventDefault(); fitWidth(false); return; }
  if (typing) return;
  if (e.key === 'Escape') {
    if (state.tool === 'ink') finishInk();
    else if (state.armed) disarm();
    else selectItem(null);
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel) { e.preventDefault(); removeItem(state.sel); }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrows[e.key] && state.sel) {
    e.preventDefault();
    const it = state.items.find(i => i.id === state.sel);
    const step = e.shiftKey ? 0.01 : 0.002;
    pushHistory();
    it.x += arrows[e.key][0] * step;
    it.y += arrows[e.key][1] * step;
    renderItems();
    setDirty(true);
  }
});

// ===========================================================================
// Boot
// ===========================================================================
renderLib();
updateButtons();
refreshLicense();
api.startupFile().then(doc => doc && openDoc(doc));

// Test hook (only when launched with HIRESIGN_TEST=1).
api.testMode().then(on => { if (on) window.__hiresign = { state, openDoc, addItem, exportPdfFromPdf, exportDocxAsDocx, exportPdfFromDocx, finishInk, setZoom }; });
