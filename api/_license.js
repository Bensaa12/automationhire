// ============================================================
// Offline licence keys for paid desktop apps (Pound Appstore).
// Format: <PREFIX>-<base64url JSON payload>.<base64url Ed25519 signature>
// The app embeds the matching public key and verifies offline.
//
// Env (one per app): e.g. HIRECAST_LICENSE_PRIVATE_KEY = the private key as single-line
// base64 of its PKCS#8 DER (see Documents\HireCast-Licensing\README.txt).
// ============================================================

const crypto = require('crypto');

const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function loadPrivateKey(envName) {
  const raw = process.env[envName];
  if (!raw) throw new Error(`Licence signing key not configured (${envName})`);
  return raw.includes('BEGIN')
    ? crypto.createPrivateKey(raw.replace(/\\n/g, '\n'))
    : crypto.createPrivateKey({ key: Buffer.from(raw.trim(), 'base64'), format: 'der', type: 'pkcs8' });
}

/**
 * Licence key for a paid Stripe Checkout session. Deterministic (Ed25519 signatures are), so
 * the buyer gets the same key every time they reload the download page.
 */
function licenseKeyForSession(prefix, envName, session) {
  const created = new Date((session.created || Date.now() / 1000) * 1000);
  const payload = {
    v: 1,
    e: session.customer_details?.email || '',
    n: session.customer_details?.name || '',
    id: crypto.createHash('sha256').update(session.id).digest('hex').slice(0, 8),
    d: created.toISOString().slice(0, 10),
    o: session.id,
  };
  const buf = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = crypto.sign(null, buf, loadPrivateKey(envName));
  return `${prefix}-${b64u(buf)}.${b64u(sig)}`;
}

module.exports = { licenseKeyForSession };
