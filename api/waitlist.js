// ============================================================
// POST /api/waitlist
// PartForge early-access waitlist signup
// Notifies hello@automationhire.co.uk + sends confirmation to subscriber
// ============================================================

const { getResend, handleCors, ok, err, getSender } = require('./_lib');

const NOTIFY_TO = 'hello@automationhire.co.uk';

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const resend = getResend();

  const { email } = req.body || {};

  if (!email?.trim()) return err(res, 'Email is required');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) return err(res, 'Invalid email address');

  const cleanEmail = email.trim().toLowerCase();

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
