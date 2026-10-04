// GCSE Literature Games: free / premium configuration. Server-only.
// Everything here can be overridden with Vercel environment variables, so limits and which
// plans count as premium can change without a code change.

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);

const LIMITS = {
  freeFlashcards: num(process.env.LIT_FREE_FLASHCARDS, 5),      // free cards per text (the cards marked free: true)
  freeScenes: num(process.env.LIT_FREE_SCENES, 1),              // free Draw the Story scenes per text
  freeWritingSubmissions: num(process.env.LIT_FREE_WRITING, 1), // free AI feedback submissions per text
  freeLevels: num(process.env.LIT_FREE_LEVELS, 3),              // writing levels open to free users (1..n)
  roundSize: num(process.env.LIT_ROUND_SIZE, 10),               // premium flashcard round length
  writingMinWords: 15,
  writingMaxChars: 4000,
};

// Academy plans that unlock the full GCSE Literature experience.
const PREMIUM_PLANS = String(process.env.LIT_PREMIUM_PLANS || 'plus,family').split(',').map((s) => s.trim()).filter(Boolean);
const isPremium = (ent) => !!ent && PREMIUM_PLANS.includes(ent.plan);

module.exports = { LIMITS, PREMIUM_PLANS, isPremium };
