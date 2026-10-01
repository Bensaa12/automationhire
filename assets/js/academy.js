/* Jarvis Academy page behaviour: level tabs, stat animation, "Try Jarvis" demo.
   The demo calls /api/academy-tutor (real AI, 3 free learner turns). Nothing else here is faked. */
(function () {
  'use strict';

  /* ---------- Level tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.ja-tab'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.ja-panel'));
  function showLevel(id, scroll) {
    if (!document.getElementById(id)) return;
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.level === id)); t.tabIndex = t.dataset.level === id ? 0 : -1; });
    panels.forEach(function (p) { p.hidden = p.id !== id; });
    setDemoLevel(id);
    if (scroll) document.getElementById('modes').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { showLevel(t.dataset.level); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      var n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); showLevel(n.dataset.level);
    });
  });
  document.querySelectorAll('[data-pick-level]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); history.replaceState(null, '', '#' + a.dataset.pickLevel); showLevel(a.dataset.pickLevel, true); });
  });
  function fromHash() {
    var h = location.hash.replace('#', '');
    if (['primary', 'secondary', 'university'].indexOf(h) > -1) { showLevel(h); setTimeout(function () { document.getElementById('modes').scrollIntoView(); }, 0); }
  }
  window.addEventListener('hashchange', fromHash);

  /* ---------- Animate bars / counters when visible ---------- */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.querySelectorAll('.ja-bar i[data-w]').forEach(function (b) { b.style.width = b.dataset.w + '%'; });
      en.target.querySelectorAll('[data-count]').forEach(function (el) {
        var to = +el.dataset.count, suffix = el.dataset.suffix || '';
        if (reduce) { el.textContent = to + suffix; return; }
        var t0 = performance.now();
        (function step(t) { var p = Math.min(1, (t - t0) / 1100); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suffix; if (p < 1) requestAnimationFrame(step); })(t0);
      });
      io.unobserve(en.target);
    });
  }, { threshold: 0.25 }) : null;
  document.querySelectorAll('[data-animate]').forEach(function (el) {
    if (io) io.observe(el); else el.querySelectorAll('.ja-bar i[data-w]').forEach(function (b) { b.style.width = b.dataset.w + '%'; });
  });

  /* ---------- Waveform bars ---------- */
  var wave = document.getElementById('jaWave');
  if (wave) for (var i = 0; i < 34; i++) { var b = document.createElement('i'); b.style.animationDelay = (i * 0.07 % 1.2).toFixed(2) + 's'; b.style.animationDuration = (0.9 + (i % 5) * 0.14).toFixed(2) + 's'; wave.appendChild(b); }

  /* ---------- Try Jarvis demo ---------- */
  var MAX_TURNS = 3;
  var box = document.getElementById('jaMsgs'), form = document.getElementById('jaForm'), input = document.getElementById('jaInput');
  var head = document.getElementById('jaChatHead'), gate = document.getElementById('jaGate'), left = document.getElementById('jaLeft');
  var level = 'secondary', history_ = [], busy = false, used = 0;
  var greet = {
    primary: 'Hello there! I am Jarvis. Tell me what you would like to learn today, and we will work it out together.',
    secondary: 'Good evening, sir. Give me a subject and a question. I shall attempt to make learning slightly less painful.',
    university: 'Good evening. Tell me what you are studying and where you are stuck, and we shall begin with your own thinking.'
  };
  var quick = { EXPLAIN: 'Explain it to me step by step.', HINT: 'Give me a hint, but not the full answer.', QUIZ: 'Quiz me on this with one question.', EXAMPLE: 'Show me a worked example on a different problem.' };

  function add(role, text) {
    var d = document.createElement('div'); d.className = 'ja-msg ' + role;
    if (role === 'bot') { var w = document.createElement('span'); w.className = 'ja-who'; w.textContent = 'JARVIS'; d.appendChild(w); }
    d.appendChild(document.createTextNode(text)); box.appendChild(d); box.scrollTop = box.scrollHeight; return d;
  }
  function setLocked(v) { input.disabled = v; form.querySelector('button').disabled = v; document.querySelectorAll('.ja-quick button').forEach(function (b) { b.disabled = v; }); }
  function setLeft() { left.textContent = Math.max(0, MAX_TURNS - used) + ' of ' + MAX_TURNS + ' free questions left'; }

  function resetDemo() {
    if (!box) return;
    box.innerHTML = ''; history_ = []; used = 0; gate.hidden = true; setLocked(false); setLeft();
    add('bot', greet[level]);
  }
  function setDemoLevel(id) {
    if (!box || id === level) return;
    level = id;
    document.querySelectorAll('.ja-level-pick button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.level === id)); });
    if (used === 0) resetDemo();
  }

  function send(text) {
    text = (text || '').trim();
    if (!text || busy || used >= MAX_TURNS) return;
    busy = true; used++; setLeft(); setLocked(true);
    add('user', text); history_.push({ role: 'user', content: text });
    var wait = add('bot', ''); wait.innerHTML += '<span class="ja-typing"><i></i><i></i><i></i></span>';
    head.classList.add('speaking');
    fetch('/api/academy-tutor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: level, messages: history_ }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        wait.remove();
        if (!res.ok || res.j.ok === false) { used--; history_.pop(); setLeft(); add('bot', res.j.error || 'Jarvis is unavailable at the moment. Please try again shortly.'); return; }
        add('bot', res.j.reply); history_.push({ role: 'assistant', content: res.j.reply });
      })
      .catch(function () { wait.remove(); used--; history_.pop(); setLeft(); add('bot', 'I could not reach the server. Please check your connection and try again.'); })
      .then(function () {
        busy = false; head.classList.remove('speaking'); input.value = '';
        if (used >= MAX_TURNS) { gate.hidden = false; setLocked(true); } else { setLocked(false); input.focus(); }
      });
  }

  if (form) {
    form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
    document.querySelectorAll('.ja-quick button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!history_.length) { input.focus(); add('bot', 'Do tell me the topic first, then press that button.'); return; }
        send(quick[b.dataset.q]);
      });
    });
    document.querySelectorAll('.ja-level-pick button').forEach(function (b) {
      b.addEventListener('click', function () { if (used > 0) { used = 0; } level = ''; setDemoLevel(b.dataset.level); resetDemo(); });
    });
    document.querySelectorAll('[data-example]').forEach(function (b) {
      b.addEventListener('click', function () { input.value = b.dataset.example; input.focus(); });
    });
    resetDemo();
  }

  fromHash();
})();
