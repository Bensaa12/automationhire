// ============================================================
// AutomationHire — LiveKit Token Endpoint
// GET /api/livekit-token
// Returns { token, url, room }
// ============================================================

const crypto = require('crypto');
const { handleCors, ok, err } = require('./_lib');

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generateToken(apiKey, apiSecret, identity, roomName) {
  const header  = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now     = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    iss: apiKey,
    sub: identity,
    iat: now,
    exp: now + 3600,
    name: 'Website Visitor',
    video: {
      roomJoin:       true,
      room:           roomName,
      canPublish:     true,
      canSubscribe:   true,
      canPublishData: true,
    },
  }));

  const sig = crypto
    .createHmac('sha256', apiSecret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${header}.${payload}.${sig}`;
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const apiKey    = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const lkUrl     = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !lkUrl) {
    return err(res, 'LiveKit credentials not configured', 500);
  }

  const roomName = `sharon-${crypto.randomBytes(6).toString('hex')}`;
  const identity = `visitor-${crypto.randomBytes(4).toString('hex')}`;
  const token    = generateToken(apiKey, apiSecret, identity, roomName);

  return ok(res, { token, url: lkUrl, room: roomName });
};
