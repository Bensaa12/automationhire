// ============================================================
// POST /api/newsletter
// Newsletter signup — saves to Supabase, sends welcome email
// ============================================================

const { getSupabase, getResend, handleCors, ok, err, emails, getSender } = require('./_lib');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const supabase = getSupabase();
  const resend   = getResend();

  const { email, source } = req.body;

  if (!email?.trim()) return err(res, 'Email is required');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return err(res, 'Invalid email address');

  const cleanEmail = email.trim().toLowerCase();

  // ---- Upsert (silently handle duplicates) ----
  const { error: upsertErr } = await supabase
    .from('newsletter_subscribers')
    .upsert(
      {
        email:       cleanEmail,
        is_active:   true,
        source:      source || 'website',
        unsubscribed_at: null,
      },
      { onConflict: 'email' }
    );

  if (upsertErr) {
    console.error('Newsletter upsert error:', upsertErr);
    return err(res, 'Subscription failed — please try again', 500);
  }

  // ---- Welcome email ----
  
  resend.emails.send({
    from: `AutomationHire <${getSender('system')}>`,
    to:   cleanEmail,
    ...emails.newsletterWelcome({ email: cleanEmail }),
  }).catch(e => console.error('Newsletter welcome email error:', e));

  return ok(res, { message: 'Subscribed! Your first issue lands Thursday.' });
};
