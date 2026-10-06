import * as pdfjsLib from './vendor/pdf.min.mjs';
import { buildPdf, prepareImage, parseRanges, chunk, groupLabel } from './pdfops.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
const PDFJS_OPTS = {
  cMapUrl: new URL('./vendor/cmaps/', import.meta.url).href,
  cMapPacked: true,
  standardFontDataUrl: new URL('./vendor/standard_fonts/', import.meta.url).href,
  isEvalSupported: false,
};
const { PDFDocument } = window.PDFLib;

const api = window.hirepdf;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const COLORS = ['#c8372d', '#2563eb', '#0d8a6a', '#b7791f', '#7c3aed', '#db2777', '#0e7490', '#4d7c0f'];
const sources = new Map(); // id -> { id, kind, name, path, size, color, pageCount, bytes, pdfjs, libDoc, image, error, sizes }
let nextSrc = 1;
let pages = []; // [{ key, srcId, index, rotate }]
let nextKey = 1;
const sel = new Set();
let anchor = null;
const undoStack = [];
let lic = { licensed: false, pro: true, trialDaysLeft: 14, trialExpired: false, version: '' };
let afterAdd = null; // quick job follow-up

// ===========================================================================
// Helpers
// ===========================================================================
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(k));
  return e;
};
const svg = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const ICON = {
  rotL: '<svg viewBox="0 0 24 24"><path d="M3 4v5h5"/><path d="M3.5 9A9 9 0 1 1 6 18"/></svg>',
  rotR: '<svg viewBox="0 0 24 24"><path d="M21 4v5h-5"/><path d="M20.5 9A9 9 0 1 0 18 18"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>',
};
const fmtSize = b => (b >= 1024 ** 2 ? (b / 1024 ** 2).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const stem = name => name.replace(/\.[^.]+$/, '');
const dirOf = p => p.replace(/[\\/][^\\/]*$/, '');

let toastTimer;
function toast(msg, actions = []) {
  const t = $('#toast');
  t.replaceChildren(el('span', {}, msg), ...actions.map(a => el('button', { onclick: () => { t.hidden = true; a.fn(); } }, a.label)));
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, actions.length ? 10000 : 5000);
}

function busy(text, frac) {
  $('#busy').hidden = text === null;
  if (text !== null) {
    $('#busyText').textContent = text;
    $('#busyBar').style.width = `${Math.round((frac || 0) * 100)}%`;
  }
}

const markDirty = () => api.setDirty(pages.length > 0);

// ===========================================================================
// Adding files
// ===========================================================================
async function addPaths(paths) {
  if (!paths.length) { afterAdd = null; return; }
  const known = new Set([...sources.values()].map(s => s.path.toLowerCase()));
  const fresh = paths.filter(p => !known.has(p.toLowerCase()));
  if (!fresh.length) { afterAdd = null; return toast('Those files are already open.'); }
  const follow = afterAdd;
  afterAdd = null;
  pushUndo();
  let added = 0;
  try {
    for (let i = 0; i < fresh.length; i++) {
      busy(`Opening ${fresh[i].split(/[\\/]/).pop()}…`, i / fresh.length);
      const src = await openSource(fresh[i]);
      sources.set(src.id, src);
      if (!src.error) {
        for (let k = 0; k < src.pageCount; k++) pages.push({ key: nextKey++, srcId: src.id, index: k, rotate: 0 });
        added++;
      }
    }
  } finally {
    busy(null);
  }
  render();
  markDirty();
  const bad = [...sources.values()].filter(s => s.error && fresh.includes(s.path));
  if (bad.length) toast(bad.length === 1 ? `${bad[0].name}: ${bad[0].error}` : `${bad.length} files couldn't be opened — see the list on the left.`);
  if (follow && added) follow();
}

async function openSource(path) {
  const id = nextSrc++;
  const color = COLORS[(id - 1) % COLORS.length];
  const file = await api.readFile(path);
  const src = { id, kind: file.ext === 'pdf' ? 'pdf' : 'image', name: file.name, path, size: file.size, color, pageCount: 0, sizes: [] };
  try {
    if (src.kind === 'pdf') {
      src.bytes = file.data;
      try {
        src.libDoc = await PDFDocument.load(file.data, { updateMetadata: false });
      } catch (e) {
        if (/encrypt/i.test(e.message)) throw new Error('This PDF is password-protected. Remove the protection first, then add it again.');
        throw new Error('This file is damaged or not a real PDF.');
      }
      src.pdfjs = await pdfjsLib.getDocument({ ...PDFJS_OPTS, data: file.data.slice() }).promise;
      src.pageCount = src.pdfjs.numPages;
      if (!src.pageCount) throw new Error('This PDF has no pages.');
    } else {
      const rgba = ['heic', 'heif'].includes(file.ext) ? await api.decodeHeic(path) : null;
      src.image = await prepareImage(file, rgba);
      src.pageCount = 1;
      src.sizes[0] = { w: src.image.width, h: src.image.height };
    }
  } catch (e) {
    src.error = e.name === 'PasswordException' ? 'This PDF is password-protected. Remove the password first, then add it again.' : e.message || 'Could not open this file.';
  }
  return src;
}

async function pickFiles(kind) { addPaths(await api.pickFiles(kind)); }

function removeSource(id) {
  pushUndo();
  const src = sources.get(id);
  pages = pages.filter(p => p.srcId !== id);
  sources.delete(id);
  src?.pdfjs?.destroy();
  for (const k of [...sel]) if (!pages.some(p => p.key === k)) sel.delete(k);
  render();
  markDirty();
}

// ===========================================================================
// Thumbnails
// ===========================================================================
const thumbs = new Map(); // "srcId:index" -> objectURL
const pending = new Map();
let rendering = 0;
const queue = [];

function requestThumb(srcId, index) {
  const k = `${srcId}:${index}`;
  if (thumbs.has(k) || pending.has(k)) return;
  pending.set(k, true);
  queue.push([srcId, index]);
  pump();
}

async function pump() {
  while (rendering < 2 && queue.length) {
    const [srcId, index] = queue.shift();
    rendering++;
    renderThumb(srcId, index).finally(() => { rendering--; pending.delete(`${srcId}:${index}`); pump(); });
  }
}

async function renderThumb(srcId, index) {
  const src = sources.get(srcId);
  if (!src) return;
  let url;
  if (src.kind === 'image') url = src.image.thumb;
  else {
    const page = await src.pdfjs.getPage(index + 1);
    const vp1 = page.getViewport({ scale: 1 });
    src.sizes[index] = { w: vp1.width, h: vp1.height };
    const scale = Math.min(300 / vp1.width, 380 / vp1.height);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
    url = URL.createObjectURL(blob);
  }
  thumbs.set(`${srcId}:${index}`, url);
  for (const node of $$(`.pg[data-thumb="${srcId}:${index}"]`)) fillSheet(node);
}

const io = new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) {
    const [s, i] = e.target.dataset.thumb.split(':').map(Number);
    requestThumb(s, i);
  }
}, { root: null, rootMargin: '400px' });

function fillSheet(node) {
  const p = pages.find(x => x.key === +node.dataset.key);
  if (!p) return;
  const src = sources.get(p.srcId);
  const size = src.sizes[p.index] || { w: 612, h: 792 };
  const turned = ((p.rotate % 180) + 180) % 180 === 90;
  const a = size.w / size.h;
  const shownA = turned ? 1 / a : a;
  let dw = 150, dh = 150 / shownA;
  if (dh > 190) { dh = 190; dw = 190 * shownA; }
  const sheet = node.querySelector('.sheet');
  const w = turned ? dh : dw;
  const h = turned ? dw : dh;
  const url = thumbs.get(`${p.srcId}:${p.index}`);
  if (!url) { sheet.className = 'sheet loading'; sheet.style.cssText = ''; return; }
  sheet.className = 'sheet';
  sheet.style.cssText = `width:${w}px;height:${h}px;transform:rotate(${p.rotate}deg)`;
  let img = sheet.querySelector('img');
  if (!img) { img = el('img', { alt: '', draggable: 'false' }); sheet.append(img); }
  img.style.cssText = `width:${w}px;height:${h}px`;
  if (img.src !== url) img.src = url;
}

// ===========================================================================
// Rendering
// ===========================================================================
function render() {
  const has = sources.size > 0;
  $('#empty').hidden = has;
  $('#work').hidden = !has;
  $('#bottom').hidden = !has;
  $('#pageTools').hidden = !has;
  renderFiles();
  renderGrid();
  renderBars();
}

function renderFiles() {
  $('#fileList').replaceChildren(...[...sources.values()].map(s => {
    const x = el('button', { class: 'x', title: 'Remove this file and its pages', onclick: () => removeSource(s.id) });
    x.append(svg(ICON.x));
    const count = pages.filter(p => p.srcId === s.id).length;
    const meta = s.error ? el('div', { class: 'err', title: s.error }, s.error)
      : el('div', { class: 'mt' }, s.kind === 'image' ? `Photo · ${fmtSize(s.size)}` : `${count === s.pageCount ? plural(s.pageCount, 'page') : `${count} of ${s.pageCount} pages`} · ${fmtSize(s.size)}`);
    return el('div', { class: 'file', title: s.path },
      el('span', { class: 'dot', style: `background:${s.error ? '#bbb' : s.color}` }),
      el('div', {}, el('div', { class: 'nm' }, s.name), meta), x);
  }));
}

function renderGrid() {
  const grid = $('#grid');
  io.disconnect();
  const nodes = pages.map((p, i) => {
    const src = sources.get(p.srcId);
    const acts = el('div', { class: 'acts' },
      api.touchUI && el('button', { title: 'Move earlier', onclick: e => { e.stopPropagation(); movePages(sel.has(p.key) ? selectedKeys() : [p.key], -1); } }, svg(ICON.left)),
      api.touchUI && el('button', { title: 'Move later', onclick: e => { e.stopPropagation(); movePages(sel.has(p.key) ? selectedKeys() : [p.key], 1); } }, svg(ICON.right)),
      el('button', { title: 'Rotate left', onclick: e => { e.stopPropagation(); rotate([p.key], -90); } }, svg(ICON.rotL)),
      el('button', { title: 'Rotate right', onclick: e => { e.stopPropagation(); rotate([p.key], 90); } }, svg(ICON.rotR)),
      el('button', { title: 'Delete page', onclick: e => { e.stopPropagation(); deletePages([p.key]); } }, svg(ICON.del)));
    const node = el('div', {
      class: 'pg' + (sel.has(p.key) ? ' sel' : ''), draggable: 'true', 'data-key': p.key, 'data-thumb': `${p.srcId}:${p.index}`,
      title: `${src.name}${src.kind === 'pdf' ? ` — page ${p.index + 1}` : ''}`,
    },
    el('div', { class: 'box' }, el('div', { class: 'sheet loading' })),
    el('div', { class: 'label' }, el('b', {}, String(i + 1)), el('span', { class: 'dot', style: `background:${src.color}` }),
      el('span', { style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, src.kind === 'pdf' && sources.size > 1 ? `${stem(src.name)} p${p.index + 1}` : src.kind === 'pdf' ? `page ${p.index + 1}` : stem(src.name))),
    acts);
    fillSheet(node);
    return node;
  });
  grid.replaceChildren(...nodes);
  nodes.forEach(n => io.observe(n));
}

function renderBars() {
  const n = pages.length;
  $('#selInfo').textContent = sel.size ? `${sel.size} of ${plural(n, 'page')} selected` : plural(n, 'page');
  for (const id of ['#btnRotL', '#btnRotR', '#btnDel']) $(id).disabled = !sel.size;
  $('#btnUndo').disabled = !undoStack.length;
  const pdfs = new Set(pages.map(p => p.srcId));
  $('#saveLabel').textContent = pdfs.size > 1 ? 'Merge & save PDF' : 'Save PDF';
  for (const id of ['#btnSave', '#btnSplit', '#btnImages']) $(id).disabled = !n;
  $('#photoSizeOpt').hidden = ![...sources.values()].some(s => s.kind === 'image' && !s.error);
  $$('[data-pro-tag]').forEach(t => { t.hidden = lic.licensed && lic.edition === 'Pro'; });
  $('#summary').textContent = n ? plural(n, 'page') + (pdfs.size > 1 ? ` from ${pdfs.size} files` : '') : 'No pages left';
}

function refreshSelection() {
  for (const node of $$('#grid .pg')) node.classList.toggle('sel', sel.has(+node.dataset.key));
  renderBars();
}

// ===========================================================================
// Editing
// ===========================================================================
function pushUndo() {
  undoStack.push(pages.map(p => ({ ...p })));
  if (undoStack.length > 60) undoStack.shift();
}

function undo() {
  if (!undoStack.length) return;
  pages = undoStack.pop().filter(p => sources.has(p.srcId));
  sel.clear();
  render();
  markDirty();
}

function rotate(keys, deg) {
  if (!keys.length) return;
  pushUndo();
  for (const p of pages) if (keys.includes(p.key)) p.rotate = (((p.rotate + deg) % 360) + 360) % 360;
  for (const node of $$('#grid .pg')) if (keys.includes(+node.dataset.key)) fillSheet(node);
  renderBars();
  markDirty();
}

function deletePages(keys) {
  if (!keys.length) return;
  pushUndo();
  pages = pages.filter(p => !keys.includes(p.key));
  keys.forEach(k => sel.delete(k));
  render();
  markDirty();
  toast(`Deleted ${plural(keys.length, 'page')}.`, [{ label: 'Undo', fn: undo }]);
}

// Move the selected pages one place earlier (-1) or later (+1).
function movePages(keys, dir) {
  const idx = pages.map((p, i) => (keys.includes(p.key) ? i : -1)).filter(i => i >= 0);
  if (!idx.length || (dir < 0 ? idx[0] === 0 : idx[idx.length - 1] === pages.length - 1)) return;
  pushUndo();
  for (const i of dir < 0 ? idx : idx.slice().reverse()) [pages[i], pages[i + dir]] = [pages[i + dir], pages[i]];
  renderGrid();
  renderBars();
  markDirty();
}

const selectedKeys = () => pages.filter(p => sel.has(p.key)).map(p => p.key);

// Selection
$('#grid').addEventListener('click', e => {
  const node = e.target.closest('.pg');
  if (!node) { sel.clear(); refreshSelection(); return; }
  const key = +node.dataset.key;
  if (e.shiftKey && anchor !== null) {
    const a = pages.findIndex(p => p.key === anchor);
    const b = pages.findIndex(p => p.key === key);
    if (!e.ctrlKey) sel.clear();
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) sel.add(pages[i].key);
  } else if (e.ctrlKey || e.metaKey || api.touchUI) {
    sel.has(key) ? sel.delete(key) : sel.add(key);
    anchor = key;
  } else {
    sel.clear();
    sel.add(key);
    anchor = key;
  }
  refreshSelection();
});

// Drag to reorder
let dragKeys = null;
$('#grid').addEventListener('dragstart', e => {
  const node = e.target.closest('.pg');
  if (!node) return;
  const key = +node.dataset.key;
  if (!sel.has(key)) { sel.clear(); sel.add(key); anchor = key; refreshSelection(); }
  dragKeys = selectedKeys();
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('application/x-hirepdf-pages', '1');
  requestAnimationFrame(() => {
    if (dragKeys) $$('#grid .pg').forEach(n => n.classList.toggle('dragging', dragKeys.includes(+n.dataset.key)));
  });
});
const clearDropMarks = () => $$('.drop-before, .drop-after').forEach(n => n.classList.remove('drop-before', 'drop-after'));
let dropTarget = null;
$('#grid').addEventListener('dragover', e => {
  if (!dragKeys) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const node = e.target.closest('.pg') || nearestPg(e.clientX, e.clientY);
  clearDropMarks();
  if (!node) { dropTarget = null; return; }
  const r = node.getBoundingClientRect();
  const after = e.clientX > r.left + r.width / 2;
  node.classList.add(after ? 'drop-after' : 'drop-before');
  dropTarget = { key: +node.dataset.key, after };
});
function nearestPg(x, y) {
  let best = null, bd = Infinity;
  for (const n of $$('#grid .pg')) {
    const r = n.getBoundingClientRect();
    const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
$('#grid').addEventListener('drop', e => {
  if (!dragKeys) return;
  e.preventDefault();
  e.stopPropagation();
  if (dropTarget && !(dragKeys.length === 1 && dragKeys[0] === dropTarget.key)) {
    pushUndo();
    const moving = pages.filter(p => dragKeys.includes(p.key));
    let rest = pages.filter(p => !dragKeys.includes(p.key));
    let at = rest.findIndex(p => p.key === dropTarget.key);
    if (at < 0) {
      // Dropped onto one of the moving pages: keep them where that page was.
      at = pages.findIndex(p => p.key === dropTarget.key) - pages.slice(0, pages.findIndex(p => p.key === dropTarget.key)).filter(p => dragKeys.includes(p.key)).length;
    } else if (dropTarget.after) at++;
    rest.splice(at, 0, ...moving);
    pages = rest;
    renderGrid();
    renderBars();
    markDirty();
  }
});
$('#grid').addEventListener('dragend', () => {
  dragKeys = null;
  dropTarget = null;
  clearDropMarks();
  $$('#grid .dragging').forEach(n => n.classList.remove('dragging'));
});

// ===========================================================================
// Saving
// ===========================================================================
function options() {
  return {
    compress: $('#optCompress').value,
    pageNumbers: $('#optNumbers').checked,
    watermark: $('#optWatermark').value,
    imagePageSize: $('#optPhotoSize').value,
  };
}
const optionsNeedPro = o => o.compress !== 'off' || o.pageNumbers || !!o.watermark.trim();

function gate(needsPro, what) {
  if (!lic.licensed && lic.trialExpired) { openAbout(); return false; }
  if (needsPro && !lic.pro) { openAbout(what || 'Compression, page numbers and watermarks are Pro features.'); return false; }
  return true;
}

function baseName() {
  const used = [...new Set(pages.map(p => p.srcId))].map(id => sources.get(id));
  const first = used[0] || [...sources.values()][0];
  return { first, stem: stem(first.name), many: used.length > 1, dir: dirOf(first.path) };
}

async function blockedReply(r) {
  await refreshLicense();
  openAbout(r.reason === 'pro' ? 'Compression, page numbers, watermarks and saving as pictures are Pro features.' : null);
}

async function savePdf() {
  if (!pages.length) return;
  const o = options();
  if (!gate(optionsNeedPro(o))) return;
  const b = baseName();
  const suffix = b.many ? ' (merged)' : o.compress !== 'off' ? ' (compressed)' : ' (edited)';
  let built;
  try {
    busy('Building your PDF…', 0);
    built = await buildPdf(pages, sources, { ...o, title: b.stem, onProgress: (f, msg) => busy(msg || 'Building your PDF…', f) });
  } catch (e) {
    busy(null);
    return toast('Could not build the PDF: ' + e.message);
  }
  busy(null);
  const r = await api.savePdf({ defaultName: `${b.stem}${suffix}.pdf`, defaultDir: b.dir, data: built.bytes, needsPro: optionsNeedPro(o) });
  if (!r) return;
  if (r.blocked) return blockedReply(r);
  api.setDirty(false);
  const was = !b.many && b.first.kind === 'pdf' ? ` (was ${fmtSize(b.first.size)})` : '';
  toast(`Saved ${r.path.split(/[\\/]/).pop()} — ${fmtSize(r.size)}${was}`, api.isWeb ? [] : [
    { label: 'Open', fn: () => api.openPath(r.path) },
    { label: 'Show in folder', fn: () => api.showInFolder(r.path) },
  ]);
  return r;
}

// ---- Split ----
const splitDlg = $('#splitDialog');
function openSplit() {
  if (!pages.length) return;
  const n = pages.length;
  $('#splitEachInfo').textContent = `${plural(n, 'PDF')}, one page each`;
  const updateChunks = () => {
    const k = Math.max(1, +$('#splitN').value || 1);
    $('#splitChunksInfo').textContent = `${plural(Math.ceil(n / k), 'PDF')}`;
  };
  updateChunks();
  $('#splitN').oninput = () => { updateChunks(); document.querySelector('input[name=split][value=chunks]').checked = true; };
  $('#splitRanges').onfocus = () => { document.querySelector('input[name=split][value=ranges]').checked = true; };
  const s = selectedKeys().length;
  $('#splitSelRow').classList.toggle('disabled', !s);
  $('#splitSelInfo').textContent = s ? `${plural(s, 'page')} selected` : (api.touchUI ? 'Select pages first: tap them' : 'Select pages first (click, Ctrl-click or Shift-click)');
  if (s && s < n) document.querySelector('input[name=split][value=selected]').checked = true;
  else if (!s && document.querySelector('input[name=split][value=selected]').checked) document.querySelector('input[name=split][value=each]').checked = true;
  $('#splitError').hidden = true;
  splitDlg.showModal();
}

function splitGroups() {
  const mode = document.querySelector('input[name=split]:checked').value;
  const n = pages.length;
  if (mode === 'each') return chunk(n, 1).map(g => ({ idx: g, label: groupLabel(g) }));
  if (mode === 'chunks') return chunk(n, Math.max(1, +$('#splitN').value || 1)).map(g => ({ idx: g, label: groupLabel(g) }));
  if (mode === 'selected') {
    const idx = pages.map((p, i) => (sel.has(p.key) ? i : -1)).filter(i => i >= 0);
    return [{ idx, label: 'selected pages' }];
  }
  return parseRanges($('#splitRanges').value, n).map(g => ({ idx: g, label: groupLabel(g) }));
}

async function doSplit() {
  let groups;
  try { groups = splitGroups(); } catch (e) {
    $('#splitError').textContent = e.message;
    $('#splitError').hidden = false;
    return;
  }
  const o = options();
  if (!gate(optionsNeedPro(o))) return;
  splitDlg.close();
  const b = baseName();
  const pick = await api.pickOutputFolder({ defaultDir: b.dir, needsPro: optionsNeedPro(o) });
  if (!pick) return;
  if (pick.blocked) return blockedReply(pick);
  const saved = [];
  try {
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      busy(`Saving PDF ${i + 1} of ${groups.length}…`, i / groups.length);
      const built = await buildPdf(g.idx.map(k => pages[k]), sources, { ...o, title: `${b.stem} - ${g.label}` });
      const r = await api.writeInto({ dir: pick.dir, name: `${b.stem} - ${g.label}.pdf`, data: built.bytes, needsPro: optionsNeedPro(o) });
      if (r.blocked) { busy(null); return blockedReply(r); }
      saved.push(r.path);
    }
  } catch (e) {
    busy(null);
    return toast('Split stopped: ' + e.message);
  }
  busy(null);
  if (api.isWeb) { if (await api.flush()) toast(`Saved ${plural(saved.length, 'PDF')}.`); return; }
  toast(`Saved ${plural(saved.length, 'PDF')}.`, [{ label: 'Open folder', fn: () => api.showInFolder(saved[0]) }]);
}

// ---- Pages to pictures (Pro) ----
const imgDlg = $('#imgDialog');
function openImages() {
  if (!pages.length) return;
  if (!gate(true, 'Saving pages as pictures is a Pro feature.')) return;
  $('#imgInfo').textContent = `${plural(pages.length, 'picture')} will be saved — one per page${sel.size ? ' (all pages, not just the selected ones)' : ''}.`;
  imgDlg.showModal();
}

async function doImages() {
  imgDlg.close();
  const fmt = $('#imgFormat').value;
  const dpi = +$('#imgDpi').value;
  const o = options();
  const b = baseName();
  const pick = await api.pickOutputFolder({ defaultDir: b.dir, needsPro: true });
  if (!pick) return;
  if (pick.blocked) return blockedReply(pick);
  const saved = [];
  let doc;
  try {
    busy('Preparing pages…', 0);
    const built = await buildPdf(pages, sources, { ...o, compress: 'off' });
    doc = await pdfjsLib.getDocument({ ...PDFJS_OPTS, data: built.bytes }).promise;
    for (let i = 1; i <= doc.numPages; i++) {
      busy(`Saving picture ${i} of ${doc.numPages}…`, i / doc.numPages);
      const page = await doc.getPage(i);
      let vp = page.getViewport({ scale: dpi / 72 });
      // Keep very large pages within what a canvas can hold.
      const cap = Math.min(1, 8000 / Math.max(vp.width, vp.height));
      if (cap < 1) vp = page.getViewport({ scale: (dpi / 72) * cap });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await new Promise(r => canvas.toBlob(r, fmt === 'png' ? 'image/png' : 'image/jpeg', 0.9));
      const r = await api.writeInto({ dir: pick.dir, name: `${b.stem} - page ${i}.${fmt}`, data: new Uint8Array(await blob.arrayBuffer()), needsPro: true });
      if (r.blocked) { busy(null); return blockedReply(r); }
      saved.push(r.path);
      canvas.width = canvas.height = 0;
    }
  } catch (e) {
    busy(null);
    return toast('Stopped: ' + e.message);
  } finally {
    doc?.destroy();
  }
  busy(null);
  if (api.isWeb) { if (await api.flush()) toast(`Saved ${plural(saved.length, 'picture')}.`); return; }
  toast(`Saved ${plural(saved.length, 'picture')}.`, [{ label: 'Open folder', fn: () => api.showInFolder(saved[0]) }]);
}

// ===========================================================================
// Controls
// ===========================================================================
$('#btnAdd').onclick = () => pickFiles();
$('#btnAdd2').onclick = () => pickFiles();
$('#dropZone').onclick = () => pickFiles();
$('#btnUndo').onclick = undo;
$('#btnSelAll').onclick = () => { pages.forEach(p => sel.add(p.key)); refreshSelection(); };
$('#btnRotL').onclick = () => rotate(selectedKeys(), -90);
$('#btnRotR').onclick = () => rotate(selectedKeys(), 90);
$('#btnDel').onclick = () => deletePages(selectedKeys());
$('#btnSave').onclick = savePdf;
$('#btnSplit').onclick = openSplit;
$('#btnImages').onclick = openImages;
$('#splitCancel').onclick = () => splitDlg.close();
$('#splitGo').onclick = doSplit;
$('#imgCancel').onclick = () => imgDlg.close();
$('#imgGo').onclick = doImages;

$('#optCompress').addEventListener('change', e => {
  if (e.target.value !== 'off' && !lic.pro) { e.target.value = 'off'; openAbout('Compressing PDFs is a Pro feature.'); }
});
$('#optNumbers').addEventListener('change', e => {
  if (e.target.checked && !lic.pro) { e.target.checked = false; openAbout('Page numbers are a Pro feature.'); }
});
for (const ev of ['mousedown', 'focus', 'input']) {
  $('#optWatermark').addEventListener(ev, e => {
    if (lic.pro) return;
    if (ev === 'mousedown') e.preventDefault();
    e.target.value = '';
    e.target.blur();
    if (!aboutDlg.open) openAbout('Watermarks are a Pro feature.');
  });
}

$$('[data-quick]').forEach(b => {
  b.onclick = () => {
    const job = b.dataset.quick;
    if (job === 'compress') {
      if (!gate(true, 'Compressing PDFs is a Pro feature.')) return;
      $('#optCompress').value = 'light';
      return pickFiles('pdf');
    }
    if (job === 'images') {
      if (!gate(true, 'Saving pages as pictures is a Pro feature.')) return;
      afterAdd = openImages;
      return pickFiles('pdf');
    }
    if (job === 'split') { afterAdd = openSplit; return pickFiles('pdf'); }
    if (job === 'photos') return pickFiles('images');
    return pickFiles('pdf');
  };
});

// Drag files in from Explorer.
let dragDepth = 0;
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; $('#dropOverlay').hidden = false; });
window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; if (--dragDepth <= 0) { dragDepth = 0; $('#dropOverlay').hidden = true; } });
window.addEventListener('drop', async e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  $('#dropOverlay').hidden = true;
  const paths = [...e.dataTransfer.files].map(f => api.pathForFile(f)).filter(Boolean);
  const expanded = await api.expandPaths(paths);
  if (!expanded.length) return toast('HirePDF opens PDFs and photos (JPG, PNG, HEIC…).');
  addPaths(expanded);
});

window.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || !$('#busy').hidden) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  const k = e.key.toLowerCase();
  if (e.ctrlKey && k === 'o') { e.preventDefault(); pickFiles(); return; }
  if (e.ctrlKey && k === 's') { e.preventDefault(); savePdf(); return; }
  if (typing) return;
  if (e.ctrlKey && k === 'z') { e.preventDefault(); undo(); }
  else if (e.ctrlKey && k === 'a') { e.preventDefault(); pages.forEach(p => sel.add(p.key)); refreshSelection(); }
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); deletePages(selectedKeys()); }
  else if (k === 'r' && !e.ctrlKey) rotate(selectedKeys(), e.shiftKey ? -90 : 90);
  else if (k === 'escape') { sel.clear(); refreshSelection(); }
});

// ===========================================================================
// Licence
// ===========================================================================
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
    : lic.trialExpired ? 'Trial ended · Activate' : `Free trial · ${days(lic.trialDaysLeft)} left`;
  $('#plans').hidden = proOwned;
  $('#plans [data-plan="Basic"]').hidden = basic;
  $$('#plans [data-price]').forEach(p => { p.textContent = lic.prices?.[p.dataset.price] || ''; });
  $('#aboutVersion').textContent = `Version ${lic.version}${lic.licensed ? ' · ' + lic.edition : ''}`;
  const st = $('#licState');
  st.className = 'lic-state ' + (lic.licensed ? 'ok' : lic.trialExpired ? 'bad' : 'warn');
  st.textContent = basic
    ? `HirePDF Basic, licensed to ${lic.name || lic.email}. ${lic.proTrial ? `Pro features are included free for ${days(lic.trialDaysLeft)} more.` : 'Upgrade to Pro to compress PDFs, add page numbers and watermarks, and save pages as pictures.'} After buying Pro, paste your Pro key below.`
    : lic.licensed
      ? `Licensed to ${lic.name ? lic.name + (lic.email ? ' (' + lic.email + ')' : '') : lic.email}. Thank you for supporting HirePDF!`
      : lic.trialExpired
        ? 'Your free trial has ended. You can still open and arrange PDFs — activate a licence to save.'
        : `You are using the free trial — ${days(lic.trialDaysLeft)} left, with every Pro feature included.`;
  $('#licForm').hidden = proOwned;
  $('#licActivate').hidden = proOwned;
  $('#licRemove').hidden = !lic.licensed;
  renderBars();
}

function openAbout(notice) {
  $('#licNotice').textContent = notice || '';
  $('#licNotice').hidden = !notice;
  $('#licError').hidden = true;
  $('#licKey').value = '';
  renderLicense();
  if (!aboutDlg.open) aboutDlg.showModal();
  if (!(lic.licensed && lic.edition === 'Pro') && !matchMedia('(pointer: coarse)').matches) $('#licKey').focus();
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
  toast(`HirePDF ${lic.edition} is activated — thank you!`);
};
$('#licRemove').onclick = async () => {
  if (!confirm('Remove the licence from this computer? You can activate it again later with the same key.')) return;
  lic = { ...(await api.removeLicense()), version: lic.version };
  renderLicense();
};

// ===========================================================================
// Start
// ===========================================================================
(async () => {
  await refreshLicense();
  render();
  api.onAddPaths(p => addPaths(p));
  const start = await api.startupPaths();
  if (start.length) addPaths(start);
  if (await api.testMode()) {
    window.__hirepdf = {
      sources, get pages() { return pages; }, sel, addPaths, buildPdf, savePdf, openSplit, splitGroups, rotate, deletePages, undo,
      options, refreshLicense, get lic() { return lic; }, pdfjsLib, PDFJS_OPTS,
    };
  }
})();
