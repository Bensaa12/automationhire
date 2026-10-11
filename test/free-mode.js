// Jarvis Academy is free: every signed-in student gets the full experience, guests keep the sample.
// Run: node test/free-mode.js   (the other tests pin the tiered limits so the paid-tier logic stays covered)
const assert = require('assert');
for (const k of ['LIT_PREMIUM_PLANS', 'HW_FREE_UPLOADS', 'ACADEMY_FREE_SESSIONS', 'ACADEMY_FREE_TURNS']) delete process.env[k];

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; } catch (e) { console.log('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

const { isPremium } = require('../api/_academy-lit-config');
test('a signed-in free account gets the full GCSE Literature experience', () => assert.strictEqual(isPremium({ plan: 'free' }), true));
test('plus and family accounts still count as premium', () => { assert.strictEqual(isPremium({ plan: 'plus' }), true); assert.strictEqual(isPremium({ plan: 'family' }), true); });
test('no entitlement (a guest) is not premium', () => { assert.strictEqual(isPremium(null), false); assert.strictEqual(isPremium(undefined), false); });

const src = require('fs').readFileSync(require('path').join(__dirname, '../api/_academy-homework.js'), 'utf8');
test('homework fair-use default is 10 uploads a month', () => assert.ok(/HW_FREE_UPLOADS, 10\)/.test(src)));
const tutor = require('fs').readFileSync(require('path').join(__dirname, '../api/_academy-tutor.js'), 'utf8');
test('free tutor allowance defaults to 30 sessions of 30 questions', () => assert.ok(/ACADEMY_FREE_SESSIONS, 30\)/.test(tutor) && /ACADEMY_FREE_TURNS, 30\)/.test(tutor)));
const billing = require('fs').readFileSync(require('path').join(__dirname, '../api/_academy-billing.js'), 'utf8');
test('paid checkout stays off unless ACADEMY_PAYMENTS_LIVE=1', () => assert.ok(/ACADEMY_PAYMENTS_LIVE === '1'/.test(billing)));

console.log(`\n${passed} passed${failed ? ', ' + failed + ' FAILED' : ''}`);
process.exit(failed ? 1 : 0);
