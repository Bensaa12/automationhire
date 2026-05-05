// ============================================================
// POST /api/get-matched
// "Get Matched" form — finds best-fit providers and sends the
// lead to up to 5 matching providers simultaneously.
// ============================================================

const { getSupabase, getResend, handleCors, ok, err, emails, getSender } = require('./_lib');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const supabase = getSupabase();
  const resend   = getResend();

  const {
    automation_type,
    description,
    budget,
    timeline,
    tools_mentioned,
    client_name,
    client_email,
    client_company,
  } = req.body;

  if (!client_name?.trim())  return err(res, 'Name is required');
  if (!client_email?.trim()) return err(res, 'Email is required');
  if (!description?.trim())  return err(res, 'Project description is required');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(client_email)) return err(res, 'Invalid email');

  // ---- Build category filter from automation_type ----
  const categoryMap = {
    'AI Agents / Assistants':           'ai-agents',
    'Workflow / Business Process':      'workflow-automation',
    'CRM Automation':                   'crm-automation',
    'Email / Marketing Automation':     'email-automation',
    'Chatbot Development':              'chatbot-automation',
    'Lead Generation Automation':       'lead-generation',
    'E-commerce Automation':            'ecommerce-automation',
    'Document Automation':              'document-automation',
    'API Integration':                  'workflow-automation',
  };
  const targetCategory = automation_type ? categoryMap[automation_type] : null;

  // ---- Query: find 5 best matching providers (paid plans, verified) ----
  let query = supabase
    .from('providers')
    .select('id, contact_email, business_name, plan, categories, rating_avg')
    .eq('is_active', true)
    .eq('is_approved', true)
    .in('plan', ['growth', 'pro', 'agency'])
    .order('is_featured', { ascending: false })
    .order('rating_avg',  { ascending: false })
    .limit(5);

  if (targetCategory) {
    query = query.contains('categories', [targetCategory]);
  }

  const { data: providers, error: queryErr } = await query;

  if (queryErr) {
    console.error('Provider query error:', queryErr);
    return err(res, 'Matching failed', 500);
  }

  // ---- If < 3 matches with category filter, relax filter ----
  let matchedProviders = providers || [];
  if (matchedProviders.length < 3) {
    const { data: fallback } = await supabase
      .from('providers')
      .select('id, contact_email, business_name, plan, categories, rating_avg')
      .eq('is_active', true)
      .eq('is_approved', true)
      .in('plan', ['growth', 'pro', 'agency'])
      .order('rating_avg', { ascending: false })
      .limit(5);

    matchedProviders = (fallback || []).filter(
      p => !matchedProviders.find(m => m.id === p.id)
    ).slice(0, 5 - matchedProviders.length);

    matchedProviders = [...(providers || []), ...matchedProviders];
  }

  // ---- Insert one lead per matched provider ----
  const leadPayload = matchedProviders.map(p => ({
    provider_id:     p.id,
    is_matched_lead: true,
    automation_type: automation_type || null,
    description:     description.trim(),
    budget:          budget || null,
    timeline:        timeline || null,
    tools_mentioned: tools_mentioned?.trim() || null,
    client_name:     client_name.trim(),
    client_email:    client_email.trim().toLowerCase(),
    client_company:  client_company?.trim() || null,
    source_page:     'get-matched',
    ip_address:      req.headers['x-forwarded-for']?.split(',')[0] || null,
    status:          'new',
  }));

  if (leadPayload.length > 0) {
    await supabase.from('leads').insert(leadPayload)
      .catch(e => console.error('Lead batch insert error:', e));
  }

  

  // ---- Email each matched provider ----
  const providerEmails = matchedProviders
    .filter(p => p.contact_email)
    .map(p =>
      resend.emails.send({
        from: `AutomationHire <${getSender('expert')}>`,
        to:       p.contact_email,
        reply_to: client_email.trim().toLowerCase(),
        ...emails.leadNotification({
          providerName: p.business_name,
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
      }).catch(e => console.error(`Email to ${p.business_name} failed:`, e))
    );

  // ---- Confirmation to client ----
  const clientEmailPromise = resend.emails.send({
    from: `AutomationHire <${getSender('solutions')}>`,
    to:      client_email.trim().toLowerCase(),
    ...emails.matchedExperts({
      clientName: client_name.trim(),
      count:      matchedProviders.length,
    }),
  }).catch(e => console.error('Client match email error:', e));

  await Promise.allSettled([...providerEmails, clientEmailPromise]);

  return ok(res, {
    message:    `Matched with ${matchedProviders.length} expert${matchedProviders.length !== 1 ? 's' : ''}. Check your inbox for confirmation.`,
    match_count: matchedProviders.length,
  }, 201);
};
