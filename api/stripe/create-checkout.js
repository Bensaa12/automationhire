// ============================================================
// POST /api/stripe/create-checkout
// Creates a Stripe Checkout Session for plan upgrade.
// Body: { plan, billing, provider_id, success_url, cancel_url }
// ============================================================

const Stripe                              = require('stripe');
const { getSupabase, handleCors, ok, err } = require('../_lib');

const PRICE_MAP = {
  growth: {
    monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_GROWTH_YEARLY,
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_PRO_YEARLY,
  },
  agency: {
    monthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_AGENCY_YEARLY,
  },
};

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = getSupabase();

  const {
    plan        = 'growth',
    billing     = 'monthly',  // 'monthly' | 'yearly'
    provider_id,
    success_url,
    cancel_url,
  } = req.body;

  if (!provider_id)           return err(res, 'provider_id is required');
  if (!PRICE_MAP[plan])       return err(res, `Invalid plan: ${plan}`);
  if (!['monthly','yearly'].includes(billing)) return err(res, 'billing must be monthly or yearly');

  const priceId = PRICE_MAP[plan][billing];
  if (!priceId) return err(res, `Stripe price not configured for ${plan}/${billing}. Check your env vars.`, 500);

  // ---- Fetch provider to get/create Stripe customer ----
  const { data: provider, error: pErr } = await supabase
    .from('providers')
    .select('id, business_name, contact_email, stripe_customer_id')
    .eq('id', provider_id)
    .single();

  if (pErr || !provider) return err(res, 'Provider not found', 404);

  // ---- Get or create Stripe customer ----
  let customerId = provider.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    provider.contact_email,
      name:     provider.business_name,
      metadata: { provider_id, supabase_provider_id: provider_id },
    });
    customerId = customer.id;

    await supabase
      .from('providers')
      .update({ stripe_customer_id: customerId })
      .eq('id', provider_id);
  }

  // ---- Create Checkout Session ----
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://automationhire.co.uk';

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    mode:                 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price:    priceId,
      quantity: 1,
    }],
    subscription_data: {
      metadata: {
        provider_id,
        plan,
        billing,
      },
    },
    success_url: success_url || `${siteUrl}/dashboard.html?upgraded=true&plan=${plan}`,
    cancel_url:  cancel_url  || `${siteUrl}/pricing.html?cancelled=true`,
    metadata: {
      provider_id,
      plan,
      billing,
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    tax_id_collection: { enabled: true },  // For UK VAT
  });

  return ok(res, {
    checkout_url: session.url,
    session_id:   session.id,
  });
};
