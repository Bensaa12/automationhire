/* Jarvis Academy — Spelling Bee (primary, ages 5–11).
 * Jarvis says a word and a sentence (browser speech, British voice when available) and the child
 * spells it. Or "Look, cover, write": the word shows for 3 seconds, then hides.
 * Word lists follow the English National Curriculum: Year 1–2 common exception words, and the
 * Year 3–4 and Year 5–6 statutory spelling lists (British spellings).
 * Signed-in students' rounds go to their Learning Brain as English: Spelling (POST /api/academy/game). */
(function () {
  'use strict';
  var root = document.getElementById('jaSpell');
  if (!root) return;

  var ROUND = 10;

  /* [word, sentence with ___ for the word, memory trick (optional)] */
  var LISTS = {
    'spell-5-7': { name: 'Ages 5–7', tutorLevel: 'primary', words: [
      ['the', 'Look at ___ big red bus.', 't-h-e: just three letters.'],
      ['said', 'Mum ___ it was time for bed.', 'It sounds like "sed", but it has "ai" in the middle: s-ai-d.'],
      ['have', 'I ___ two cats.', 'English words don’t end in v, so we add an e: have.'],
      ['like', 'I ___ eating apples.', 'l-i-k-e: the e at the end makes the i say its name.'],
      ['come', 'Please ___ to my party.', 'It sounds like "cum", but it has an o: c-o-m-e.'],
      ['some', 'Can I have ___ juice, please?', 'Just like come: s-o-m-e.'],
      ['love', 'I ___ my family.', 'The o says "uh", and words don’t end in v: l-o-v-e.'],
      ['house', 'We live in a blue ___.', '"ou" says "ow", then -se: h-ou-se.'],
      ['friend', 'My best ___ lives next door.', 'fr-IE-nd: I will be your friend to the END.'],
      ['school', 'We walk to ___ every morning.', '"sch" makes the "sk" sound: sch-ool.'],
      ['people', 'Lots of ___ came to the fair.', 'p-EO-ple: the e and the o sit together.'],
      ['once', '___ upon a time there was a dragon.', 'It sounds like "wunce", but it starts with o: o-n-c-e.'],
      ['because', 'I wore a coat ___ it was cold.', 'Big Elephants Can Always Understand Small Elephants.'],
      ['little', 'The ___ mouse ran away.', 'Double t, then -le: li-tt-le.'],
      ['could', '___ you help me, please?', '-ould: O U Lucky Duck!'],
      ['would', '___ you like a biscuit?', 'Like could, but with a w: w-ould.'],
      ['should', 'You ___ brush your teeth.', 'Like could, but with sh: sh-ould.'],
      ['water', 'Fish swim in the ___.', 'The a sounds like "or": w-a-t-e-r.'],
      ['again', 'Let’s play that game ___!', 'a-g-AI-n.'],
      ['there', 'Put the book over ___.', 'There has "here" inside it, and both are about places.'],
      ['where', '___ is my other shoe?', 'It starts with wh, like when and what.'],
      ['every', 'I read a story ___ night.', 'ever + y = every.'],
      ['pretty', 'What a ___ flower!', 'It sounds like "pritty", but it has an e, and double t.'],
      ['beautiful', 'The sunset was ___.', 'Big Elephants Are Useful: b-e-a-u, then tiful.'],
      ['after', 'We play outside ___ lunch.', 'a-f-t-e-r.'],
      ['father', 'My ___ makes pancakes on Sunday.', 'f-a-th-er.'],
      ['children', 'The ___ played in the park.', 'child + ren.'],
      ['climb', 'Monkeys ___ trees.', 'A silent b at the end: clim-B.'],
      ['busy', 'The shop was very ___.', 'It sounds like "bizzy", but it is spelt with a u: b-u-s-y.'],
      ['great', 'We had a ___ day at the beach.', 'gr-EA-t.'],
      ['move', 'Can you ___ your chair, please?', 'The o sounds like "oo": m-o-v-e.'],
      ['half', 'I ate ___ of the cake.', 'A silent l: ha-L-f.'],
      ['money', 'I saved my ___ in a jar.', 'The o says "uh": m-o-n-e-y.'],
      ['eye', 'I closed one ___.', 'e-y-e: it even looks like a face!'],
      ['door', 'Please shut the ___.', 'Double o, then r: d-oo-r.'],
      ['whole', 'I ate the ___ pizza!', 'A silent w: W-hole.']
    ] },
    'spell-7-9': { name: 'Ages 7–9', tutorLevel: 'primary', words: [
      ['answer', 'Put your hand up to ___ the question.', 'A silent w: ans-W-er.'],
      ['believe', 'I ___ in you.', 'Never beLIEve a LIE.'],
      ['bicycle', 'I ride my ___ to the park.', 'bi (two) + cycle (wheels).'],
      ['build', 'Let’s ___ a sandcastle.', 'b-U-I-ld: yoU and I build together.'],
      ['calendar', 'Look at the ___ to find the date.', 'It ends in -dar, not -der.'],
      ['caught', 'She ___ the ball.', 'c-AUGH-t, like taught.'],
      ['centre', 'Stand in the ___ of the circle.', 'The British spelling ends in -tre.'],
      ['circle', 'Draw a ___ with your compass.', 'Two c’s: C-ir-C-le.'],
      ['different', 'Every snowflake is ___.', 'Say it slowly: diff-ER-ent.'],
      ['difficult', 'This puzzle is ___.', 'Double f, then i-c-u-l-t.'],
      ['disappear', 'The magician made the rabbit ___.', 'dis + appear: one s, double p.'],
      ['early', 'I woke up ___ today.', 'It starts with EAR: ear-ly.'],
      ['eight', 'A spider has ___ legs.', 'e-IGH-t.'],
      ['enough', 'Have you had ___ to eat?', 'Here "ough" makes the "uff" sound.'],
      ['favourite', 'Blue is my ___ colour.', 'British spelling: fav-OU-rite.'],
      ['February', 'My birthday is in ___.', 'Feb-RU-ary: don’t forget the first r.'],
      ['fruit', 'Apples are my favourite ___.', 'fr-UI-t.'],
      ['guard', 'A ___ stood by the castle gate.', 'A silent u after the g: g-U-ard.'],
      ['heart', 'My ___ beats fast when I run.', 'hear + t: you can HEAR your heart.'],
      ['island', 'We sailed to a small ___.', 'An island IS LAND: is + land, with a silent s.'],
      ['knowledge', 'Reading gives you ___.', 'A silent k: know + ledge.'],
      ['library', 'I borrowed a book from the ___.', 'Two r’s: lib-R-a-R-y.'],
      ['minute', 'Wait a ___, please.', 'min-U-te.'],
      ['naughty', 'The ___ puppy chewed my shoe.', 'n-AUGH-ty.'],
      ['often', 'I ___ walk to school.', 'of + ten.'],
      ['peculiar', 'What a ___ smell!', 'pe-cu-li-ar.'],
      ['potatoes', 'We had roast ___ for dinner.', 'More than one potato: add -es.'],
      ['quarter', 'A ___ of an hour is fifteen minutes.', 'qu-AR-ter.'],
      ['question', 'Can I ask a ___?', '-tion makes the "chun" sound here.'],
      ['separate', 'Keep the eggs ___ from the flour.', 'There is A RAT in sep-A-RAT-e.'],
      ['special', 'Today is a ___ day.', '-cial makes the "shul" sound.'],
      ['straight', 'Draw a ___ line with a ruler.', 'str-AIGH-t.'],
      ['surprise', 'We planned a ___ party.', 'SUR-prise: don’t forget the first r.'],
      ['though', 'It was cold, ___ it was sunny.', 'th-OUGH.'],
      ['through', 'We walked ___ the forest.', 'thr-OUGH.'],
      ['women', 'Two ___ won the race.', 'wo-MEN: more than one woman.']
    ] },
    'spell-9-11': { name: 'Ages 9–11', tutorLevel: 'primary', words: [
      ['accommodate', 'The hotel can ___ forty guests.', 'Double c AND double m: a-CC-o-MM-odate.'],
      ['achieve', 'Work hard and you will ___ your goal.', 'i before e: ach-IE-ve.'],
      ['amateur', 'She is an ___ painter, not a professional.', 'am-a-TEUR.'],
      ['ancient', 'We visited an ___ castle.', 'an-CIENT: c-i-e.'],
      ['awkward', 'There was an ___ silence.', 'Two w’s: a-W-k-W-ard.'],
      ['bargain', 'The jumper was a ___ at five pounds.', 'bar-GAIN: you GAIN with a bargain.'],
      ['bruise', 'I got a ___ on my knee.', 'br-UI-se.'],
      ['committee', 'The school ___ met today.', 'Double m, double t, double e.'],
      ['conscience', 'My ___ told me to tell the truth.', 'con + SCIENCE.'],
      ['curiosity', '___ made the cat open the box.', 'curious loses its u: curi-OSITY.'],
      ['definite', 'Is that a ___ yes?', 'There is FINITE in de-FINITE.'],
      ['desperate', 'The thirsty dog was ___ for water.', 'desp-ER-ate.'],
      ['embarrass', 'Please don’t ___ me in front of my friends!', 'Double r and double s: Really Red, So Shy.'],
      ['environment', 'We must protect the ___.', 'There is IRON in env-IRON-ment.'],
      ['especially', 'I love fruit, ___ mangoes.', 'e + SPECIAL + ly.'],
      ['exaggerate', 'Don’t ___. It wasn’t that big!', 'Double g: exa-GG-erate.'],
      ['foreign', 'She speaks a ___ language.', 'for-EIGN.'],
      ['forty', 'My dad is ___ years old.', 'No u: four, but forty.'],
      ['government', 'The ___ makes new laws.', 'There is GOVERN in govern-ment.'],
      ['immediately', 'Come here ___!', 'Double m: i-MM-ediately.'],
      ['language', 'French is a beautiful ___.', 'lang-UA-ge.'],
      ['lightning', 'We saw ___ in the storm.', 'No e: lightning, not lightening.'],
      ['marvellous', 'What a ___ performance!', 'Double l in British English: marve-LL-ous.'],
      ['mischievous', 'The ___ kitten hid my sock.', 'mischief → mischievous: the f becomes v. There is no "i" before -ous.'],
      ['necessary', 'Is it ___ to bring a coat?', 'One Collar and two Sleeves: one c, double s.'],
      ['neighbour', 'Our ___ has a friendly dog.', 'neigh + bour (British -our).'],
      ['nuisance', 'The buzzing fly was a ___.', 'n-UI-sance.'],
      ['parliament', 'Laws are debated in ___.', 'A hidden i: parl-I-ament.'],
      ['persuade', 'Can I ___ you to stay a little longer?', 'pers-UA-de.'],
      ['queue', 'We waited in a long ___.', 'q, then u-e-u-e.'],
      ['recommend', 'I ___ this book to everyone.', 'One c, double m: re-C-o-MM-end.'],
      ['restaurant', 'We ate at an Italian ___.', 'rest-AU-rant.'],
      ['rhythm', 'Clap along to the ___.', 'Rhythm Helps Your Two Hips Move.'],
      ['soldier', 'The ___ marched in the parade.', 'sol-DIER.'],
      ['temperature', 'Check the ___ outside.', 'tem-PER-ature: don’t skip the "per".'],
      ['vegetable', 'Carrots are my favourite ___.', 'VEG-E-TABLE.']
    ] }
  };

  /* ---------- helpers ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function button(cls, text, onClick) { var b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', onClick); return b; }

  var listId = LISTS[store('ja_spell_list')] ? store('ja_spell_list') : 'spell-5-7';
  var speechOk = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  var mode = store('ja_spell_mode') === 'look' || !speechOk ? 'look' : 'listen';
  var muted = store('ja_game_muted') === '1';            // shared with the Maths Challenge sound setting

  /* ---------- speech + sound ---------- */
  var voice = null;
  function chooseVoice() {
    if (!speechOk) return;
    var vs = speechSynthesis.getVoices();
    voice = vs.filter(function (v) { return /en[-_]GB/i.test(v.lang); }).sort(function (a, b) { return (/female|libby|sonia|hazel|serena/i.test(b.name) ? 1 : 0) - (/female|libby|sonia|hazel|serena/i.test(a.name) ? 1 : 0); })[0]
      || vs.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
  }
  if (speechOk) { chooseVoice(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', chooseVoice); }
  function say(parts, slow) {
    if (!speechOk) return;
    speechSynthesis.cancel();
    parts.forEach(function (text, i) {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-GB'; if (voice) u.voice = voice;
      u.rate = slow ? 0.55 : 0.85; u.pitch = 1;
      if (i > 0) u.volume = 1;
      speechSynthesis.speak(u);
    });
  }
  function speakWord(w, slow) {
    var sentence = w[1].replace('___', w[0]);
    say(slow ? [w[0]] : [w[0] + '.', sentence, w[0] + '.'], slow);
  }
  var actx = null;
  function beep(freqs, dur) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * dur * 0.8;
        o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.start(t); o.stop(t + dur + 0.02);
      });
    } catch (e) { /* optional */ }
  }

  /* ---------- screens ---------- */
  var setup = el('div', 'js-setup'), play = el('div', 'js-play'), end = el('div', 'jg-end');
  play.hidden = true; end.hidden = true;
  root.append(setup, play, end);

  function missedKey() { return 'ja_spell_missed_' + listId; }
  function getMissed() { try { return JSON.parse(store(missedKey()) || '[]'); } catch (e) { return []; } }
  function setMissed(arr) { store(missedKey(), JSON.stringify(arr.slice(-20))); }

  function renderSetup() {
    setup.innerHTML = '';
    var r1 = el('div', 'jg-row'); r1.appendChild(el('span', 'jg-label', 'Words'));
    var c1 = el('div', 'jg-choices');
    Object.keys(LISTS).forEach(function (k) {
      var b = button('ja-tab', LISTS[k].name, function () { listId = k; store('ja_spell_list', k); renderSetup(); });
      b.setAttribute('aria-selected', String(k === listId)); c1.appendChild(b);
    });
    r1.appendChild(c1); setup.appendChild(r1);

    var r2 = el('div', 'jg-row'); r2.appendChild(el('span', 'jg-label', 'How'));
    var c2 = el('div', 'jg-choices');
    [['listen', '🔊 Listen & spell'], ['look', '👀 Look, cover, write']].forEach(function (m) {
      var b = button('jg-topic', m[1], function () { mode = m[0]; store('ja_spell_mode', m[0]); renderSetup(); });
      b.setAttribute('aria-pressed', String(m[0] === mode));
      if (m[0] === 'listen' && !speechOk) { b.disabled = true; b.title = 'Your browser can’t speak words aloud'; }
      c2.appendChild(b);
    });
    r2.appendChild(c2); setup.appendChild(r2);

    var best = Number(store('ja_spell_best_' + listId) || 0), missed = getMissed();
    setup.appendChild(el('p', 'jg-best', (best ? 'Your best: ' + best + ' points. ' : 'No score yet: set the first record! ') + (missed.length ? missed.length + ' word' + (missed.length > 1 ? 's' : '') + ' to practise from last time will come back.' : '')));
    var go = button('btn btn-lg ja-btn-cyan jg-go', 'START ▶', function () { start(null); });
    setup.appendChild(go);
    if (missed.length) setup.appendChild(button('btn ja-btn-outline js-practise', 'PRACTISE MY ' + missed.length + ' WORD' + (missed.length > 1 ? 'S' : ''), function () { start(missed); }));
    setup.appendChild(el('p', 'ja-note jg-note', window.JA && window.JA.student()
      ? 'Signed in: your spelling goes into your Learning Brain, and a linked parent sees your progress.'
      : (speechOk ? 'Turn your sound on: Jarvis says each word and a sentence. ' : '') + 'Sign in and Jarvis remembers your progress.'));
  }

  // Play screen pieces
  var hud = el('div', 'jg-hud');
  var countEl = el('b'), scoreEl = el('b'), multEl = el('span', 'jg-mult', '×1');
  var countWrap = el('span', 'jg-stat'); countWrap.append('Word ', countEl);
  var scoreWrap = el('span', 'jg-stat'); scoreWrap.append('Score ', scoreEl);
  var muteBtn = button('ja-link jg-mute', '', function () { muted = !muted; store('ja_game_muted', muted ? '1' : '0'); renderMute(); });
  var stopBtn = button('ja-link', 'Stop', function () { finish(true); });
  hud.append(countWrap, scoreWrap, multEl, muteBtn, stopBtn);
  function renderMute() { muteBtn.textContent = muted ? '🔇 Beeps off' : '🔊 Beeps on'; }
  renderMute();

  var listen = el('div', 'js-listen');
  var hearBtn = button('btn ja-btn-outline', '🔊 Hear it again', function () { speakWord(s.cur, false); });
  var slowBtn = button('btn ja-btn-outline', '🐢 Slowly', function () { speakWord(s.cur, true); });
  listen.append(hearBtn, slowBtn);
  var flashEl = el('div', 'js-flash');
  var clueEl = el('p', 'js-clue');
  var tilesEl = el('div', 'js-tiles');
  var fbEl = el('div', 'jg-feedback'); fbEl.setAttribute('aria-live', 'polite');
  var kb = el('div', 'js-kb');
  ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].forEach(function (row, i) {
    var r = el('div', 'js-kbrow');
    row.split('').forEach(function (ch) { r.appendChild(button('jg-key js-k', ch, function () { press(ch); })); });
    if (i === 2) r.appendChild(button('jg-key js-k js-back', '⌫', function () { press('Backspace'); }));
    kb.appendChild(r);
  });
  var checkBtn = button('jg-key jg-ok js-check', 'Check ✓', function () { press('Enter'); });
  kb.appendChild(checkBtn);
  play.append(hud, listen, flashEl, clueEl, tilesEl, fbEl, kb);

  /* ---------- round state ---------- */
  var s = null, flashTimer = null;

  function start(practiceWords) {
    var list = LISTS[listId].words, words;
    if (practiceWords) {
      words = practiceWords.map(function (w) { return list.filter(function (x) { return x[0] === w; })[0]; }).filter(Boolean);
    } else {
      // Up to 3 words missed last time come back, then fresh words.
      var missed = getMissed().slice(-3), fresh = shuffle(list.filter(function (x) { return missed.indexOf(x[0]) < 0; }));
      words = shuffle(missed.map(function (w) { return list.filter(function (x) { return x[0] === w; })[0]; }).filter(Boolean).concat(fresh.slice(0, ROUND - missed.length)));
    }
    s = { words: words, i: -1, score: 0, streak: 0, bestStreak: 0, firstTry: 0, missed: [], wrongs: {}, practice: !!practiceWords, cur: null, typed: '', tries: 0, copying: false };
    setup.hidden = true; end.hidden = true; play.hidden = false;
    document.body.classList.add('jg-playing');
    scoreWrap.hidden = s.practice; multEl.hidden = s.practice;
    root.scrollIntoView({ behavior: 'smooth', block: 'center' });
    next();
  }

  function next() {
    s.i++;
    if (s.i >= s.words.length) return finish(false);
    s.cur = s.words[s.i]; s.typed = ''; s.tries = 0; s.copying = false;
    countEl.textContent = (s.i + 1) + '/' + s.words.length;
    scoreEl.textContent = String(s.score);
    multEl.textContent = '×' + mult(); multEl.classList.toggle('hot', mult() > 1);
    clueEl.textContent = s.cur[1].replace('___', '_'.repeat(Math.max(4, s.cur[0].length)));
    fbEl.className = 'jg-feedback';
    clearTimeout(flashTimer);
    if (mode === 'look') {
      listen.hidden = true; flashEl.hidden = false; kb.classList.add('js-wait');
      flashEl.textContent = s.cur[0];
      fbEl.textContent = 'Look carefully…';
      flashTimer = setTimeout(function () { flashEl.hidden = true; kb.classList.remove('js-wait'); fbEl.textContent = 'Now cover it. Can you write it?'; }, 3000);
    } else {
      listen.hidden = false; flashEl.hidden = true; kb.classList.remove('js-wait');
      fbEl.textContent = speechSynthesis.getVoices().length
        ? 'Listen, then spell the word.'
        : 'Listen, then spell the word. (No sound? Choose "Look, cover, write" instead.)';
      speakWord(s.cur, false);
    }
    renderTiles(null);
  }

  function mult() { return Math.min(5, 1 + Math.floor(s.streak / 3)); }

  function renderTiles(marks) {
    tilesEl.innerHTML = '';
    var n = Math.max(s.cur[0].length, s.typed.length);
    for (var i = 0; i < n; i++) {
      var t = el('span', 'js-tile' + (i >= s.cur[0].length ? ' js-extra' : ''), s.typed[i] || '');
      if (marks && marks[i]) t.classList.add(marks[i]);
      if (!marks && i === s.typed.length) t.classList.add('js-cursor');
      tilesEl.appendChild(t);
    }
  }

  function press(k) {
    if (!s || play.hidden || kb.classList.contains('js-wait')) return;
    if (/^[a-z]$/i.test(k)) { if (s.typed.length < s.cur[0].length + 3) s.typed += k.toLowerCase(); }
    else if (k === 'Backspace') s.typed = s.typed.slice(0, -1);
    else if (k === 'Enter') return check();
    renderTiles(null);
  }

  function check() {
    if (!s.typed) return;
    var want = s.cur[0].toLowerCase(), got = s.typed;
    if (s.copying) {                                    // typing it once after seeing the answer
      if (got === want) { beep([660, 880], 0.1); fbEl.textContent = 'Lovely. That one will stick now.'; fbEl.className = 'jg-feedback good'; return setTimeout(next, 900); }
      fbEl.textContent = 'Copy it carefully: ' + s.cur[0]; fbEl.className = 'jg-feedback bad'; s.typed = ''; return renderTiles(null);
    }
    s.tries++;
    if (got === want) {
      if (s.tries === 1) {
        s.firstTry++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak);
        if (!s.practice) s.score += 10 * mult();
        fbEl.textContent = pick(['Correct!', 'Perfect spelling!', 'Spot on!', 'Brilliant!', 'Splendid!']) + (mult() > 1 && !s.practice ? ' Streak ×' + mult() + '!' : '');
      } else {
        if (!s.practice) s.score += 5;
        fbEl.textContent = 'Yes! You fixed it.';
      }
      fbEl.className = 'jg-feedback good'; beep([660, 880], 0.1);
      renderTiles(want.split('').map(function () { return 'js-right'; }));
      if (s.tries > 1) noteMiss(got);
      return setTimeout(next, 900);
    }
    beep([220], 0.22);
    s.streak = 0;
    noteMiss(got);
    var marks = got.split('').map(function (ch, i) { return ch === want[i] ? 'js-right' : 'js-wrong'; });
    if (s.tries === 1) {
      renderTiles(marks);
      fbEl.textContent = 'Nearly! Green letters are right. Have another go.'; fbEl.className = 'jg-feedback bad';
      s.typed = '';
      setTimeout(function () { if (!s.copying && s.tries === 1) renderTiles(null); }, 1400);
      return;
    }
    // Second miss: show the word and its trick, then type it once.
    s.copying = true; s.typed = '';
    flashEl.hidden = false; flashEl.textContent = s.cur[0];
    fbEl.textContent = 'It’s spelt "' + s.cur[0] + '". ' + (s.cur[2] ? 'Jarvis’s trick: ' + s.cur[2] + ' ' : '') + 'Now type it once to remember it.';
    fbEl.className = 'jg-feedback bad';
    renderTiles(null);
    if (mode === 'listen') say([s.cur[0]], true);
  }

  function noteMiss(got) {
    var w = s.cur[0];
    if (s.missed.indexOf(w) < 0) s.missed.push(w);
    if (!s.wrongs[w]) s.wrongs[w] = got;
  }

  document.addEventListener('keydown', function (e) {
    if (!s || play.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (/^[a-z]$/i.test(e.key) || e.key === 'Backspace' || e.key === 'Enter') { e.preventDefault(); press(e.key); }
  });

  /* ---------- end of round ---------- */
  function finish(quit) {
    clearTimeout(flashTimer);
    if (speechOk) speechSynthesis.cancel();
    if (play.hidden) return;
    play.hidden = true;
    document.body.classList.remove('jg-playing');
    // Words attempted: the current one counts once it has had a try.
    var done = Math.min(s.words.length, s.copying || s.tries ? s.i + 1 : s.i);
    if (quit && done === 0) { setup.hidden = false; renderSetup(); return; }

    // Remember words to practise next time (and clear the ones now spelt right first time).
    var keep = getMissed().filter(function (w) { return s.missed.indexOf(w) < 0 && !(s.words.slice(0, done).some(function (x) { return x[0] === w; })); });
    setMissed(keep.concat(s.missed));

    var stars = s.firstTry >= 9 ? 3 : s.firstTry >= 6 ? 2 : s.firstTry >= 3 ? 1 : 0;
    if (s.practice) stars = s.missed.length === 0 ? 3 : stars;
    var best = Number(store('ja_spell_best_' + listId) || 0), newBest = !quit && !s.practice && s.score > best;
    if (newBest) store('ja_spell_best_' + listId, String(s.score));

    end.innerHTML = '';
    end.appendChild(el('div', 'jg-stars', '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars)));
    end.appendChild(el('h3', 'jg-score', s.practice ? 'Practice done!' : s.score + ' points'));
    if (newBest) end.appendChild(el('p', 'jg-newbest', best ? 'New personal best! (was ' + best + ')' : 'First record set!'));
    var stats = el('div', 'jg-stats');
    [[s.firstTry + '/' + done, 'right first time'], [String(s.bestStreak), 'best streak'], [String(s.missed.length), 'to practise'], [LISTS[listId].name, 'word list']].forEach(function (x) {
      var c = el('div', 'jg-statbox'); c.appendChild(el('b', null, x[0])); c.appendChild(el('span', null, x[1])); stats.appendChild(c);
    });
    end.appendChild(stats);
    if (s.missed.length) {
      var ul = el('div', 'js-words');
      s.missed.forEach(function (w) { ul.appendChild(el('span', 'js-word', w)); });
      end.appendChild(el('p', 'jg-best', 'Words to practise:'));
      end.appendChild(ul);
    }
    end.appendChild(el('p', 'jg-jarvis', '“' + pick([
      ['Good try, my friend! Every word you practise gets easier.', 'Nice start! Let’s practise the tricky ones together.'],
      ['Well done! A few more practices and you’ll be a spelling star.', 'Good work! Those tricky words are getting easier.'],
      ['Brilliant spelling! You’re really getting the hang of this.', 'Super work! Your spelling is looking strong.'],
      ['Amazing! Three stars! You’re a spelling superstar!', 'Fantastic! Three stars. I’m very impressed, my friend.']
    ][stars]) + '” — Jarvis'));

    var btns = el('div', 'jg-btns');
    btns.appendChild(button('btn ja-btn-cyan', 'PLAY AGAIN', function () { start(null); }));
    if (s.missed.length) btns.appendChild(button('btn ja-btn-outline', 'PRACTISE THESE WORDS', function () { start(s.missed.slice()); }));
    if (s.missed.length && window.JA) {
      var w0 = s.missed[0];
      btns.appendChild(button('btn ja-btn-outline', 'ASK JARVIS ABOUT "' + w0.toUpperCase() + '"', function () {
        window.JA.askTutor('Can you help me remember how to spell "' + w0 + '"? I wrote "' + (s.wrongs[w0] || '') + '".', LISTS[listId].tutorLevel);
      }));
    }
    btns.appendChild(button('ja-link', 'Change words', function () { end.hidden = true; setup.hidden = false; renderSetup(); }));
    end.appendChild(btns);
    var msg = el('p', 'ja-note jg-save'); end.appendChild(msg);
    end.hidden = false;
    if (!s.practice && done > 0) save(msg, done);
  }

  function save(msg, done) {
    if (!window.JA || !window.JA.student()) {
      msg.textContent = 'Want Jarvis to remember this? ';
      msg.appendChild(button('ja-link ja-link-strong', 'Create a free account', function () { window.JA ? window.JA.signUp() : null; }));
      msg.appendChild(document.createTextNode(' and your spelling goes into your Learning Brain, where a parent can follow your progress.'));
      return;
    }
    var mistake = s.missed.length ? s.missed[0] + ' (wrote "' + (s.wrongs[s.missed[0]] || '') + '")' : '';
    msg.textContent = 'Saving to your Learning Brain…';
    window.JA.apiAuthed('game', { results: [{ topic: listId, total: done, correct: s.firstTry, mistake: mistake }] }).then(function (res) {
      if (res.ok) { msg.textContent = '✓ Saved to your Learning Brain.'; window.JA.refreshBrain(); }
      else msg.textContent = res.status === 429 ? 'Rounds are saved at most once every 20 seconds, so this one wasn’t recorded.' : 'Could not save this round to your Learning Brain.';
    }).catch(function () { msg.textContent = 'Could not reach the server to save this round.'; });
  }

  // Game tabs (Maths Challenge / Spelling Bee). Switching away stops a round in progress.
  var tabs = document.querySelectorAll('#jaGameTabs [data-game]'), sub = document.getElementById('jaGameSub');
  Array.prototype.forEach.call(tabs, function (t) {
    t.addEventListener('click', function () {
      Array.prototype.forEach.call(tabs, function (x) {
        var box = document.getElementById(x.dataset.game), on = x === t;
        if (!on && box && !box.hidden) {
          var stop = Array.prototype.filter.call(box.querySelectorAll('.ja-link'), function (b) { return b.textContent === 'Stop' && b.offsetParent; })[0];
          if (stop) stop.click();
        }
        x.setAttribute('aria-selected', String(on));
        if (box) box.hidden = !on;
        if (on && box && sub) sub.textContent = box.dataset.sub;
      });
    });
  });

  // Exposed for automated checks of the word lists (not used by the page itself).
  window.JA_SPELL_LISTS = LISTS;

  renderSetup();
})();
