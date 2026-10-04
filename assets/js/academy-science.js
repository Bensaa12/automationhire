/* Jarvis Academy — Science Quiz (secondary, ages 11–16).
 * Multiple choice, 10 questions a round, optional 20-second clock with a speed bonus, one 50:50
 * lifeline, and a "Did you know?" explanation after every answer. Questions follow the UK National
 * Curriculum (KS3) and GCSE combined science. Secondary only, by request: not offered to primary. Signed-in students' rounds go to their Learning
 * Brain as Science: Biology / Chemistry / Physics (POST /api/academy/game). */
(function () {
  'use strict';
  var root = document.getElementById('jaSci');
  if (!root) return;

  var ROUND = 10, SECONDS = 20;

  /* Each question: [question, [CORRECT, wrong, wrong, wrong], explanation]. Options are shuffled when shown. */
  var BANK = {
    '11-14': { name: 'Ages 11–14', tutorLevel: 'secondary', bio: [
      ['What is the basic unit of all living things?', ['The cell', 'The atom', 'The organ', 'The tissue'], 'All living things are made of cells. Cells form tissues, tissues form organs, and organs form systems.'],
      ['Which part of a cell contains its genetic material (DNA)?', ['Nucleus', 'Cell membrane', 'Cytoplasm', 'Cell wall'], 'The nucleus holds the DNA and controls what the cell does.'],
      ['Which structures are found in plant cells but not animal cells?', ['A cell wall and chloroplasts', 'A nucleus and cytoplasm', 'A cell membrane and mitochondria', 'Ribosomes'], 'Plant cells also have a permanent vacuole. Chloroplasts trap light for photosynthesis.'],
      ['Complete the word equation for aerobic respiration: glucose + oxygen → ?', ['carbon dioxide + water', 'carbon dioxide + oxygen', 'glucose + carbon dioxide', 'lactic acid + water'], 'Aerobic respiration releases energy from glucose and makes carbon dioxide and water.'],
      ['Where does photosynthesis happen in a plant cell?', ['Chloroplasts', 'Mitochondria', 'Nucleus', 'Vacuole'], 'Chloroplasts contain green chlorophyll, which absorbs light energy.'],
      ['Which organ makes bile to help digest fats?', ['Liver', 'Stomach', 'Pancreas', 'Small intestine'], 'The liver makes bile, the gall bladder stores it, and it breaks fat into small droplets.'],
      ['What is the job of red blood cells?', ['To carry oxygen', 'To fight infection', 'To help blood clot', 'To digest food'], 'Red blood cells contain haemoglobin, which carries oxygen from the lungs to the body.'],
      ['In a food chain, what do the arrows show?', ['Which way the energy is transferred', 'Which animal is the biggest in size', 'Where each of the animals lives', 'Which animal can run the fastest'], 'Arrows point from the food to the eater, showing which way the energy flows.'],
      ['What is the variety of living things in an area called?', ['Biodiversity', 'Photosynthesis', 'Adaptation', 'Respiration'], 'High biodiversity makes an ecosystem more stable.'],
      ['Which gas is there more of in the air you breathe out than in the air you breathe in?', ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium'], 'Respiration in your cells makes carbon dioxide, which you breathe out.']
    ], chem: [
      ['What is the chemical symbol for sodium?', ['Na', 'S', 'So', 'Sd'], 'Na comes from natrium, the Latin name for sodium.'],
      ['What is the pH of a neutral solution, such as pure water?', ['7', '0', '14', '1'], 'Below 7 is acidic, 7 is neutral, and above 7 is alkaline.'],
      ['Which gas is made when a metal reacts with an acid?', ['Hydrogen', 'Oxygen', 'Carbon dioxide', 'Nitrogen'], 'metal + acid → salt + hydrogen. Hydrogen gives a squeaky pop with a lit splint.'],
      ['What is H₂O?', ['Water', 'Hydrogen peroxide', 'Oxygen gas', 'Salt'], 'Two hydrogen atoms joined to one oxygen atom make a water molecule.'],
      ['An atom is made of protons, neutrons and…', ['Electrons', 'Molecules', 'Cells', 'Crystals'], 'Protons and neutrons are in the nucleus; electrons move around it.'],
      ['Universal indicator turns red in…', ['A strong acid', 'A strong alkali', 'A neutral solution', 'Pure water'], 'Red/orange means acidic, green means neutral, and blue/purple means alkaline.'],
      ['Which of these is a compound?', ['Carbon dioxide (CO₂)', 'Oxygen (O₂)', 'Chlorine gas (Cl₂)', 'Nitrogen gas (N₂)'], 'A compound has two or more different elements chemically joined. CO₂ has carbon and oxygen.'],
      ['What do we call a reaction that gives out heat?', ['Exothermic', 'Endothermic', 'Evaporation', 'Condensation'], 'Exo- means "out". Burning is exothermic; endothermic reactions take heat in.'],
      ['What does iron need in order to rust?', ['Water and oxygen', 'Only sunlight', 'Only salt', 'Carbon dioxide and heat'], 'Iron needs both water and oxygen to rust. Salt speeds it up.'],
      ['Which technique separates the different colours in an ink?', ['Chromatography', 'Filtration', 'Distillation', 'Evaporation'], 'In chromatography, each dye travels up the paper at a different speed.']
    ], phys: [
      ['What is the unit of force?', ['Newton (N)', 'Joule (J)', 'Watt (W)', 'Volt (V)'], 'Force is measured in newtons, named after Isaac Newton.'],
      ['Which formula gives average speed?', ['distance ÷ time', 'time ÷ distance', 'distance × time', 'mass × time'], 'Speed = distance ÷ time, for example metres per second (m/s).'],
      ['A car travels 100 m in 5 s. What is its average speed?', ['20 m/s', '500 m/s', '0.05 m/s', '95 m/s'], 'Speed = distance ÷ time = 100 ÷ 5 = 20 m/s.'],
      ['Which travels faster?', ['Light', 'Sound', 'They travel at the same speed', 'Neither: both are instant'], 'Light is almost a million times faster than sound in air, which is why you see lightning before you hear thunder.'],
      ['What is the unit of energy?', ['Joule (J)', 'Newton (N)', 'Metre (m)', 'Amp (A)'], 'Energy is measured in joules. Food labels use kilojoules (kJ).'],
      ['In a series circuit, if one bulb breaks, the other bulbs…', ['Go out', 'Get brighter', 'Stay the same', 'Change colour'], 'A series circuit has only one path, so one break stops the current everywhere.'],
      ['Which meter measures electric current?', ['Ammeter', 'Voltmeter', 'Thermometer', 'Barometer'], 'An ammeter measures current in amps and is connected in series.'],
      ['Why does an astronaut weigh less on the Moon?', ['The Moon’s gravity is weaker', 'They lose mass in space', 'There is no air on the Moon', 'The Moon is hotter'], 'Their mass stays the same, but the Moon’s gravity is about one sixth of Earth’s, so they weigh less.'],
      ['Sound cannot travel through…', ['A vacuum (empty space)', 'Sea water', 'A steel railway line', 'Air in a classroom'], 'Sound needs particles to vibrate, so it can’t travel through empty space.'],
      ['Which colour of visible light has the longest wavelength?', ['Red', 'Violet', 'Green', 'Blue'], 'Red has the longest wavelength of visible light and violet the shortest.']
    ] },
    '14-16': { name: 'GCSE · ages 14–16', tutorLevel: 'secondary', bio: [
      ['What does mitosis produce?', ['Two genetically identical cells', 'Four genetically different gametes', 'One large cell', 'Bacteria'], 'Mitosis is for growth and repair. Meiosis makes four genetically different gametes.'],
      ['How many chromosomes are in a normal human body cell?', ['46', '23', '48', '92'], '46 chromosomes in 23 pairs. Gametes (sperm and egg cells) have 23.'],
      ['Which enzyme breaks down starch?', ['Amylase', 'Protease', 'Lipase', 'Insulin'], 'Amylase breaks starch into sugars. Protease digests proteins and lipase digests fats.'],
      ['Which organ produces insulin?', ['Pancreas', 'Liver', 'Kidney', 'Brain'], 'The pancreas releases insulin to lower blood glucose.'],
      ['What do antibiotics kill?', ['Bacteria', 'Viruses', 'All microorganisms', 'Only fungi'], 'Antibiotics work on bacteria, not viruses, which is why they don’t cure a cold.'],
      ['Diffusion is the net movement of particles from…', ['A higher concentration to a lower concentration', 'A lower concentration to a higher concentration', 'One cell to the same cell', 'Only through a pump'], 'Diffusion is passive: it needs no energy. Active transport moves particles against the gradient using energy.'],
      ['What is the main job of white blood cells?', ['To defend the body against pathogens', 'To carry oxygen around the body', 'To clot the blood at a wound', 'To carry glucose to the muscles'], 'White blood cells engulf pathogens, make antibodies and make antitoxins.'],
      ['Which molecule carries genetic information?', ['DNA', 'ATP', 'Glucose', 'Haemoglobin'], 'DNA is a double helix made of two strands. Genes are sections of DNA.'],
      ['Where in the cell does most aerobic respiration take place?', ['Mitochondria', 'Ribosomes', 'Nucleus', 'Chloroplasts'], 'Mitochondria release energy from glucose in aerobic respiration.'],
      ['Who proposed the theory of evolution by natural selection?', ['Charles Darwin', 'Isaac Newton', 'Marie Curie', 'Gregor Mendel'], 'Darwin (together with Alfred Russel Wallace) proposed natural selection. Mendel discovered how characteristics are inherited.']
    ], chem: [
      ['What is the relative charge of an electron?', ['−1', '+1', '0', '+2'], 'Protons are +1, neutrons are 0 and electrons are −1.'],
      ['What are the Group 1 metals called?', ['Alkali metals', 'Noble gases', 'Halogens', 'Transition metals'], 'Alkali metals such as sodium and potassium react with water to form alkaline solutions.'],
      ['Which group contains the noble gases?', ['Group 0', 'Group 1', 'Group 7', 'Group 2'], 'Group 0 gases have full outer shells, which makes them very unreactive.'],
      ['What is the formula of carbon dioxide?', ['CO₂', 'CO', 'C₂O', 'CO₃'], 'One carbon atom joined to two oxygen atoms. CO is carbon monoxide.'],
      ['Complete the balanced equation: 2H₂ + O₂ → ?', ['2H₂O', 'H₂O', 'H₂O₂', '2HO'], 'There are 4 H and 2 O atoms on the left, so you need 2H₂O on the right.'],
      ['What type of bond forms between a metal and a non-metal?', ['Ionic', 'Covalent', 'Metallic', 'Hydrogen'], 'The metal loses electrons and the non-metal gains them, forming oppositely charged ions.'],
      ['In electrolysis, positive ions move towards the…', ['Cathode (negative electrode)', 'Anode (positive electrode)', 'Middle of the solution', 'Power supply'], 'Opposites attract: positive ions go to the negative cathode.'],
      ['What does a catalyst do?', ['Speeds up a reaction without being used up', 'Slows a reaction down permanently', 'Is used up so that the reaction can start', 'Changes which products the reaction makes'], 'Catalysts provide a route with a lower activation energy.'],
      ['How is crude oil separated into useful fractions?', ['Fractional distillation', 'Simple filtration', 'Paper chromatography', 'Electrolysis of the oil'], 'Fractions with different boiling points condense at different heights in the column.'],
      ['What is the test for hydrogen gas?', ['A lit splint gives a squeaky pop', 'It relights a glowing splint', 'It turns limewater cloudy', 'It bleaches damp litmus paper'], 'A glowing splint relighting tests for oxygen, cloudy limewater for carbon dioxide, and bleached litmus for chlorine.']
    ], phys: [
      ['Which equation links potential difference (V), current (I) and resistance (R)?', ['V = I × R', 'V = I ÷ R', 'V = R ÷ I', 'V = I + R'], 'Potential difference = current × resistance.'],
      ['A current of 3 A flows through a 2 Ω resistor. What is the potential difference across it?', ['6 V', '1.5 V', '5 V', '0.67 V'], 'V = I × R = 3 × 2 = 6 V.'],
      ['Which equation gives kinetic energy?', ['½ × m × v²', 'm × g × h', 'm × v', 'F × d'], 'Kinetic energy = ½ × mass × speed². m × g × h is gravitational potential energy.'],
      ['Which of these is a longitudinal wave?', ['Sound', 'Light', 'Radio waves', 'X-rays'], 'In longitudinal waves, the vibrations are parallel to the direction the wave travels. Electromagnetic waves are transverse.'],
      ['What is the unit of power?', ['Watt (W)', 'Joule (J)', 'Newton (N)', 'Ohm (Ω)'], 'Power is energy transferred per second: 1 W = 1 J/s.'],
      ['What is the gravitational field strength at the Earth’s surface?', ['About 9.8 N/kg', 'About 1 N/kg', 'About 98 N/kg', 'About 0.98 N/kg'], 'About 9.8 N/kg, often rounded to 10 N/kg in exam questions.'],
      ['Which type of radiation is stopped by a sheet of paper?', ['Alpha', 'Beta', 'Gamma', 'X-rays'], 'Alpha is stopped by paper, beta by a few millimetres of aluminium, and gamma is reduced by thick lead.'],
      ['Weight = mass × ?', ['Gravitational field strength', 'Velocity squared', 'Density of the object', 'Volume of the object'], 'W = m × g. A 50 kg person on Earth weighs about 490 N.'],
      ['What is the half-life of a radioactive isotope?', ['Time for half the unstable nuclei to decay', 'Half the time it takes to decay completely', 'The time until it is completely safe', 'Half of its mass number'], 'After one half-life, the activity of the sample has halved.'],
      ['Which equation gives momentum?', ['mass × velocity', 'mass × acceleration', 'force × distance', '½ × mass × velocity²'], 'p = m × v. Mass × acceleration gives force.']
    ] }
  };
  var SUBJECTS = [['mixed', 'Mixed'], ['bio', '🧬 Biology'], ['chem', '⚗️ Chemistry'], ['phys', '⚡ Physics']];
  var SUBJECT_NAME = { bio: 'biology', chem: 'chemistry', phys: 'physics' };

  /* ---------- helpers ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function button(cls, text, onClick) { var b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', onClick); return b; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  var level = BANK[store('ja_sci_level')] ? store('ja_sci_level') : '11-14';
  var subject = 'mixed';
  var timed = store('ja_sci_timed') !== '0';
  var muted = store('ja_game_muted') === '1';

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
  var setup = el('div', 'js-setup'), play = el('div', 'sq-play'), end = el('div', 'jg-end');
  play.hidden = true; end.hidden = true;
  root.append(setup, play, end);

  function seenKey() { return 'ja_sci_seen_' + level; }
  function getSeen() { try { return JSON.parse(store(seenKey()) || '[]'); } catch (e) { return []; } }

  function renderSetup() {
    setup.innerHTML = '';
    var r1 = el('div', 'jg-row'); r1.appendChild(el('span', 'jg-label', 'Level'));
    var c1 = el('div', 'jg-choices');
    Object.keys(BANK).forEach(function (k) {
      var b = button('ja-tab', BANK[k].name, function () { level = k; store('ja_sci_level', k); renderSetup(); });
      b.setAttribute('aria-selected', String(k === level)); c1.appendChild(b);
    });
    r1.appendChild(c1); setup.appendChild(r1);

    var r2 = el('div', 'jg-row'); r2.appendChild(el('span', 'jg-label', 'Subject'));
    var c2 = el('div', 'jg-choices');
    SUBJECTS.forEach(function (sj) {
      var b = button('jg-topic', sj[1], function () { subject = sj[0]; renderSetup(); });
      b.setAttribute('aria-pressed', String(sj[0] === subject)); c2.appendChild(b);
    });
    r2.appendChild(c2); setup.appendChild(r2);

    var r3 = el('div', 'jg-row'); r3.appendChild(el('span', 'jg-label', 'Clock'));
    var c3 = el('div', 'jg-choices');
    [[true, '⏱ 20 seconds (bonus for speed)'], [false, '😌 Relaxed, no clock']].forEach(function (o) {
      var b = button('jg-topic', o[1], function () { timed = o[0]; store('ja_sci_timed', timed ? '1' : '0'); renderSetup(); });
      b.setAttribute('aria-pressed', String(o[0] === timed)); c3.appendChild(b);
    });
    r3.appendChild(c3); setup.appendChild(r3);

    var best = Number(store('ja_sci_best_' + level + '_' + subject) || 0);
    setup.appendChild(el('p', 'jg-best', best ? 'Your best on this one: ' + best + ' points. Can you beat it?' : 'No score yet on this one. Set the first record!'));
    setup.appendChild(button('btn btn-lg ja-btn-cyan jg-go', 'START ▶', start));
    setup.appendChild(el('p', 'ja-note jg-note', window.JA && window.JA.student()
      ? 'Signed in: your answers go into your Learning Brain, and a linked parent sees your progress.'
      : '10 questions, one 50:50 lifeline. Sign in and Jarvis remembers your progress.'));
  }

  // Play screen
  var hud = el('div', 'jg-hud');
  var numEl = el('b'), scoreEl = el('b'), multEl = el('span', 'jg-mult', '×1'), clockEl = el('b');
  var numWrap = el('span', 'jg-stat'); numWrap.append('Question ', numEl);
  var scoreWrap = el('span', 'jg-stat'); scoreWrap.append('Score ', scoreEl);
  var clockWrap = el('span', 'jg-stat'); clockWrap.append('⏱ ', clockEl);
  var fiftyBtn = button('ja-link sq-fifty', '50:50', fifty);
  var muteBtn = button('ja-link jg-mute', '', function () { muted = !muted; store('ja_game_muted', muted ? '1' : '0'); renderMute(); });
  var stopBtn = button('ja-link', 'Stop', function () { finish(true); });
  hud.append(numWrap, scoreWrap, multEl, clockWrap, fiftyBtn, muteBtn, stopBtn);
  function renderMute() { muteBtn.textContent = muted ? '🔇 Beeps off' : '🔊 Beeps on'; }
  renderMute();
  var bar = el('div', 'jg-timebar'), barFill = el('i'); bar.appendChild(barFill);
  var tagEl = el('div', 'sq-tag');
  var qEl = el('div', 'sq-q');
  var optsEl = el('div', 'sq-opts');
  var factEl = el('div', 'sq-fact'); factEl.setAttribute('aria-live', 'polite');
  var nextBtn = button('btn ja-btn-cyan sq-next', 'NEXT ▶', function () { next(); });
  play.append(hud, bar, tagEl, qEl, optsEl, factEl, nextBtn);

  /* ---------- round ---------- */
  var s = null, timer = null;

  function pool() {
    var subs = subject === 'mixed' ? ['bio', 'chem', 'phys'] : [subject];
    var all = [];
    subs.forEach(function (sj) { BANK[level][sj].forEach(function (q, i) { all.push({ sj: sj, id: sj + i, q: q[0], opts: q[1], fact: q[2] }); }); });
    return all;
  }

  function start() {
    // Questions not seen recently come first, so repeat players get fresh ones.
    var seen = getSeen(), all = shuffle(pool());
    var fresh = all.filter(function (x) { return seen.indexOf(x.id) < 0; }), old = all.filter(function (x) { return seen.indexOf(x.id) >= 0; });
    var qs = fresh.concat(old).slice(0, ROUND);
    store(seenKey(), JSON.stringify(seen.filter(function (id) { return !qs.some(function (x) { return x.id === id; }); }).concat(qs.map(function (x) { return x.id; })).slice(-24)));
    s = { qs: qs, i: -1, score: 0, streak: 0, bestStreak: 0, right: 0, per: {}, missed: [], fiftyUsed: false, answered: false, cur: null };
    setup.hidden = true; end.hidden = true; play.hidden = false;
    document.body.classList.add('jg-playing');
    clockWrap.hidden = !timed; bar.hidden = !timed;
    fiftyBtn.disabled = false; fiftyBtn.textContent = '50:50';
    root.scrollIntoView({ behavior: 'smooth', block: 'center' });
    next();
  }

  function mult() { return Math.min(5, 1 + Math.floor(s.streak / 3)); }

  function next() {
    clearInterval(timer);
    s.i++;
    if (s.i >= s.qs.length) return finish(false);
    var q = s.cur = s.qs[s.i];
    s.answered = false;
    numEl.textContent = (s.i + 1) + '/' + s.qs.length;
    scoreEl.textContent = String(s.score);
    multEl.textContent = '×' + mult(); multEl.classList.toggle('hot', mult() > 1);
    fiftyBtn.disabled = s.fiftyUsed;
    tagEl.textContent = { bio: '🧬 Biology', chem: '⚗️ Chemistry', phys: '⚡ Physics' }[q.sj];
    qEl.textContent = q.q;
    optsEl.innerHTML = '';
    s.order = shuffle(q.opts);
    s.order.forEach(function (text, i) {
      var b = button('sq-opt', '', function () { answer(text); });
      b.appendChild(el('span', 'sq-key', String(i + 1)));
      b.appendChild(el('span', null, text));
      b.dataset.text = text;
      optsEl.appendChild(b);
    });
    factEl.hidden = true; nextBtn.hidden = true;
    if (timed) {
      var t0 = Date.now();
      s.left = SECONDS;
      clockEl.textContent = String(SECONDS); barFill.style.width = '100%'; bar.classList.remove('low');
      timer = setInterval(function () {
        s.left = Math.max(0, SECONDS - (Date.now() - t0) / 1000);
        clockEl.textContent = String(Math.ceil(s.left));
        barFill.style.width = (s.left / SECONDS * 100) + '%';
        bar.classList.toggle('low', s.left <= 5);
        if (s.left <= 0) answer(null);
      }, 100);
    }
  }

  function answer(text) {
    if (!s || s.answered) return;
    s.answered = true;
    clearInterval(timer);
    var q = s.cur, correct = q.opts[0], ok = text === correct;
    var per = s.per[q.sj] || (s.per[q.sj] = { total: 0, correct: 0, mistake: '' });
    per.total++;
    Array.prototype.forEach.call(optsEl.children, function (b) {
      b.disabled = true;
      if (b.dataset.text === correct) b.classList.add('sq-right');
      else if (b.dataset.text === text) b.classList.add('sq-wrong');
    });
    if (ok) {
      per.correct++; s.right++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak);
      var bonus = timed ? Math.ceil(s.left / 2) : 0;
      s.score += (10 + bonus) * mult();
      beep([660, 880], 0.1);
      factEl.innerHTML = '';
      factEl.appendChild(el('b', null, pick(['Correct!', 'Spot on!', 'Brilliant!', 'Precisely.', 'Splendid!']) + (bonus ? ' +' + bonus + ' speed bonus.' : '') + ' '));
    } else {
      s.streak = 0;
      beep([220], 0.22);
      per.mistake = q.q + ' (answered "' + (text || 'no answer') + '", correct "' + correct + '")';
      s.missed.push({ q: q, given: text });
      factEl.innerHTML = '';
      factEl.appendChild(el('b', null, (text ? 'Not quite. ' : 'Time’s up! ') + 'The answer is: ' + correct + '. '));
    }
    factEl.appendChild(el('span', null, 'Did you know? ' + q.fact));
    factEl.className = 'sq-fact ' + (ok ? 'good' : 'bad');
    factEl.hidden = false;
    scoreEl.textContent = String(s.score);
    multEl.textContent = '×' + mult(); multEl.classList.toggle('hot', mult() > 1);
    nextBtn.textContent = s.i + 1 >= s.qs.length ? 'SEE MY RESULTS ▶' : 'NEXT ▶';
    nextBtn.hidden = false;
    nextBtn.focus({ preventScroll: true });
  }

  function fifty() {
    if (!s || s.answered || s.fiftyUsed) return;
    s.fiftyUsed = true; fiftyBtn.disabled = true; fiftyBtn.textContent = '50:50 used';
    var wrongs = shuffle(Array.prototype.filter.call(optsEl.children, function (b) { return b.dataset.text !== s.cur.opts[0]; })).slice(0, 2);
    wrongs.forEach(function (b) { b.disabled = true; b.classList.add('sq-gone'); });
  }

  document.addEventListener('keydown', function (e) {
    if (!s || play.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (!s.answered && /^[1-4]$/.test(e.key)) {
      var b = optsEl.children[Number(e.key) - 1];
      if (b && !b.disabled) { e.preventDefault(); answer(b.dataset.text); }
    } else if (s.answered && e.key === 'Enter' && document.activeElement !== nextBtn) { e.preventDefault(); next(); }
  });

  /* ---------- results ---------- */
  function finish(quit) {
    clearInterval(timer);
    if (play.hidden) return;
    play.hidden = true;
    document.body.classList.remove('jg-playing');
    var done = s.i + (s.answered ? 1 : 0);
    if (s.i >= s.qs.length) done = s.qs.length;
    if (quit && done === 0) { setup.hidden = false; renderSetup(); return; }
    var stars = s.right >= 9 ? 3 : s.right >= 7 ? 2 : s.right >= 4 ? 1 : 0;
    var bestKey = 'ja_sci_best_' + level + '_' + subject, best = Number(store(bestKey) || 0), newBest = !quit && s.score > best;
    if (newBest) store(bestKey, String(s.score));

    end.innerHTML = '';
    end.appendChild(el('div', 'jg-stars', '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars)));
    end.appendChild(el('h3', 'jg-score', s.score + ' points'));
    if (newBest) end.appendChild(el('p', 'jg-newbest', best ? 'New personal best! (was ' + best + ')' : 'First record set!'));
    var stats = el('div', 'jg-stats');
    [[s.right + '/' + done, 'correct'], [String(s.bestStreak), 'best streak'], [s.fiftyUsed ? 'Used' : 'Saved', '50:50'], [BANK[level].name.replace(' · ', ' '), 'level']].forEach(function (x) {
      var c = el('div', 'jg-statbox'); c.appendChild(el('b', null, x[0])); c.appendChild(el('span', null, x[1])); stats.appendChild(c);
    });
    end.appendChild(stats);
    end.appendChild(el('p', 'jg-jarvis', '“' + pick([
      ['A modest start. Read the facts below; every one of them is worth knowing.', 'Science rewards curiosity. Have a look at the answers below and go again.'],
      ['Respectable. A little more practice and that becomes rather good.', 'Good effort. Read through the misses and you’ll know them next time.'],
      ['Very good indeed. You clearly know your science.', 'Excellent work. The laboratory beckons.'],
      ['Outstanding. Three stars. I shall alert the Royal Society.', 'Splendid! Three stars. A true scientist in the making.']
    ][stars]) + '” — Jarvis'));

    if (s.missed.length) {
      var rev = el('details', 'sq-review');
      rev.appendChild(el('summary', null, 'Review the ' + s.missed.length + ' question' + (s.missed.length > 1 ? 's' : '') + ' you missed'));
      s.missed.forEach(function (m) {
        var item = el('div', 'sq-rev-item');
        item.appendChild(el('b', null, m.q.q));
        item.appendChild(el('span', 'sq-rev-a', '✓ ' + m.q.opts[0] + (m.given ? '   (you said: ' + m.given + ')' : '   (no answer)')));
        item.appendChild(el('span', 'sq-rev-f', m.q.fact));
        rev.appendChild(item);
      });
      end.appendChild(rev);
    }

    var btns = el('div', 'jg-btns');
    btns.appendChild(button('btn ja-btn-cyan', 'PLAY AGAIN', start));
    var weak = weakest();
    if (weak && window.JA) {
      btns.appendChild(button('btn ja-btn-outline', 'ASK JARVIS ABOUT ' + SUBJECT_NAME[weak].toUpperCase(), function () {
        var m = s.missed.filter(function (x) { return x.q.sj === weak; })[0];
        window.JA.askTutor('Can you help me with ' + SUBJECT_NAME[weak] + '? In the Science Quiz I got this wrong: "' + m.q.q + '" The answer was "' + m.q.opts[0] + '". Can you explain why?', BANK[level].tutorLevel);
      }));
    }
    btns.appendChild(button('ja-link', 'Change level or subject', function () { end.hidden = true; setup.hidden = false; renderSetup(); }));
    end.appendChild(btns);
    var msg = el('p', 'ja-note jg-save'); end.appendChild(msg);
    end.hidden = false;
    if (done > 0) save(msg);
  }

  function weakest() {
    var worst = null, worstAcc = 101;
    Object.keys(s.per).forEach(function (k) { var p = s.per[k], a = p.correct / p.total * 100; if (p.correct < p.total && a < worstAcc) { worst = k; worstAcc = a; } });
    return worst;
  }

  function save(msg) {
    if (!window.JA || !window.JA.student()) {
      msg.textContent = 'Want Jarvis to remember this? ';
      msg.appendChild(button('ja-link ja-link-strong', 'Create a free account', function () { if (window.JA) window.JA.signUp(); }));
      msg.appendChild(document.createTextNode(' and your science goes into your Learning Brain, where a parent can follow your progress.'));
      return;
    }
    var results = Object.keys(s.per).map(function (k) { return { topic: 'sci-' + k + '-' + level, total: s.per[k].total, correct: s.per[k].correct, mistake: s.per[k].mistake.slice(0, 140) }; });
    msg.textContent = 'Saving to your Learning Brain…';
    window.JA.apiAuthed('game', { results: results }).then(function (res) {
      if (res.ok) { msg.textContent = '✓ Saved to your Learning Brain.'; window.JA.refreshBrain(); }
      else msg.textContent = res.status === 429 ? 'Rounds are saved at most once every 20 seconds, so this one wasn’t recorded.' : 'Could not save this round to your Learning Brain.';
    }).catch(function () { msg.textContent = 'Could not reach the server to save this round.'; });
  }

  // Exposed for automated checks of the question bank (not used by the page itself).
  window.JA_SCIENCE_BANK = BANK;

  renderSetup();
})();
