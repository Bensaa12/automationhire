// Uploads a file to Cloudflare R2 via a presigned PUT, then verifies it with a presigned GET.
//
//   node scripts/upload-to-r2.js <local-file> <bucket> <key>
//
// Reads R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY from the environment
// (e.g. load .env.local first). Single PUT is fine up to 5 GB.
const fs = require('fs');
const { r2PresignedUrl } = require('../api/_r2');

async function main() {
  const [file, bucket, key] = process.argv.slice(2);
  if (!file || !bucket || !key) throw new Error('usage: node scripts/upload-to-r2.js <local-file> <bucket> <key>');
  const body = fs.readFileSync(file);
  console.log(`Uploading ${(body.length / 1e6).toFixed(1)} MB to r2://${bucket}/${key} ...`);

  const put = await fetch(r2PresignedUrl(bucket, key, { method: 'PUT', expiresIn: 900 }), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body,
  });
  if (!put.ok) throw new Error(`Upload failed: HTTP ${put.status} ${await put.text()}`);

  // Confirm a buyer-style signed link works and reports the right size (ranged GET, first byte only).
  const get = await fetch(r2PresignedUrl(bucket, key, { expiresIn: 300 }), { headers: { Range: 'bytes=0-0' } });
  const total = Number((get.headers.get('content-range') || '').split('/')[1]);
  if (!get.ok || total !== body.length) throw new Error(`Verification failed: HTTP ${get.status}, size ${total}`);
  console.log(`Done. Signed download link verified (${(total / 1e6).toFixed(1)} MB).`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
