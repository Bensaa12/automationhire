/* Jarvis Academy page behaviour: level tabs, stat animation, "Try Jarvis" demo.
   The demo calls /api/academy/* (real AI; 3 free turns anonymous, accounts via Supabase). Nothing else here is faked. */
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

  /* ---------- Try Jarvis demo + accounts ---------- */
  var ANON_TURNS = 3, USER_TURNS = 20;
  var box = document.getElementById('jaMsgs'), form = document.getElementById('jaForm'), input = document.getElementById('jaInput');
  var head = document.getElementById('jaChatHead'), gate = document.getElementById('jaGate'), left = document.getElementById('jaLeft');
  var level = 'secondary', history_ = [], busy = false, used = 0, sessionId = newId();
  var auth = loadAuth();
  var greet = {
    primary: 'Hello there! I am Jarvis. Tell me what you would like to learn today, and we will work it out together.',
    secondary: 'Good evening, sir. Give me a subject and a question. I shall attempt to make learning slightly less painful.',
    university: 'Good evening. Tell me what you are studying and where you are stuck, and we shall begin with your own thinking.'
  };
  var quick = { EXPLAIN: 'Explain it to me step by step.', HINT: 'Give me a hint, but not the full answer.', QUIZ: 'Quiz me on this with one question.', EXAMPLE: 'Show me a worked example on a different problem.' };

  function newId() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }
  function loadAuth() { try { return JSON.parse(localStorage.getItem('ja_auth') || 'null'); } catch (e) { return null; } }
  function saveAuth(a) { auth = a; try { if (a) localStorage.setItem('ja_auth', JSON.stringify(a)); else localStorage.removeItem('ja_auth'); } catch (e) {} renderAuth(); }
  function maxTurns() { return auth ? USER_TURNS : ANON_TURNS; }

  function api(op, body, method) {
    var h = { 'Content-Type': 'application/json' };
    if (auth && auth.access_token) h.Authorization = 'Bearer ' + auth.access_token;
    return fetch('/api/academy/' + op, { method: method || 'POST', headers: h, body: method === 'GET' ? undefined : JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.ok !== false, status: j.status || r.status, j: j }; }); });
  }
  // Retry once with a refreshed token if the access token has expired.
  function apiAuthed(op, body, method) {
    return api(op, body, method).then(function (res) {
      if (res.status !== 401 || !auth || !auth.refresh_token) return res;
      return api('refresh', { refresh_token: auth.refresh_token }).then(function (rr) {
        if (!rr.ok) { saveAuth(null); return res; }
        auth.access_token = rr.j.access_token; auth.refresh_token = rr.j.refresh_token; saveAuth(auth);
        return api(op, body, method);
      });
    });
  }

  function add(role, text) {
    var d = document.createElement('div'); d.className = 'ja-msg ' + role;
    if (role === 'bot') { var w = document.createElement('span'); w.className = 'ja-who'; w.textContent = 'JARVIS'; d.appendChild(w); }
    d.appendChild(document.createTextNode(text)); box.appendChild(d); box.scrollTop = box.scrollHeight; return d;
  }
  function setLocked(v) { input.disabled = v; form.querySelector('button').disabled = v; document.querySelectorAll('.ja-quick button').forEach(function (b) { b.disabled = v; }); }
  function setLeft() { if (!left) return; left.textContent = auth ? 'Signed in: ' + Math.max(0, USER_TURNS - used) + ' questions left in this session' : Math.max(0, ANON_TURNS - used) + ' of ' + ANON_TURNS + ' free questions left'; }

  function resetDemo() {
    if (!box) return;
    box.innerHTML = ''; history_ = []; used = 0; sessionId = newId(); gate.hidden = true; setLocked(false); setLeft();
    add('bot', greet[level]);
  }
  function setDemoLevel(id) {
    if (!box || id === level) return;
    level = id;
    document.querySelectorAll('.ja-level-pick button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.level === id)); });
    if (used === 0) resetDemo();
  }
  function showGate(text, mode, hideBtn) {
    document.getElementById('jaGateText').textContent = text;
    var b = document.getElementById('jaGateBtn'); b.textContent = mode === 'login' ? 'SIGN IN' : 'CREATE FREE ACCOUNT'; b.dataset.mode = mode; b.hidden = !!hideBtn;
    gate.hidden = false; setLocked(true);
  }

  function send(text) {
    text = (text || '').trim();
    if (!text || busy || used >= maxTurns()) return;
    busy = true; used++; setLeft(); setLocked(true);
    add('user', text); history_.push({ role: 'user', content: text });
    var wait = add('bot', ''); wait.innerHTML += '<span class="ja-typing"><i></i><i></i><i></i></span>';
    head.classList.add('speaking');
    var undo = function () { used--; history_.pop(); setLeft(); };
    var wasAuth = !!auth;
    apiAuthed('tutor', { level: level, session_id: sessionId, messages: history_ })
      .then(function (res) {
        wait.remove();
        if (res.status === 401 && wasAuth) { undo(); showGate('Your session has expired. Please sign in again.', 'login'); return; }
        if (!res.ok) { undo(); add('bot', res.j.error || 'Jarvis is unavailable at the moment. Please try again shortly.'); return; }
        if (res.j.limit) { undo(); add('bot', res.j.reply); showGate(res.j.limit === 'anon' ? 'Create a free account to keep going. Jarvis will remember what you work on.' : res.j.reply, 'signup', res.j.limit !== 'anon'); return; }
        add('bot', res.j.reply); history_.push({ role: 'assistant', content: res.j.reply });
        if (res.j.learned && auth) loadBrain();
      })
      .catch(function () { wait.remove(); undo(); add('bot', 'I could not reach the server. Please check your connection and try again.'); })
      .then(function () {
        busy = false; head.classList.remove('speaking'); input.value = '';
        if (!auth && used >= ANON_TURNS) showGate('Create a free account to keep going. Jarvis will remember what you work on.', 'signup');
        else if (gate.hidden) { setLocked(false); input.focus(); }
      });
  }

  /* Learning Brain (live, signed-in only) */
  function loadBrain() {
    if (!auth) return;
    apiAuthed('me', null, 'GET').then(function (res) {
      if (!res.ok) return;
      var b = res.j.brain, rows = document.getElementById('jaBrainRows'); rows.innerHTML = '';
      var skills = b.skills.filter(function (s) { return s.attempts > 0; }).sort(function (a, c) { return a.confidence - c.confidence; });
      skills.slice(0, 8).forEach(function (s) {
        var r = document.createElement('div'); r.className = 'ja-bar-row';
        var n = document.createElement('span'); n.textContent = s.topic; var sm = document.createElement('small'); sm.textContent = s.subject; n.appendChild(sm);
        var bar = document.createElement('div'); bar.className = 'ja-bar'; var i = document.createElement('i'); if (s.confidence < 60) i.className = 'warn'; i.style.width = s.confidence + '%'; bar.appendChild(i);
        var p = document.createElement('b'); p.textContent = s.confidence + '%';
        r.appendChild(n); r.appendChild(bar); r.appendChild(p); rows.appendChild(r);
      });
      var weak = skills[0], used_ = b.sessionsThisMonth + ' of ' + b.sessionLimit + ' free sessions used this month.';
      document.getElementById('jaBrainNote').textContent = skills.length
        ? (weak.confidence < 60 ? 'Jarvis suggests next: ' + weak.topic + ' (' + weak.subject + '). ' : '') + used_
        : 'Nothing yet. Answer one of Jarvis’s questions and your first topic will appear here. ' + used_;
      document.getElementById('jaBrainLive').hidden = false;
    });
  }

  function renderAuth() {
    var t = document.getElementById('jaAuthText'); if (!t) return;
    document.getElementById('jaSignIn').hidden = !!auth; document.getElementById('jaSignUp').hidden = !!auth; document.getElementById('jaSignOut').hidden = !auth;
    t.textContent = auth ? 'Signed in as ' + ((auth.profile && auth.profile.display_name) || 'student') : 'Free demo · 3 questions';
    if (!auth) document.getElementById('jaBrainLive').hidden = true;
    setLeft();
  }

  /* Auth dialog */
  var dlg = document.getElementById('jaAuth'), mode = 'signup';
  function openAuth(m) {
    mode = m; var s = m === 'signup';
    document.getElementById('jaAuthTitle').textContent = s ? 'Create your free account' : 'Welcome back';
    document.getElementById('jaAuthSubmit').textContent = s ? 'CREATE ACCOUNT' : 'SIGN IN';
    document.getElementById('jaAuthSwap').textContent = s ? 'I already have an account' : 'Create a new account';
    ['jaNameWrap', 'jaLevelWrap', 'jaGuardWrap'].forEach(function (id) { document.getElementById(id).hidden = !s; });
    document.getElementById('jaPass').autocomplete = s ? 'new-password' : 'current-password';
    document.getElementById('jaLevelSel').value = level;
    var e = document.getElementById('jaAuthErr'); e.hidden = true; e.style.color = '';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function authMsg(msg, good) { var e = document.getElementById('jaAuthErr'); e.textContent = msg; e.style.color = good ? 'var(--green)' : ''; e.hidden = false; }

  if (dlg) {
    document.getElementById('jaSignIn').addEventListener('click', function () { openAuth('login'); });
    document.getElementById('jaSignUp').addEventListener('click', function () { openAuth('signup'); });
    document.getElementById('jaGateBtn').addEventListener('click', function (e) { openAuth(e.currentTarget.dataset.mode || 'signup'); });
    document.getElementById('jaAuthClose').addEventListener('click', function () { dlg.close(); });
    document.getElementById('jaAuthSwap').addEventListener('click', function () { openAuth(mode === 'signup' ? 'login' : 'signup'); });
    document.getElementById('jaSignOut').addEventListener('click', function () { saveAuth(null); resetDemo(); });
    document.getElementById('jaAuthForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = document.getElementById('jaAuthSubmit'); btn.disabled = true;
      var body = { email: document.getElementById('jaEmail').value, password: document.getElementById('jaPass').value };
      if (mode === 'signup') { body.display_name = document.getElementById('jaName').value; body.level = document.getElementById('jaLevelSel').value; body.guardian_confirmed = document.getElementById('jaGuard').checked; }
      var prev = auth; auth = null;
      api(mode, body).then(function (res) {
        btn.disabled = false;
        if (!res.ok) { auth = prev; authMsg(res.j.error || 'Something went wrong. Please try again.'); return; }
        if (res.j.needs_confirmation) { auth = prev; authMsg('Almost there! Check your email for a confirmation link, then sign in.', true); return; }
        saveAuth({ access_token: res.j.access_token, refresh_token: res.j.refresh_token, profile: res.j.profile });
        dlg.close();
        if (res.j.profile && res.j.profile.level) { level = ''; setDemoLevel(res.j.profile.level); }
        resetDemo(); loadBrain();
      }).catch(function () { auth = prev; btn.disabled = false; authMsg('Could not reach the server. Please try again.'); });
    });
  }

  if (form) {
    form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
    document.querySelectorAll('.ja-quick button').forEach(function (b) {
      if (!b.dataset.q) return;
      b.addEventListener('click', function () {
        if (!history_.length) { input.focus(); add('bot', 'Do tell me the topic first, then press that button.'); return; }
        send(quick[b.dataset.q]);
      });
    });
    document.querySelectorAll('.ja-level-pick button').forEach(function (b) {
      b.addEventListener('click', function () { level = ''; setDemoLevel(b.dataset.level); resetDemo(); });
    });
    document.querySelectorAll('[data-example]').forEach(function (b) {
      b.addEventListener('click', function () { input.value = b.dataset.example; input.focus(); });
    });
    renderAuth(); resetDemo(); if (auth) loadBrain();
  }

  fromHash();
})();
