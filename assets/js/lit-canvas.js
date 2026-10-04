/* GCSE Literature: drawing canvas for "Draw the Story".
   LitCanvas.create(container) -> { clear, undo, isEmpty, setTool, setColor, onChange }
   Tools: pen, arrow, circle, label, eraser. Works with mouse, trackpad, touch and stylus
   (Pointer Events; pen pressure when the device reports it). Shapes are kept as objects, so
   undo works and the drawing is redrawn crisply after a resize or rotation. */
(function () {
  'use strict';

  function create(container) {
    var canvas = document.createElement('canvas');
    canvas.className = 'lit-canvas';
    canvas.setAttribute('aria-label', 'Drawing area: sketch the scene');
    canvas.setAttribute('role', 'img');
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var shapes = [], current = null, tool = 'pen', color = '#22d3ee', listeners = [];
    var W = 0, H = 0;

    // Coordinates are stored as 0..1 of the canvas size so drawings survive a resize.
    function resize() {
      var r = container.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }
    var ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(container); else window.addEventListener('resize', resize);

    function pt(e) {
      var r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, p: e.pressure > 0 && e.pointerType === 'pen' ? e.pressure : 0.5 };
    }
    var X = function (p) { return p.x * W; }, Y = function (p) { return p.y * H; };

    function drawShape(s) {
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
      if (s.type === 'pen' || s.type === 'eraser') {
        if (s.type === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000'; }
        var base = s.type === 'eraser' ? 22 : 3.2;
        for (var i = 1; i < s.pts.length; i++) {
          var a = s.pts[i - 1], b = s.pts[i];
          ctx.lineWidth = base * (0.6 + b.p);
          ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke();
        }
        if (s.pts.length === 1) { ctx.beginPath(); ctx.arc(X(s.pts[0]), Y(s.pts[0]), base * 0.6, 0, 7); ctx.fill(); }
      } else if (s.type === 'arrow') {
        var x1 = X(s.a), y1 = Y(s.a), x2 = X(s.b), y2 = Y(s.b), ang = Math.atan2(y2 - y1, x2 - x1), head = 14;
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(ang - 0.45), y2 - head * Math.sin(ang - 0.45));
        ctx.lineTo(x2 - head * Math.cos(ang + 0.45), y2 - head * Math.sin(ang + 0.45));
        ctx.closePath(); ctx.fill();
      } else if (s.type === 'circle') {
        var cx = (X(s.a) + X(s.b)) / 2, cy = (Y(s.a) + Y(s.b)) / 2;
        var rx = Math.abs(X(s.b) - X(s.a)) / 2, ry = Math.abs(Y(s.b) - Y(s.a)) / 2;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx, 4), Math.max(ry, 4), 0, 0, Math.PI * 2); ctx.stroke();
      } else if (s.type === 'label') {
        ctx.font = '600 16px Inter, system-ui, sans-serif'; ctx.textBaseline = 'middle';
        var w = ctx.measureText(s.text).width + 16, x = X(s.a), y = Y(s.a);
        ctx.globalAlpha = 0.18; ctx.fillRect(x - 4, y - 14, w, 28); ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5; ctx.strokeRect(x - 4, y - 14, w, 28);
        ctx.fillText(s.text, x + 4, y + 1);
      }
      ctx.restore();
    }
    function redraw() {
      ctx.clearRect(0, 0, W, H);
      shapes.forEach(drawShape);
      if (current) drawShape(current);
    }
    function changed() { listeners.forEach(function (f) { f(shapes.length); }); }

    // Label tool: a small inline text box at the tap point (works with on-screen keyboards).
    function askLabel(p) {
      var input = document.createElement('input');
      input.type = 'text'; input.maxLength = 40; input.className = 'lit-label-input'; input.placeholder = 'Label…';
      input.style.left = (p.x * 100) + '%'; input.style.top = (p.y * 100) + '%';
      container.appendChild(input); input.focus();
      var done = false;
      function commit() {
        if (done) return; done = true;
        var t = input.value.trim(); input.remove();
        if (t) { shapes.push({ type: 'label', a: p, text: t, color: color }); redraw(); changed(); }
      }
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { input.value = ''; commit(); } });
      input.addEventListener('blur', commit);
    }

    canvas.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      e.preventDefault();
      var p = pt(e);
      if (tool === 'label') { askLabel(p); return; }
      // Keep receiving moves if the finger/pen slides off the canvas. Capture can throw for a
      // pointer the browser no longer treats as active; drawing must still work without it.
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      current = (tool === 'pen' || tool === 'eraser') ? { type: tool, pts: [p], color: color } : { type: tool, a: p, b: p, color: color };
      redraw();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!current) return;
      e.preventDefault();
      // Coalesced samples give smoother lines on fast pens; some devices return none, so fall back.
      var list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (!list.length) list = [e];
      if (current.pts) list.forEach(function (ev) { current.pts.push(pt(ev)); });
      else current.b = pt(e);
      redraw();
    });
    function end() {
      if (!current) return;
      var tiny = current.a && Math.hypot(current.b.x - current.a.x, current.b.y - current.a.y) < 0.01;
      if (!tiny) shapes.push(current);
      current = null; redraw(); changed();
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    resize();
    return {
      setTool: function (t) { tool = t; canvas.dataset.tool = t; },
      setColor: function (c) { color = c; },
      undo: function () { shapes.pop(); redraw(); changed(); },
      clear: function () { shapes = []; redraw(); changed(); },
      isEmpty: function () { return shapes.length === 0; },
      onChange: function (f) { listeners.push(f); },
      destroy: function () { if (ro) ro.disconnect(); canvas.remove(); },
    };
  }

  window.LitCanvas = { create: create };
})();
