// ============================================================
// Purchase confirmation email for paid downloads (api/_packs.js): the licence key and a link back
// to the purchase page, which re-checks the payment and gives a fresh download link.
//
// Sent from two places so it arrives even if one fails: the Stripe webhook
// (checkout.session.completed) and the download page's first visit (action=garage-download).
// A flag in the Checkout Session's metadata (purchase_email) stops it being sent twice.
// ============================================================

const { getResend, getSender } = require('./_lib');
const { licenseKeyForSession } = require('./_license');

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://automationhire.co.uk';

// Names buyers see. Keys match api/_packs.js.
const TITLES = {
  'plant-3d-cable-tray': 'Cable Tray Catalog for AutoCAD Plant 3D',
  hirecast: 'HireCast', 'hirecast-pro': 'HireCast Pro',
  hiresign: 'HireSign', 'hiresign-pro': 'HireSign Pro',
  hireconvert: 'HireConvert', 'hireconvert-pro': 'HireConvert Pro',
  hirepdf: 'HirePDF', 'hirepdf-pro': 'HirePDF Pro',
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function money(amount, currency) {
  if (amount == null) return '';
  const symbol = { gbp: '£', usd: '$', eur: '€' }[String(currency || '').toLowerCase()] || '';
  return symbol + (amount / 100).toFixed(2);
}

/** The email for one purchase: { subject, html, text }. Exported for tests. */
function buildPurchaseEmail({ pack, config, session, licenseKey }) {
  const title = TITLES[pack] || 'your download';
  const isApp = !!config.licensePrefix;
  const link = `${SITE}${config.returnPath}?session_id=${encodeURIComponent(session.id)}`;
  const name = (session.customer_details?.name || '').split(' ')[0];
  const paid = money(session.amount_total, session.currency);
  const fileName = String(config.storagePath || '').split('/').pop();
  const phoneLink = config.webApp ? SITE + config.webApp : '';

  const subject = isApp ? `Your ${title} licence key and download` : `Your ${title} download`;
  const steps = isApp
    ? [
        `Open the download link on your <b>Windows 10 or 11 PC</b> and download ${esc(fileName)}.`,
        `Run it. If Windows shows "Windows protected your PC", click <b>More info &rarr; Run anyway</b> (new apps from small publishers show this until they build up a reputation).`,
        `When ${esc(title.replace(/ Pro$/, ''))} asks for it, paste your licence key. It works offline and never expires.`,
      ]
    : [`Open the download link on the computer you use AutoCAD Plant 3D on and download ${esc(fileName)}.`, 'Unzip it and run the installer inside.'];

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#1b1f27">
<div style="max-width:560px;margin:0 auto;padding:28px 18px">
  <div style="font-weight:700;font-size:18px;color:#0b8f4d;margin-bottom:16px">AutomationHire &middot; Pound Appstore</div>
  <div style="background:#fff;border:1px solid #dde1e8;border-radius:12px;padding:26px">
    <h1 style="font-size:22px;margin:0 0 10px">Thank you${name ? ', ' + esc(name) : ''}!</h1>
    <p style="margin:0 0 16px;line-height:1.55">Your purchase of <b>${esc(title)}</b>${paid ? ' (' + esc(paid) + ')' : ''} is confirmed. Keep this email: it has everything you need to install ${isApp ? 'and activate ' : ''}it, now or later.</p>
    ${isApp ? `<p style="margin:0 0 6px;font-weight:700">Your licence key</p>
    <div style="font-family:Consolas,Menlo,monospace;font-size:13px;word-break:break-all;background:#f4f6fa;border:1px solid #dde1e8;border-radius:8px;padding:12px;margin:0 0 18px">${esc(licenseKey)}</div>` : ''}
    <p style="margin:0 0 22px"><a href="${esc(link)}" style="display:inline-block;background:#00c853;color:#04150b;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px">Download ${esc(title)}</a></p>
    <p style="margin:0 0 6px;font-weight:700">How to install</p>
    <ol style="margin:0 0 18px;padding-left:20px;line-height:1.6">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>
    ${phoneLink ? `<p style="margin:0 0 6px;font-weight:700">On iPhone, iPad or Android</p>
    <p style="margin:0 0 18px;line-height:1.55">Open <a href="${esc(phoneLink)}" style="color:#0b8f4d">${esc(phoneLink.replace(/^https?:\/\//, ''))}</a> on your phone. iPhone: tap <b>Share &rarr; Add to Home Screen</b>. Android: tap <b>Install app</b>. Then tap the &#9432; button and paste the same licence key.</p>` : ''}
    <p style="margin:0;color:#5b6472;font-size:13px;line-height:1.55">The download button always takes you back to your purchase page, which makes a fresh download link each time${isApp ? ' and shows your key again' : ''}. Not working as described? Reply to this email within 30 days for a full refund.</p>
  </div>
  <p style="color:#8a93a3;font-size:12px;margin:14px 4px 0">AutomationHire.co.uk &middot; Order ${esc(session.id.slice(-10))}</p>
</div></body></html>`;

  const text = [
    `Thank you${name ? ', ' + name : ''}!`,
    `Your purchase of ${title}${paid ? ' (' + paid + ')' : ''} is confirmed.`,
    isApp ? `\nYour licence key:\n${licenseKey}\n` : '',
    `Download: ${link}`,
    '',
    'How to install:',
    ...steps.map((s, i) => `${i + 1}. ${s.replace(/<[^>]+>/g, '').replace(/&rarr;/g, '->').replace(/&amp;/g, '&')}`),
    phoneLink ? `
On iPhone, iPad or Android: open ${phoneLink} on your phone. iPhone: Share -> Add to Home Screen. Android: Install app. Then paste the same licence key.` : '',
    '',
    'Not working as described? Reply to this email within 30 days for a full refund.',
  ].filter((l) => l !== '').join('\n');

  return { subject, html, text };
}

/**
 * Sends the confirmation email for a paid session at most once. `session` may be a webhook
 * snapshot; the latest copy is fetched so a flag set by the other path is seen.
 * Returns 'sent' | 'already' | 'skipped:<reason>'. Never throws (purchases must not fail on email).
 */
async function sendPurchaseEmail(stripe, packs, sessionOrId) {
  try {
    const id = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId.id;
    const session = await stripe.checkout.sessions.retrieve(id);
    const pack = session.metadata?.pack;
    const config = packs[pack];
    if (!config) return 'skipped:not-a-pack';
    if (session.payment_status !== 'paid') return 'skipped:unpaid';
    const to = session.customer_details?.email;
    if (!to) return 'skipped:no-email';
    if (session.metadata?.purchase_email) return 'already';

    // Claim the email first, so the webhook and the download page don't both send it.
    await stripe.checkout.sessions.update(id, { metadata: { ...session.metadata, purchase_email: 'sending' } });

    let licenseKey = null;
    if (config.licensePrefix) licenseKey = licenseKeyForSession(config.licensePrefix, config.licenseKeyEnv, session, config.edition);
    const { subject, html, text } = buildPurchaseEmail({ pack, config, session, licenseKey });
    try {
      // Resend v4 reports failures in the result rather than throwing.
      const result = await getResend().emails.send({
        from: `AutomationHire <${getSender('system')}>`,
        to,
        reply_to: process.env.RESEND_REPLY_TO || 'hello@automationhire.co.uk',
        subject, html, text,
      });
      if (result && result.error) throw new Error('Resend: ' + (result.error.message || JSON.stringify(result.error)));
    } catch (e) {
      // Release the claim so the next attempt (webhook retry or page visit) can try again.
      await stripe.checkout.sessions.update(id, { metadata: { ...session.metadata, purchase_email: '' } }).catch(() => {});
      throw e;
    }
    await stripe.checkout.sessions.update(id, { metadata: { ...session.metadata, purchase_email: new Date().toISOString() } });
    console.log(`[purchase-email] sent ${pack} to ${to.replace(/(.).*@/, '$1***@')}`);
    return 'sent';
  } catch (e) {
    console.error('[purchase-email] failed:', e.message);
    return 'skipped:error';
  }
}

module.exports = { sendPurchaseEmail, buildPurchaseEmail, TITLES };
