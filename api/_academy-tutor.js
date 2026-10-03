// ============================================================
// Jarvis Academy API. Not a function itself: dispatched from api/sharon.js
// (Vercel Hobby plan allows 12 functions). Rewrites in vercel.json:
//   /api/academy/:op        -> /api/sharon?action=academy&op=:op
//   /api/academy-tutor      -> same, op=tutor   (legacy path)
// ops: signup | login | refresh | me | tutor | invite | link | family | unlink | config | game
// ============================================================

const crypto = require('crypto');
const { getSupabase, getBody, handleCors, ok, err } = require('./_lib');

const MODEL = 'claude-haiku-4-5-20251001';
const ANON_TURNS = 3;          // anonymous learner messages per conversation
const IP_LIMIT = 12;           // anonymous learner messages per IP per hour (best-effort, per instance)
// Per-plan allowances (sessions per calendar month, learner messages per session).
// Marketed as "unlimited sessions" but fair-use capped here because voice/vision/AI cost real money.
const PLANS = { free: { sessions: 10, turns: 20 }, plus: { sessions: 100, turns: 40 }, family: { sessions: 100, turns: 40 } };
const hits = new Map();

const BASE = `You are Jarvis, the AI tutor inside Jarvis Academy on automationhire.co.uk. You are a sophisticated, patient British butler: calm, encouraging, gently dry-witted, never condescending. Occasional phrases such as "Certainly, sir." or "Very good." are welcome, but vary them and do not overdo it.

TEACHING METHOD (most important): you teach, you do not just hand over answers. Prefer this loop: give a hint or ask a guiding question, explain the idea simply, let the student attempt, give feedback, then offer a similar question. If the student asks for a full solution to what looks like assessed coursework or an exam answer, decline politely and guide them through it instead. For an unfamiliar concept, a short worked example on a DIFFERENT problem is fine.

RULES: Keep replies under 150 words. Use plain text only (no markdown headings, no tables); short lines and numbered steps are fine. Be accurate; if unsure, say so and suggest checking with a teacher or textbook. Stay on learning topics. Keep everything age-appropriate. If a student seems upset or mentions anything about safety or harm, respond kindly and encourage them to talk to a trusted adult or teacher. Never ask for personal information (full name, address, school, contact details). End most replies with one short question or a next step for the student.`;

const LEVELS = {
  primary: `LEVEL: Primary (ages 5 to 11). Use short sentences, simple words, concrete everyday analogies (pizza, sweets, football) and a warm, playful tone. Drop the "sir" formality and address the child as "my friend" or not at all. Maximum 80 words.`,
  secondary: `LEVEL: Secondary (GCSE / A-Level, ages 11 to 18). Align with UK GCSE terminology and exam technique where relevant. Light dry humour is welcome.`,
  university: `LEVEL: University / adult learner. Treat the student as an adult. Be more Socratic: ask what they think first, analyse their reasoning, and never write assessed work for them. You may use precise academic vocabulary.`,
};

const EXTRACT = `You analyse one exchange between a student and a tutor. Reply with ONLY a JSON object, no prose:
{"subject":"<school subject, e.g. Mathematics>","topic":"<specific topic, e.g. Simultaneous equations>","assessed":"correct|incorrect|partial|none","mistake":"<short common-mistake note, or empty>"}
Use assessed="none" unless the STUDENT attempted an answer or explanation that the tutor evaluated. Keep subject and topic short, Title Case.`;

const clamp = (s, n) => String(s || '').trim().slice(0, n);
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 3600_000);
  if (arr.length >= IP_LIMIT) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

async function claude(apiKey, system, messages, max_tokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens, system, messages }),
  });
  if (!r.ok) throw new Error('anthropic ' + r.status);
  const d = await r.json();
  return d?.content?.[0]?.text?.trim() || '';
}

async function userFromReq(req, supabase) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  const { data: { user } = {}, error } = await supabase.auth.getUser(h.slice(7));
  return error || !user ? null : user;
}

const planActive = p => !!p && ['plus', 'family'].includes(p.plan) && (!p.plan_expires_at || new Date(p.plan_expires_at).getTime() + 3 * 86400_000 > Date.now());

// A student's own Plus plan, or a linked parent's active Family plan, lifts the free limits.
async function entitlement(supabase, userId) {
  const { data: p } = await supabase.from('academy_profiles').select('plan, plan_expires_at').eq('user_id', userId).maybeSingle();
  let plan = planActive(p) ? p.plan : 'free';
  if (plan === 'free') {
    const { data: links } = await supabase.from('academy_links').select('parent_id').eq('student_id', userId);
    const ids = (links || []).map(l => l.parent_id);
    if (ids.length) {
      const { data: parents } = await supabase.from('academy_profiles').select('plan, plan_expires_at').in('user_id', ids);
      if ((parents || []).some(x => x.plan === 'family' && planActive(x))) plan = 'family';
    }
  }
  return { plan, ...PLANS[plan] };
}

async function getBrain(supabase, userId, ent) {
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [skills, sess] = await Promise.all([
    supabase.from('academy_skills').select('subject, topic, confidence, attempts, correct, last_mistake, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(60),
    supabase.from('academy_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('started_at', monthStart.toISOString()),
  ]);
  return { skills: skills.data || [], sessionsThisMonth: sess.count || 0, sessionLimit: ent.sessions, turnLimit: ent.turns, plan: ent.plan };
}

function brainContext(skills) {
  const weak = skills.filter(s => s.attempts > 0 && s.confidence < 60).sort((a, b) => a.confidence - b.confidence).slice(0, 3);
  const strong = skills.filter(s => s.confidence >= 75).slice(0, 2);
  if (!weak.length && !strong.length) return '';
  const w = weak.map(s => `${s.subject}: ${s.topic} (${s.confidence}%${s.last_mistake ? ', usual mistake: ' + s.last_mistake : ''})`).join('; ');
  const st = strong.map(s => `${s.subject}: ${s.topic}`).join('; ');
  return `\n\nWHAT YOU REMEMBER ABOUT THIS STUDENT (private; use naturally, do not recite it): ${w ? 'needs practice: ' + w + '. ' : ''}${st ? 'strong at: ' + st + '.' : ''}`;
}

async function recordSkill(supabase, apiKey, userId, studentMsg, reply) {
  try {
    const raw = await claude(apiKey, EXTRACT, [{ role: 'user', content: `STUDENT: ${studentMsg}\n\nTUTOR: ${reply}` }], 120);
    const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    if (!['correct', 'incorrect', 'partial'].includes(j.assessed)) return null;
    const subject = clamp(j.subject, 40), topic = clamp(j.topic, 60);
    if (!subject || !topic) return null;
    const { data: cur } = await supabase.from('academy_skills').select('*').eq('user_id', userId).eq('subject', subject).eq('topic', topic).maybeSingle();
    const target = j.assessed === 'correct' ? 100 : j.assessed === 'partial' ? 55 : 10;
    const row = {
      user_id: userId, subject, topic,
      confidence: Math.round((cur ? cur.confidence : 50) * 0.7 + target * 0.3),
      attempts: (cur?.attempts || 0) + 1,
      correct: (cur?.correct || 0) + (j.assessed === 'correct' ? 1 : 0),
      last_mistake: j.assessed !== 'correct' && j.mistake ? clamp(j.mistake, 140) : (cur?.last_mistake || null),
      updated_at: new Date().toISOString(),
    };
    await supabase.from('academy_skills').upsert(row, { onConflict: 'user_id,subject,topic' });
    return { subject, topic, confidence: row.confidence };
  } catch (e) {
    console.error('[academy] skill extract failed:', e.message);
    return null;
  }
}

function sessionPayload(session, user, profile) {
  return { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in, user: { id: user.id, email: user.email }, profile };
}

async function signup(req, res) {
  const b = await getBody(req);
  const email = clamp(b.email, 200).toLowerCase(), password = String(b.password || '');
  const name = clamp(b.display_name, 40), level = LEVELS[b.level] ? b.level : 'secondary', role = b.role === 'parent' ? 'parent' : 'student';
  if (!validEmail(email)) return err(res, 'Please enter a valid email address');
  if (password.length < 8) return err(res, 'Password must be at least 8 characters');
  if (!name) return err(res, 'Please enter a first name or nickname');
  if (b.guardian_confirmed !== true) return err(res, 'Please confirm you are 13 or over, or that a parent or guardian is setting this up');

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: 'https://automationhire.co.uk/jarvis-academy' } });
  if (error) return err(res, error.message.includes('registered') ? 'That email already has an account. Try signing in.' : 'Could not create the account. Please try again.', 400);
  if (!data.user) return err(res, 'Could not create the account', 400);

  await supabase.from('academy_profiles').upsert({ user_id: data.user.id, display_name: name, level, role, guardian_confirmed: true }, { onConflict: 'user_id' });

  if (!data.session) return ok(res, { needs_confirmation: true });   // project requires email confirmation
  return ok(res, sessionPayload(data.session, data.user, { display_name: name, level, role }));
}

async function login(req, res) {
  const { email, password } = await getBody(req);
  if (!email || !password) return err(res, 'Email and password required');
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email: clamp(email, 200).toLowerCase(), password: String(password) });
  if (error) return err(res, 'Invalid email or password', 401);
  const { data: profile } = await supabase.from('academy_profiles').select('display_name, level, plan, role').eq('user_id', data.user.id).maybeSingle();
  if (!profile) return err(res, 'No Jarvis Academy account for this email. Please create one.', 404);
  return ok(res, sessionPayload(data.session, data.user, profile));
}

async function refresh(req, res) {
  const { refresh_token } = await getBody(req);
  if (!refresh_token) return err(res, 'refresh_token required');
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token });
  if (error || !data.session) return err(res, 'Session expired. Please sign in again.', 401);
  return ok(res, { access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_in: data.session.expires_in });
}

async function me(req, res) {
  const supabase = getSupabase();
  const user = await userFromReq(req, supabase);
  if (!user) return err(res, 'Unauthorized', 401);
  const { data: profile } = await supabase.from('academy_profiles').select('display_name, level, plan, role').eq('user_id', user.id).maybeSingle();
  if (!profile) return err(res, 'No Jarvis Academy account for this user', 404);
  if (profile.role === 'parent') return ok(res, { user: { id: user.id, email: user.email }, profile });
  const brain = await getBrain(supabase, user.id, await entitlement(supabase, user.id));
  const { count } = await supabase.from('academy_links').select('parent_id', { count: 'exact', head: true }).eq('student_id', user.id);
  brain.linkedParents = count || 0;
  return ok(res, { user: { id: user.id, email: user.email }, profile, brain });
}

async function tutor(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith('sk-ant-placeholder')) return err(res, 'The Jarvis demo is offline at the moment. Please try again soon.', 503);

  const { level = 'secondary', messages = [], session_id } = await getBody(req);
  if (!Array.isArray(messages) || !messages.length) return err(res, 'messages required');
  const clean = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-12)
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 800) }));
  while (clean.length && clean[0].role !== 'user') clean.shift();   // the 12-message window can start on a tutor reply
  if (!clean.length || clean[0].role !== 'user' || clean[clean.length - 1].role !== 'user') return err(res, 'Conversation must start and end with a student message');
  const turns = clean.filter(m => m.role === 'user').length;

  const hasAuth = (req.headers.authorization || '').startsWith('Bearer ');
  let supabase = null, user = null, profile = null, brain = null, sessTurns = 0, ent = null;

  if (hasAuth) {
    supabase = getSupabase();
    user = await userFromReq(req, supabase);
    if (!user) return err(res, 'Your session has expired. Please sign in again.', 401);
    if (!/^[0-9a-f-]{36}$/i.test(String(session_id || ''))) return err(res, 'session_id required');
    ({ data: profile } = await supabase.from('academy_profiles').select('display_name, level, role').eq('user_id', user.id).maybeSingle());
    if (!profile) return err(res, 'No Jarvis Academy account for this user', 404);
    if (profile.role === 'parent') return err(res, 'Parent accounts view progress; the tutor is for students.', 403);
    ent = await entitlement(supabase, user.id);

    const { data: sess } = await supabase.from('academy_sessions').select('id, turns').eq('id', session_id).eq('user_id', user.id).maybeSingle();
    if (!sess) {
      const b = await getBrain(supabase, user.id, ent);
      if (b.sessionsThisMonth >= ent.sessions) return ok(res, { limit: 'monthly', reply: ent.plan === 'free' ? `You have used your ${ent.sessions} free sessions this month. Upgrade for a much bigger allowance.` : 'You have reached this month\'s fair-use allowance. It resets at the start of next month.' });
      await supabase.from('academy_sessions').insert({ id: session_id, user_id: user.id, level: LEVELS[level] ? level : 'secondary', turns: 0 });
    } else if (sess.turns >= ent.turns) {
      return ok(res, { limit: 'session', reply: 'That was a long and productive session, sir. Start a new one to carry on.' });
    } else { sessTurns = sess.turns; }
    brain = await getBrain(supabase, user.id, ent);
  } else {
    if (turns > ANON_TURNS) return ok(res, { limit: 'anon', reply: 'You have seen what Jarvis can do. Create a free account to continue.' });
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    if (limited(ip)) return err(res, 'Too many requests from your connection. Please try again later.', 429);
  }

  try {
    const lvl = LEVELS[level] ? level : 'secondary';
    let system = `${BASE}\n\n${LEVELS[lvl]}`;
    if (profile) system += `\n\nThe student's first name or nickname is ${profile.display_name}. Use it occasionally.` + brainContext(brain.skills);
    const reply = (await claude(apiKey, system, clean, 400)) || 'Forgive me, sir, could you say that again?';

    if (!user) return ok(res, { reply, turnsLeft: Math.max(0, ANON_TURNS - turns) });

    await supabase.from('academy_sessions').update({ turns: sessTurns + 1, updated_at: new Date().toISOString() }).eq('id', session_id).eq('user_id', user.id);
    const learned = await recordSkill(supabase, apiKey, user.id, clean[clean.length - 1].content, reply);
    return ok(res, { reply, learned });
  } catch (e) {
    console.error('[academy-tutor] Error:', e.message);
    return err(res, 'Jarvis is unavailable right now. Please try again.', 502);
  }
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_CHILDREN = 4;

async function authedProfile(req, res, supabase, role) {
  const user = await userFromReq(req, supabase);
  if (!user) { err(res, 'Unauthorized', 401); return null; }
  const { data: profile } = await supabase.from('academy_profiles').select('display_name, level, role').eq('user_id', user.id).maybeSingle();
  if (!profile) { err(res, 'No Jarvis Academy account for this user', 404); return null; }
  if (role && profile.role !== role) { err(res, role === 'parent' ? 'Only parent accounts can do this' : 'Only student accounts can do this', 403); return null; }
  return { user, profile };
}

// Student: make a one-time code (valid 7 days) to share progress with a parent.
async function invite(req, res) {
  const supabase = getSupabase();
  const a = await authedProfile(req, res, supabase, 'student'); if (!a) return;
  const bytes = crypto.randomBytes(8);
  const code = Array.from(bytes, b => CODE_CHARS[b % CODE_CHARS.length]).join('');
  const expires_at = new Date(Date.now() + 7 * 86400_000).toISOString();
  await supabase.from('academy_invites').delete().eq('student_id', a.user.id);   // one live code at a time
  const { error } = await supabase.from('academy_invites').insert({ code, student_id: a.user.id, expires_at });
  if (error) return err(res, 'Could not create a code. Please try again.', 500);
  return ok(res, { code, expires_at });
}

// Parent: redeem a student's code.
async function link(req, res) {
  const supabase = getSupabase();
  const a = await authedProfile(req, res, supabase, 'parent'); if (!a) return;
  const { code } = await getBody(req);
  const c = clamp(code, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length < 6) return err(res, 'Please enter the code from your child');
  const { count } = await supabase.from('academy_links').select('student_id', { count: 'exact', head: true }).eq('parent_id', a.user.id);
  if ((count || 0) >= MAX_CHILDREN) return err(res, 'You can link up to ' + MAX_CHILDREN + ' children.');
  const { data: inv } = await supabase.from('academy_invites').select('code, student_id, expires_at').eq('code', c).maybeSingle();
  if (!inv || new Date(inv.expires_at) < new Date()) return err(res, 'That code is not valid or has expired. Ask your child for a new one.', 404);
  await supabase.from('academy_links').upsert({ parent_id: a.user.id, student_id: inv.student_id }, { onConflict: 'parent_id,student_id' });
  await supabase.from('academy_invites').delete().eq('code', c);
  return ok(res, { linked: true });
}

// Parent: progress summary for each linked child. No conversation text, ever.
async function family(req, res) {
  const supabase = getSupabase();
  const a = await authedProfile(req, res, supabase, 'parent'); if (!a) return;
  const { data: links } = await supabase.from('academy_links').select('student_id').eq('parent_id', a.user.id);
  const ids = (links || []).map(l => l.student_id);
  if (!ids.length) return ok(res, { children: [] });
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [profiles, skills, sessions] = await Promise.all([
    supabase.from('academy_profiles').select('user_id, display_name, level').in('user_id', ids),
    supabase.from('academy_skills').select('user_id, subject, topic, confidence, attempts').in('user_id', ids).gt('attempts', 0),
    supabase.from('academy_sessions').select('user_id, turns, updated_at').in('user_id', ids).gte('updated_at', weekAgo),
  ]);
  const children = (profiles.data || []).map(p => {
    const sk = (skills.data || []).filter(s => s.user_id === p.user_id);
    const se = (sessions.data || []).filter(s => s.user_id === p.user_id);
    const bySubject = {};
    sk.forEach(s => { (bySubject[s.subject] = bySubject[s.subject] || []).push(s.confidence); });
    return {
      id: p.user_id, display_name: p.display_name, level: p.level,
      sessionsThisWeek: se.length,
      questionsThisWeek: se.reduce((n, s) => n + (s.turns || 0), 0),
      lastActive: se.map(s => s.updated_at).sort().pop() || null,
      subjects: Object.keys(bySubject).map(k => ({ subject: k, average: Math.round(bySubject[k].reduce((x, y) => x + y, 0) / bySubject[k].length), topics: bySubject[k].length })).sort((x, y) => y.average - x.average),
      needsAttention: sk.filter(s => s.confidence < 60).sort((x, y) => x.confidence - y.confidence).slice(0, 3).map(s => ({ subject: s.subject, topic: s.topic, confidence: s.confidence })),
      strong: sk.filter(s => s.confidence >= 75).sort((x, y) => y.confidence - x.confidence).slice(0, 3).map(s => ({ subject: s.subject, topic: s.topic, confidence: s.confidence })),
    };
  });
  return ok(res, { children });
}

// Either side can end a link. Parent sends { student_id }; a student ends all their parent links.
async function unlink(req, res) {
  const supabase = getSupabase();
  const a = await authedProfile(req, res, supabase); if (!a) return;
  const b = await getBody(req);
  if (a.profile.role === 'parent') {
    if (!b.student_id) return err(res, 'student_id required');
    await supabase.from('academy_links').delete().eq('parent_id', a.user.id).eq('student_id', String(b.student_id));
  } else {
    await supabase.from('academy_links').delete().eq('student_id', a.user.id);
  }
  return ok(res, { unlinked: true });
}

async function config(req, res) { return ok(res, { payments: require('./_academy-billing').paymentsLive() }); }

// Games (assets/js/academy-game.js = Maths Challenge, academy-spelling.js = Spelling Bee): a finished
// round updates the student's Learning Brain like a tutor exchange does, so games show in their
// progress and the parent view. Questions are made in the browser; this is the only server call.
const GAME_TOPICS = {
  'add-sub': ['Mathematics', 'Addition and subtraction'], times: ['Mathematics', 'Times tables'], divide: ['Mathematics', 'Division'],
  negatives: ['Mathematics', 'Negative numbers'], fractions: ['Mathematics', 'Fractions of amounts'], percent: ['Mathematics', 'Percentages'],
  algebra: ['Mathematics', 'Solving equations'], powers: ['Mathematics', 'Powers and roots'],
  'spell-5-7': ['English', 'Spelling (ages 5-7)'], 'spell-7-9': ['English', 'Spelling (ages 7-9)'], 'spell-9-11': ['English', 'Spelling (ages 9-11)'],
};
const gameHits = new Map();

async function game(req, res) {
  const supabase = getSupabase();
  const a = await authedProfile(req, res, supabase, 'student');
  if (!a) return;
  // A 60-second round can't legitimately be posted more than every 20 seconds.
  const last = gameHits.get(a.user.id) || 0;
  if (Date.now() - last < 20_000) return err(res, 'Slow down a moment', 429);
  gameHits.set(a.user.id, Date.now());
  if (gameHits.size > 5000) gameHits.clear();

  const b = await getBody(req);
  const results = Array.isArray(b.results) ? b.results.slice(0, 8) : [];
  const saved = [];
  for (const r of results) {
    const known = GAME_TOPICS[r && r.topic];
    const total = Math.floor(Number(r && r.total));
    const correct = Math.floor(Number(r && r.correct));
    if (!known || !(total >= 1 && total <= 120) || !(correct >= 0 && correct <= total)) continue;
    const [subject, topic] = known;
    const { data: cur } = await supabase.from('academy_skills').select('*').eq('user_id', a.user.id).eq('subject', subject).eq('topic', topic).maybeSingle();
    // More questions answered = more evidence, so the round moves confidence further (max half-way).
    const weight = Math.min(0.5, 0.04 * total);
    const accuracy = (correct / total) * 100;
    const row = {
      user_id: a.user.id, subject, topic,
      confidence: Math.round((cur ? cur.confidence : 50) * (1 - weight) + accuracy * weight),
      attempts: (cur?.attempts || 0) + total,
      correct: (cur?.correct || 0) + correct,
      last_mistake: r.mistake ? clamp(r.mistake, 140) : (cur?.last_mistake || null),
      updated_at: new Date().toISOString(),
    };
    await supabase.from('academy_skills').upsert(row, { onConflict: 'user_id,subject,topic' });
    saved.push({ subject, topic, confidence: row.confidence });
  }
  return ok(res, { saved });
}

const OPS = { signup, login, refresh, me, tutor, invite, link, family, unlink, config, game };

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  const op = (req.query && req.query.op) || 'tutor';
  const fn = OPS[op];
  if (!fn) return err(res, 'Unknown operation', 404);
  const wantsGet = op === 'me' || op === 'config';
  if ((wantsGet && req.method !== 'GET') || (!wantsGet && req.method !== 'POST')) return err(res, 'Method not allowed', 405);
  try { return await fn(req, res); }
  catch (e) { console.error('[academy]', op, e.message); return err(res, 'Internal error', 500); }
};
