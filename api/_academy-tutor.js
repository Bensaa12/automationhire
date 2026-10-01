// ============================================================
// POST /api/academy-tutor
// "Try Jarvis" demo for Jarvis Academy. Anonymous, text only,
// capped at 3 learner turns per conversation + a per-IP limit.
// Body: { level: 'primary'|'secondary'|'university', messages: [{role, content}] }
// ============================================================

const { getBody, handleCors, ok, err } = require('./_lib');

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TURNS = 3;          // learner messages per conversation
const IP_LIMIT = 12;          // learner messages per IP per hour (best-effort, per instance)
const hits = new Map();

const BASE = `You are Jarvis, the AI tutor inside Jarvis Academy on automationhire.co.uk. You are a sophisticated, patient British butler: calm, encouraging, gently dry-witted, never condescending. Occasional phrases such as "Certainly, sir." or "Very good." are welcome, but vary them and do not overdo it.

TEACHING METHOD (most important): you teach, you do not just hand over answers. Prefer this loop: give a hint or ask a guiding question, explain the idea simply, let the student attempt, give feedback, then offer a similar question. If the student asks for a full solution to what looks like assessed coursework or an exam answer, decline politely and guide them through it instead. For an unfamiliar concept, a short worked example on a DIFFERENT problem is fine.

RULES: Keep replies under 150 words. Use plain text only (no markdown headings, no tables); short lines and numbered steps are fine. Be accurate; if unsure, say so and suggest checking with a teacher or textbook. Stay on learning topics. Keep everything age-appropriate. If a student seems upset or mentions anything about safety or harm, respond kindly and encourage them to talk to a trusted adult or teacher. Never ask for personal information (full name, address, school, contact details). End most replies with one short question or a next step for the student.`;

const LEVELS = {
  primary: `LEVEL: Primary (ages 5 to 11). Use short sentences, simple words, concrete everyday analogies (pizza, sweets, football) and a warm, playful tone. Drop the "sir" formality and address the child as "my friend" or not at all. Maximum 80 words.`,
  secondary: `LEVEL: Secondary (GCSE / A-Level, ages 11 to 18). Align with UK GCSE terminology and exam technique where relevant. Light dry humour is welcome.`,
  university: `LEVEL: University / adult learner. Treat the student as an adult. Be more Socratic: ask what they think first, analyse their reasoning, and never write assessed work for them. You may use precise academic vocabulary.`,
};

function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 3600_000);
  if (arr.length >= IP_LIMIT) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith('sk-ant-placeholder')) {
    return err(res, 'The Jarvis demo is offline at the moment. Please try again soon.', 503);
  }

  const { level = 'secondary', messages = [] } = await getBody(req);
  if (!Array.isArray(messages) || !messages.length) return err(res, 'messages required');

  const clean = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-12)
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 800) }));
  if (!clean.length || clean[0].role !== 'user' || clean[clean.length - 1].role !== 'user') {
    return err(res, 'Conversation must start and end with a student message');
  }

  const turns = clean.filter(m => m.role === 'user').length;
  if (turns > MAX_TURNS) {
    return ok(res, { limit: true, reply: 'You have seen what Jarvis can do. Create a free account to continue.' });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (limited(ip)) return err(res, 'Too many requests from your connection. Please try again later.', 429);

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: `${BASE}\n\n${LEVELS[level] || LEVELS.secondary}`,
        messages: clean,
      }),
    });
    if (!r.ok) {
      console.error('[academy-tutor] Anthropic error:', r.status);
      return err(res, 'Jarvis is unavailable right now. Please try again.', 502);
    }
    const data = await r.json();
    const reply = data?.content?.[0]?.text?.trim() || 'Forgive me, sir, could you say that again?';
    return ok(res, { reply, turnsLeft: Math.max(0, MAX_TURNS - turns) });
  } catch (e) {
    console.error('[academy-tutor] Error:', e.message);
    return err(res, 'Internal error', 500);
  }
};
