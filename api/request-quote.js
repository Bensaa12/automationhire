// ============================================================
// POST /api/request-quote
// Handles direct quote requests to a specific provider.
// Saves lead to DB, emails provider + sends confirmation to client.
// ============================================================

const { getSupabase, getResend, handleCors, ok, err, emails, getSender } = require('./_lib');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const supabase = getSupabase();
  const resend   = getResend();

  const {
    provider_id,      // UUID of the provider being contacted (optional if matched)
    provider_slug,    // Slug of provider (used to look up if no id)
    automation_type,
    description,
    budget,
    timeline,
    tools_mentioned,
    client_name,
    client_email,
    client_company,
    client_phone,
    source_page,
  } = req.body;

  // ---- Validation ----
  if (!client_name?.trim())  return err(res, 'Your name is required');
  if (!client_email?.trim()) return err(res, 'Email address is required');
  if (!description?.trim())  return err(res, 'Project description is required');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(client_email)) return err(res, 'Invalid email address');

  // ---- Resolve provider ----
  let resolvedProviderId = provider_id || null;
  let providerEmail      = null;
  let providerName       = 'the provider';

  if (!resolvedProviderId && provider_slug) {
    const { data: p, error: pErr } = await supabase
      .from('providers')
      .select('id, contact_email, business_name, plan, is_active, is_approved')
      .eq('slug', provider_slug)
      .single();

    if (pErr || !p) return err(res, 'Provider not found', 404);
    if (!p.is_active || !p.is_approved) return err(res, 'Provider is not available', 410);

    resolvedProviderId = p.id;
    providerEmail      = p.contact_email;
    providerName       = p.business_name;
  } else if (resolvedProviderId) {
    const { data: p } = await supabase
      .from('providers')
      .select('contact_email, business_name, plan, is_active, is_approved')
      .eq('id', resolvedProviderId)
      .single();

    if (!p || !p.is_active || !p.is_approved) return err(res, 'Provider not available', 410);
    providerEmail = p.contact_email;
    providerName  = p.business_name;

    // ---- Check lead quota for free plan ----
    if (p.plan === 'free') {
      return err(res, 'This provider is on the free plan and cannot receive leads. Ask them to upgrade.', 402);
    }

    // ---- Monthly lead count check for paid plans ----
    const planLimits = { growth: 20, pro: Infinity, agency: Infinity };
    const limit = planLimits[p.plan];
    if (limit !== Infinity) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', resolvedProviderId)
        .gte('created_at', startOfMonth.toISOString());

      if ((count || 0) >= limit) {
        return err(res, 'This provider has reached their monthly lead limit. Try again next month or browse other experts.', 429);
      }
    }
  }

  // ---- Insert lead ----
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .insert({
      provider_id:     resolvedProviderId,
      automation_type: automation_type?.trim() || null,
      description:     description.trim(),
      budget:          budget || null,
      timeline:        timeline || null,
      tools_mentioned: tools_mentioned?.trim() || null,
      client_name:     client_name.trim(),
      client_email:    client_email.trim().toLowerCase(),
      client_company:  client_company?.trim() || null,
      client_phone:    client_phone?.trim() || null,
      source_page:     source_page || req.headers.referer || null,
      ip_address:      req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress,
      status:          'new',
    })
    .select('id')
    .single();

  if (leadErr) {
    console.error('Lead insert error:', leadErr);
    return err(res, 'Failed to submit request', 500);
  }

  // ---- Update provider lead count ----
  if (resolvedProviderId) {
    await supabase.rpc('increment_lead_count', { p_id: resolvedProviderId })
      .catch(() => {}); // non-critical
  }

  

  // ---- Email provider ----
  if (providerEmail) {
    resend.emails.send({
      from:     `AutomationHire <${getSender('expert')}>`,
      to:       providerEmail,
      reply_to: client_email.trim().toLowerCase(),
      ...emails.leadNotification({
        providerName,
        lead: {
          automation_type,
          description,
          budget,
          timeline,
          client_name:    client_name.trim(),
          client_email:   client_email.trim().toLowerCase(),
          client_company: client_company?.trim(),
        }
      }),
    }).catch(e => console.error('Provider email error:', e));
  }

  // ---- Confirmation email to client ----
  resend.emails.send({
    from:    `AutomationHire <${getSender('solutions')}>`,
    to:      client_email.trim().toLowerCase(),
    ...emails.leadConfirmation({ clientName: client_name.trim(), providerName }),
  }).catch(e => console.error('Client email error:', e));

  return ok(res, {
    message: `Quote request sent to ${providerName}. Expect a reply within 4 hours.`,
    lead_id: lead.id,
  }, 201);
};
