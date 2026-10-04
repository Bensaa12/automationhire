// Validates every GCSE Literature text in api/_literature. Run: node test/literature-content.js
// Checks structure, unique ids, valid categories, the free sample size, and that quotations
// stay short (exam-board guidance and copyright: keep quoted material brief).
const assert = require('assert');
const { TEXTS, CATEGORIES, byId } = require('../api/_literature/registry');
const { LIMITS } = require('../api/_academy-lit-config');

const cats = new Set(CATEGORIES.map((c) => c.id));
const REQUIRED = ['id', 'title', 'author', 'form', 'examBoards', 'tagline', 'accent', 'characters', 'themes', 'events',
  'quotations', 'context', 'techniques', 'flashcards', 'writingScenes', 'examQuestions'];
const seen = new Set();
let problems = 0;
const check = (ok, msg) => { if (!ok) { problems++; console.log('  ✗ ' + msg); } };
// Quoted material inside answers: text between straight double quotes
const quotesIn = (s) => (s.match(/"([^"]+)"/g) || []).map((q) => q.slice(1, -1));
const words = (s) => s.split(/\s+/).filter(Boolean).length;

for (const t of TEXTS) {
  console.log(`${t.title} (${t.id})`);
  for (const k of REQUIRED) check(t[k] != null, `missing field ${k}`);
  check(byId[t.id] === t, 'id not registered');
  check(/^#[0-9a-f]{6}$/i.test(t.accent), 'accent must be a hex colour');

  const free = t.flashcards.filter((c) => c.free);
  check(free.length === LIMITS.freeFlashcards, `exactly ${LIMITS.freeFlashcards} free flashcards (has ${free.length})`);
  for (const c of cats) {
    const n = t.flashcards.filter((f) => f.category === c).length;
    check(n >= 4, `category ${c} needs at least 4 cards (has ${n})`);
  }
  for (const f of t.flashcards) {
    check(!seen.has(f.id), `duplicate id ${f.id}`); seen.add(f.id);
    check(cats.has(f.category), `${f.id}: unknown category ${f.category}`);
    check(f.q && f.q.length >= 15 && f.a && f.a.length >= 60, `${f.id}: question/answer too short`);
    check(words(f.a) <= 80, `${f.id}: answer over 80 words (${words(f.a)})`);
    for (const q of quotesIn(f.q + ' ' + f.a)) check(words(q) <= 16, `${f.id}: quotation too long: "${q}"`);
  }

  const freeScenes = t.writingScenes.filter((s) => s.free);
  check(freeScenes.length === LIMITS.freeScenes, `exactly ${LIMITS.freeScenes} free writing scene(s) (has ${freeScenes.length})`);
  for (const s of t.writingScenes) {
    check(!seen.has(s.id), `duplicate id ${s.id}`); seen.add(s.id);
    for (const k of ['title', 'where', 'drawPrompt', 'sketchIdeas', 'keyPoints', 'vocab', 'examQuestion']) check(s[k], `${s.id}: missing ${k}`);
    check(s.keyPoints.length >= 5, `${s.id}: needs at least 5 key points for marking`);
  }
  for (const q of t.quotations) check(words(q.text) <= 16, `quotation too long: "${q.text}"`);
  check(t.examQuestions.length >= 3, 'needs at least 3 exam questions');
  console.log(`  ${t.flashcards.length} flashcards (${free.length} free), ${t.writingScenes.length} scenes, ${t.examQuestions.length} exam questions`);
}

assert.strictEqual(problems, 0, `${problems} problem(s) found`);
console.log(`\nOK: ${TEXTS.length} texts valid`);
