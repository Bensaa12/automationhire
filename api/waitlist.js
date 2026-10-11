// ============================================================
// POST /api/waitlist
// Early-access / enquiry signups:
//   - PartForge waitlist (default, { email })
//   - DebateLens early access ({ product: 'debatelens', email, name, organisation, use, message, website })
// Notifies hello@automationhire.co.uk + sends confirmation to subscriber
// ============================================================

const { getResend, getBody, handleCors, ok, err, getSender } = require('./_lib');

const NOTIFY_TO = 'hello@automationhire.co.uk';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => String(s ?? '').trim().slice(0, n);

const DEBATELENS_USES = {
  newsroom: 'Newsroom / broadcaster',
  education: 'School, university or debate club',
  creator: 'YouTube / podcast creator',
  campaign: 'Campaign, NGO or research',
  other: 'Other',
};

async function debatelensEnquiry(res, resend, body, cleanEmail) {
  // Honeypot: bots fill the hidden "website" field; pretend success.
  if (body.website) return ok(res, { message: "Thanks, we'll be in touch." });

  const name = clip(body.name, 120);
  const organisation = clip(body.organisation, 160);
  const use = DEBATELENS_USES[body.use] ? body.use : 'other';
  const message = clip(body.message, 2000);
  if (!name) return err(res, 'Please tell us your name');

  const row = (label, value) => value
    ? `<tr><td style="padding:6px 12px 6px 0;color:#9a8f7f;font-size:12px;text-transform:uppercase;letter-spacing:.06em;vertical-align:top">${label}</td><td style="padding:6px 0;color:#f5efe4;font-size:15px">${value}</td></tr>`
    : '';

  await resend.emails.send({
    from: `DebateLens <${getSender('system')}>`,
    to: NOTIFY_TO,
    replyTo: cleanEmail,
    subject: `DebateLens enquiry: ${name}${organisation ? ` (${organisation})` : ''}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#16110c;color:#f5efe4;border-radius:12px">
        <h2 style="margin:0 0 16px;font-size:20px;color:#f6b737">New DebateLens early-access enquiry</h2>
        <table style="border-collapse:collapse;margin-bottom:20px">
          ${row('Name', esc(name))}
          ${row('Email', `<a href="mailto:${esc(cleanEmail)}" style="color:#f6b737">${esc(cleanEmail)}</a>`)}
          ${row('Organisation', esc(organisation))}
          ${row('Use', esc(DEBATELENS_USES[use]))}
          ${row('Message', esc(message).replace(/\n/g, '<br>'))}
        </table>
        <p style="margin:0;font-size:12px;color:#6b6155">Reply to this email to answer them directly. Sent from automationhire.co.uk/debatelens, ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</p>
      </div>
    `,
  });

  resend.emails.send({
    from: `DebateLens <${getSender('system')}>`,
    to: cleanEmail,
    replyTo: NOTIFY_TO,
    subject: 'Thanks for your interest in DebateLens',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#16110c;color:#f5efe4;border-radius:12px">
        <h2 style="margin:0 0 12px;font-size:22px;color:#fff">Thanks, ${esc(name)}.</h2>
        <p style="margin:0 0 16px;color:#c9bfae;font-size:15px;line-height:1.6">
          We've received your request for early access to DebateLens. We're onboarding a small number of
          early users personally, so we'll get back to you within two working days to arrange a demo
          on a debate of your choice.
        </p>
        <p style="margin:0 0 24px;color:#c9bfae;font-size:15px;line-height:1.6">
          If you have something specific in mind, just reply to this email.
        </p>
        <p style="margin:0;font-size:11px;color:#6b6155">DebateLens by AutomationHire · automationhire.co.uk/debatelens</p>
      </div>
    `,
  }).catch(e => console.error('DebateLens confirmation email error:', e));

  return ok(res, { message: "Thanks, we'll be in touch within two working days." });
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const resend = getResend();
  const body = await getBody(req);
  const { email } = body;

  if (!email?.trim()) return err(res, 'Email is required');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) return err(res, 'Invalid email address');

  const cleanEmail = email.trim().toLowerCase();

  if (body.product === 'debatelens') return debatelensEnquiry(res, resend, body, cleanEmail);

  // ---- Notify the team ----
  await resend.emails.send({
    from: `PartForge <${getSender('system')}>`,
    to:   NOTIFY_TO,
    subject: `New PartForge waitlist signup — ${cleanEmail}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d1117;color:#e6edf3;border-radius:12px">
        <div style="font-size:28px;margin-bottom:8px">⚡</div>
        <h2 style="margin:0 0 16px;font-size:20px;color:#fff">New PartForge Waitlist Signup</h2>
        <p style="margin:0 0 24px;color:#8b949e;font-size:15px;line-height:1.6">
          Someone just joined the PartForge early-access waitlist.
        </p>
        <div style="background:#161b27;border:1px solid #30363d;border-radius:8px;padding:16px 20px;margin-bottom:24px">
          <div style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Email</div>
          <div style="font-size:17px;font-weight:600;color:#00e676">${cleanEmail}</div>
        </div>
        <p style="margin:0;font-size:12px;color:#484f58">
          Submitted via automationhire.co.uk/forge — ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}
        </p>
      </div>
    `,
  });

  // ---- Confirmation to subscriber ----
  resend.emails.send({
    from: `PartForge <${getSender('system')}>`,
    to:   cleanEmail,
    subject: "You're on the PartForge waitlist ⚡",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d1117;color:#e6edf3;border-radius:12px">
        <div style="font-size:32px;margin-bottom:12px">⚡</div>
        <h2 style="margin:0 0 12px;font-size:22px;color:#fff">You're on the list.</h2>
        <p style="margin:0 0 20px;color:#8b949e;font-size:15px;line-height:1.6">
          Thanks for joining the PartForge early-access waitlist. When we launch you'll be first to know — and you'll get 3 free STEP file generations on day one.
        </p>
        <div style="background:#161b27;border:1px solid #1a3a2a;border-radius:8px;padding:16px 20px;margin-bottom:28px">
          <div style="font-size:13px;color:#00e676;font-weight:700;margin-bottom:6px">What you get on launch day</div>
          <ul style="margin:0;padding-left:18px;color:#8b949e;font-size:14px;line-height:2">
            <li>3 free STEP file generations</li>
            <li>Early-access pricing lock-in</li>
            <li>Your early-access link — no queue</li>
          </ul>
        </div>
        <p style="margin:0 0 24px;font-size:14px;color:#8b949e;line-height:1.6">
          Questions? Reply to this email or reach us at
          <a href="mailto:experts@automationhire.co.uk" style="color:#00e676">experts@automationhire.co.uk</a>
        </p>
        <p style="margin:0;font-size:11px;color:#484f58">
          AutomationHire · automationhire.co.uk · You signed up at forge page
        </p>
      </div>
    `,
  }).catch(e => console.error('Waitlist confirmation email error:', e));

  return ok(res, { message: "You're on the list! Check your inbox for confirmation." });
};
