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
  function isParent() { return !!(auth && auth.profile && auth.profile.role === 'parent'); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var payments = false, billing = 'monthly';
  function planName() { var p = auth && auth.profile && auth.profile.plan; return p && p !== 'free' ? p.charAt(0).toUpperCase() + p.slice(1) : ''; }
  function maxTurns() { return auth ? USER_TURNS : ANON_TURNS; }

  function api(op, body, method) {
    var h = { 'Content-Type': 'application/json' };
    if (auth && auth.access_token) h.Authorization = 'Bearer ' + auth.access_token;
    return fetch((op.charAt(0) === '/' ? op : '/api/academy/' + op), { method: method || 'POST', headers: h, body: method === 'GET' ? undefined : JSON.stringify(body || {}) })
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
    if (isParent()) { add('bot', 'You are signed in as a parent. Your family dashboard is just below. Students use this tutor.'); setLocked(true); }
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
    if (!text || busy || isParent() || used >= maxTurns()) return;
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
        if (isParent()) { setLocked(true); } else if (!auth && used >= ANON_TURNS) showGate('Create a free account to keep going. Jarvis will remember what you work on.', 'signup');
        else if (gate.hidden) { setLocked(false); input.focus(); }
      });
  }

  /* Learning Brain (live, signed-in only) */
  function loadBrain() {
    if (!auth) return;
    apiAuthed('me', null, 'GET').then(function (res) {
      if (!res.ok) return;
      var b = res.j.brain, rows = document.getElementById('jaBrainRows'); rows.innerHTML = '';
      USER_TURNS = b.turnLimit || 20;
      if (res.j.profile && auth && (!auth.profile || auth.profile.plan !== res.j.profile.plan)) { auth.profile = res.j.profile; saveAuth(auth); }
      setLeft();
      var skills = b.skills.filter(function (s) { return s.attempts > 0; }).sort(function (a, c) { return a.confidence - c.confidence; });
      skills.slice(0, 8).forEach(function (s) {
        var r = document.createElement('div'); r.className = 'ja-bar-row';
        var n = document.createElement('span'); n.textContent = s.topic; var sm = document.createElement('small'); sm.textContent = s.subject; n.appendChild(sm);
        var bar = document.createElement('div'); bar.className = 'ja-bar'; var i = document.createElement('i'); if (s.confidence < 60) i.className = 'warn'; i.style.width = s.confidence + '%'; bar.appendChild(i);
        var p = document.createElement('b'); p.textContent = s.confidence + '%';
        r.appendChild(n); r.appendChild(bar); r.appendChild(p); rows.appendChild(r);
      });
      var weak = skills[0], used_ = b.sessionsThisMonth + ' of ' + b.sessionLimit + (b.plan === 'free' ? ' free' : '') + ' sessions used this month.';
      document.getElementById('jaBrainNote').textContent = skills.length
        ? (weak.confidence < 60 ? 'Jarvis suggests next: ' + weak.topic + ' (' + weak.subject + '). ' : '') + used_
        : 'Nothing yet. Answer one of Jarvis’s questions and your first topic will appear here. ' + used_;
      var n = b.linkedParents || 0;
      document.getElementById('jaShareNote').textContent = n ? n + (n === 1 ? ' parent can' : ' parents can') + ' see your topics, scores and how often you practise. They never see your chats.' : 'A parent sees your topics, scores and how often you practise. They never see your chats.';
      document.getElementById('jaStopShare').hidden = !n;
      document.getElementById('jaBrainLive').hidden = false;
    });
  }

  function renderAuth() {
    var t = document.getElementById('jaAuthText'); if (!t) return;
    document.getElementById('jaSignIn').hidden = !!auth; document.getElementById('jaSignUp').hidden = !!auth; document.getElementById('jaSignOut').hidden = !auth;
    t.textContent = auth ? 'Signed in as ' + ((auth.profile && auth.profile.display_name) || 'student') + (isParent() ? ' (parent)' : '') + (planName() ? ' \u00b7 ' + planName() : '') : 'Free demo · 3 questions';
    if (!auth || isParent()) document.getElementById('jaBrainLive').hidden = true;
    document.getElementById('jaManage').hidden = !(auth && payments && planName());
    document.getElementById('family').hidden = !isParent();
    if (isParent()) loadFamily();
    setLeft();
  }

  /* Student: share progress with a parent */
  var shareBtn = document.getElementById('jaShareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      apiAuthed('invite', {}).then(function (res) {
        if (!res.ok) { document.getElementById('jaShareNote').textContent = res.j.error || 'Could not make a code. Please try again.'; return; }
        var c = document.getElementById('jaShareCode'); c.textContent = res.j.code; c.hidden = false;
        document.getElementById('jaShareNote').textContent = 'Give this code to your parent. They enter it on this page after creating a parent account. It works once and expires in 7 days.';
      });
    });
    document.getElementById('jaStopShare').addEventListener('click', function () {
      apiAuthed('unlink', {}).then(function () { document.getElementById('jaShareCode').hidden = true; loadBrain(); });
    });
  }

  /* Parent: family dashboard */
  function loadFamily() {
    apiAuthed('family', {}).then(function (res) {
      var box_ = document.getElementById('jaChildren'); if (!box_ || !res.ok) return;
      box_.innerHTML = '';
      if (!res.j.children.length) { box_.appendChild(el('p', 'ja-empty', 'No children linked yet. Ask your child for their code.')); return; }
      res.j.children.forEach(function (c) {
        var card = el('div', 'ja-child'), hd = el('div', 'ja-child-head'), nm = el('b', null, c.display_name);
        nm.appendChild(el('small', null, c.level)); hd.appendChild(nm);
        var stop = el('button', 'ja-link', 'Stop sharing'); stop.type = 'button';
        stop.addEventListener('click', function () { apiAuthed('unlink', { student_id: c.id }).then(loadFamily); });
        hd.appendChild(stop); card.appendChild(hd);
        var sr = el('div', 'ja-stat-row');
        [[c.sessionsThisWeek, 'sessions this week'], [c.questionsThisWeek, 'questions this week'], [c.lastActive ? new Date(c.lastActive).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'None', 'last active']].forEach(function (p) {
          var s = el('div', 'ja-stat'); s.appendChild(el('b', null, String(p[0]))); s.appendChild(el('span', null, p[1])); sr.appendChild(s);
        });
        card.appendChild(sr);
        if (c.subjects.length) {
          c.subjects.forEach(function (s) {
            var r = el('div', 'ja-bar-row'); r.appendChild(el('span', null, s.subject));
            var bar = el('div', 'ja-bar'), i = el('i'); if (s.average < 60) i.className = 'warn'; i.style.width = s.average + '%'; bar.appendChild(i); r.appendChild(bar); r.appendChild(el('b', null, s.average + '%')); card.appendChild(r);
          });
        } else card.appendChild(el('p', 'ja-empty', 'No scored topics yet. They appear once your child answers Jarvis\u2019s questions.'));
        [['NEEDS ATTENTION', c.needsAttention, 'ja-warn', '\u26a0 '], ['DOING WELL', c.strong, 'ja-ok', '\u2713 ']].forEach(function (g) {
          if (!g[1].length) return; card.appendChild(el('h5', null, g[0])); var ul = el('ul');
          g[1].forEach(function (s) { ul.appendChild(el('li', g[2], g[3] + s.topic + ' (' + s.subject + ', ' + s.confidence + '%)')); }); card.appendChild(ul);
        });
        box_.appendChild(card);
      });
    });
  }
  var linkForm = document.getElementById('jaLinkForm');
  if (linkForm) linkForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var m = document.getElementById('jaLinkMsg');
    apiAuthed('link', { code: document.getElementById('jaLinkCode').value }).then(function (res) {
      m.hidden = false; m.style.color = res.ok ? 'var(--green)' : '';
      m.textContent = res.ok ? 'Linked. Your child\u2019s progress is below.' : (res.j.error || 'Could not link. Please try again.');
      if (res.ok) { document.getElementById('jaLinkCode').value = ''; loadFamily(); }
    });
  });

  /* Email-confirmation link lands here with tokens in the URL hash: sign the student straight in. */
  function handleConfirm() {
    var h = location.hash;
    if (h.indexOf('access_token=') < 0 && h.indexOf('error_description=') < 0) return;
    var p = new URLSearchParams(h.slice(1));
    history.replaceState(null, '', location.pathname);
    if (p.get('error_description') || !p.get('access_token')) { openAuth('login'); authMsg('That confirmation link has expired. Please sign in, or create the account again.'); return; }
    auth = { access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), profile: null };
    apiAuthed('me', null, 'GET').then(function (res) {
      if (!res.ok) { auth = null; openAuth('login'); authMsg('Email confirmed. Please sign in.', true); return; }
      saveAuth({ access_token: auth.access_token, refresh_token: auth.refresh_token, profile: res.j.profile });
      if (isParent()) { resetDemo(); document.getElementById('family').scrollIntoView(); return; }
      if (res.j.profile && res.j.profile.level) { level = ''; setDemoLevel(res.j.profile.level); }
      resetDemo(); loadBrain();
      add('bot', 'Welcome aboard, ' + res.j.profile.display_name + '. Your email is confirmed. What shall we work on first?');
      document.getElementById('try').scrollIntoView();
    });
  }

  /* Pricing / Stripe checkout (paid plans only appear once the server says payments are live) */
  function priceMsg(text, good) { var m = document.getElementById('jaPriceMsg'); m.textContent = text; m.style.color = good ? 'var(--green)' : ''; m.hidden = !text; }
  function drawPrices() {
    document.querySelectorAll('.ja-amt[data-m]').forEach(function (a) {
      var y = billing === 'yearly'; a.textContent = '\u00a3' + (y ? a.dataset.y : a.dataset.m);
      var sm = document.createElement('small'); sm.textContent = y ? '/year' : '/month'; a.appendChild(sm);
    });
  }
  function buy(plan) {
    if (!auth) { openAuth('signup', plan === 'family' ? 'parent' : 'student'); priceMsg(plan === 'family' ? 'Create a parent account, then choose Family.' : 'Create a free account, then choose Plus.'); return; }
    priceMsg('Opening secure checkout\u2026', true);
    apiAuthed('/api/stripe/create-checkout', { product: 'academy', plan: plan, billing: billing }).then(function (res) {
      if (res.ok && res.j.checkout_url) { location.href = res.j.checkout_url; return; }
      priceMsg(res.j.error || 'Could not start checkout. Please try again.');
    }).catch(function () { priceMsg('Could not reach the server. Please try again.'); });
  }
  function initPricing() {
    fetch('/api/academy/config').then(function (r) { return r.json(); }).then(function (c) {
      payments = !!(c && c.payments); if (!payments) return;
      document.getElementById('jaPriceLabel').firstChild.textContent = 'Pricing ';
      var tag = document.getElementById('jaPriceTag'); tag.textContent = 'Live'; tag.className = 'ja-tag live';
      document.getElementById('jaPriceSub').textContent = 'Choose a plan. It renews until you cancel, and you can cancel any time.';
      document.getElementById('jaBilling').hidden = false;
      var plus = document.getElementById('jaBuyPlus'), fam = document.getElementById('jaBuyFamily');
      plus.textContent = 'UPGRADE TO PLUS'; fam.textContent = 'CHOOSE FAMILY';
      plus.addEventListener('click', function (e) { e.preventDefault(); buy('plus'); });
      fam.addEventListener('click', function (e) { e.preventDefault(); buy('family'); });
      document.querySelectorAll('#jaBilling .ja-tab').forEach(function (b) {
        b.addEventListener('click', function () {
          billing = b.dataset.bill;
          document.querySelectorAll('#jaBilling .ja-tab').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
          drawPrices();
        });
      });
      document.getElementById('jaManage').addEventListener('click', function () {
        apiAuthed('/api/stripe/create-checkout', { product: 'academy', action: 'portal' }).then(function (res) {
          if (res.ok && res.j.url) location.href = res.j.url; else priceMsg(res.j.error || 'Could not open billing. Please try again.');
        });
      });
      renderAuth();
    }).catch(function () {});

    // Returning from Stripe
    var q = location.search;
    if (q.indexOf('subscribed=1') > -1) {
      history.replaceState(null, '', location.pathname);
      priceMsg('Thank you! Activating your plan\u2026', true);
      document.getElementById('pricing').scrollIntoView();
      var tries = 0;
      (function poll() {
        if (!auth) { priceMsg(''); return; }
        apiAuthed('me', null, 'GET').then(function (res) {
          if (res.ok && res.j.profile && res.j.profile.plan && res.j.profile.plan !== 'free') {
            auth.profile = res.j.profile; saveAuth(auth); priceMsg('Your ' + planName() + ' plan is active. Welcome aboard!', true);
            if (!isParent()) loadBrain(); return;
          }
          if (++tries < 8) setTimeout(poll, 2500); else priceMsg('Payment received. Your plan can take a minute to appear; refresh shortly.', true);
        });
      })();
    } else if (q.indexOf('cancelled=1') > -1) {
      history.replaceState(null, '', location.pathname + '#pricing');
      priceMsg('No problem. Nothing was charged.');
    }
  }

  /* Auth dialog */
  var dlg = document.getElementById('jaAuth'), mode = 'signup';
  function openAuth(m, role) {
    mode = m; var s = m === 'signup';
    if (role) document.getElementById('jaRoleSel').value = role;
    applyRole();
    document.getElementById('jaAuthTitle').textContent = s ? 'Create your free account' : 'Welcome back';
    document.getElementById('jaAuthSubmit').textContent = s ? 'CREATE ACCOUNT' : 'SIGN IN';
    document.getElementById('jaAuthSwap').textContent = s ? 'I already have an account' : 'Create a new account';
    ['jaNameWrap', 'jaLevelWrap', 'jaGuardWrap'].forEach(function (id) { document.getElementById(id).hidden = !s; });
    document.getElementById('jaPass').autocomplete = s ? 'new-password' : 'current-password';
    document.getElementById('jaLevelSel').value = level;
    document.getElementById('jaRoleWrap').hidden = !s;
    applyRole();
    var e = document.getElementById('jaAuthErr'); e.hidden = true; e.style.color = '';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function applyRole() {
    var p = document.getElementById('jaRoleSel').value === 'parent' && mode === 'signup';
    document.getElementById('jaLevelWrap').hidden = p || mode !== 'signup';
    document.getElementById('jaNameLabel').textContent = p ? 'Your first name' : 'First name or nickname';
    document.getElementById('jaGuardText').textContent = p ? 'I am an adult (18 or over) and the parent or guardian of the child I will link.' : 'I am 13 or over, or a parent or guardian is setting this up for a child.';
  }
  function authMsg(msg, good) { var e = document.getElementById('jaAuthErr'); e.textContent = msg; e.style.color = good ? 'var(--green)' : ''; e.hidden = false; }

  if (dlg) {
    document.getElementById('jaSignIn').addEventListener('click', function () { openAuth('login'); });
    document.getElementById('jaSignUp').addEventListener('click', function () { openAuth('signup'); });
    document.getElementById('jaGateBtn').addEventListener('click', function (e) { openAuth(e.currentTarget.dataset.mode || 'signup'); });
    document.getElementById('jaAuthClose').addEventListener('click', function () { dlg.close(); });
    document.getElementById('jaAuthSwap').addEventListener('click', function () { openAuth(mode === 'signup' ? 'login' : 'signup'); });
    document.getElementById('jaRoleSel').addEventListener('change', applyRole);
    document.getElementById('jaParentSignUp').addEventListener('click', function () { openAuth('signup', 'parent'); });
    document.getElementById('jaParentSignIn').addEventListener('click', function () { openAuth('login'); });
    document.getElementById('jaSignOut').addEventListener('click', function () { saveAuth(null); resetDemo(); });
    document.getElementById('jaAuthForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = document.getElementById('jaAuthSubmit'); btn.disabled = true;
      var body = { email: document.getElementById('jaEmail').value, password: document.getElementById('jaPass').value };
      if (mode === 'signup') { body.role = document.getElementById('jaRoleSel').value; body.display_name = document.getElementById('jaName').value; body.level = document.getElementById('jaLevelSel').value; body.guardian_confirmed = document.getElementById('jaGuard').checked; }
      var prev = auth; auth = null;
      api(mode, body).then(function (res) {
        btn.disabled = false;
        if (!res.ok) { auth = prev; authMsg(res.j.error || 'Something went wrong. Please try again.'); return; }
        if (res.j.needs_confirmation) { auth = prev; authMsg('Almost there! Check your email for a confirmation link, then sign in.', true); return; }
        saveAuth({ access_token: res.j.access_token, refresh_token: res.j.refresh_token, profile: res.j.profile });
        dlg.close();
        if (isParent()) { resetDemo(); document.getElementById('family').scrollIntoView({ behavior: 'smooth' }); return; }
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
    renderAuth(); resetDemo(); if (auth && !isParent()) loadBrain();
    handleConfirm();
    initPricing();
  }

  // Bridge for the Maths Challenge game (academy-game.js): who is signed in, authed API calls
  // (with token refresh), refreshing the Learning Brain panel, and handing a topic to the tutor.
  window.JA = {
    student: function () { return !!auth && !isParent(); },
    apiAuthed: apiAuthed,
    refreshBrain: function () { if (auth && !isParent()) loadBrain(); },
    askTutor: function (text, lvl) {
      if (!form) return;
      if (lvl && lvl !== level) { setDemoLevel(lvl); resetDemo(); }
      input.value = text;
      document.getElementById('try').scrollIntoView({ behavior: 'smooth' });
      setTimeout(function () { input.focus(); }, 500);
    },
    signUp: function () { openAuth('signup'); }
  };

  fromHash();
})();
