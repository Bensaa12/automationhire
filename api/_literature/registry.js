// GCSE Literature: the registry of texts. Server-only. (Not named index.js: a folder index
// would be served as the page for /api/_literature on this static-output site.)
//
// ADD A NEW GCSE TEXT: create api/_literature/<id>.js with the same shape as macbeth.js
// (id, title, author, form, examBoards, tagline, accent, characters, themes, events,
// quotations, context, techniques, flashcards, writingScenes, examQuestions), mark exactly
// LIMITS.freeFlashcards cards and one writing scene as `free: true`, add it to TEXTS below,
// then run `node test/literature-content.js` to validate it. No UI changes are needed.

const TEXTS = [
  require('./macbeth'),
  require('./a-christmas-carol'),
  require('./an-inspector-calls'),
];

const CATEGORIES = [
  { id: 'characters', label: 'Characters' },
  { id: 'themes', label: 'Themes' },
  { id: 'events', label: 'Key Events' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'context', label: 'Context' },
  { id: 'techniques', label: 'Language & Techniques' },
];

// Draw the Story levels. Free users get the first FREE_LEVELS on their free scene.
const LEVELS = [
  { n: 1, name: 'What happened?', task: 'Describe what happens in this scene. Who is there, and what do they do and say?' },
  { n: 2, name: 'What happened and why?', task: 'Explain what happens in this scene and why the characters act as they do.' },
  { n: 3, name: 'What does it show?', task: 'What does this scene show us about a character or a theme? Explain your ideas.' },
  { n: 4, name: 'GCSE Analysis', task: 'Analyse how the writer presents this scene. Consider language, structure, character, theme, context and the writer\'s purpose.' },
  { n: 5, name: 'Exam Challenge', task: null },   // uses the scene's own examQuestion
];

const byId = Object.fromEntries(TEXTS.map((t) => [t.id, t]));

module.exports = { TEXTS, CATEGORIES, LEVELS, byId };
