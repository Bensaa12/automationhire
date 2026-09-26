// ============================================================
// Cloudflare R2 (S3-compatible) presigned URLs — AWS Signature V4, query-string form.
// No SDK: a dozen lines of HMAC keep the Vercel function small.
// Files starting with "_" in /api are helpers, not routes (they don't count as functions).
//
// Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
// ============================================================

const crypto = require('crypto');

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex');

/** RFC 3986 encoding as SigV4 requires (encodeURIComponent leaves !'()* alone). */
function uriEncode(str, keepSlash) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(keepSlash ? /%2F/g : /$^/, '/');
}

/**
 * Presigns a request for `key` in `bucket`. Generic over host/region so it can be
 * checked against AWS's published test vector; use r2PresignedUrl() in app code.
 */
function presign({ method = 'GET', host, bucket, key, accessKeyId, secretAccessKey, region = 'auto', expiresIn = 3600, now = new Date(), extraQuery = {} }) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20130524T000000Z
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${region}/s3/aws4_request`;
  const path = bucket ? `/${uriEncode(bucket)}/${uriEncode(key, true)}` : `/${uriEncode(key, true)}`;

  const query = {
    ...extraQuery,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(query[k])}`)
    .join('&');

  const canonicalRequest = [method, path, canonicalQuery, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, date), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Time-limited private link to an object in an R2 bucket (GET to download, PUT to upload). */
function r2PresignedUrl(bucket, key, { method = 'GET', expiresIn = 3600, downloadName } = {}) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)');
  }
  return presign({
    method,
    host: `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    bucket,
    key,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    expiresIn,
    // Makes the browser save it under its real name instead of opening it.
    extraQuery: downloadName ? { 'response-content-disposition': `attachment; filename="${downloadName}"` } : {},
  });
}

module.exports = { presign, r2PresignedUrl };
