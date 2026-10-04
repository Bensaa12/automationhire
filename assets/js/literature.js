/* GCSE Literature Games (gcse-literature.html).
   All literature content comes from the server (/api/academy/lit-*), which decides what a free
   or premium student may see; this file only renders it. XP, streaks and achievements are a
   per-browser bonus layer (localStorage) and never unlock content.
   Routes (hash): #/  ·  #/<text>  ·  #/<text>/flashcards[/<category>]  ·  #/<text>/draw[/<scene>]  ·  #/<text>/exam[/<scene>] */
(function () {
  'use strict';
  var app = document.getElementById('litApp');
  if (!app) return;

  /* ---------- API (shares the Jarvis Academy sign-in) ---------- */
  var auth = null;
  try { auth = JSON.parse(localStorage.getItem('ja_auth') || 'null'); } catch (e) {}
  function saveAuth(a) { auth = a; try { if (a) localStorage.setItem('ja_auth', JSON.stringify(a)); else localStorage.removeItem('ja_auth'); } catch (e) {} }
  function api(op, body, method) {
    var h = { 'Content-Type': 'application/json' };
    if (auth && auth.access_token) h.Authorization = 'Bearer ' + auth.access_token;
    return fetch('/api/academy/' + op, { method: method || 'POST', headers: h, body: method === 'GET' ? undefined : JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok !== false, status: r.status, j: j }; }); });
  }
  function call(op, body, method) {   // retries once with a refreshed token
    return api(op, body, method).then(function (res) {
      if (res.status !== 401 || !auth || !auth.refresh_token) return res;
      return api('refresh', { refresh_token: auth.refresh_token }).then(function (rr) {
        if (!rr.ok) { saveAuth(null); return api(op, body, method); }
        auth.access_token = rr.j.access_token; auth.refresh_token = rr.j.refresh_token; saveAuth(auth);
        return api(op, body, method);
      });
    });
  }

  /* ---------- tiny DOM helper (text is always set as text, never HTML) ---------- */
  function h(tag, attrs) {
    var e = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    for (var k in attrs || {}) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style') e.setAttribute('style', v);
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    kids.forEach(function add(c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); });
    return e;
  }
  function mount() { app.innerHTML = ''; Array.prototype.slice.call(arguments).forEach(function (n) { if (n) app.appendChild(n); }); window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' }); }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function loading(msg) { return h('div', { class: 'lit-state', role: 'status' }, h('div', { class: 'lit-spinner' }), h('p', null, msg || 'Loading…')); }
  function errorBox(msg, retry) {
    return h('div', { class: 'lit-state lit-error', role: 'alert' }, h('p', null, msg || 'Something went wrong.'),
      retry ? h('button', { class: 'lit-btn', type: 'button', onclick: retry }, 'Try again') : null);
  }

  /* ---------- gamification (per browser) ---------- */
  var ACH = [
    { id: 'first', icon: '🎯', name: 'First round', desc: 'Finish a flashcard round' },
    { id: 'perfect', icon: '💯', name: 'Flawless', desc: 'Get every card right in a round' },
    { id: 'streak5', icon: '🔥', name: 'On fire', desc: 'Know 5 cards in a row' },
    { id: 'writer', icon: '✍️', name: 'Storyteller', desc: 'Submit a Draw the Story response' },
    { id: 'analyst', icon: '🔍', name: 'Analyst', desc: 'Write at Level 4 or 5' },
    { id: 'exam', icon: '🎓', name: 'Exam ready', desc: 'Complete an Exam Mode paragraph' },
    { id: 'trio', icon: '📚', name: 'Well read', desc: 'Play all three texts' },
    { id: 'daily3', icon: '📅', name: 'Habit', desc: 'Revise three days in a row' },
  ];
  var stats = load();
  function load() {
    var s = null; try { s = JSON.parse(localStorage.getItem('lit_stats') || 'null'); } catch (e) {}
    return s && typeof s === 'object' ? s : { xp: 0, ach: {}, best: {}, played: {}, day: null, dayStreak: 0, bestRun: 0 };
  }
  function persist() { try { localStorage.setItem('lit_stats', JSON.stringify(stats)); } catch (e) {} }
  function level() { return Math.floor(stats.xp / 250) + 1; }
  function touchDay() {
    var today = new Date().toISOString().slice(0, 10);
    if (stats.day === today) return;
    var y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    stats.dayStreak = stats.day === y ? (stats.dayStreak || 0) + 1 : 1; stats.day = today;
    if (stats.dayStreak >= 3) unlock('daily3');
    persist();
  }
  var newly = [];
  function unlock(id) { if (!stats.ach[id]) { stats.ach[id] = Date.now(); newly.push(id); persist(); } }
  function addXP(n) { stats.xp += n; persist(); }
  function hud() {
    var got = Object.keys(stats.ach).length;
    return h('div', { class: 'lit-hud' },
      h('span', { class: 'lit-chip', title: 'Days in a row' }, '🔥 ', h('b', null, stats.dayStreak || 0), ' day streak'),
      h('span', { class: 'lit-chip', title: 'Experience points' }, '⭐ ', h('b', null, stats.xp), ' XP · Lv ' + level()),
      h('span', { class: 'lit-chip', title: 'Achievements' }, '🏆 ', h('b', null, got), '/' + ACH.length));
  }
  function toastAchievements() {
    newly.splice(0).forEach(function (id, i) {
      var a = ACH.find(function (x) { return x.id === id; }); if (!a) return;
      var t = h('div', { class: 'lit-toast', role: 'status' }, h('span', { class: 'lit-toast-ic' }, a.icon), h('div', null, h('b', null, 'Achievement unlocked'), h('div', null, a.name)));
      setTimeout(function () { document.body.appendChild(t); setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, 2600); }, i * 700);
    });
  }

  /* ---------- catalog + plan ---------- */
  var cat = null, payments = false;
  function getCatalog(force) {
    if (cat && !force) return Promise.resolve(cat);
    return call('lit-catalog', {}).then(function (res) {
      if (res.status === 401) { saveAuth(null); return call('lit-catalog', {}); }
      return res;
    }).then(function (res) { if (!res.ok) throw new Error(res.j.error || 'Could not load the games.'); cat = res.j; return cat; });
  }
  api('config', null, 'GET').then(function (r) { payments = !!(r.ok && r.j.payments); }).catch(function () {});
  function textById(id) { return cat && cat.texts.find(function (t) { return t.id === id; }); }

  /* ---------- subscription CTA (plans and checkout live on the Jarvis Academy page) ---------- */
  function ctaPanel(t, headline, sub) {
    var lib = cat ? cat.texts.reduce(function (n, x) { return n + x.totalCards; }, 0) : 0;
    var scenes = cat ? cat.texts.reduce(function (n, x) { return n + x.scenes.length; }, 0) : 0;
    return h('section', { class: 'lit-cta', 'aria-labelledby': 'litCtaH' },
      h('div', { class: 'lit-cta-glow' }),
      h('h2', { id: 'litCtaH' }, headline),
      h('p', { class: 'lit-cta-sub' }, sub),
      h('ul', { class: 'lit-cta-list' },
        ['Every flashcard: ' + lib + ' across ' + (cat ? cat.texts.length : 3) + ' GCSE texts', 'Full character, theme, quote and context challenges',
         'All ' + scenes + ' Draw the Story scenes, at every level', 'GCSE Exam Mode with structured paragraph feedback',
         'Detailed writing feedback from Jarvis', 'Progress tracking and mastery scores', 'New GCSE texts as they are added'].map(function (x) { return h('li', null, x); })),
      h('div', { class: 'lit-cta-btns' },
        h('a', { class: 'lit-btn lit-btn-big', href: '/jarvis-academy?from=gcse-literature#pricing' }, 'Unlock GCSE Revision'),
        h('a', { class: 'lit-btn lit-btn-ghost', href: '/jarvis-academy#pricing' }, 'View Plans')),
      h('p', { class: 'lit-fine' }, 'Part of Jarvis Plus and Jarvis Family.' +
        (payments ? '' : ' Paid plans are opening soon: join early access on the plans page.') +
        (auth ? '' : ' Already subscribed? Sign in on the Jarvis Academy page.')));
  }

  /* ---------- views ---------- */
  function back(href, label) { return h('a', { class: 'lit-back', href: href }, '← ' + label); }

  function dashboard() {
    mount(loading('Loading your GCSE texts…'));
    getCatalog().then(function (c) {
      var planNote = c.premium
        ? h('div', { class: 'lit-plan premium' }, '★ Full access: every card, scene and exam question is unlocked.')
        : h('div', { class: 'lit-plan' }, 'Free: ' + c.limits.freeFlashcards + ' flashcards and ' + c.limits.freeWriting + ' writing challenge per text. ',
            h('a', { href: '/jarvis-academy#pricing' }, 'See the full experience'));
      if (!c.texts.length) { mount(h('div', { class: 'lit-state' }, h('p', null, 'No GCSE texts are available yet. Check back soon.'))); return; }
      mount(
        h('header', { class: 'lit-hero' },
          h('div', { class: 'lit-kicker' }, 'GCSE · AGES 14–16 · ENGLISH LITERATURE'),
          h('h1', null, 'GCSE Literature Games'),
          h('p', { class: 'lit-sub' }, 'Revise your GCSE texts. Test your memory. Build your exam confidence.'),
          hud(), planNote,
          h('ol', { class: 'lit-loop', 'aria-label': 'How it works' }, ['Learn', 'Recall', 'Write', 'Analyse', 'Improve'].map(function (s) { return h('li', null, s); }))),
        h('div', { class: 'lit-grid' }, c.texts.map(textCard)),
        achievementsStrip());
    }).catch(function (e) { mount(errorBox(e.message, dashboard)); });
  }
  function textCard(t) {
    return h('article', { class: 'lit-card', style: '--acc:' + t.accent },
      h('div', { class: 'lit-card-top' },
        h('div', null, h('h2', null, t.title), h('div', { class: 'lit-author' }, t.author)),
        t.mastery ? ring(t.mastery.overall) : null),
      h('p', { class: 'lit-tag' }, t.tagline),
      h('ul', { class: 'lit-cats' }, t.categories.map(function (c) { return h('li', null, c.label); })),
      h('a', { class: 'lit-btn lit-btn-acc', href: '#/' + t.id }, 'Play ' + t.title));
  }
  function ring(pct) {
    return h('div', { class: 'lit-ring', style: '--p:' + pct, title: 'Mastery ' + pct + '%' }, h('span', null, pct + '%'));
  }
  function achievementsStrip() {
    return h('section', { class: 'lit-ach' }, h('h3', null, 'Achievements'),
      h('div', { class: 'lit-ach-row' }, ACH.map(function (a) {
        var got = !!stats.ach[a.id];
        return h('div', { class: 'lit-badge' + (got ? ' got' : ''), title: a.desc }, h('span', null, a.icon), h('b', null, a.name), h('small', null, a.desc));
      })));
  }

  function hub(id) {
    mount(loading());
    getCatalog().then(function (c) {
      var t = textById(id); if (!t) { go('#/'); return; }
      var weakest = t.mastery && t.mastery.parts.filter(function (p) { return p.key !== 'writing'; }).sort(function (a, b) { return (a.confidence == null ? -1 : a.confidence) - (b.confidence == null ? -1 : b.confidence); })[0];
      mount(
        back('#/', 'All texts'),
        h('header', { class: 'lit-text-head', style: '--acc:' + t.accent },
          h('div', { class: 'lit-kicker' }, t.form + ' · ' + t.examBoards.join(' · ')),
          h('h1', null, t.title), h('div', { class: 'lit-author' }, t.author), hud()),
        h('div', { class: 'lit-games' },
          gameTile('🃏', 'Flashcard Challenge', c.premium ? 'Rounds of ' + c.limits.roundSize + ' from ' + t.totalCards + ' cards. Pick a category or mix them.' : c.limits.freeFlashcards + ' free questions from across the text.', '#/' + t.id + '/flashcards', false),
          gameTile('🎨', 'Draw the Story', 'Sketch a key scene, then write about it. Jarvis gives GCSE feedback.' + (c.premium ? '' : ' 1 free scene.'), '#/' + t.id + '/draw', false),
          gameTile('🎓', 'GCSE Exam Mode', 'Build a structured exam paragraph: point, evidence, analysis, context, writer\'s intent.', '#/' + t.id + '/exam', !c.premium)),
        c.premium ? categoryPicker(t) : null,
        masteryPanel(t, c, weakest),
        h('section', { class: 'lit-know' },
          h('div', null, h('h3', null, 'Characters'), h('p', null, t.characters.join(' · '))),
          h('div', null, h('h3', null, 'Themes'), h('p', null, t.themes.join(' · ')))));
    }).catch(function (e) { mount(errorBox(e.message, function () { hub(id); })); });
  }
  function gameTile(icon, title, desc, href, locked) {
    return h('a', { class: 'lit-game' + (locked ? ' locked' : ''), href: href },
      h('span', { class: 'lit-game-ic' }, icon), h('h3', null, title, locked ? h('span', { class: 'lit-lock', title: 'Premium' }, ' 🔒') : null), h('p', null, desc));
  }
  function categoryPicker(t) {
    return h('section', { class: 'lit-pick' }, h('h3', null, 'Challenge a category'),
      h('div', { class: 'lit-pick-row' },
        h('a', { class: 'lit-pill', href: '#/' + t.id + '/flashcards' }, 'Mixed'),
        t.categories.map(function (c) { return h('a', { class: 'lit-pill', href: '#/' + t.id + '/flashcards/' + c.id }, c.label + ' (' + c.cards + ')'); })));
  }
  function masteryPanel(t, c, weakest) {
    if (!c.premium) {
      return h('section', { class: 'lit-mastery locked' },
        h('h3', null, '📚 ' + t.title + ' Mastery'),
        h('div', { class: 'lit-blur', 'aria-hidden': 'true' }, ['Characters', 'Themes', 'Quotes', 'Context', 'Writing'].map(function (l, i) { return bar(l, [82, 70, 48, 61, 55][i]); })),
        h('p', null, 'Track your mastery of every category and get told exactly what to revise next. ', h('a', { href: '/jarvis-academy#pricing' }, 'Included with Jarvis Plus.')));
    }
    var m = t.mastery || { overall: 0, parts: [] };
    var catHref = function (p) { return p.key === 'writing' ? '#/' + t.id + '/draw' : '#/' + t.id + '/flashcards/' + p.key; };
    return h('section', { class: 'lit-mastery' },
      h('div', { class: 'lit-mastery-head' }, h('h3', null, '📚 ' + t.title + ' Mastery — ' + m.overall + '%'), ring(m.overall)),
      m.parts.map(function (p) { return bar(p.label, p.confidence); }),
      weakest ? h('p', { class: 'lit-weak' }, weakest.confidence == null ? 'You haven\'t tried ' + weakest.label + ' yet. ' : 'Your weakest area is ' + weakest.label + '. ',
        h('a', { href: catHref(weakest) }, 'Play: ' + weakest.label + ' Challenge →')) : null);
  }
  function bar(label, pct) {
    return h('div', { class: 'lit-bar' }, h('span', null, label), h('div', { class: 'lit-bar-track' }, h('i', { style: 'width:' + (pct || 0) + '%' })), h('b', null, pct == null ? '–' : pct + '%'));
  }

  /* ---------- Flashcard Challenge ---------- */
  function flashcards(id, category) {
    mount(loading('Shuffling the cards…'));
    getCatalog().then(function (c) {
      var t = textById(id); if (!t) { go('#/'); return; }
      return call('lit-round', { text: id, category: category || null }).then(function (res) {
        if (!res.ok) throw new Error(res.j.error || 'Could not load the cards.');
        if (!res.j.cards.length) { mount(back('#/' + id, t.title), h('div', { class: 'lit-state' }, h('p', null, 'No cards here yet.'))); return; }
        playRound(t, res.j.cards, res.j.sample, category);
      });
    }).catch(function (e) { mount(errorBox(e.message, function () { flashcards(id, category); })); });
  }
  function playRound(t, cards, sample, category) {
    touchDay();
    var i = 0, correct = 0, wrong = 0, streak = 0, best = 0, results = [];
    var counter = h('div', { class: 'lit-count' }), progress = h('div', { class: 'lit-progress' }, h('i'));
    var stage = h('div', { class: 'lit-stage' });
    var sc = { c: h('b'), w: h('b'), acc: h('b'), st: h('b'), best: h('b') };
    var board = h('div', { class: 'lit-score' },
      h('span', null, '✓ ', sc.c), h('span', null, '✗ ', sc.w), h('span', null, '🎯 ', sc.acc), h('span', null, '🔥 ', sc.st), h('span', null, 'Best ', sc.best));
    mount(back('#/' + t.id, t.title),
      h('div', { class: 'lit-play-head', style: '--acc:' + t.accent }, h('h1', null, '🃏 ' + t.title + ' · Flashcard Challenge'), sample ? h('span', { class: 'lit-free-tag' }, 'Free sample') : null),
      progress, counter, stage, board);
    function upd() {
      var done = correct + wrong;
      sc.c.textContent = correct; sc.w.textContent = wrong; sc.acc.textContent = (done ? Math.round(correct / done * 100) : 0) + '%';
      sc.st.textContent = streak; sc.best.textContent = best;
      counter.textContent = 'Card ' + Math.min(i + 1, cards.length) + ' of ' + cards.length;
      progress.firstChild.style.width = (done / cards.length * 100) + '%';
    }
    function show() {
      upd();
      var c = cards[i], revealed = false;
      var answer = h('div', { class: 'lit-answer', 'aria-live': 'polite' });
      var know = h('button', { class: 'lit-btn lit-yes', type: 'button', onclick: function () { mark(true); } }, '✓ I knew it');
      var dont = h('button', { class: 'lit-btn lit-no', type: 'button', onclick: function () { mark(false); } }, '✗ I didn\'t know it');
      var choices = h('div', { class: 'lit-choices', hidden: true }, know, dont);
      var reveal = h('button', { class: 'lit-btn lit-btn-big', type: 'button', onclick: doReveal }, 'Reveal answer');
      var card = h('div', { class: 'lit-flash' },
        h('div', { class: 'lit-flash-cat' }, c.label),
        h('p', { class: 'lit-q' }, c.q),
        h('p', { class: 'lit-think' }, 'Think of your answer, then reveal it.'),
        answer, reveal, choices);
      function doReveal() {
        if (revealed) return; revealed = true;
        answer.textContent = c.a; card.classList.add('flipped'); reveal.remove(); choices.hidden = false; know.focus();
      }
      function mark(ok) {
        results.push({ category: c.category, label: c.label, ok: ok, q: c.q });
        if (ok) { correct++; streak++; best = Math.max(best, streak); addXP(10); if (streak >= 5) unlock('streak5'); }
        else { wrong++; streak = 0; addXP(2); }
        card.classList.add(ok ? 'out-right' : 'out-left');
        i++;
        setTimeout(function () { if (i < cards.length) show(); else finish(); }, 260);
      }
      card.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { if (!revealed) { e.preventDefault(); doReveal(); } }
      });
      stage.innerHTML = ''; stage.appendChild(card); card.tabIndex = 0; card.focus();
    }
    function finish() {
      stats.bestRun = Math.max(stats.bestRun || 0, best);
      stats.played[t.id] = true; unlock('first');
      if (correct === cards.length) unlock('perfect');
      if (Object.keys(stats.played).length >= 3) unlock('trio');
      var pct = Math.round(correct / cards.length * 100);
      var prev = stats.best[t.id]; if (!prev || pct > prev) stats.best[t.id] = pct;
      persist();
      // per-category tallies -> server (signed in) and the result screen
      var byCat = {};
      results.forEach(function (r) { var b = byCat[r.category] = byCat[r.category] || { category: r.category, label: r.label, total: 0, correct: 0 }; b.total++; if (r.ok) b.correct++; });
      var tallies = Object.keys(byCat).map(function (k) { return byCat[k]; });
      var saving = auth ? call('lit-progress', { text: t.id, results: tallies.map(function (x) { return { category: x.category, total: x.total, correct: x.correct }; }) }) : Promise.resolve(null);
      saving.then(function (r) { if (r && r.ok && r.j.mastery && cat) { var tt = textById(t.id); if (tt) tt.mastery = r.j.mastery; } }).catch(function () {});
      resultScreen(t, correct, cards.length, pct, best, tallies, sample, category);
    }
    show();
  }
  function resultScreen(t, correct, total, pct, best, tallies, sample, category) {
    var good = tallies.filter(function (x) { return x.correct / x.total >= 0.7; });
    var weak = tallies.filter(function (x) { return x.correct / x.total < 0.7; });
    var weakest = weak.sort(function (a, b) { return a.correct / a.total - b.correct / b.total; })[0];
    var next = sample
      ? { href: '#/' + t.id + '/draw', label: 'Play Draw the Story →', why: 'Now put it into words: sketch a key scene and write about it.' }
      : weakest ? { href: '#/' + t.id + '/flashcards/' + weakest.category, label: weakest.label + ' Challenge →', why: 'Your weakest area this round was ' + weakest.label + '.' }
        : { href: '#/' + t.id + '/draw', label: 'Draw the Story →', why: 'Great recall. Now practise writing about a scene.' };
    var verdict = pct >= 90 ? 'Outstanding!' : pct >= 70 ? 'Great work!' : pct >= 50 ? 'Good effort!' : 'Keep going: every round makes it stick.';
    mount(back('#/' + t.id, t.title),
      h('section', { class: 'lit-result', style: '--acc:' + t.accent },
        h('div', { class: 'lit-kicker' }, 'YOUR RESULT'),
        h('div', { class: 'lit-big' }, correct + '/' + total), h('div', { class: 'lit-pct' }, pct + '%'),
        h('p', { class: 'lit-verdict' }, verdict), hud(),
        h('div', { class: 'lit-split' },
          h('div', null, h('h3', null, '💪 You did well on'), good.length ? h('ul', null, good.map(function (x) { return h('li', null, x.label + ' (' + x.correct + '/' + x.total + ')'); })) : h('p', { class: 'lit-muted' }, 'Keep practising: this list will fill up.')),
          h('div', null, h('h3', null, '📖 Revise next'), weak.length ? h('ul', null, weak.map(function (x) { return h('li', null, x.label + ' (' + x.correct + '/' + x.total + ')'); })) : h('p', { class: 'lit-muted' }, 'Nothing flagged. Brilliant.'))),
        h('div', { class: 'lit-next' }, h('p', null, h('b', null, 'Suggested next game: '), next.why), h('a', { class: 'lit-btn lit-btn-big', href: next.href }, next.label)),
        sample ? h('p', { class: 'lit-fine' }, 'That was the free ' + t.title + ' sample. The full library has ' + t.totalCards + ' cards. ', h('a', { href: '/jarvis-academy#pricing' }, 'See what\'s included'))
          : h('button', { class: 'lit-btn lit-btn-ghost', type: 'button', onclick: function () { flashcards(t.id, category); } }, 'Play another round')));
    toastAchievements();
  }

  /* ---------- Draw the Story / Exam Mode ---------- */
  function scenePicker(t, mode) {
    var exam = mode === 'exam';
    mount(back('#/' + t.id, t.title),
      h('div', { class: 'lit-play-head', style: '--acc:' + t.accent }, h('h1', null, (exam ? '🎓 GCSE Exam Mode · ' : '🎨 Draw the Story · ') + t.title)),
      h('p', { class: 'lit-sub' }, exam ? 'Pick a scene. You\'ll write one structured exam paragraph and Jarvis will show you how to develop it.' : 'Pick a key moment. Sketch it, then explain what is happening.'),
      h('div', { class: 'lit-scenes' }, t.scenes.map(function (s) {
        var locked = s.locked || (exam && !cat.premium);
        // Locked scenes still link through: the server answers with a friendly "premium" screen.
        return h('a', { class: 'lit-scene-card' + (locked ? ' locked' : ''), href: '#/' + t.id + '/' + mode + '/' + s.id },
          h('span', { class: 'lit-art' }, s.art || '🎭'), h('b', null, s.title), h('small', null, s.where),
          locked ? h('span', { class: 'lit-lock-tag' }, '🔒 Premium') : s.free && !cat.premium ? h('span', { class: 'lit-free-tag' }, 'Free') : null);
      })));
  }
  function drawGame(id, sceneId, mode) {
    mode = mode || 'draw';
    mount(loading());
    getCatalog().then(function (c) {
      var t = textById(id); if (!t) { go('#/'); return; }
      if (mode === 'exam' && !c.premium) { lockedScreen(t, 'GCSE Exam Mode is part of the full GCSE experience', 'Write structured exam paragraphs and get feedback on point, evidence, analysis, context and the writer\'s intent.'); return; }
      if (!sceneId) { scenePicker(t, mode); return; }
      return call('lit-scene', { text: id, scene: sceneId }).then(function (res) {
        if (!res.ok) throw new Error(res.j.error || 'Could not load the scene.');
        if (res.j.locked) { lockedScreen(t, 'This scene is part of the full GCSE experience', 'Your free ' + t.title + ' scene is "' + (t.scenes.find(function (s) { return s.free; }) || {}).title + '". Unlock every scene, at every level.'); return; }
        sceneScreen(t, res.j, mode);
      });
    }).catch(function (e) { mount(errorBox(e.message, function () { drawGame(id, sceneId, mode); })); });
  }
  function lockedScreen(t, title, sub) {
    mount(back('#/' + t.id, t.title), ctaPanel(t, title, sub));
  }

  function sceneScreen(t, data, mode) {
    touchDay();
    var s = data.scene, exam = mode === 'exam';
    var lvl = exam ? 5 : 1;
    var art = h('div', { class: 'lit-prompt', style: '--acc:' + t.accent },
      h('div', { class: 'lit-prompt-art', 'aria-hidden': 'true' }, s.art || '🎭'),
      h('div', null, h('div', { class: 'lit-kicker' }, s.where), h('h2', null, s.title), h('p', null, s.drawPrompt)));

    // Step 1-2: sketch (Draw the Story only)
    var sketch = null, canvas = null;
    if (!exam) {
      var box = h('div', { class: 'lit-canvas-box' });
      var tools = [['pen', '✏️ Draw'], ['arrow', '➜ Arrow'], ['circle', '◯ Circle'], ['label', 'T Label'], ['eraser', '⌫ Erase']];
      var colors = ['#22d3ee', '#00e676', '#ffb547', '#ff5c7a', '#ffffff'];
      var toolBtns = tools.map(function (x) { return h('button', { class: 'lit-tool', type: 'button', 'data-tool': x[0], 'aria-pressed': String(x[0] === 'pen'), onclick: function () { pick(x[0]); } }, x[1]); });
      var colorBtns = colors.map(function (col, k) { return h('button', { class: 'lit-swatch', type: 'button', style: 'background:' + col, 'aria-label': 'Colour ' + (k + 1), 'aria-pressed': String(k === 0), onclick: function (e) { canvas.setColor(col); colorBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b === e.currentTarget)); }); } }); });
      function pick(tl) { canvas.setTool(tl); toolBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tool === tl)); }); }
      sketch = h('section', { class: 'lit-step' },
        h('h3', null, '1 · Sketch the scene'), h('p', { class: 'lit-muted' }, 'It doesn\'t need to be good art: it\'s to help you remember who is there and what happens.'),
        h('ul', { class: 'lit-ideas' }, s.sketchIdeas.map(function (x) { return h('li', null, x); })),
        h('div', { class: 'lit-toolbar' }, toolBtns, h('span', { class: 'lit-sep' }), colorBtns, h('span', { class: 'lit-sep' }),
          h('button', { class: 'lit-tool', type: 'button', onclick: function () { canvas.undo(); } }, '↶ Undo'),
          h('button', { class: 'lit-tool', type: 'button', onclick: function () { canvas.clear(); } }, '🗑 Clear')),
        box);
      setTimeout(function () { canvas = window.LitCanvas.create(box); }, 0);
    }

    // Step 3: write
    var levelBtns = exam ? null : data.levels.map(function (l) {
      return h('button', { class: 'lit-level', type: 'button', 'data-n': l.n, disabled: l.locked || !l.task, 'aria-pressed': String(l.n === 1), title: l.locked ? 'Premium' : l.name, onclick: function () { setLevel(l.n); } },
        h('b', null, 'L' + l.n), ' ' + l.name, l.locked ? ' 🔒' : '');
    });
    var taskEl = h('p', { class: 'lit-task' });
    function setLevel(n) {
      lvl = n;
      if (levelBtns) levelBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.n === n)); });
      var L = data.levels.find(function (x) { return x.n === n; });
      taskEl.textContent = exam ? (s.examQuestion || '') : (L && L.task) || '';
    }
    var ta = h('textarea', { class: 'lit-write', rows: exam ? 12 : 9, maxlength: 4000, placeholder: exam ? 'Write one developed paragraph…' : 'Now explain what is happening in this scene…', 'aria-label': 'Your writing' });
    var wc = h('span', { class: 'lit-wc' }, '0 words');
    ta.addEventListener('input', function () { var n = ta.value.trim().split(/\s+/).filter(Boolean).length; wc.textContent = n + ' word' + (n === 1 ? '' : 's'); });
    var guide = exam
      ? h('div', { class: 'lit-guide' }, h('h4', null, 'Build your paragraph'),
          [['Point', 'Answer the question directly in one clear sentence.'], ['Evidence', 'A short quotation or precise reference.'], ['Analysis', 'Zoom in on key words: what effect do they create?'], ['Context', 'Link to the time, the audience or the writer\'s world.'], ['Writer\'s intent', 'Why did the writer want us to see it this way?']]
            .map(function (p, k) { return h('div', { class: 'lit-peel', 'data-part': ['point', 'evidence', 'analysis', 'context', 'writers_intent'][k] }, h('b', null, p[0]), h('span', null, p[1])); }))
      : h('div', { class: 'lit-guide' }, h('h4', null, 'Try to mention'),
          h('ul', null, ['What happens', 'The characters involved', 'Important details', 'Themes', 'Context, where it fits', 'Relevant vocabulary'].map(function (x) { return h('li', null, x); })),
          h('div', { class: 'lit-vocab' }, s.vocab.map(function (v) { return h('button', { type: 'button', class: 'lit-pill', title: 'Add to your writing', onclick: function () { ta.value += (ta.value && !/\s$/.test(ta.value) ? ' ' : '') + v; ta.focus(); ta.dispatchEvent(new Event('input')); } }, v); })));
    var note = data.freeWritingLeft != null ? h('p', { class: 'lit-fine' }, data.freeWritingLeft > 0 ? 'Free: ' + data.freeWritingLeft + ' feedback submission left for ' + t.title + '. Levels 1–' + (cat.limits.freeLevels) + ' are open on this scene.' : 'You have used your free feedback for ' + t.title + '.') : null;
    var submit = h('button', { class: 'lit-btn lit-btn-big', type: 'button', onclick: send }, exam ? 'Get exam feedback' : 'Get feedback from Jarvis');
    var out = h('div', { class: 'lit-feedback-wrap', 'aria-live': 'polite' });
    var write = h('section', { class: 'lit-step' },
      h('h3', null, exam ? 'Write your paragraph' : '2 · Now explain what is happening in this scene'),
      levelBtns ? h('div', { class: 'lit-levels', role: 'group', 'aria-label': 'Writing level' }, levelBtns) : null,
      taskEl,
      h('div', { class: 'lit-write-grid' }, h('div', null, ta, h('div', { class: 'lit-write-foot' }, wc, submit)), guide),
      note, out);
    setLevel(lvl);

    function send() {
      submit.disabled = true; submit.textContent = 'Jarvis is reading…';
      out.innerHTML = ''; out.appendChild(loading('Jarvis is reading your work…'));
      call('lit-feedback', { text: t.id, scene: s.id, level: lvl, mode: exam ? 'exam' : 'draw', writing: ta.value }).then(function (res) {
        out.innerHTML = '';
        if (!res.ok) { out.appendChild(errorBox(res.j.error || 'Jarvis could not mark this just now.', send)); return; }
        if (res.j.tooShort) { out.appendChild(h('p', { class: 'lit-hint' }, res.j.message)); return; }
        if (res.j.locked) {
          out.appendChild(res.j.reason === 'free-limit'
            ? ctaPanel(t, 'You\'ve completed your free ' + t.title + ' challenge.', 'Unlock the full GCSE experience and keep practising.')
            : h('p', { class: 'lit-hint' }, 'That option is part of the full GCSE experience.'));
          return;
        }
        addXP(exam ? 50 : 25); unlock('writer'); if (lvl >= 4) unlock('analyst'); if (exam) unlock('exam');
        stats.played[t.id] = true; if (Object.keys(stats.played).length >= 3) unlock('trio'); persist();
        out.appendChild(feedbackCard(res.j, exam));
        var afterFree = res.j.basic && res.j.freeWritingLeft === 0;
        out.appendChild(h('div', { class: 'lit-cta-btns' },
          afterFree ? null : h('button', { class: 'lit-btn lit-btn-ghost', type: 'button', onclick: function () { out.innerHTML = ''; ta.focus(); } }, 'Try again'),
          h('a', { class: 'lit-btn', href: '#/' + t.id }, 'Continue')));
        if (afterFree) out.appendChild(ctaPanel(t, 'You\'ve completed your free ' + t.title + ' challenge.', 'Unlock the full GCSE experience and keep practising.'));
        if (exam && res.j.feedback.structure) write.querySelectorAll('.lit-peel').forEach(function (p) { p.classList.toggle('hit', !!res.j.feedback.structure[p.dataset.part]); });
        toastAchievements();
        out.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }).catch(function () { out.innerHTML = ''; out.appendChild(errorBox('Could not reach Jarvis. Check your connection.', send)); })
        .then(function () { submit.disabled = false; submit.textContent = exam ? 'Get exam feedback' : 'Get feedback from Jarvis'; });
    }

    mount(back('#/' + t.id + '/' + mode, exam ? 'Exam Mode scenes' : 'All scenes'),
      h('div', { class: 'lit-play-head', style: '--acc:' + t.accent }, h('h1', null, (exam ? '🎓 Exam Mode · ' : '🎨 Draw the Story · ') + t.title)),
      art, sketch, write);
  }
  function feedbackCard(r, exam) {
    var f = r.feedback, names = { knowledge: 'Knowledge', detail: 'Detail', vocabulary: 'Vocabulary', analysis: 'Analysis', context: 'Context' };
    return h('section', { class: 'lit-feedback' },
      h('h3', null, '🤵 ' + f.headline),
      f.strengths.length ? h('div', null, h('h4', null, 'What you did well'), h('ul', null, f.strengths.map(function (x) { return h('li', null, x); }))) : null,
      f.improvements.length ? h('div', null, h('h4', null, 'To improve your GCSE response'), h('ul', null, f.improvements.map(function (x) { return h('li', null, x); }))) : null,
      f.scores ? h('div', { class: 'lit-scores' }, Object.keys(names).map(function (k) {
        var v = f.scores[k]; return h('div', { class: 'lit-crit' + (v == null ? ' na' : '') }, h('span', null, names[k]), h('div', { class: 'lit-dots' }, [1, 2, 3, 4].map(function (n) { return h('i', { class: v != null && n <= v ? 'on' : '' }); })), h('small', null, v == null ? 'not needed at this level' : v + '/4'));
      })) : null,
      f.structure ? h('div', { class: 'lit-structure' }, [['point', 'Point'], ['evidence', 'Evidence'], ['analysis', 'Analysis'], ['context', 'Context'], ['writers_intent', 'Writer\'s intent']].map(function (p) {
        return h('span', { class: f.structure[p[0]] ? 'ok' : 'miss' }, (f.structure[p[0]] ? '✓ ' : '○ ') + p[1]);
      })) : null,
      f.next_step ? h('p', { class: 'lit-nextq' }, h('b', null, 'Think about: '), f.next_step) : null,
      r.basic ? h('p', { class: 'lit-fine' }, 'This is basic feedback. Jarvis Plus gives detailed scores on knowledge, detail, vocabulary, analysis and context.') : null);
  }

  /* ---------- router ---------- */
  function render() {
    var parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (!parts.length) return dashboard();
    var id = parts[0], view = parts[1], arg = parts[2];
    if (!view) return hub(id);
    if (view === 'flashcards') return flashcards(id, arg);
    if (view === 'draw') return drawGame(id, arg, 'draw');
    if (view === 'exam') return drawGame(id, arg, 'exam');
    go('#/' + id);
  }
  window.addEventListener('hashchange', render);
  render();
})();
