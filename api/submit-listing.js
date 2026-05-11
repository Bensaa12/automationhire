// ============================================================
// POST /api/submit-listing
// Creates a new provider listing + Supabase Auth account
// Sends welcome email via Resend
// ============================================================

const { getSupabase, getResend, handleCors, ok, err, toSlug, emails, getSender } = require('./_lib');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const supabase = getSupabase();
  const resend   = getResend();

  const {
    // Account
    contact_name,
    email,
    password,
    // Business
    business_name,
    provider_type,
    description,
    website_url,
    linkedin_url,
    // Location
    location_city,
    location_country,
    remote_work,
    team_size,
    years_experience,
    // Pricing
    hourly_rate,
    min_project_budget,
    // Skills
    categories,
    tools,
    industries,
  } = req.body;

  // ---- Validation ----
  if (!business_name?.trim()) return err(res, 'Business name is required');
  if (!email?.trim())         return err(res, 'Email is required');
  if (!password || password.length < 8) return err(res, 'Password must be at least 8 characters');
  if (!description?.trim())  return err(res, 'Description is required');
  if (!provider_type)        return err(res, 'Provider type is required');

  // ---- Check for duplicate email ----
  const { data: existing } = await supabase
    .from('providers')
    .select('id')
    .eq('contact_email', email.toLowerCase().trim())
    .single();

  if (existing) return err(res, 'An account with this email already exists', 409);

  // ---- Create Supabase Auth user ----
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email:    email.trim().toLowerCase(),
    password: password,
    email_confirm: true,
    user_metadata: {
      full_name:     contact_name || business_name,
      business_name: business_name,
    }
  });

  if (authError) {
    if (authError.message?.includes('already registered')) {
      return err(res, 'An account with this email already exists', 409);
    }
    console.error('Auth error:', authError);
    return err(res, 'Failed to create account', 500, authError.message);
  }

  const userId = authData.user.id;

  // ---- Parse hourly rate range ----
  let rateMin = null, rateMax = null;
  if (hourly_rate) {
    const rateMap = {
      'Under £25/hr':      [0, 25],
      '£25 – £50/hr':     [25, 50],
      '£50 – £75/hr':     [50, 75],
      '£75 – £100/hr':    [75, 100],
      '£100 – £150/hr':   [100, 150],
      '£150+/hr':         [150, null],
    };
    [rateMin, rateMax] = rateMap[hourly_rate] || [null, null];
  }

  // ---- Generate unique slug ----
  const baseSlug  = toSlug(business_name);
  const timestamp = Date.now().toString(36);
  const slug      = `${baseSlug}-${timestamp}`;

  // ---- Insert provider record ----
  const { data: provider, error: insertError } = await supabase
    .from('providers')
    .insert({
      user_id:           userId,
      business_name:     business_name.trim(),
      slug,
      provider_type,
      description:       description.trim(),
      website_url:       website_url?.trim() || null,
      linkedin_url:      linkedin_url?.trim() || null,
      contact_email:     email.trim().toLowerCase(),
      location_city:     location_city?.trim() || null,
      location_country:  location_country || 'United Kingdom',
      remote_work:       remote_work !== false,
      team_size:         team_size || null,
      years_experience:  years_experience || null,
      hourly_rate_min:   rateMin,
      hourly_rate_max:   rateMax,
      min_project_budget: min_project_budget || null,
      categories:        Array.isArray(categories) ? categories : [],
      tools:             Array.isArray(tools) ? tools : [],
      industries:        Array.isArray(industries) ? industries : [],
      plan:              'free',
      is_approved:       false,
      submitted_at:      new Date().toISOString(),
    })
    .select('id, slug, business_name')
    .single();

  if (insertError) {
    console.error('Insert error:', insertError);
    // Roll back auth user if provider insert fails
    await supabase.auth.admin.deleteUser(userId);
    return err(res, 'Failed to create listing', 500, insertError.message);
  }

  // ---- Auto-login: sign in right after registration ----
  let session = null;
  const { data: signIn } = await supabase.auth.signInWithPassword({
    email:    email.trim().toLowerCase(),
    password: password,
  });
  if (signIn?.session) session = signIn.session;

  // ---- Send emails (fire and forget) ----
  Promise.all([
    resend.emails.send({
      from:     `AutomationHire <${getSender('confirmation')}>`,
      reply_to: getSender('expert'),
      to:       email.trim().toLowerCase(),
      ...emails.listingSubmitted({ name: contact_name || business_name }),
    }),
    resend.emails.send({
      from:  `AutomationHire <${getSender('system')}>`,
      to:    process.env.ADMIN_EMAIL || 'admin@automationhire.co.uk',
      ...emails.adminNewListing({ name: business_name, email, type: provider_type }),
    }),
  ]).catch(e => console.error('Email send error:', e));

  return ok(res, {
    message:       'Listing submitted successfully. Under review within 24 hours.',
    provider:      { id: provider.id, slug: provider.slug, business_name: provider.business_name, plan: 'free' },
    access_token:  session?.access_token  || null,
    refresh_token: session?.refresh_token || null,
    expires_in:    session?.expires_in    || null,
  }, 201);
};
