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
 * the buyer gets the same key every time they reload the download page. `edition` 'pro' marks
 * a Pro key (the app unlocks its Pro features); anything else is a Standard key.
 */
function licenseKeyForSession(prefix, envName, session, edition) {
  const created = new Date((session.created || Date.now() / 1000) * 1000);
  const payload = {
    v: 1,
    e: session.customer_details?.email || '',
    n: session.customer_details?.name || '',
    id: crypto.createHash('sha256').update(session.id).digest('hex').slice(0, 8),
    d: created.toISOString().slice(0, 10),
    o: session.id,
  };
  if (edition === 'pro') payload.ed = 'pro';
  const buf = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = crypto.sign(null, buf, loadPrivateKey(envName));
  return `${prefix}-${b64u(buf)}.${b64u(sig)}`;
}

const b64uDecode = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/**
 * Checks a licence key we issued (e.g. a Standard key offered for the Pro upgrade price).
 * The public half is derived from the signing key, so no extra env var is needed.
 * Returns the payload, or null if the key is malformed, for another app, or forged.
 */
function verifyLicenseKey(prefix, envName, key) {
  const compact = String(key || '').replace(/\s+/g, '');
  if (!compact.startsWith(`${prefix}-`)) return null;
  const m = compact.slice(prefix.length + 1).match(/^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  const buf = b64uDecode(m[1]);
  const publicKey = crypto.createPublicKey(loadPrivateKey(envName));
  if (!crypto.verify(null, buf, publicKey, b64uDecode(m[2]))) return null;
  try {
    const payload = JSON.parse(buf.toString('utf8'));
    return payload && payload.v === 1 ? payload : null;
  } catch {
    return null;
  }
}

module.exports = { licenseKeyForSession, verifyLicenseKey };
