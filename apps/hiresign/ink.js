// Shared ink engine: captures pointer strokes (mouse / pen / touch) and renders them
// as smooth, variable-width lines. Pen pressure drives width when available;
// otherwise stroke speed does (fast = thinner), which reads like real handwriting.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function nextWidth(stroke, pt, prev) {
  const size = stroke.size;
  let target;
  if (stroke.pen) {
    target = size * (0.3 + 1.1 * clamp(pt.p, 0, 1));
  } else if (!prev) {
    target = size * 0.9;
  } else {
    const dt = Math.max(1, pt.t - prev.t);
    const v = Math.hypot(pt.x - prev.x, pt.y - prev.y) / dt;
    target = size * clamp(1.3 - 0.35 * v * stroke.unit, 0.45, 1.3); // v*unit = CSS px per ms
  }
  return prev ? prev.w * 0.6 + target * 0.4 : target;
}

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Draw segment i of a stroke (the curve ending near point i).
function drawSegment(ctx, pts, i, s, ox, oy) {
  const a = i === 1 ? pts[0] : mid(pts[i - 2], pts[i - 1]);
  const c = pts[i - 1];
  const b = mid(pts[i - 1], pts[i]);
  ctx.lineWidth = Math.max(0.5, ((pts[i - 1].w + pts[i].w) / 2) * s);
  ctx.beginPath();
  ctx.moveTo(a.x * s + ox, a.y * s + oy);
  ctx.quadraticCurveTo(c.x * s + ox, c.y * s + oy, b.x * s + ox, b.y * s + oy);
  ctx.stroke();
}

function drawTail(ctx, pts, s, ox, oy) {
  const n = pts.length;
  if (n < 2) return;
  const a = mid(pts[n - 2], pts[n - 1]);
  const b = pts[n - 1];
  ctx.lineWidth = Math.max(0.5, b.w * s);
  ctx.beginPath();
  ctx.moveTo(a.x * s + ox, a.y * s + oy);
  ctx.lineTo(b.x * s + ox, b.y * s + oy);
  ctx.stroke();
}

function prep(ctx, stroke) {
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

export function renderStroke(ctx, stroke, s = 1, ox = 0, oy = 0) {
  const pts = stroke.points;
  if (!pts.length) return;
  prep(ctx, stroke);
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x * s + ox, pts[0].y * s + oy, Math.max(0.5, (pts[0].w * s) / 2), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = 1; i < pts.length; i++) drawSegment(ctx, pts, i, s, ox, oy);
  drawTail(ctx, pts, s, ox, oy);
}

export function strokesBounds(strokes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const st of strokes) {
    for (const p of st.points) {
      const r = p.w / 2 + 1;
      x0 = Math.min(x0, p.x - r); y0 = Math.min(y0, p.y - r);
      x1 = Math.max(x1, p.x + r); y1 = Math.max(y1, p.y + r);
    }
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Rasterise strokes into a tightly cropped transparent PNG.
export function strokesToImage(strokes, pxPerUnit = 3) {
  const b = strokesBounds(strokes);
  if (!b) return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(b.w * pxPerUnit));
  c.height = Math.max(1, Math.ceil(b.h * pxPerUnit));
  const ctx = c.getContext('2d');
  for (const st of strokes) renderStroke(ctx, st, pxPerUnit, -b.x * pxPerUnit, -b.y * pxPerUnit);
  return { src: c.toDataURL('image/png'), bounds: b, aspect: c.height / c.width };
}

/**
 * Attach stroke capture to an element.
 * opts.toLocal(e)  -> {x, y} in stroke units
 * opts.style()     -> {color, size, unit}  (unit = CSS px per stroke unit, for speed normalisation)
 * opts.accept(e)   -> bool, whether this pointer may draw
 * opts.onStart(stroke) / opts.onPoint(stroke, i) / opts.onEnd(stroke)
 */
export function captureInk(el, opts) {
  let active = null;
  let pid = null;

  const push = e => {
    const { x, y } = opts.toLocal(e);
    const pts = active.points;
    const prev = pts[pts.length - 1];
    if (prev && Math.hypot(x - prev.x, y - prev.y) < 0.35 / active.unit) return;
    const pt = { x, y, p: e.pressure || 0.5, t: e.timeStamp };
    pt.w = nextWidth(active, pt, prev);
    pts.push(pt);
    opts.onPoint?.(active, pts.length - 1);
  };

  el.addEventListener('pointerdown', e => {
    if (active || (opts.accept && !opts.accept(e))) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const st = opts.style();
    active = {
      color: st.color,
      size: st.size,
      unit: st.unit || 1,
      pen: e.pointerType === 'pen' && e.pressure > 0 && e.pressure !== 0.5,
      points: [],
    };
    pid = e.pointerId;
    el.setPointerCapture(pid);
    opts.onStart?.(active, e);
    push(e);
  });

  el.addEventListener('pointermove', e => {
    if (!active || e.pointerId !== pid) return;
    e.preventDefault();
    if (e.pointerType === 'pen' && e.pressure > 0 && e.pressure !== 0.5) active.pen = true;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ce of evs.length ? evs : [e]) push(ce);
  });

  const end = e => {
    if (!active || e.pointerId !== pid) return;
    const st = active;
    active = null;
    try { el.releasePointerCapture(pid); } catch {}
    opts.onEnd?.(st);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

export function drawIncrement(ctx, stroke, i, s = 1) {
  prep(ctx, stroke);
  const pts = stroke.points;
  if (i === 0) {
    ctx.beginPath();
    ctx.arc(pts[0].x * s, pts[0].y * s, Math.max(0.5, (pts[0].w * s) / 2), 0, Math.PI * 2);
    ctx.fill();
  } else {
    drawSegment(ctx, pts, i, s, 0, 0);
  }
}

export function drawEnd(ctx, stroke, s = 1) {
  prep(ctx, stroke);
  drawTail(ctx, stroke.points, s, 0, 0);
}

// ---- image helpers -------------------------------------------------------

export function trimCanvas(c, pad = 4) {
  const ctx = c.getContext('2d');
  const { width: w, height: h } = c;
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export function textToImage(text, { font = 'Segoe UI', size = 64, color = '#000', weight = '400' } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const f = `${weight} ${size}px "${font}"`;
  ctx.font = f;
  const m = ctx.measureText(text);
  c.width = Math.ceil(m.width + size);
  c.height = Math.ceil(size * 1.9);
  ctx.font = f;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, c.height / 2);
  const t = trimCanvas(c, Math.round(size * 0.08));
  return t ? { src: t.toDataURL('image/png'), aspect: t.height / t.width, width: t.width } : null;
}

export function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}
