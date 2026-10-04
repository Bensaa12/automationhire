/* Jarvis Academy: Homework Help (student) and homework unlocks (parent).
   Talks to /api/academy/hw-* through the window.JA bridge in academy.js (sign-in, token refresh,
   the tutor chat). Answers are only ever sent by the server after a parent unlocks them; this file
   just shows what it is given. Photos are shrunk in the browser, sent once to be read, never kept. */
(function () {
  'use strict';
  var panel = document.getElementById('jaHw'), openBtn = document.getElementById('jaHwOpen'), parentBox = document.getElementById('jaHwParent');
  if (!panel && !parentBox) return;
  var JA = function () { return window.JA || {}; };
  var call = function (op, body) { return JA().apiAuthed(op, body || {}); };

  function h(tag, attrs) {
    var e = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    for (var k in attrs || {}) {
      var v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    kids.forEach(function add(c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); });
    return e;
  }
  function busy(msg) { return h('div', { class: 'ja-hw-busy', role: 'status' }, h('span', { class: 'ja-hw-spin' }), msg || 'One moment…'); }
  function errLine(msg) { return h('p', { class: 'ja-err' }, msg); }
  function show(node) { panel.innerHTML = ''; panel.appendChild(node); }

  /* =================== student =================== */
  var state = { pages: [], pdf: null, homework: null, items: [], quota: null, linkedParent: false, parentPin: false };

  if (openBtn) openBtn.addEventListener('click', function () {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) { home(); panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });

  function home() {
    if (!JA().signedIn || !JA().signedIn()) {
      show(h('div', { class: 'ja-hw-in' }, h('h3', null, '📚 Homework help'),
        h('p', null, 'Create a free student account and Jarvis will help with your homework: snap it, and he teaches the lesson behind every question. Free accounts get 2 homework uploads a month.'),
        h('button', { type: 'button', class: 'btn ja-btn-cyan btn-sm', onclick: function () { JA().signUp(); } }, 'CREATE FREE ACCOUNT')));
      return;
    }
    show(busy('Loading your homework…'));
    call('hw-list').then(function (res) {
      if (!res.ok) { show(errLine(res.j.error || 'Could not load homework help.')); return; }
      state.quota = res.j.quota; state.linkedParent = res.j.linkedParent; state.parentPin = res.j.parentPin;
      uploadView(res.j.homework || []);
    }).catch(function () { show(errLine('Could not reach Jarvis. Check your connection.')); });
  }

  function quotaLine() {
    var q = state.quota; if (!q) return null;
    return h('span', { class: 'ja-hw-quota' + (q.left ? '' : ' none') }, q.left + ' of ' + q.limit + ' homework uploads left this month');
  }

  function uploadView(recent) {
    state.pages = []; state.pdf = null;
    var pagesBox = h('div', { class: 'ja-hw-pages' });
    var cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
    var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,application/pdf', multiple: true, hidden: true });
    var typed = h('textarea', { class: 'ja-hw-text', rows: 4, maxlength: 4000, placeholder: 'Or type / paste the question(s) here…', 'aria-label': 'Type your homework question' });
    var note = h('input', { type: 'text', class: 'ja-hw-note', maxlength: 400, placeholder: 'What do you find hard? (optional)', 'aria-label': 'What you find hard' });
    var msg = h('p', { class: 'ja-err', hidden: true });
    var go = h('button', { type: 'button', class: 'btn ja-btn-cyan', onclick: submit }, 'READ MY HOMEWORK');
    cam.addEventListener('change', function () { addFiles(cam.files); cam.value = ''; });
    file.addEventListener('change', function () { addFiles(file.files); file.value = ''; });

    function say(t) { msg.textContent = t; msg.hidden = !t; }
    function addFiles(list) {
      say('');
      Array.prototype.forEach.call(list || [], function (f) {
        if (f.type === 'application/pdf') {
          if (f.size > 3e6) { say('That PDF is over 3 MB. Take photos of the pages instead.'); return; }
          var r = new FileReader();
          r.onload = function () { state.pdf = { name: f.name, data: String(r.result).split(',')[1] }; state.pages = []; drawPages(); };
          r.readAsDataURL(f); return;
        }
        if (state.pages.length >= 4) { say('Up to 4 pages per homework.'); return; }
        loadImage(f).then(function (canvas) { state.pdf = null; state.pages.push({ canvas: canvas, rot: 0, crop: null }); drawPages(); })
          .catch(function (e) { console.error('[homework] photo', e); say('That photo format can\'t be opened here. Please use a JPG or PNG (on iPhone, use "Take photo").'); });
      });
    }
    function drawPages() {
      pagesBox.innerHTML = '';
      if (state.pdf) { pagesBox.appendChild(h('div', { class: 'ja-hw-pdf' }, '📄 ' + state.pdf.name, h('button', { type: 'button', class: 'ja-link', onclick: function () { state.pdf = null; drawPages(); } }, 'Remove'))); return; }
      state.pages.forEach(function (p, i) {
        var thumb = renderPage(p, 220); thumb.className = 'ja-hw-thumb';
        pagesBox.appendChild(h('figure', { class: 'ja-hw-page' }, thumb,
          h('figcaption', null, 'Page ' + (i + 1),
            h('button', { type: 'button', title: 'Rotate', 'aria-label': 'Rotate page ' + (i + 1), onclick: function () { p.rot = (p.rot + 90) % 360; p.crop = null; drawPages(); } }, '⟳'),
            h('button', { type: 'button', title: 'Crop', 'aria-label': 'Crop page ' + (i + 1), onclick: function () { cropper(p, drawPages); } }, '✂'),
            h('button', { type: 'button', title: 'Remove', 'aria-label': 'Remove page ' + (i + 1), onclick: function () { state.pages.splice(i, 1); drawPages(); } }, '✕'))));
      });
    }
    function submit() {
      say('');
      if (!state.pages.length && !state.pdf && typed.value.trim().length < 8) { say('Add a photo of your homework, or type the question.'); return; }
      var body = { note: note.value, text: typed.value, level: JA().level ? JA().level() : 'secondary' };
      if (state.pdf) body.pdf = { data: state.pdf.data };
      else if (state.pages.length) body.images = state.pages.map(function (p) { return { media_type: 'image/jpeg', data: renderPage(p, 1600).toDataURL('image/jpeg', 0.82).split(',')[1] }; });
      go.disabled = true; show(busy('Jarvis is reading your homework…'));
      call('hw-upload', body).then(function (res) {
        if (!res.ok) { uploadView(recent); panel.querySelector('.ja-err').hidden = false; panel.querySelector('.ja-err').textContent = res.j.error || 'Jarvis could not read that. Please try again.'; return; }
        if (res.j.limit) { limitView(); return; }
        if (res.j.unreadable) { uploadView(recent); var m = panel.querySelector('.ja-err'); m.hidden = false; m.textContent = '🤔 ' + res.j.reason + ' (This didn\'t use up an upload.)'; return; }
        state.quota = res.j.quota; state.homework = res.j.homework; state.items = res.j.items;
        cardsView();
      }).catch(function () { uploadView(recent); });
    }

    var q = state.quota;
    show(h('div', { class: 'ja-hw-in' },
      h('div', { class: 'ja-hw-head' }, h('h3', null, '📚 Help with my homework'), quotaLine()),
      q && !q.left ? h('p', { class: 'ja-hw-limit' }, 'You have used this month\'s free homework uploads. They reset on the 1st, or upgrade to Jarvis Plus for many more. You can still open your recent homework below.') : null,
      q && !q.left ? null : h('div', null,
        h('div', { class: 'ja-hw-src' },
          h('button', { type: 'button', class: 'btn ja-btn-outline btn-sm', onclick: function () { cam.click(); } }, '📷 Take a photo'),
          h('button', { type: 'button', class: 'btn ja-btn-outline btn-sm', onclick: function () { file.click(); } }, '📁 Upload photo or PDF'), cam, file),
        h('p', { class: 'ja-hw-tip' }, '💡 Crop out your name and school. Photos are read once and never stored. Up to 4 pages.'),
        pagesBox, typed, note, msg,
        h('div', { class: 'ja-hw-actions' }, go)),
      recent.length ? h('div', { class: 'ja-hw-recent' }, h('h4', null, 'Your recent homework'),
        recent.map(function (hw) {
          var done = hw.items.filter(function (i) { return i.tried; }).length;
          return h('button', { type: 'button', class: 'ja-hw-row', onclick: function () { openHomework(hw); } },
            h('b', null, hw.title || hw.subject), h('span', null, hw.subject + ' · ' + hw.items.length + ' question' + (hw.items.length === 1 ? '' : 's') + ' · ' + done + ' tried'),
            hw.assessment ? h('em', null, 'test') : null);
        })) : null));
  }

  function limitView() {
    show(h('div', { class: 'ja-hw-in' }, h('h3', null, '📚 Homework help'),
      h('p', { class: 'ja-hw-limit' }, 'You have used this month\'s ' + (state.quota ? state.quota.limit : 2) + ' free homework uploads. They reset on the 1st of next month.'),
      h('p', null, 'Jarvis Plus gives you many more uploads every month. ', h('a', { href: '#pricing' }, 'See plans')),
      h('button', { type: 'button', class: 'ja-link', onclick: home }, '← Back')));
  }

  function openHomework(hw) {
    state.homework = hw;
    state.items = hw.items.map(function (i) { return { id: i.id, idx: i.idx, question: i.question || null, attempts: i.tried ? 1 : 0, attemptResult: i.result, unlocked: i.unlocked }; });
    cardsView(true);
  }

  function statusChip(it) {
    if (it.unlocked) return h('span', { class: 'ja-hw-chip ok' }, '🔓 answer unlocked');
    if (it.attemptResult === 'correct') return h('span', { class: 'ja-hw-chip ok' }, '✓ correct');
    if (it.attempts > 0) return h('span', { class: 'ja-hw-chip' }, '✎ tried');
    return h('span', { class: 'ja-hw-chip dim' }, 'not started');
  }
  function cardsView(fromList) {
    var hw = state.homework, items = state.items;
    // e.g. "I can see a Mathematics worksheet on adding fractions with 6 questions."
    var subject = hw.subject || 'homework', kind = ((hw.title || '').match(/worksheet|exercise|test|questions|essay|homework/i) || ['homework'])[0].toLowerCase();
    var intro = 'I can see ' + (/^[aeiou]/i.test(subject) ? 'an ' : 'a ') + subject + ' ' + kind + (hw.topic ? ' on ' + hw.topic.toLowerCase() : '') +
      ' with ' + items.length + ' question' + (items.length === 1 ? '' : 's') + '. Which one shall we start with?';
    show(h('div', { class: 'ja-hw-in' },
      h('div', { class: 'ja-hw-head' }, h('button', { type: 'button', class: 'ja-link', onclick: home }, '← Homework'), quotaLine()),
      h('div', { class: 'ja-hw-jarvis' }, h('span', { class: 'ja-who' }, 'JARVIS'), fromList ? (hw.title || hw.subject) + ': which question shall we work on?' : intro),
      hw.assessment ? h('p', { class: 'ja-hw-test' }, '📝 This looks like a test or graded work, so Jarvis will teach the topic but won\'t solve it, and the answers stay hidden.') : null,
      h('div', { class: 'ja-hw-cards' }, items.map(function (it) {
        return h('button', { type: 'button', class: 'ja-hw-card', onclick: function () { questionView(it.id); } },
          h('span', { class: 'ja-hw-num' }, 'Q' + it.idx), h('span', { class: 'ja-hw-q' }, it.question ? it.question.slice(0, 140) + (it.question.length > 140 ? '…' : '') : 'Question ' + it.idx), statusChip(it));
      }))));
  }

  function questionView(itemId) {
    show(busy('Opening the question…'));
    call('hw-item', { item_id: itemId }).then(function (res) {
      if (!res.ok) { show(errLine(res.j.error || 'Could not open that question.')); return; }
      state.linkedParent = res.j.linkedParent; state.parentPin = res.j.parentPin;
      if (res.j.homework) state.homework = Object.assign({}, state.homework || {}, res.j.homework);
      renderQuestion(res.j.item);
    }).catch(function () { show(errLine('Could not reach Jarvis. Check your connection.')); });
  }

  function renderQuestion(it) {
    var cached = state.items.find(function (x) { return x.id === it.id; });
    if (cached) Object.assign(cached, it);
    var lessonBox = h('div', { class: 'ja-hw-lesson' });
    function showLesson(text) { lessonBox.innerHTML = ''; lessonBox.appendChild(h('div', { class: 'ja-hw-jarvis' }, h('span', { class: 'ja-who' }, 'JARVIS · THE LESSON'), text)); }
    var teach = h('button', { type: 'button', class: 'btn ja-btn-cyan btn-sm', onclick: function () {
      teach.disabled = true; lessonBox.innerHTML = ''; lessonBox.appendChild(busy('Jarvis is preparing the lesson…'));
      call('hw-lesson', { item_id: it.id, lang: JA().lang ? JA().lang() : 'en' }).then(function (r) {
        if (!r.ok) { lessonBox.innerHTML = ''; lessonBox.appendChild(errLine(r.j.error || 'Could not prepare the lesson.')); teach.disabled = false; return; }
        it.lesson = r.j.lesson; showLesson(r.j.lesson); teach.textContent = 'TEACH ME AGAIN'; teach.disabled = false;
      }).catch(function () { lessonBox.innerHTML = ''; lessonBox.appendChild(errLine('Could not reach Jarvis.')); teach.disabled = false; });
    } }, it.lesson ? 'TEACH ME AGAIN' : 'TEACH ME THE LESSON');
    if (it.lesson) showLesson(it.lesson);

    var attempt = h('textarea', { class: 'ja-hw-text', rows: 3, maxlength: 1500, placeholder: 'Write your own answer (and working) here…', 'aria-label': 'Your answer' });
    if (it.attempt) attempt.value = it.attempt;
    var verdict = h('div', { class: 'ja-hw-verdict', 'aria-live': 'polite' });
    if (it.attemptResult) verdict.appendChild(resultLine(it.attemptResult, null));
    var checkBtn = h('button', { type: 'button', class: 'btn ja-btn-outline btn-sm', onclick: function () {
      if (!attempt.value.trim()) { verdict.innerHTML = ''; verdict.appendChild(errLine('Write your answer first.')); return; }
      checkBtn.disabled = true; verdict.innerHTML = ''; verdict.appendChild(busy('Jarvis is checking…'));
      call('hw-check', { item_id: it.id, attempt: attempt.value, lang: JA().lang ? JA().lang() : 'en' }).then(function (r) {
        verdict.innerHTML = ''; checkBtn.disabled = false;
        if (!r.ok) { verdict.appendChild(errLine(r.j.error || 'Could not check that.')); return; }
        it.attempts = (it.attempts || 0) + 1; it.attemptResult = r.j.result; it.attempt = attempt.value;
        verdict.appendChild(resultLine(r.j.result, r.j.feedback));
        answerBox.replaceWith(answerBox = answerArea(it));
        if (JA().refreshBrain) JA().refreshBrain();
      }).catch(function () { verdict.innerHTML = ''; checkBtn.disabled = false; verdict.appendChild(errLine('Could not reach Jarvis.')); });
    } }, 'CHECK MY ANSWER');

    var answerBox = answerArea(it);
    show(h('div', { class: 'ja-hw-in' },
      h('div', { class: 'ja-hw-head' }, h('button', { type: 'button', class: 'ja-link', onclick: function () { cardsView(true); } }, '← All questions'), quotaLine()),
      h('div', { class: 'ja-hw-qbox' }, h('span', { class: 'ja-hw-num' }, 'Q' + it.idx), h('p', null, it.question), it.context ? h('p', { class: 'ja-hw-ctx' }, '🖼 ' + it.context) : null),
      h('section', null, h('h4', null, '1 · Understand the lesson'), h('div', { class: 'ja-hw-row2' }, teach,
        h('button', { type: 'button', class: 'ja-link', onclick: function () {
          JA().askTutorAbout(it.id, '', 'Let\'s talk about homework question ' + it.idx + '. Ask me anything about it: I\'ll explain, but the answer stays locked until a parent unlocks it.');
        } }, '💬 Ask Jarvis a question about it')), lessonBox),
      h('section', null, h('h4', null, '2 · Have a go'), attempt, h('div', { class: 'ja-hw-row2' }, checkBtn), verdict),
      h('section', null, h('h4', null, '3 · The answer'), answerBox)));
  }

  function resultLine(result, feedback) {
    var label = result === 'correct' ? '✓ Correct!' : result === 'partial' ? '◐ Nearly there' : result === 'incorrect' ? '✗ Not quite' : '✎ Saved';
    return h('div', { class: 'ja-hw-result ' + (result || 'saved') }, h('b', null, label), feedback ? ' ' + feedback : '');
  }

  function answerArea(it) {
    if (it.unlocked && it.answer) {
      return h('div', { class: 'ja-hw-answer open' }, h('div', { class: 'ja-hw-lockline' }, '🔓 Unlocked by your parent'), h('p', null, it.answer));
    }
    if (!it.unlockable) return h('div', { class: 'ja-hw-answer' }, h('p', null, '📝 This looks like a test or graded work, so the answer stays hidden. Jarvis can still teach you the topic.'));
    if (!(it.attempts > 0)) return h('div', { class: 'ja-hw-answer' }, h('div', { class: 'ja-hw-lockline' }, '🔒 Locked'), h('p', null, 'Have a go first: write your answer and press Check. Then a parent can unlock the answer.'));
    var box = h('div', { class: 'ja-hw-answer' }, h('div', { class: 'ja-hw-lockline' }, '🔒 Locked: a parent can unlock it'));
    var line = h('div', { class: 'ja-hw-unlock' });
    function refresh() { questionView(it.id); }
    if (it.request && it.request.status === 'pending') {
      line.appendChild(h('p', null, '⏳ Waiting for a parent to unlock it. ', h('button', { type: 'button', class: 'ja-link', onclick: refresh }, 'Check again')));
    } else {
      if (it.request && it.request.status === 'declined') line.appendChild(h('p', { class: 'ja-hw-note-from' }, '💬 Your parent said: "' + (it.request.note || 'Not yet, have another go.') + '"'));
      var askBtn = h('button', { type: 'button', class: 'btn ja-btn-outline btn-sm', onclick: function () {
        askBtn.disabled = true;
        call('hw-request', { item_id: it.id }).then(function (r) {
          if (!r.ok) { line.appendChild(errLine(r.j.error || 'Could not send the request.')); askBtn.disabled = false; return; }
          if (r.j.needsParent) { line.innerHTML = ''; line.appendChild(h('p', null, 'First link a parent: press "GET A CODE FOR MY PARENT" in your Learning Brain below and give them the code.')); return; }
          it.request = { status: 'pending' }; box.replaceWith(answerArea(it));
        }).catch(function () { askBtn.disabled = false; });
      } }, '📨 Ask a parent to unlock');
      line.appendChild(askBtn);
    }
    if (state.parentPin) {
      var pin = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 6, class: 'ja-hw-pin', placeholder: 'Parent PIN', 'aria-label': 'Parent PIN' });
      var pinMsg = h('span', { class: 'ja-err', hidden: true });
      var pinBtn = h('button', { type: 'button', class: 'btn ja-btn-outline btn-sm', onclick: function () {
        pinBtn.disabled = true; pinMsg.hidden = true;
        call('hw-pin-unlock', { item_id: it.id, pin: pin.value }).then(function (r) {
          pinBtn.disabled = false; pin.value = '';
          if (r.ok && r.j.item) { box.replaceWith(answerArea(r.j.item)); return; }
          pinMsg.textContent = r.j.error || 'That PIN isn\'t right.'; pinMsg.hidden = false;
        }).catch(function () { pinBtn.disabled = false; });
      } }, '🔢 Unlock with PIN');
      line.appendChild(h('div', { class: 'ja-hw-pinrow' }, h('span', null, 'Parent here?'), pin, pinBtn, pinMsg));
    } else if (state.linkedParent) {
      line.appendChild(h('p', { class: 'ja-hw-tip' }, 'Parent with you? They can set an unlock PIN in their family dashboard.'));
    }
    box.appendChild(line);
    return box;
  }

  /* ---------- images: load (EXIF-aware), rotate, crop, shrink ---------- */
  function loadImage(file) {
    var make = window.createImageBitmap ? createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return createImageBitmap(file); }) : Promise.reject();
    return make.catch(function () {
      return new Promise(function (ok, no) { var img = new Image(); img.onload = function () { ok(img); }; img.onerror = no; img.src = URL.createObjectURL(file); });
    }).then(function (src) {
      var w = src.width, hh = src.height, s = Math.min(1, 2200 / Math.max(w, hh));
      var c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(hh * s);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      return c;
    });
  }
  // Rotated + cropped page, longest side at most `max` px
  function renderPage(p, max) {
    var src = p.canvas, r = p.rot, rw = r % 180 ? src.height : src.width, rh = r % 180 ? src.width : src.height;
    var full = document.createElement('canvas'); full.width = rw; full.height = rh;
    var g = full.getContext('2d'); g.translate(rw / 2, rh / 2); g.rotate(r * Math.PI / 180); g.drawImage(src, -src.width / 2, -src.height / 2);
    var c = p.crop || { x: 0, y: 0, w: 1, h: 1 };
    var cw = Math.max(1, Math.round(c.w * rw)), ch = Math.max(1, Math.round(c.h * rh)), s = Math.min(1, max / Math.max(cw, ch));
    var out = document.createElement('canvas'); out.width = Math.round(cw * s); out.height = Math.round(ch * s);
    out.getContext('2d').drawImage(full, c.x * rw, c.y * rh, cw, ch, 0, 0, out.width, out.height);
    return out;
  }
  // Crop: drag the corners (or the box) over the page. Mouse, touch and pen.
  function cropper(p, done) {
    var keep = p.crop; p.crop = null;
    var view = renderPage(p, 900); p.crop = keep;
    var c = Object.assign({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 }, keep || {});
    var stage = h('div', { class: 'ja-crop-stage' }, view);
    var box = h('div', { class: 'ja-crop-box' }, ['nw', 'ne', 'sw', 'se'].map(function (k) { return h('i', { 'data-h': k }); }));
    stage.appendChild(box);
    function place() { box.style.left = c.x * 100 + '%'; box.style.top = c.y * 100 + '%'; box.style.width = c.w * 100 + '%'; box.style.height = c.h * 100 + '%'; }
    place();
    var drag = null;
    box.addEventListener('pointerdown', function (e) {
      e.preventDefault(); try { box.setPointerCapture(e.pointerId); } catch (x) {}
      drag = { h: e.target.dataset.h || 'move', x: e.clientX, y: e.clientY, c: Object.assign({}, c) };
    });
    box.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var r = stage.getBoundingClientRect(), dx = (e.clientX - drag.x) / r.width, dy = (e.clientY - drag.y) / r.height, o = drag.c, m = 0.08;
      if (drag.h === 'move') { c.x = Math.min(1 - o.w, Math.max(0, o.x + dx)); c.y = Math.min(1 - o.h, Math.max(0, o.y + dy)); }
      else {
        var L = o.x, T = o.y, R = o.x + o.w, B = o.y + o.h;
        if (/w/.test(drag.h)) L = Math.min(R - m, Math.max(0, o.x + dx)); if (/e/.test(drag.h)) R = Math.max(L + m, Math.min(1, R + dx));
        if (/n/.test(drag.h)) T = Math.min(B - m, Math.max(0, o.y + dy)); if (/s/.test(drag.h)) B = Math.max(T + m, Math.min(1, B + dy));
        c = { x: L, y: T, w: R - L, h: B - T };
      }
      place();
    });
    box.addEventListener('pointerup', function () { drag = null; });
    var modal = h('div', { class: 'ja-crop', role: 'dialog', 'aria-label': 'Crop page' },
      h('div', { class: 'ja-crop-card' }, h('p', null, 'Drag the corners so only the questions are inside. Leave out your name and school.'), stage,
        h('div', { class: 'ja-hw-actions' },
          h('button', { type: 'button', class: 'ja-link', onclick: function () { p.crop = null; modal.remove(); done(); } }, 'Reset'),
          h('button', { type: 'button', class: 'btn ja-btn-cyan btn-sm', onclick: function () { p.crop = c; modal.remove(); done(); } }, 'DONE'))));
    document.body.appendChild(modal);
  }

  /* =================== parent =================== */
  function parentRender() {
    if (!parentBox) return;
    if (!(JA().isParent && JA().isParent())) { parentBox.innerHTML = ''; return; }
    parentBox.innerHTML = ''; parentBox.appendChild(busy('Loading homework…'));
    call('hw-parent').then(function (res) {
      parentBox.innerHTML = '';
      if (!res.ok) { parentBox.appendChild(errLine(res.j.error || 'Could not load homework.')); return; }
      var d = res.j;
      parentBox.appendChild(h('h4', null, 'HOMEWORK ANSWERS'));
      if (!d.children.length) { parentBox.appendChild(h('p', { class: 'ja-hw-small' }, 'Link your child above to see their homework requests here.')); return; }
      parentBox.appendChild(d.pending.length ? h('div', null, d.pending.map(requestCard)) : h('p', { class: 'ja-hw-small' }, 'No answers waiting to be unlocked.'));
      parentBox.appendChild(pinCard(d.hasPin));
      if (d.recent.length) parentBox.appendChild(h('div', { class: 'ja-hwp-recent' }, h('h4', null, 'RECENT HOMEWORK'), d.recent.map(recentRow)));
    }).catch(function () { parentBox.innerHTML = ''; parentBox.appendChild(errLine('Could not reach the server.')); });
  }
  function requestCard(r) {
    var it = r.item, note = h('input', { type: 'text', maxlength: 300, placeholder: 'Optional note, e.g. "Try once more first"', class: 'ja-hw-note' });
    var msg = h('span', { class: 'ja-hw-small' });
    function decide(approve) {
      call('hw-decide', { request_id: r.id, approve: approve, note: note.value }).then(function (res) {
        msg.textContent = res.ok ? (approve ? '🔓 Unlocked. Your child can see the answer now.' : '👍 Sent. It stays locked.') : (res.j.error || 'Could not save.');
        if (res.ok) setTimeout(parentRender, 1200);
      });
    }
    return h('div', { class: 'ja-hwp-card' },
      h('div', { class: 'ja-hwp-top' }, h('b', null, r.child + ' · ' + (r.homework ? (r.homework.title || r.homework.subject) : 'Homework') + ' · Q' + it.idx), h('small', null, new Date(r.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))),
      h('p', null, it.question),
      h('p', { class: 'ja-hwp-attempt' }, h('b', null, 'Their attempt' + (it.attempts > 1 ? ' (' + it.attempts + ' tries)' : '') + ': '), it.attempt || '–', ' ',
        it.attemptResult ? h('span', { class: 'ja-hw-chip ' + (it.attemptResult === 'correct' ? 'ok' : '') }, it.attemptResult) : null),
      h('details', null, h('summary', null, 'Show the answer'), h('p', null, it.answer || 'No answer (test or graded work).')),
      note,
      h('div', { class: 'ja-hw-actions' },
        h('button', { type: 'button', class: 'btn ja-btn-outline btn-sm', onclick: function () { decide(false); } }, 'NOT YET'),
        h('button', { type: 'button', class: 'btn ja-btn-cyan btn-sm', onclick: function () { decide(true); } }, '🔓 UNLOCK')),
      msg);
  }
  function pinCard(hasPin) {
    var pin = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxlength: 6, class: 'ja-hw-pin', placeholder: hasPin ? 'New PIN' : '4–6 digits', 'aria-label': 'Unlock PIN' });
    var msg = h('span', { class: 'ja-hw-small' });
    return h('div', { class: 'ja-hwp-pin' },
      h('b', null, hasPin ? '🔢 Unlock PIN is set' : '🔢 Set an unlock PIN'),
      h('span', { class: 'ja-hw-small' }, 'Sitting with your child? Type this PIN on their screen to unlock an answer straight away. 5 wrong tries lock it for an hour.'),
      h('div', { class: 'ja-hw-pinrow' }, pin, h('button', { type: 'button', class: 'btn ja-btn-outline btn-sm', onclick: function () {
        call('hw-set-pin', { pin: pin.value }).then(function (r) { pin.value = ''; msg.textContent = r.ok ? '✓ PIN saved.' : (r.j.error || 'Could not save.'); if (r.ok) setTimeout(parentRender, 900); });
      } }, hasPin ? 'CHANGE PIN' : 'SAVE PIN'), msg));
  }
  function recentRow(hw) {
    var locked = hw.items.filter(function (i) { return !i.unlocked && i.answer; }).length;
    var msg = h('span', { class: 'ja-hw-small' });
    return h('details', { class: 'ja-hwp-hw' },
      h('summary', null, hw.child + ' · ' + (hw.title || hw.subject) + ' · ' + new Date(hw.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + (hw.assessment ? ' · test' : '')),
      h('ul', null, hw.items.map(function (i) {
        var status = i.unlocked ? '🔓 unlocked' + (i.method === 'pin' ? ' with PIN' : i.method === 'parent-all' ? ' (all)' : '') + (i.triedFirst ? ' after trying' : ' without trying') : i.attempts ? '✎ tried, ' + (i.attemptResult || 'saved') : 'not started';
        return h('li', null, h('b', null, 'Q' + i.idx + ' '), i.question.slice(0, 120), h('small', null, ' · ' + status));
      })),
      locked && !hw.assessment ? h('button', { type: 'button', class: 'btn ja-btn-outline btn-sm', onclick: function () {
        if (!confirm('Unlock all ' + locked + ' remaining answers for this homework?')) return;
        call('hw-unlock-all', { homework_id: hw.id }).then(function (r) { msg.textContent = r.ok ? '🔓 ' + r.j.unlocked + ' unlocked.' : (r.j.error || 'Could not unlock.'); if (r.ok) setTimeout(parentRender, 1200); });
      } }, 'UNLOCK ALL ' + locked) : null, msg);
  }

  /* ---------- wiring ---------- */
  // academy.js calls this whenever it redraws the sign-in state, which can happen several times;
  // only reset the panels when who is signed in actually changes, so work in progress isn't lost.
  var lastWho = null;
  function render() {
    var signed = JA().signedIn ? JA().signedIn() : false, parent = JA().isParent ? JA().isParent() : false;
    var who = !signed ? 'guest' : parent ? 'parent' : 'student';
    if (who === lastWho) return;
    lastWho = who;
    if (openBtn) openBtn.parentNode.hidden = parent;
    if (parent && panel) panel.hidden = true;
    if (panel && !panel.hidden) home();
    parentRender();
  }
  window.JAHW = { render: render };
  render();
})();
