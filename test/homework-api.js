// Server tests for Homework Help (api/_academy-homework.js) with an in-memory fake Supabase,
// fake auth/plans, fake Claude and fake email. Run: node test/homework-api.js
// The rule under test above all: a student never receives an answer a parent hasn't unlocked.
const assert = require('assert');
const crypto = require('crypto');
process.env.ANTHROPIC_API_KEY = 'test-key';
const createHomeworkOps = require('../api/_academy-homework');

// ---------- fake Supabase (just enough of the query builder) ----------
const db = { academy_profiles: [], academy_links: [], academy_homework: [], academy_hw_items: [], academy_hw_requests: [], academy_skills: [] };
function from(table) {
  const rows = db[table];
  let filters = [], mode = 'select', payload = null, single = false, maybe = false, countOnly = false, order = null, limit = null, returning = false;
  const q = {
    select(_c, opts) { if (mode === 'select' && opts && opts.head) countOnly = true; if (mode !== 'select') returning = true; return q; },
    eq(k, v) { filters.push((r) => r[k] === v); return q; },
    gte(k, v) { filters.push((r) => String(r[k]) >= String(v)); return q; },
    gt(k, v) { filters.push((r) => r[k] > v); return q; },
    in(k, vs) { filters.push((r) => vs.includes(r[k])); return q; },
    order(k, o) { order = [k, o && o.ascending === false ? -1 : 1]; return q; },
    limit(n) { limit = n; return q; },
    maybeSingle() { maybe = true; return q; },
    single() { single = true; return q; },
    insert(p) { mode = 'insert'; payload = Array.isArray(p) ? p : [p]; return q; },
    update(p) { mode = 'update'; payload = p; return q; },
    upsert(p) {
      const i = rows.findIndex((r) => r.user_id === p.user_id && r.subject === p.subject && r.topic === p.topic);
      if (i >= 0) rows[i] = { ...rows[i], ...p }; else rows.push({ ...p });
      return Promise.resolve({ error: null });
    },
    then(res, rej) {
      try {
        let out;
        if (mode === 'insert') {
          const made = payload.map((p) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), status: table === 'academy_hw_requests' ? 'pending' : undefined, attempts: table === 'academy_hw_items' ? 0 : undefined, ...p }));
          rows.push(...made);
          out = { data: single ? made[0] : made, error: null };
        } else if (mode === 'update') {
          const hit = rows.filter((r) => filters.every((f) => f(r))); hit.forEach((r) => Object.assign(r, payload));
          out = { data: hit, error: null };
        } else {
          let hit = rows.filter((r) => filters.every((f) => f(r)));
          if (order) hit = hit.slice().sort((a, b) => (a[order[0]] > b[order[0]] ? 1 : -1) * order[1]);
          if (limit) hit = hit.slice(0, limit);
          out = countOnly ? { count: hit.length, error: null } : { data: maybe || single ? hit[0] || null : hit, error: null };
        }
        return Promise.resolve(out).then(res, rej);
      } catch (e) { return Promise.reject(e).then(res, rej); }
    },
  };
  return q;
}
const supabase = { from, auth: { admin: { getUserById: async (id) => ({ data: { user: { email: id + '@example.com' } } }) } } };

// ---------- people ----------
const U = { kid: 'aaaaaaaa-0000-0000-0000-000000000001', kid2: 'aaaaaaaa-0000-0000-0000-000000000002', mum: 'aaaaaaaa-0000-0000-0000-00000000000a', stranger: 'aaaaaaaa-0000-0000-0000-00000000000b', plus: 'aaaaaaaa-0000-0000-0000-000000000003' };
db.academy_profiles.push(
  { user_id: U.kid, display_name: 'Sam', level: 'secondary', role: 'student' },
  { user_id: U.kid2, display_name: 'Alex', level: 'primary', role: 'student' },
  { user_id: U.plus, display_name: 'Priya', level: 'secondary', role: 'student' },
  { user_id: U.mum, display_name: 'Mum', level: 'secondary', role: 'parent' },
  { user_id: U.stranger, display_name: 'Other parent', level: 'secondary', role: 'parent' });
db.academy_links.push({ parent_id: U.mum, student_id: U.kid });
const TOKENS = { 'tok-kid': U.kid, 'tok-kid2': U.kid2, 'tok-mum': U.mum, 'tok-stranger': U.stranger, 'tok-plus': U.plus };
const emails = [];
let nextClaude = [];
const LEVELS = { primary: 'LEVEL: Primary', secondary: 'LEVEL: Secondary', university: 'LEVEL: University' };
const ops = createHomeworkOps({
  getSupabase: () => supabase,
  getBody: async (req) => req.body || {},
  ok: (res, d) => { res.status = 200; res.json = { ok: true, ...d }; },
  err: (res, m, c = 400) => { res.status = c; res.json = { ok: false, error: m }; },
  userFromReq: async (req) => { const id = TOKENS[(req.headers.authorization || '').slice(7)]; return id ? { id } : null; },
  entitlement: async (_s, uid) => ({ plan: uid === U.plus ? 'plus' : 'free' }),
  claude: async (_k, system, messages) => { const r = nextClaude.shift(); if (r instanceof Error) throw r; return typeof r === 'function' ? r(system, messages) : r; },
  getResend: () => ({ emails: { send: async (m) => { emails.push(m); return { id: 'x' }; } } }),
  getSender: () => 'noreply@test',
  LEVELS, clamp: (s, n) => String(s || '').trim().slice(0, n),
});
async function call(op, body = {}, token) {
  const req = { body, headers: token ? { authorization: 'Bearer ' + token } : {} };
  const res = {}; await ops[op](req, res); return res;
}
const EXTRACTED = JSON.stringify({ readable: true, subject: 'Mathematics', topic: 'Adding fractions', title: 'Fractions worksheet', assessment: false,
  questions: [{ question: 'Work out 1/2 + 1/3', context: '', answer: '1/2 + 1/3 = 3/6 + 2/6 = 5/6' }, { question: 'Work out 3/4 - 1/8', context: '', answer: '6/8 - 1/8 = 5/8' }] });
const PHOTO = { media_type: 'image/jpeg', data: Buffer.from('fake-jpeg').toString('base64') };
const deepHas = (obj, s) => JSON.stringify(obj).includes(s);

let passed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('  ✓ ' + name); } catch (e) { console.log('  ✗ ' + name + '\n    ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n    ')); process.exitCode = 1; } }

(async () => {
  let items, hwId;
  console.log('Upload');
  await test('needs a signed-in student account', async () => {
    assert.strictEqual((await call('hw-upload', { images: [PHOTO] })).status, 401);
    assert.strictEqual((await call('hw-upload', { images: [PHOTO] }, 'tok-mum')).status, 403);
  });
  await test('rejects bad input without calling the AI', async () => {
    assert.strictEqual((await call('hw-upload', { images: [PHOTO, PHOTO, PHOTO, PHOTO, PHOTO] }, 'tok-kid')).status, 400);
    assert.strictEqual((await call('hw-upload', { images: [{ media_type: 'image/heic', data: 'abc' }] }, 'tok-kid')).status, 400);
    assert.strictEqual((await call('hw-upload', { text: 'hi' }, 'tok-kid')).status, 400);
  });
  await test('a photo is read into question cards; answers are NOT sent to the student', async () => {
    nextClaude.push((system, messages) => { assert.ok(system.includes('NEVER copy names')); assert.strictEqual(messages[0].content[0].type, 'image'); return EXTRACTED; });
    const r = await call('hw-upload', { images: [PHOTO], note: 'I find common denominators hard' }, 'tok-kid');
    assert.strictEqual(r.json.items.length, 2);
    assert.ok(!deepHas(r.json, '5/6') && !deepHas(r.json, '5/8'), 'answer leaked in upload response');
    assert.ok(r.json.items.every((i) => i.answer === null && i.unlocked === false));
    assert.strictEqual(r.json.quota.left, 1);
    items = r.json.items; hwId = r.json.homework.id;
    assert.ok(db.academy_hw_items.every((i) => i.answer), 'answers should be stored server-side');
  });
  await test('an unreadable photo does not use up an upload', async () => {
    nextClaude.push(JSON.stringify({ readable: false, reason: 'The photo is too blurry.', questions: [] }));
    const r = await call('hw-upload', { images: [PHOTO] }, 'tok-kid');
    assert.strictEqual(r.json.unreadable, true);
    assert.strictEqual((await call('hw-list', {}, 'tok-kid')).json.quota.left, 1);
  });
  await test('free plan: 2 uploads a month, then a friendly limit (AI not called)', async () => {
    nextClaude.push(EXTRACTED);
    assert.ok((await call('hw-upload', { text: 'Work out 2/5 + 1/5 please' }, 'tok-kid')).json.items);
    const before = nextClaude.length;
    const r = await call('hw-upload', { images: [PHOTO] }, 'tok-kid');
    assert.strictEqual(r.json.limit, true); assert.strictEqual(nextClaude.length, before);
  });
  await test('Plus plan gets the larger allowance', async () => {
    const r = await call('hw-list', {}, 'tok-plus');
    assert.ok(r.json.quota.limit > 2);
  });

  console.log('Learning (lesson, check)');
  await test('lesson prompt forbids giving the answer and the lesson is cached', async () => {
    nextClaude.push((system) => { assert.ok(system.includes('NEVER give the final answer')); return 'Think of a similar sum, 1/4 + 1/6...'; });
    const r = await call('hw-lesson', { item_id: items[0].id }, 'tok-kid');
    assert.ok(r.json.lesson.startsWith('Think'));
    const again = await call('hw-lesson', { item_id: items[0].id }, 'tok-kid');
    assert.strictEqual(again.json.lesson, r.json.lesson);
  });
  await test('another student cannot open someone else\'s question', async () => {
    assert.strictEqual((await call('hw-item', { item_id: items[0].id }, 'tok-kid2')).status, 404);
    assert.strictEqual((await call('hw-check', { item_id: items[0].id, attempt: '5/6' }, 'tok-kid2')).status, 404);
  });
  await test('cannot ask for an unlock before trying', async () => {
    assert.strictEqual((await call('hw-request', { item_id: items[0].id }, 'tok-kid')).status, 403);
    assert.strictEqual((await call('hw-pin-unlock', { item_id: items[0].id, pin: '4826' }, 'tok-kid')).status, 403);
  });
  await test('checking an attempt gives feedback without the answer and feeds the Learning Brain', async () => {
    nextClaude.push(JSON.stringify({ result: 'incorrect', feedback: 'Look again at how you made the denominators the same.', mistake: 'Added denominators' }));
    const r = await call('hw-check', { item_id: items[0].id, attempt: '2/5' }, 'tok-kid');
    assert.strictEqual(r.json.result, 'incorrect');
    assert.ok(!deepHas(r.json, '5/6'));
    assert.ok(db.academy_skills.find((s) => s.user_id === U.kid && s.topic === 'Adding fractions'));
    const it = (await call('hw-item', { item_id: items[0].id }, 'tok-kid')).json.item;
    assert.strictEqual(it.answer, null); assert.strictEqual(it.attempts, 1);
  });

  console.log('Parent unlock');
  await test('remote request emails the linked parent (no answer in the email)', async () => {
    const r = await call('hw-request', { item_id: items[0].id }, 'tok-kid');
    assert.strictEqual(r.json.request.status, 'pending');
    assert.strictEqual(emails.length, 1); assert.ok(emails[0].to.startsWith(U.mum));
    assert.ok(!emails[0].html.includes('5/6'));
    assert.strictEqual((await call('hw-request', { item_id: items[0].id }, 'tok-kid')).json.request.status, 'pending');
    assert.strictEqual(emails.length, 1, 'a second request should not spam');
  });
  await test('the parent sees the request with the attempt and the answer; a stranger sees nothing', async () => {
    const p = await call('hw-parent', {}, 'tok-mum');
    assert.strictEqual(p.json.pending.length, 1);
    assert.strictEqual(p.json.pending[0].item.answer, '1/2 + 1/3 = 3/6 + 2/6 = 5/6');
    assert.strictEqual(p.json.pending[0].item.attempt, '2/5');
    const s = await call('hw-parent', {}, 'tok-stranger');
    assert.strictEqual(s.json.pending.length, 0);
    assert.strictEqual((await call('hw-decide', { request_id: p.json.pending[0].id, approve: true }, 'tok-stranger')).status, 404);
    assert.strictEqual((await call('hw-decide', { request_id: p.json.pending[0].id, approve: true }, 'tok-kid')).status, 403);
  });
  await test('"Not yet" keeps it locked and passes the note to the student', async () => {
    const p = await call('hw-parent', {}, 'tok-mum');
    await call('hw-decide', { request_id: p.json.pending[0].id, approve: false, note: 'Try once more, then ask me' }, 'tok-mum');
    const it = (await call('hw-item', { item_id: items[0].id }, 'tok-kid')).json.item;
    assert.strictEqual(it.unlocked, false); assert.strictEqual(it.answer, null);
    assert.strictEqual(it.request.status, 'declined'); assert.strictEqual(it.request.note, 'Try once more, then ask me');
  });
  await test('remote approval unlocks only that question', async () => {
    await call('hw-request', { item_id: items[0].id }, 'tok-kid');
    const p = await call('hw-parent', {}, 'tok-mum');
    assert.strictEqual((await call('hw-decide', { request_id: p.json.pending[0].id, approve: true }, 'tok-mum')).json.status, 'approved');
    const it = (await call('hw-item', { item_id: items[0].id }, 'tok-kid')).json.item;
    assert.strictEqual(it.unlocked, true); assert.ok(it.answer.includes('5/6'));
    const other = (await call('hw-item', { item_id: items[1].id }, 'tok-kid')).json.item;
    assert.strictEqual(other.answer, null);
    const row = db.academy_hw_items.find((i) => i.id === items[0].id);
    assert.strictEqual(row.unlock_method, 'remote'); assert.strictEqual(row.attempted_before_unlock, true);
  });

  console.log('Parent PIN');
  await test('weak PINs are refused; only parents can set one', async () => {
    assert.strictEqual((await call('hw-set-pin', { pin: '1111' }, 'tok-mum')).status, 400);
    assert.strictEqual((await call('hw-set-pin', { pin: '1234' }, 'tok-mum')).status, 400);
    assert.strictEqual((await call('hw-set-pin', { pin: '4826' }, 'tok-kid')).status, 403);
    assert.strictEqual((await call('hw-set-pin', { pin: '4826' }, 'tok-mum')).json.hasPin, true);
    assert.ok(!JSON.stringify(db.academy_profiles).includes('"4826"'), 'PIN stored in plain text');
  });
  await test('wrong PIN keeps it locked; the right PIN unlocks it', async () => {
    nextClaude.push(JSON.stringify({ result: 'partial', feedback: 'Nearly. Check your last step.', mistake: '' }));
    await call('hw-check', { item_id: items[1].id, attempt: '4/8' }, 'tok-kid');
    const bad = await call('hw-pin-unlock', { item_id: items[1].id, pin: '9999' }, 'tok-kid');
    assert.strictEqual(bad.status, 403); assert.ok(!deepHas(bad.json, '5/8'));
    const good = await call('hw-pin-unlock', { item_id: items[1].id, pin: '4826' }, 'tok-kid');
    assert.ok(good.json.item.answer.includes('5/8'));
    assert.strictEqual(db.academy_hw_items.find((i) => i.id === items[1].id).unlock_method, 'pin');
  });
  await test('5 wrong PINs lock PIN unlocking for an hour', async () => {
    nextClaude.push(EXTRACTED);
    const extra = await call('hw-upload', { text: 'Work out 1/2 + 1/3 and 3/4 - 1/8' }, 'tok-plus');
    db.academy_links.push({ parent_id: U.mum, student_id: U.plus });
    nextClaude.push(JSON.stringify({ result: 'incorrect', feedback: 'Have another look.', mistake: '' }));
    const target = extra.json.items[0].id;
    await call('hw-check', { item_id: target, attempt: '1/5' }, 'tok-plus');
    for (let i = 0; i < 5; i++) await call('hw-pin-unlock', { item_id: target, pin: '0000' }, 'tok-plus');
    const locked = await call('hw-pin-unlock', { item_id: target, pin: '4826' }, 'tok-plus');
    assert.strictEqual(locked.status, 429, 'right PIN must not work while locked');
    assert.strictEqual(db.academy_hw_items.find((i) => i.id === target).unlocked_at, undefined);
  });

  console.log('Unlock all and assessments');
  await test('parent "unlock all" opens every question of that homework only', async () => {
    const plusHw = db.academy_homework.find((h) => h.student_id === U.plus);
    assert.strictEqual((await call('hw-unlock-all', { homework_id: plusHw.id }, 'tok-stranger')).status, 404);
    const r = await call('hw-unlock-all', { homework_id: plusHw.id }, 'tok-mum');
    assert.strictEqual(r.json.unlocked, 2);
    assert.ok(db.academy_hw_items.filter((i) => i.homework_id === plusHw.id).every((i) => i.unlock_method === 'parent-all'));
  });
  await test('a test paper is taught but never solved, and cannot be unlocked', async () => {
    nextClaude.push(JSON.stringify({ readable: true, subject: 'Science', topic: 'Forces', title: 'End of unit test', assessment: true,
      questions: [{ question: 'State Newton\'s second law', context: '', answer: 'F = ma' }] }));
    const db0 = db.academy_hw_items.length;
    const r = await call('hw-upload', { text: 'End of unit test: State Newton\'s second law' }, 'tok-plus');
    assert.strictEqual(r.json.homework.assessment, true);
    const row = db.academy_hw_items[db0];
    assert.strictEqual(row.answer, null, 'assessment answers must not be stored');
    const chk = await call('hw-check', { item_id: row.id, attempt: 'F = ma' }, 'tok-plus');
    assert.strictEqual(chk.json.result, null);
    assert.strictEqual((await call('hw-request', { item_id: row.id }, 'tok-plus')).status, 403);
  });

  console.log('Robustness');
  await test('AI failure on upload is a friendly 502 and uses no upload', async () => {
    const left = (await call('hw-list', {}, 'tok-plus')).json.quota.left;
    nextClaude.push(new Error('anthropic 500'));
    assert.strictEqual((await call('hw-upload', { text: 'Work out 7 x 8 please' }, 'tok-plus')).status, 502);
    assert.strictEqual((await call('hw-list', {}, 'tok-plus')).json.quota.left, left);
  });
  await test('student with no linked parent is told to link one', async () => {
    nextClaude.push(EXTRACTED);
    const r = await call('hw-upload', { text: 'Work out 1/2 + 1/3' }, 'tok-kid2');
    nextClaude.push(JSON.stringify({ result: 'incorrect', feedback: 'Try again.', mistake: '' }));
    await call('hw-check', { item_id: r.json.items[0].id, attempt: '2/5' }, 'tok-kid2');
    assert.strictEqual((await call('hw-request', { item_id: r.json.items[0].id }, 'tok-kid2')).json.needsParent, true);
  });

  console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
})();
