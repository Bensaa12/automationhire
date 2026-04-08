// ============================================================
// AutomationHire — n8n Webhook Relay
// POST /api/n8n-webhook
// Called by Supabase Database Webhooks → forwards to n8n
// This keeps your n8n URL private and lets you add logic
// ============================================================

const { handleCors, ok, err } = require('./_lib');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const N8N_NEW_PROVIDER_URL  = process.env.N8N_NEW_PROVIDER_WEBHOOK;
  const N8N_APPROVED_URL      = process.env.N8N_APPROVED_WEBHOOK;

  try {
    const body   = req.body || {};
    const record = body.record || {};
    const type   = body.type;   // INSERT or UPDATE

    // Route to the right n8n workflow
    let targetUrl = null;

    if (type === 'INSERT') {
      targetUrl = N8N_NEW_PROVIDER_URL;
    } else if (type === 'UPDATE' && record.is_approved === true) {
      targetUrl = N8N_APPROVED_URL;
    }

    if (!targetUrl) {
      return ok(res, { skipped: true });
    }

    const resp = await fetch(targetUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        event:  type,
        record,
        old_record: body.old_record || {},
        timestamp:  new Date().toISOString(),
      }),
    });

    return ok(res, { forwarded: true, status: resp.status });

  } catch (e) {
    console.error('[n8n-webhook]', e.message);
    return err(res, 'Relay error', 500);
  }
};
