// HirePDF engine: builds output PDFs from an ordered list of pages (from PDFs and photos),
// and adds the Pro extras — compression, page numbers and watermarks.
const { PDFDocument, PDFName, PDFNumber, PDFArray, PDFDict, PDFRawStream, PDFRef, degrees, StandardFonts, rgb } = window.PDFLib;

export const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] };

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------
// A PDF source holds its bytes and a lazily-loaded pdf-lib document.
export async function loadLibDoc(src) {
  if (!src.libDoc) src.libDoc = await PDFDocument.load(src.bytes, { updateMetadata: false });
  return src.libDoc;
}

// EXIF orientation of a JPEG (1 = upright).
export function jpegOrientation(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return 1;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 2;
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) return 1;
    const marker = b[i + 1];
    const len = dv.getUint16(i + 2);
    if (marker === 0xe1 && String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]) === 'Exif') {
      const t = i + 10;
      const le = b[t] === 0x49;
      const u16 = o => dv.getUint16(o, le);
      const u32 = o => dv.getUint32(o, le);
      const ifd = t + u32(t + 4);
      const count = u16(ifd);
      for (let k = 0; k < count; k++) {
        const e = ifd + 2 + k * 12;
        if (e + 12 > b.length) break;
        if (u16(e) === 0x0112) return u16(e + 8) || 1;
      }
      return 1;
    }
    if (marker === 0xda) return 1;
    i += 2 + len;
  }
  return 1;
}

const canvasToBytes = (canvas, type, quality) => new Promise((resolve, reject) => canvas.toBlob(async b => {
  if (!b) return reject(new Error('Could not encode image'));
  resolve(new Uint8Array(await b.arrayBuffer()));
}, type, quality));

function hasAlpha(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 250) return true;
  return false;
}

// Turns a photo file into { type: 'jpg'|'png', bytes, width, height, thumb } ready for pdf-lib.
// rgba = { width, height, data } for HEIC (decoded in the main process).
export async function prepareImage(file, rgba) {
  let canvas;
  let original = null;
  if (rgba) {
    canvas = new OffscreenCanvas(rgba.width, rgba.height);
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.data.buffer, rgba.data.byteOffset, rgba.data.byteLength), rgba.width, rgba.height), 0, 0);
  } else {
    const isJpg = file.ext === 'jpg' || file.ext === 'jpeg';
    const bmp = await createImageBitmap(new Blob([file.data]), { imageOrientation: 'from-image' });
    canvas = new OffscreenCanvas(bmp.width, bmp.height);
    canvas.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close();
    // Use the original bytes when pdf-lib can embed them as they are (no quality loss).
    if (isJpg && jpegOrientation(file.data) === 1) original = { type: 'jpg', bytes: file.data };
    else if (file.ext === 'png') original = { type: 'png', bytes: file.data };
  }
  const { width, height } = canvas;
  let out = original;
  if (!out) {
    const ctx = canvas.getContext('2d');
    const alpha = ['png', 'webp', 'gif'].includes(file.ext) && hasAlpha(ctx, width, height);
    out = alpha
      ? { type: 'png', bytes: new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()) }
      : { type: 'jpg', bytes: new Uint8Array(await (await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 })).arrayBuffer()) };
  }
  const tw = 220;
  const th = Math.max(1, Math.round(tw * height / width));
  const small = new OffscreenCanvas(tw, th);
  const sctx = small.getContext('2d');
  sctx.fillStyle = '#fff';
  sctx.fillRect(0, 0, tw, th);
  sctx.drawImage(canvas, 0, 0, tw, th);
  const blob = await small.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  const thumb = URL.createObjectURL(blob);
  return { ...out, width, height, thumb };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
// pages: [{ srcId, index, rotate }], sources: Map(id -> source), opts: see below.
export async function buildPdf(pages, sources, opts = {}) {
  const { imagePageSize = 'a4', pageNumbers = false, watermark = '', compress = 'off', title = '', onProgress = () => {} } = opts;
  const out = await PDFDocument.create();
  if (title) out.setTitle(title);
  out.setProducer('HirePDF by AutomationHire');
  out.setCreator('HirePDF');

  // Copy PDF pages in one go per source (copyPages shares fonts/images between pages).
  const queues = new Map();
  for (const p of pages) {
    const src = sources.get(p.srcId);
    if (src.kind !== 'pdf') continue;
    if (!queues.has(src.id)) queues.set(src.id, []);
    queues.get(src.id).push(p.index);
  }
  const copied = new Map();
  for (const [id, indices] of queues) {
    const doc = await loadLibDoc(sources.get(id));
    copied.set(id, await out.copyPages(doc, indices));
  }
  const embedded = new Map();
  let n = 0;
  for (const p of pages) {
    const src = sources.get(p.srcId);
    let page;
    if (src.kind === 'pdf') {
      page = out.addPage(copied.get(src.id).shift());
    } else {
      let img = embedded.get(src.id);
      if (!img) {
        img = src.image.type === 'png' ? await out.embedPng(src.image.bytes) : await out.embedJpg(src.image.bytes);
        embedded.set(src.id, img);
      }
      const landscape = img.width > img.height;
      let [pw, ph] = imagePageSize === 'fit'
        ? (landscape ? [841.89, 841.89 * img.height / img.width] : [841.89 * img.width / img.height, 841.89])
        : PAGE_SIZES[imagePageSize] || PAGE_SIZES.a4;
      if (imagePageSize !== 'fit' && landscape) [pw, ph] = [ph, pw];
      page = out.addPage([pw, ph]);
      const s = Math.min(pw / img.width, ph / img.height);
      const w = img.width * s;
      const h = img.height * s;
      page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
    if (p.rotate) page.setRotation(degrees((((page.getRotation().angle + p.rotate) % 360) + 360) % 360));
    onProgress(++n / pages.length * (compress === 'off' ? 0.9 : 0.5), `Adding page ${n} of ${pages.length}`);
  }

  if (pageNumbers || watermark.trim()) {
    const font = await out.embedFont(StandardFonts.Helvetica);
    const bold = watermark.trim() ? await out.embedFont(StandardFonts.HelveticaBold) : null;
    const all = out.getPages();
    all.forEach((page, i) => {
      if (watermark.trim()) drawWatermark(page, bold, watermark.trim());
      if (pageNumbers) drawPageNumber(page, font, `${i + 1} / ${all.length}`);
    });
  }

  let before = 0;
  let after = 0;
  if (compress !== 'off') {
    // Embedded photos are only written into the document on flush, so do it first.
    await out.flush();
    const r = await compressImages(out, compress, (f, msg) => onProgress(0.5 + f * 0.4, msg));
    before = r.before;
    after = r.after;
  }
  onProgress(0.95, 'Writing PDF…');
  const bytes = await out.save({ useObjectStreams: true });
  return { bytes, pageCount: pages.length, imagesBefore: before, imagesAfter: after };
}

// Maps a point on the page as the reader SEES it (u from left, v from bottom, angle in degrees)
// to the page's own unrotated coordinates, so text lands upright whatever /Rotate the page has.
function placeOnPage(page, u, v, angle) {
  const box = page.getCropBox();
  const r = ((page.getRotation().angle % 360) + 360) % 360;
  const W = box.width, H = box.height;
  let x, y;
  if (r === 90) { x = W - v; y = u; } else if (r === 180) { x = W - u; y = H - v; } else if (r === 270) { x = v; y = H - u; } else { x = u; y = v; }
  return { x: box.x + x, y: box.y + y, rotate: degrees(angle + r) };
}

function shownSize(page) {
  const box = page.getCropBox();
  const r = ((page.getRotation().angle % 360) + 360) % 360;
  return r === 90 || r === 270 ? { w: box.height, h: box.width } : { w: box.width, h: box.height };
}

function drawPageNumber(page, font, text) {
  const { w } = shownSize(page);
  const size = Math.max(8, Math.min(11, w / 55));
  const tw = font.widthOfTextAtSize(text, size);
  const pad = 4;
  const at = placeOnPage(page, w / 2 - tw / 2, 18, 0);
  const bg = placeOnPage(page, w / 2 - tw / 2 - pad, 18 - pad, 0);
  page.drawRectangle({ x: bg.x, y: bg.y, width: tw + pad * 2, height: size + pad * 1.6, rotate: bg.rotate, color: rgb(1, 1, 1), opacity: 0.85 });
  page.drawText(text, { x: at.x, y: at.y, size, font, color: rgb(0.2, 0.22, 0.26), rotate: at.rotate });
}

function drawWatermark(page, font, text) {
  const { w, h } = shownSize(page);
  const angle = Math.atan2(h, w) * 180 / Math.PI;
  const diag = Math.hypot(w, h);
  const size = Math.min(110, (diag * 0.7) / Math.max(1, font.widthOfTextAtSize(text, 1)));
  const tw = font.widthOfTextAtSize(text, size);
  const th = size * 0.7;
  const a = angle * Math.PI / 180;
  // Start point so the text's centre sits on the page centre.
  const u = w / 2 - (tw / 2) * Math.cos(a) + (th / 2) * Math.sin(a);
  const v = h / 2 - (tw / 2) * Math.sin(a) - (th / 2) * Math.cos(a);
  const at = placeOnPage(page, u, v, angle);
  page.drawText(text, { x: at.x, y: at.y, size, font, color: rgb(0.75, 0.1, 0.1), opacity: 0.16, rotate: at.rotate });
}

// ---------------------------------------------------------------------------
// Compression: re-encode big photos inside the PDF (text and drawings are untouched).
// ---------------------------------------------------------------------------
const LEVELS = {
  light: { maxSide: 2200, quality: 0.72, flate: false },
  strong: { maxSide: 1400, quality: 0.5, flate: true },
};

const nameOf = v => (v instanceof PDFName ? v.asString().replace(/^\//, '') : null);

function resolve(ctx, v) { return v instanceof PDFRef ? ctx.lookup(v) : v; }

// 'rgb' | 'gray' | null (anything else, e.g. CMYK or indexed, is left alone)
function colourKind(ctx, cs) {
  cs = resolve(ctx, cs);
  const n = nameOf(cs);
  if (n === 'DeviceRGB') return 'rgb';
  if (n === 'DeviceGray') return 'gray';
  if (cs instanceof PDFArray && nameOf(cs.get(0)) === 'ICCBased') {
    const icc = resolve(ctx, cs.get(1));
    const N = icc?.dict?.get(PDFName.of('N'));
    const k = N instanceof PDFNumber ? N.asNumber() : 0;
    return k === 3 ? 'rgb' : k === 1 ? 'gray' : null;
  }
  return null;
}

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate');
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}

// Undo PNG row predictors (DecodeParms /Predictor 10-15).
function unpredict(data, width, colors, height) {
  const bpp = colors;
  const row = width * bpp;
  const out = new Uint8Array(row * height);
  let prev = new Uint8Array(row);
  for (let y = 0; y < height; y++) {
    const f = data[y * (row + 1)];
    const line = data.subarray(y * (row + 1) + 1, (y + 1) * (row + 1));
    const cur = out.subarray(y * row, (y + 1) * row);
    for (let i = 0; i < row; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    prev = cur;
  }
  return out;
}

async function decodeImage(ctx, dict, contents, kind) {
  const filter = resolve(ctx, dict.get(PDFName.of('Filter')));
  const fname = filter instanceof PDFArray ? (filter.size() === 1 ? nameOf(filter.get(0)) : null) : nameOf(filter);
  const W = dict.get(PDFName.of('Width'))?.asNumber?.();
  const H = dict.get(PDFName.of('Height'))?.asNumber?.();
  if (fname === 'DCTDecode') {
    return createImageBitmap(new Blob([contents], { type: 'image/jpeg' }), { imageOrientation: 'none' });
  }
  if (fname === 'FlateDecode') {
    const bpc = dict.get(PDFName.of('BitsPerComponent'))?.asNumber?.();
    if (bpc !== 8 || !W || !H) return null;
    const parms = resolve(ctx, dict.get(PDFName.of('DecodeParms')));
    const predictor = parms instanceof PDFDict ? parms.get(PDFName.of('Predictor'))?.asNumber?.() || 1 : 1;
    if (predictor !== 1 && predictor < 10) return null;
    const colors = kind === 'rgb' ? 3 : 1;
    let raw = await inflate(contents);
    if (predictor >= 10) raw = unpredict(raw, W, colors, H);
    if (raw.length < W * H * colors) return null;
    const rgba = new Uint8ClampedArray(W * H * 4);
    for (let i = 0, j = 0; i < W * H; i++, j += colors) {
      rgba[i * 4] = raw[j];
      rgba[i * 4 + 1] = raw[colors === 3 ? j + 1 : j];
      rgba[i * 4 + 2] = raw[colors === 3 ? j + 2 : j];
      rgba[i * 4 + 3] = 255;
    }
    return createImageBitmap(new ImageData(rgba, W, H));
  }
  return null;
}

export async function compressImages(doc, level, onProgress = () => {}) {
  const cfg = LEVELS[level];
  const ctx = doc.context;
  const images = ctx.enumerateIndirectObjects().filter(([, obj]) => obj instanceof PDFRawStream
    && nameOf(obj.dict.get(PDFName.of('Subtype'))) === 'Image');
  let before = 0, after = 0, done = 0;
  for (const [ref, obj] of images) {
    done++;
    onProgress(done / images.length, `Compressing image ${done} of ${images.length}`);
    const dict = obj.dict;
    const size = obj.contents.length;
    before += size;
    const W = dict.get(PDFName.of('Width'))?.asNumber?.() || 0;
    const H = dict.get(PDFName.of('Height'))?.asNumber?.() || 0;
    const skip = !W || !H || W * H < 90000 || size < 40000
      || dict.get(PDFName.of('ImageMask'))?.asBoolean?.() || dict.has(PDFName.of('Decode')) || dict.has(PDFName.of('Mask'));
    const kind = skip ? null : colourKind(ctx, dict.get(PDFName.of('ColorSpace')));
    const filter = resolve(ctx, dict.get(PDFName.of('Filter')));
    const isFlate = (filter instanceof PDFArray ? nameOf(filter.get(0)) : nameOf(filter)) === 'FlateDecode';
    // Lossless images are often screenshots or diagrams: Light only touches really big ones.
    if (!kind || (isFlate && !cfg.flate && size < 1_000_000)) { after += size; continue; }
    let bmp = null;
    try { bmp = await decodeImage(ctx, dict, obj.contents, kind); } catch { bmp = null; }
    if (!bmp) { after += size; continue; }
    const s = Math.min(1, cfg.maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * s));
    const h = Math.max(1, Math.round(bmp.height * s));
    const canvas = new OffscreenCanvas(w, h);
    const c2d = canvas.getContext('2d');
    c2d.imageSmoothingQuality = 'high';
    c2d.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const jpeg = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/jpeg', quality: cfg.quality })).arrayBuffer());
    if (jpeg.length > size * 0.9) { after += size; continue; }
    const fields = { Type: 'XObject', Subtype: 'Image', Width: w, Height: h, ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'DCTDecode' };
    const stream = ctx.stream(jpeg, fields);
    for (const key of ['SMask', 'Intent', 'Interpolate', 'Metadata']) {
      const v = dict.get(PDFName.of(key));
      if (v) stream.dict.set(PDFName.of(key), v);
    }
    ctx.assign(ref, stream);
    after += jpeg.length;
  }
  return { before, after, count: images.length };
}

// ---------------------------------------------------------------------------
// Split helpers
// ---------------------------------------------------------------------------
// "1-3, 5, 8-" -> [[0,1,2],[4],[7..n-1]] (0-based). Throws a friendly error on nonsense.
export function parseRanges(text, n) {
  const groups = [];
  for (const part of text.split(/[,;]+/).map(s => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d*)\s*(?:-|–|to)\s*(\d*)$/i) || part.match(/^(\d+)$/);
    if (!m) throw new Error(`"${part}" isn't a page range. Use something like 1-3, 5, 8-`);
    let a, b;
    if (m.length === 2) a = b = +m[1];
    else { a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : n; }
    if (a < 1 || b > n || a > b) throw new Error(`"${part}" is outside pages 1–${n}.`);
    groups.push(Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i));
  }
  if (!groups.length) throw new Error('Type the pages you want, like 1-3, 5, 8-');
  return groups;
}

export function chunk(n, size) {
  const groups = [];
  for (let i = 0; i < n; i += size) groups.push(Array.from({ length: Math.min(size, n - i) }, (_, k) => i + k));
  return groups;
}

export const groupLabel = g => (g.length === 1 ? `page ${g[0] + 1}` : `pages ${g[0] + 1}-${g[g.length - 1] + 1}`);
