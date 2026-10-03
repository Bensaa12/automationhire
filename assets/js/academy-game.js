/* Jarvis Academy — Maths Challenge.
 * A 60-second mental-maths game. Questions are generated here in the browser (no AI cost),
 * difficulty adapts to the player, and every mistake comes with Jarvis's method for next time.
 * Signed-in students' rounds are saved to their Learning Brain via POST /api/academy/game
 * (see api/_academy-tutor.js), so games also show in the parent view. */
(function () {
  'use strict';
  var root = document.getElementById('jaGame');
  if (!root) return;

  var ROUND_SECONDS = 60;
  var MINUS = '−';

  /* ---------- helpers ---------- */
  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function n(x) { return x < 0 ? MINUS + Math.abs(x) : String(x); }          // display number
  function br(x) { return x < 0 ? '(' + n(x) + ')' : n(x); }                  // bracket negatives
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---------- question generators: d = difficulty 1..5 ----------
     Each returns { q: question text, a: integer answer, how: Jarvis's method, topic } */
  var GEN = {
    'add-sub': function (d) {
      var add = d < 2 || Math.random() < 0.55, a, b;
      var r = [[1, 9, 1, 9], [5, 20, 1, 10], [10, 99, 2, 9], [20, 99, 11, 99], [100, 999, 11, 99]][d - 1];
      a = ri(r[0], r[1]); b = ri(r[2], r[3]);
      if (!add && b > a) { var t = a; a = b; b = t; }
      if (add) {
        var tensUp = Math.ceil((a + 1) / 10) * 10, gap = tensUp - a;
        var how = b > gap && a % 10 !== 0 && b < 10
          ? 'Make a ten first: ' + a + ' + ' + gap + ' = ' + tensUp + ', then + ' + (b - gap) + ' = ' + (a + b) + '.'
          : b >= 10 ? 'Add the tens, then the ones: ' + a + ' + ' + (b - b % 10) + ' = ' + (a + b - b % 10) + ', then + ' + (b % 10) + ' = ' + (a + b) + '.'
            : 'Count on from the bigger number: ' + a + ' + ' + b + ' = ' + (a + b) + '.';
        return { q: a + ' + ' + b, a: a + b, how: how };
      }
      var down = a % 10;
      var howS = b > down && down > 0 && b < 10
        ? 'Take away in two jumps: ' + a + ' ' + MINUS + ' ' + down + ' = ' + (a - down) + ', then ' + MINUS + ' ' + (b - down) + ' = ' + (a - b) + '.'
        : b >= 10 ? 'Take the tens, then the ones: ' + a + ' ' + MINUS + ' ' + (b - b % 10) + ' = ' + (a - b + b % 10) + ', then ' + MINUS + ' ' + (b % 10) + ' = ' + (a - b) + '.'
          : 'Count back ' + b + ' from ' + a + ': you land on ' + (a - b) + '.';
      return { q: a + ' ' + MINUS + ' ' + b, a: a - b, how: howS };
    },
    times: function (d) {
      var sets = [[2, 5, 10], [2, 3, 4, 5, 10], [2, 3, 4, 5, 6, 8, 10], [3, 4, 6, 7, 8, 9, 11, 12], [6, 7, 8, 9, 12]];
      var a = pick(sets[d - 1]), b = ri(d < 3 ? 1 : 2, d < 4 ? 10 : 12);
      if (Math.random() < 0.5) { var t = a; a = b; b = t; }
      return { q: a + ' × ' + b, a: a * b, how: timesTrick(a, b) };
    },
    divide: function (d) {
      var sets = [[2, 5, 10], [2, 3, 4, 5, 10], [3, 4, 6, 8], [6, 7, 8, 9, 12], [7, 8, 9, 11, 12]];
      var b = pick(sets[d - 1]), q = ri(2, d < 4 ? 10 : 12);
      return { q: (b * q) + ' ÷ ' + b, a: q, how: 'Think of the times table: ' + q + ' × ' + b + ' = ' + (b * q) + ', so ' + (b * q) + ' ÷ ' + b + ' = ' + q + '.' };
    },
    negatives: function (d) {
      var a, b;
      if (d === 1) { a = ri(1, 9); b = ri(a + 1, a + 9); return { q: a + ' ' + MINUS + ' ' + b, a: a - b, how: 'Start at ' + a + ' and go down ' + b + ': you pass zero and land on ' + n(a - b) + '.' }; }
      if (d === 2) { a = -ri(2, 12); b = ri(2, 15); return { q: n(a) + ' + ' + b, a: a + b, how: 'Start at ' + n(a) + ' and go up ' + b + ' on the number line: ' + n(a + b) + '.' }; }
      if (d === 3) {
        if (Math.random() < 0.5) { a = -ri(2, 12); b = ri(2, 12); return { q: n(a) + ' ' + MINUS + ' ' + b, a: a - b, how: 'Going down from a negative goes further below zero: ' + n(a) + ' ' + MINUS + ' ' + b + ' = ' + n(a - b) + '.' }; }
        a = ri(-9, 9); b = ri(2, 9);                          // a − (−b) = a + b
        return { q: n(a) + ' ' + MINUS + ' ' + br(-b), a: a + b, how: 'Subtracting a negative is the same as adding: ' + n(a) + ' + ' + b + ' = ' + n(a + b) + '.' };
      }
      a = ri(2, 9) * (Math.random() < 0.5 ? -1 : 1); b = ri(2, 9) * (a > 0 ? -1 : pick([1, -1]));
      if (d === 4) return { q: br(a) + ' × ' + br(b), a: a * b, how: (a < 0) === (b < 0) ? 'Same signs give a positive: ' + Math.abs(a) + ' × ' + Math.abs(b) + ' = ' + a * b + '.' : 'Different signs give a negative: ' + Math.abs(a) + ' × ' + Math.abs(b) + ' = ' + Math.abs(a * b) + ', so the answer is ' + n(a * b) + '.' };
      return { q: br(a * b) + ' ÷ ' + br(b), a: a, how: ((a * b < 0) === (b < 0) ? 'Same signs give a positive: ' : 'Different signs give a negative: ') + Math.abs(a * b) + ' ÷ ' + Math.abs(b) + ' = ' + Math.abs(a) + ', so the answer is ' + n(a) + '.' };
    },
    fractions: function (d) {
      var dens = [[2], [2, 4, 10], [3, 4, 5, 10], [3, 4, 5, 8, 10], [3, 5, 6, 8, 12]][d - 1];
      var den = pick(dens), num = d < 3 ? 1 : ri(1, den - 1);
      while (d >= 3 && gcd(num, den) !== 1) num = ri(1, den - 1);
      var amount = den * ri(2, d < 3 ? 10 : 12), part = amount / den;
      return { q: num + '/' + den + ' of ' + amount, a: part * num, how: num === 1 ? 'Divide by the bottom number: ' + amount + ' ÷ ' + den + ' = ' + part + '.' : 'Divide by the bottom (' + amount + ' ÷ ' + den + ' = ' + part + '), then times by the top (' + part + ' × ' + num + ' = ' + part * num + ').' };
    },
    percent: function (d) {
      var pcts = [[10, 50], [10, 25, 50], [5, 20, 25, 75], [15, 30, 35, 40, 60], [5, 15, 20, 35]][d - 1];
      var p = pick(pcts), base = pick(d < 3 ? [20, 40, 60, 80, 100, 120, 200] : [20, 40, 60, 80, 120, 160, 200, 240, 300, 400]);
      var v = base * p / 100;
      if (d === 5) return { q: 'Increase ' + base + ' by ' + p + '%', a: base + v, how: p + '% of ' + base + ' is ' + v + ', so ' + base + ' + ' + v + ' = ' + (base + v) + '.' };
      return { q: p + '% of ' + base, a: v, how: pctHow(p, base) };
    },
    algebra: function (d) {
      var x = ri(d < 3 ? 1 : -4, d < 4 ? 12 : 15), a = ri(2, d < 4 ? 6 : 9), b = ri(1, 15);
      if (d === 3 && x < 1) x = ri(1, 10);
      var ask = ',   x = ?';
      if (d === 1) return { q: 'x + ' + b + ' = ' + (x + b), ask: ask, a: x, how: 'Undo the + ' + b + ': x = ' + (x + b) + ' ' + MINUS + ' ' + b + ' = ' + n(x) + '.' };
      if (d === 2) return { q: a + 'x = ' + n(a * x), ask: ask, a: x, how: 'Undo the × ' + a + ': x = ' + n(a * x) + ' ÷ ' + a + ' = ' + n(x) + '.' };
      if (d === 3) return { q: a + 'x + ' + b + ' = ' + (a * x + b), ask: ask, a: x, how: 'Subtract ' + b + ' (' + a + 'x = ' + (a * x) + '), then divide by ' + a + ': x = ' + n(x) + '.' };
      if (d === 4) return { q: a + 'x ' + MINUS + ' ' + b + ' = ' + n(a * x - b), ask: ask, a: x, how: 'Add ' + b + ' (' + a + 'x = ' + n(a * x) + '), then divide by ' + a + ': x = ' + n(x) + '.' };
      return { q: a + '(x + ' + b + ') = ' + n(a * (x + b)), ask: ask, a: x, how: 'Divide by ' + a + ' (x + ' + b + ' = ' + n(x + b) + '), then subtract ' + b + ': x = ' + n(x) + '.' };
    },
    powers: function (d) {
      var b;
      if (d === 1) { b = ri(2, 10); return { q: b + '²', a: b * b, how: b + '² means ' + b + ' × ' + b + ' = ' + b * b + '.' }; }
      if (d === 2) { b = ri(4, 12); return Math.random() < 0.5 ? { q: '√' + b * b, a: b, how: 'Which number times itself makes ' + b * b + '? ' + b + ' × ' + b + ' = ' + b * b + ', so √' + b * b + ' = ' + b + '.' } : { q: b + '²', a: b * b, how: b + ' × ' + b + ' = ' + b * b + '.' }; }
      if (d === 3) { b = ri(2, 5); return { q: b + '³', a: b * b * b, how: b + '³ = ' + b + ' × ' + b + ' × ' + b + ' = ' + b * b + ' × ' + b + ' = ' + b * b * b + '.' }; }
      if (d === 4) { var e = ri(4, 10); return { q: '2' + sup(e), a: Math.pow(2, e), how: 'Keep doubling from 2, ' + e + ' times in all: 2' + sup(e) + ' = ' + Math.pow(2, e) + '.' }; }
      var p = ri(2, 6), q = ri(2, 6), base = pick([2, 3, 5, 7, 'x']), mult = Math.random() < 0.6;
      if (mult) return { q: base + sup(p) + ' × ' + base + sup(q), ask: ' = ' + base + '^?', a: p + q, how: 'Multiplying powers of the same number: add the powers. ' + p + ' + ' + q + ' = ' + (p + q) + '.' };
      var big = p + q;
      return { q: base + sup(big) + ' ÷ ' + base + sup(q), ask: ' = ' + base + '^?', a: p, how: 'Dividing powers of the same number: subtract the powers. ' + big + ' ' + MINUS + ' ' + q + ' = ' + p + '.' };
    }
  };
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function sup(x) { return String(x).replace(/\d/g, function (c) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]; }); }
  function timesTrick(a, b) {
    var big = Math.max(a, b), small = Math.min(a, b), ans = a * b;
    if (small === 1) return 'Anything times 1 stays the same: ' + ans + '.';
    if (small === 10 || big === 10) return 'Times 10: add a zero. ' + (small === 10 ? big : small) + ' → ' + ans + '.';
    if (small === 5 || big === 5) { var o = small === 5 ? big : small; return 'Times 5 is half of times 10: ' + o + ' × 10 = ' + o * 10 + ', half of that is ' + ans + '.'; }
    if (small === 9 || big === 9) { var m = small === 9 ? big : small; return 'Times 9 is times 10 take away one lot: ' + m * 10 + ' ' + MINUS + ' ' + m + ' = ' + ans + '.'; }
    if (small === 2 || big === 2) return 'Times 2 is doubling: double ' + (small === 2 ? big : small) + ' is ' + ans + '.';
    if (small === 11 || big === 11) { var e = small === 11 ? big : small; return 'Times 11: times 10, then add one more lot. ' + e * 10 + ' + ' + e + ' = ' + ans + '.'; }
    var even = a % 2 === 0 ? a : b % 2 === 0 ? b : 0;
    if (even && even >= 4) { var other = even === a ? b : a; return 'Halve and double: ' + other + ' × ' + even / 2 + ' = ' + other * even / 2 + ', doubled is ' + ans + '.'; }
    return a + ' × ' + b + ' = ' + ans + '. Try counting up in ' + small + 's: ' + big + ' steps.';
  }
  function pctHow(p, base) {
    var ten = base / 10, v = base * p / 100;
    if (p === 50) return '50% is a half: ' + base + ' ÷ 2 = ' + v + '.';
    if (p === 25) return '25% is a quarter: halve it twice. ' + base + ' → ' + base / 2 + ' → ' + v + '.';
    if (p === 75) return '75% is three quarters: a quarter is ' + base / 4 + ', so 3 × ' + base / 4 + ' = ' + v + '.';
    if (p === 10) return '10% means divide by 10: ' + base + ' ÷ 10 = ' + v + '.';
    if (p === 5) return '10% of ' + base + ' is ' + ten + ', and 5% is half of that: ' + v + '.';
    if (p % 10 === 0) return '10% of ' + base + ' is ' + ten + ', so ' + p + '% is ' + p / 10 + ' × ' + ten + ' = ' + v + '.';
    return '10% of ' + base + ' is ' + ten + ', 5% is ' + ten / 2 + '. Add the pieces to make ' + p + '%: ' + v + '.';
  }

  /* ---------- levels and topics ---------- */
  var LEVELS = {
    junior: { name: 'Junior', ages: 'ages 5–11', tutorLevel: 'primary', start: 1, topics: [['mixed', 'Mixed'], ['add-sub', 'Adding & taking away'], ['times', 'Times tables'], ['divide', 'Dividing']] },
    secondary: { name: 'Secondary', ages: 'ages 11–16', tutorLevel: 'secondary', start: 2, topics: [['mixed', 'Mixed'], ['negatives', 'Negative numbers'], ['fractions', 'Fractions of amounts'], ['percent', 'Percentages'], ['algebra', 'Solve for x'], ['powers', 'Powers & roots']] }
  };
  var TOPIC_NAMES = { 'add-sub': 'adding and taking away', times: 'times tables', divide: 'dividing', negatives: 'negative numbers', fractions: 'fractions of amounts', percent: 'percentages', algebra: 'solving equations', powers: 'powers and roots' };

  var lvl = store('ja_game_level') === 'secondary' ? 'secondary' : 'junior';
  var topic = 'mixed';
  var muted = store('ja_game_muted') === '1';

  /* ---------- sound (tiny WebAudio blips; no files) ---------- */
  var actx = null;
  function beep(freqs, dur) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * dur * 0.8;
        o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.start(t); o.stop(t + dur + 0.02);
      });
    } catch (e) { /* audio is optional */ }
  }
  var sfx = { right: function () { beep([660, 880], 0.12); }, wrong: function () { beep([220], 0.25); }, level: function () { beep([523, 659, 784], 0.12); }, end: function () { beep([784, 659, 523, 784], 0.16); } };

  /* ---------- UI ---------- */
  var setup = el('div', 'jg-setup'), play = el('div', 'jg-play'), end = el('div', 'jg-end');
  play.hidden = true; end.hidden = true;
  root.appendChild(setup); root.appendChild(play); root.appendChild(end);

  function bestKey() { return 'ja_game_best_' + lvl + '_' + topic; }

  function renderSetup() {
    setup.innerHTML = '';
    var lv = el('div', 'jg-row'); lv.appendChild(el('span', 'jg-label', 'Level'));
    var lvBtns = el('div', 'jg-choices');
    Object.keys(LEVELS).forEach(function (k) {
      var b = el('button', 'ja-tab', LEVELS[k].name + ' · ' + LEVELS[k].ages); b.type = 'button';
      b.setAttribute('aria-selected', String(k === lvl));
      b.addEventListener('click', function () { lvl = k; topic = 'mixed'; store('ja_game_level', k); renderSetup(); });
      lvBtns.appendChild(b);
    });
    lv.appendChild(lvBtns); setup.appendChild(lv);

    var tp = el('div', 'jg-row'); tp.appendChild(el('span', 'jg-label', 'Topic'));
    var tpBtns = el('div', 'jg-choices');
    LEVELS[lvl].topics.forEach(function (t) {
      var b = el('button', 'jg-topic', t[1]); b.type = 'button';
      b.setAttribute('aria-pressed', String(t[0] === topic));
      b.addEventListener('click', function () { topic = t[0]; renderSetup(); });
      tpBtns.appendChild(b);
    });
    tp.appendChild(tpBtns); setup.appendChild(tp);

    var best = Number(store(bestKey()) || 0);
    setup.appendChild(el('p', 'jg-best', best ? 'Your best on this one: ' + best + ' points. Can you beat it?' : 'No score yet on this one. Set the first record!'));
    var go = el('button', 'btn btn-lg ja-btn-cyan jg-go', 'START ▶'); go.type = 'button';
    go.addEventListener('click', function () { start(false); });
    setup.appendChild(go);
    var note = el('p', 'ja-note jg-note');
    note.textContent = window.JA && window.JA.student()
      ? 'Signed in: your rounds are saved to your Learning Brain, and a linked parent sees your progress.'
      : 'Free to play. Sign in and Jarvis remembers your scores and shows your progress to a linked parent.';
    setup.appendChild(note);
  }

  // Play screen
  var hud = el('div', 'jg-hud');
  var tEl = el('b', null, String(ROUND_SECONDS)), sEl = el('b', null, '0'), mEl = el('span', 'jg-mult', '×1'), dEl = el('span', 'jg-diff');
  var timeWrap = el('span', 'jg-stat'); timeWrap.append('⏱ ', tEl);
  var scoreWrap = el('span', 'jg-stat'); scoreWrap.append('Score ', sEl);
  var muteBtn = el('button', 'ja-link jg-mute'); muteBtn.type = 'button';
  var quitBtn = el('button', 'ja-link', 'Stop'); quitBtn.type = 'button';
  hud.append(timeWrap, scoreWrap, mEl, dEl, muteBtn, quitBtn);
  var bar = el('div', 'jg-timebar'), barFill = el('i'); bar.appendChild(barFill);
  var qEl = el('div', 'jg-q'); qEl.setAttribute('aria-live', 'polite');
  var aEl = el('div', 'jg-answer');
  var fbEl = el('div', 'jg-feedback'); fbEl.setAttribute('aria-live', 'polite');
  var pad = el('div', 'jg-pad');
  ['7', '8', '9', '4', '5', '6', '1', '2', '3', MINUS, '0', '⌫'].forEach(function (k) {
    var b = el('button', 'jg-key', k); b.type = 'button';
    b.addEventListener('click', function () { press(k === MINUS ? '-' : k === '⌫' ? 'Backspace' : k); });
    pad.appendChild(b);
  });
  var okBtn = el('button', 'jg-key jg-ok', 'OK ↵'); okBtn.type = 'button';
  okBtn.addEventListener('click', function () { press('Enter'); });
  pad.appendChild(okBtn);
  play.append(hud, bar, qEl, aEl, fbEl, pad);

  function renderMute() { muteBtn.textContent = muted ? '🔇 Sound off' : '🔊 Sound on'; }
  muteBtn.addEventListener('click', function () { muted = !muted; store('ja_game_muted', muted ? '1' : '0'); renderMute(); });
  renderMute();
  quitBtn.addEventListener('click', function () { finish(true); });

  /* ---------- game state ---------- */
  var g = null, timer = null;

  function topicFor() {
    if (topic !== 'mixed') return topic;
    return pick(LEVELS[lvl].topics.slice(1))[0];
  }
  function nextQuestion() {
    var q;
    if (g.practice) {
      if (!g.queue.length) return finish(false);
      q = g.queue.shift();
    } else {
      var t = topicFor();
      // Avoid repeating the exact same question twice in a row.
      for (var i = 0; i < 5; i++) { q = GEN[t](g.diff); q.topic = t; if (!g.cur || q.q !== g.cur.q) break; }
    }
    g.cur = q; g.typed = '';
    qEl.textContent = q.q + (q.ask !== undefined ? q.ask : ' = ?');
    renderAnswer();
  }
  function renderAnswer() { aEl.textContent = g.typed ? g.typed.replace('-', MINUS) : ' '; }
  function renderHud() {
    sEl.textContent = String(g.score);
    mEl.textContent = '×' + mult();
    mEl.classList.toggle('hot', mult() > 1);
    dEl.textContent = g.practice ? 'Practice · no clock' : 'Level ' + g.diff;
  }
  function mult() { return Math.min(5, 1 + Math.floor(g.streak / 3)); }

  function start(practice) {
    var queue = practice ? g.missed.map(function (m) { return m.q; }) : [];
    g = { score: 0, streak: 0, bestStreak: 0, right: 0, total: 0, diff: LEVELS[lvl].start, missed: [], per: {}, practice: practice, queue: queue, left: ROUND_SECONDS, cur: null, typed: '' };
    setup.hidden = true; end.hidden = true; play.hidden = false;
    bar.hidden = practice; timeWrap.hidden = practice; scoreWrap.hidden = practice; mEl.hidden = practice;
    fbEl.textContent = practice ? 'Practice your mistakes. No clock, no pressure: get each one right to finish.' : 'Type the answer, then press Enter (or OK). Go!';
    fbEl.className = 'jg-feedback';
    renderHud(); nextQuestion();
    root.scrollIntoView({ behavior: 'smooth', block: 'center' });
    clearInterval(timer);
    if (!practice) {
      var t0 = Date.now();
      timer = setInterval(function () {
        g.left = Math.max(0, ROUND_SECONDS - (Date.now() - t0) / 1000);
        tEl.textContent = String(Math.ceil(g.left));
        barFill.style.width = (g.left / ROUND_SECONDS * 100) + '%';
        bar.classList.toggle('low', g.left <= 10);
        if (g.left <= 0) finish(false);
      }, 100);
    }
  }

  function press(k) {
    if (!g || play.hidden) return;
    if (/^\d$/.test(k)) { if (g.typed.replace('-', '').length < 6) g.typed += k; }
    else if (k === '-') { g.typed = g.typed.charAt(0) === '-' ? g.typed.slice(1) : '-' + g.typed; }
    else if (k === 'Backspace') g.typed = g.typed.slice(0, -1);
    else if (k === 'Enter') return submit();
    renderAnswer();
  }

  function submit() {
    if (!g.typed || g.typed === '-') return;
    var given = parseInt(g.typed, 10), q = g.cur, ok = given === q.a;
    var per = g.per[q.topic] || (g.per[q.topic] = { total: 0, correct: 0, mistake: '' });
    per.total++; g.total++;
    if (ok) {
      g.right++; per.correct++; g.streak++; g.bestStreak = Math.max(g.bestStreak, g.streak);
      if (!g.practice) {
        g.score += 10 * mult();
        if (g.streak % 3 === 0 && g.diff < 5) { g.diff++; sfx.level(); fbEl.textContent = pick(['Splendid. Turning it up a notch.', 'Very good. Level ' + g.diff + ' now.', 'Excellent streak. Harder ones coming.']); fbEl.className = 'jg-feedback good'; }
        else { sfx.right(); fbEl.textContent = pick(['Correct!', 'Spot on.', 'Very good.', 'Lovely.', 'Precisely.', 'Yes!']) + (mult() > 1 ? ' Streak ×' + mult() + '!' : ''); fbEl.className = 'jg-feedback good'; }
      } else { sfx.right(); fbEl.textContent = 'Correct! ' + (g.queue.length ? g.queue.length + ' to go.' : 'All done!'); fbEl.className = 'jg-feedback good'; }
      flash('good');
    } else {
      sfx.wrong(); flash('bad');
      g.streak = 0;
      if (!g.practice && g.diff > 1) g.diff--;
      per.mistake = q.q + ' (answered ' + n(given) + ', correct ' + n(q.a) + ')';
      if (!g.practice && !g.missed.some(function (m) { return m.q.q === q.q; })) g.missed.push({ q: q, given: given });
      if (g.practice) g.queue.push(q);                       // try it again before the end
      fbEl.textContent = 'Not quite: the answer is ' + n(q.a) + '. ' + q.how;
      fbEl.className = 'jg-feedback bad';
    }
    renderHud(); nextQuestion();
  }
  function flash(cls) { qEl.classList.remove('good', 'bad'); void qEl.offsetWidth; qEl.classList.add(cls); }

  document.addEventListener('keydown', function (e) {
    if (!g || play.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    var k = e.key === '−' ? '-' : e.key;
    if (/^\d$/.test(k) || k === '-' || k === 'Backspace' || k === 'Enter') { e.preventDefault(); press(k); }
  });

  /* ---------- results ---------- */
  function finish(quit) {
    clearInterval(timer);
    if (play.hidden) return;
    play.hidden = true;
    if (g.practice) return showPracticeEnd();
    if (quit && g.total === 0) { setup.hidden = false; renderSetup(); return; }
    sfx.end();
    var acc = g.total ? Math.round(g.right / g.total * 100) : 0;
    var junior = lvl === 'junior';
    var th = junior ? [4, 10, 16] : [5, 12, 20];
    var stars = g.right >= th[2] && acc >= 85 ? 3 : g.right >= th[1] && acc >= 70 ? 2 : g.right >= th[0] ? 1 : 0;
    var best = Number(store(bestKey()) || 0), newBest = !quit && g.score > best;
    if (newBest) store(bestKey(), String(g.score));

    end.innerHTML = '';
    end.appendChild(el('div', 'jg-stars', '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars)));
    end.appendChild(el('h3', 'jg-score', g.score + ' points'));
    if (newBest) end.appendChild(el('p', 'jg-newbest', best ? 'New personal best! (was ' + best + ')' : 'First record set!'));
    var stats = el('div', 'jg-stats');
    [[g.right + '/' + g.total, 'correct'], [acc + '%', 'accuracy'], [String(g.bestStreak), 'best streak'], ['Level ' + g.diff, 'reached']].forEach(function (s) {
      var c = el('div', 'jg-statbox'); c.appendChild(el('b', null, s[0])); c.appendChild(el('span', null, s[1])); stats.appendChild(c);
    });
    end.appendChild(stats);
    end.appendChild(el('p', 'jg-jarvis', '“' + jarvisLine(stars, acc, junior) + '” — Jarvis'));

    var weak = weakestTopic();
    var btns = el('div', 'jg-btns');
    var again = el('button', 'btn ja-btn-cyan', 'PLAY AGAIN'); again.type = 'button';
    again.addEventListener('click', function () { start(false); });
    btns.appendChild(again);
    if (g.missed.length) {
      var prac = el('button', 'btn ja-btn-outline', 'PRACTISE MY ' + g.missed.length + ' MISTAKE' + (g.missed.length > 1 ? 'S' : '')); prac.type = 'button';
      prac.addEventListener('click', function () { start(true); });
      btns.appendChild(prac);
    }
    if (weak && window.JA) {
      var ask = el('button', 'btn ja-btn-outline', 'ASK JARVIS ABOUT ' + TOPIC_NAMES[weak].toUpperCase()); ask.type = 'button';
      ask.addEventListener('click', function () {
        var m = g.per[weak].mistake;
        window.JA.askTutor('Can you help me with ' + TOPIC_NAMES[weak] + '? In the Maths Challenge I got ' + (m || 'some wrong') + '.', LEVELS[lvl].tutorLevel);
      });
      btns.appendChild(ask);
    }
    var change = el('button', 'ja-link', 'Change level or topic'); change.type = 'button';
    change.addEventListener('click', function () { end.hidden = true; setup.hidden = false; renderSetup(); });
    btns.appendChild(change);
    end.appendChild(btns);

    var saveMsg = el('p', 'ja-note jg-save');
    end.appendChild(saveMsg);
    end.hidden = false;
    if (newBest || stars === 3) confetti();
    saveRound(saveMsg);
  }

  function showPracticeEnd() {
    end.innerHTML = '';
    end.appendChild(el('div', 'jg-stars', '✔'));
    end.appendChild(el('h3', 'jg-score', 'Mistakes fixed!'));
    end.appendChild(el('p', 'jg-jarvis', '“' + pick(['Every one corrected. That is how the clever ones do it.', 'Splendid. Mistakes are simply lessons wearing a disguise.', 'Very good. Shall we see if the score improves now?']) + '” — Jarvis'));
    var btns = el('div', 'jg-btns');
    var again = el('button', 'btn ja-btn-cyan', 'PLAY AGAIN'); again.type = 'button';
    again.addEventListener('click', function () { g.missed = []; start(false); });
    var change = el('button', 'ja-link', 'Change level or topic'); change.type = 'button';
    change.addEventListener('click', function () { end.hidden = true; setup.hidden = false; renderSetup(); });
    btns.append(again, change); end.appendChild(btns);
    end.hidden = false;
  }

  function weakestTopic() {
    var worst = null, worstAcc = 101;
    Object.keys(g.per).forEach(function (t) { var p = g.per[t], a = p.correct / p.total * 100; if (p.total - p.correct > 0 && a < worstAcc) { worst = t; worstAcc = a; } });
    return worst;
  }

  function jarvisLine(stars, acc, junior) {
    var lines = junior
      ? [['Good try, my friend! Every game makes your brain a little stronger. Shall we go again?', 'Nice start! Have a look at the tricks for the ones you missed, then try again.'],
         ['Well done! You are getting quicker. Can you get an extra star next time?', 'Lovely work! Practise the mistakes and that score will climb.'],
         ['Brilliant! That was super quick thinking.', 'Wow, great job! Your number skills are looking strong.'],
         ['Amazing! Three stars! You are a maths superstar!', 'Fantastic! Three stars. I am very impressed, my friend.']]
      : [['A modest start. Read my notes on the misses; speed follows understanding.', 'Every expert was once a beginner. Practise the mistakes, then go again.'],
         ['Respectable. With a little practice that becomes rather good.', 'Good work. The streak multiplier rewards accuracy over haste.'],
         ['Very good indeed. Your mental arithmetic is in fine form.', 'Excellent. A few more rounds and the examiners should be nervous.'],
         ['Outstanding. Three stars. I shall alert the Royal Society.', 'Splendid, sir. Three stars and barely a hair out of place.']];
    return pick(lines[stars]);
  }

  function confetti() {
    var box = el('div', 'jg-confetti');
    for (var i = 0; i < 60; i++) {
      var p = el('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = pick(['#22d3ee', '#2979ff', '#00e676', '#fbbf24', '#f472b6']);
      p.style.animationDelay = Math.random() * 0.6 + 's';
      p.style.transform = 'rotate(' + ri(0, 360) + 'deg)';
      box.appendChild(p);
    }
    root.appendChild(box);
    setTimeout(function () { box.remove(); }, 3200);
  }

  /* ---------- Learning Brain ---------- */
  function saveRound(msg) {
    var results = Object.keys(g.per).map(function (t) { return { topic: t, total: g.per[t].total, correct: g.per[t].correct, mistake: g.per[t].mistake }; });
    if (!window.JA || !window.JA.student()) {
      msg.textContent = 'Want Jarvis to remember this? ';
      var b = el('button', 'ja-link ja-link-strong', 'Create a free account'); b.type = 'button';
      b.addEventListener('click', function () { window.JA ? window.JA.signUp() : document.getElementById('try').scrollIntoView(); });
      msg.appendChild(b);
      msg.appendChild(document.createTextNode(' and your rounds go into your Learning Brain, where a parent can follow your progress.'));
      return;
    }
    if (!results.length) return;
    msg.textContent = 'Saving to your Learning Brain…';
    window.JA.apiAuthed('game', { results: results }).then(function (res) {
      if (res.ok) { msg.textContent = '✓ Saved to your Learning Brain.'; window.JA.refreshBrain(); }
      else msg.textContent = res.status === 429 ? 'Saved rounds are limited to one every 20 seconds, so this one wasn’t recorded.' : 'Could not save this round to your Learning Brain.';
    }).catch(function () { msg.textContent = 'Could not reach the server to save this round.'; });
  }

  // Exposed for automated checks of the question maths (not used by the page itself).
  window.JA_GAME_GEN = GEN;

  renderSetup();
})();
