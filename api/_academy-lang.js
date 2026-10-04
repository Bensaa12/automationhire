// ============================================================
// Jarvis Academy tutor languages. Pure data + helpers (no dependencies) so it can be
// unit-tested on its own. Used by api/_academy-tutor.js.
// Add a language: one entry in LANGS with its prompt and canned replies, then the same
// code in assets/js/academy.js (UI strings) and the EN|FR switch in jarvis-academy.html.
// ============================================================

const LANGS = {
  en: {
    prompt: '',
    maxTokens: 400,
    replies: {
      anon: 'You have seen what Jarvis can do. Create a free account to continue.',
      monthlyFree: (n) => `You have used your ${n} free sessions this month. Upgrade for a much bigger allowance.`,
      monthlyPaid: 'You have reached this month\'s fair-use allowance. It resets at the start of next month.',
      session: 'That was a long and productive session, sir. Start a new one to carry on.',
      fallback: 'Forgive me, sir, could you say that again?',
    },
  },
  fr: {
    // Francophone Africa first: most learners are in West and Central Africa, also France,
    // Belgium, Switzerland and Canada. Overrides the UK/GCSE wording in the level prompts.
    prompt: `LANGUAGE: Always reply in French (français), even if the student mixes in English words, unless they explicitly ask for another language. Write natural, correct French with French punctuation and number conventions (decimal comma: 3,5; spaces in large numbers: 10 000).
AUDIENCE: Many students are in francophone Africa (for example Côte d'Ivoire, Sénégal, Cameroun, RD Congo, Mali, Burkina Faso, Bénin, Togo, Guinée, Gabon), others in France, Belgium, Switzerland or Canada. Use examples that make sense across these countries (metric units, everyday situations such as the market, football, sharing food); do not assume a country unless the student says where they are.
SCHOOL SYSTEM: Ignore the UK GCSE / A-Level references above unless the student mentions GCSE, IGCSE or A-Level. Follow francophone programmes instead: primaire (CP to CM2, CEPE), collège (6e to 3e, BEPC / brevet), lycée (seconde to terminale, BAC), université. Use French subject names and exam vocabulary (for example "équation du premier degré", "dissertation", "commentaire de texte").
STYLE: Keep Jarvis's courteous butler character in French ("Certainement.", "Très bien.", "À votre service."), varied and not overdone. Use "tu" with primary-school children and "vous" with secondary and university students.`,
    maxTokens: 520,   // French needs more tokens than English for the same ~150 words
    replies: {
      anon: 'Vous avez vu ce que Jarvis sait faire. Créez un compte gratuit pour continuer.',
      monthlyFree: (n) => `Vous avez utilisé vos ${n} séances gratuites ce mois-ci. Passez à une offre supérieure pour beaucoup plus de séances.`,
      monthlyPaid: 'Vous avez atteint la limite d\'utilisation raisonnable de ce mois. Elle se réinitialise au début du mois prochain.',
      session: 'Quelle longue et belle séance ! Commencez-en une nouvelle pour continuer.',
      fallback: 'Pardonnez-moi, pourriez-vous répéter ?',
    },
  },
};

const pickLang = (code) => (Object.prototype.hasOwnProperty.call(LANGS, code) ? code : 'en');

module.exports = { LANGS, pickLang };
