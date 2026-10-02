// ============================================================
// Jarvis Academy billing (Stripe). Not a function itself: called from
//   api/stripe/create-checkout.js  (body.product === 'academy')
//   api/stripe/webhook.js          (events whose metadata.product === 'academy')
// Prices live here (Stripe price_data), so no price IDs or env vars are needed
// beyond the existing STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET.
// Paid checkout is OFF until ACADEMY_PAYMENTS_LIVE=1 is set on Vercel.
// ============================================================

const { ok, err } = require('./_lib');

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://automationhire.co.uk';

// Plus is for students; Family is bought by a parent account and covers the children linked to it.
const PLANS = {
  plus:   { role: 'student', name: 'Jarvis Plus',   amount: { monthly: 599, yearly: 4900 } },
  family: { role: 'parent',  name: 'Jarvis Family', amount: { monthly: 999, yearly: 8900 } },
};

const paymentsLive = () => process.env.ACADEMY_PAYMENTS_LIVE === '1';

async function userFromReq(req, supabase) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  const { data: { user } = {}, error } = await supabase.auth.getUser(h.slice(7));
  return error || !user ? null : user;
}

const periodEnd = sub => {
  const t = sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end);
  return t ? new Date(t * 1000).toISOString() : null;
};

async function getOrCreateCustomer(stripe, supabase, user, profile) {
  if (profile.stripe_customer_id) return profile.stripe_customer_id;
  const c = await stripe.customers.create({ email: user.email, name: profile.display_name, metadata: { product: 'academy', user_id: user.id } });
  await supabase.from('academy_profiles').update({ stripe_customer_id: c.id }).eq('user_id', user.id);
  return c.id;
}

// POST /api/stripe/create-checkout  { product:'academy', plan:'plus'|'family', billing:'monthly'|'yearly' }
//                                   { product:'academy', action:'portal' }
async function handle(req, res, { stripe, supabase, body }) {
  if (!paymentsLive()) return err(res, 'Paid plans are not available yet. Jarvis Academy is free during early access.', 503);

  const user = await userFromReq(req, supabase);
  if (!user) return err(res, 'Please sign in to Jarvis Academy first.', 401);
  const { data: profile } = await supabase.from('academy_profiles')
    .select('display_name, role, plan, plan_expires_at, stripe_customer_id').eq('user_id', user.id).maybeSingle();
  if (!profile) return err(res, 'No Jarvis Academy account for this user', 404);

  try {
    // ---- Manage / cancel via Stripe's customer portal ----
    if (body.action === 'portal') {
      if (!profile.stripe_customer_id) return err(res, 'You do not have a paid plan yet.', 400);
      const portal = await stripe.billingPortal.sessions.create({ customer: profile.stripe_customer_id, return_url: `${SITE()}/jarvis-academy` });
      return ok(res, { url: portal.url });
    }

    // ---- New subscription ----
    const plan = PLANS[body.plan];
    const billing = body.billing === 'yearly' ? 'yearly' : 'monthly';
    if (!plan) return err(res, 'Unknown plan');
    if (profile.role !== plan.role) {
      return err(res, plan.role === 'parent' ? 'Family plans are bought from a parent account. Create a parent account first.' : 'Plus is for student accounts. Parents can choose the Family plan.', 403);
    }
    if (['plus', 'family'].includes(profile.plan) && (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date())) {
      return err(res, 'You already have a paid plan. Use "Manage plan" to change or cancel it.', 409);
    }

    const customer = await getOrCreateCustomer(stripe, supabase, user, profile);
    const meta = { product: 'academy', user_id: user.id, academy_plan: body.plan, billing };
    const session = await stripe.checkout.sessions.create({
      customer,
      mode: 'subscription',
      payment_method_types: ['card'],
      client_reference_id: user.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'gbp',
          unit_amount: plan.amount[billing],
          recurring: { interval: billing === 'yearly' ? 'year' : 'month' },
          product_data: { name: plan.name, description: 'Jarvis Academy, your AI learning companion' },
        },
      }],
      subscription_data: { metadata: meta },
      metadata: meta,
      custom_text: { submit: { message: 'Renews automatically until you cancel; you can cancel any time from Jarvis Academy. By subscribing you agree to our Terms (automationhire.co.uk/terms#academy), including your 14-day cancellation rights.' } },
      success_url: `${SITE()}/jarvis-academy?subscribed=1`,
      cancel_url: `${SITE()}/jarvis-academy?cancelled=1#pricing`,
      allow_promotion_codes: true,
    });
    return ok(res, { checkout_url: session.url, session_id: session.id });
  } catch (e) {
    console.error('[academy-billing]', e.message);
    return err(res, 'Could not start checkout. Please try again.', 502);
  }
}

// Webhook events for Academy subscriptions. Returns true if the event was an Academy one.
async function handleEvent(event, { stripe, supabase }) {
  const obj = event.data.object;

  if (event.type === 'checkout.session.completed' && obj.metadata && obj.metadata.product === 'academy') {
    if (!obj.subscription) return true;
    const sub = await stripe.subscriptions.retrieve(obj.subscription);
    await applySubscription(supabase, obj.metadata.user_id, obj.metadata.academy_plan, sub);
    return true;
  }

  if ((event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted')
      && obj.metadata && obj.metadata.product === 'academy') {
    await applySubscription(supabase, obj.metadata.user_id, obj.metadata.academy_plan, obj, event.type === 'customer.subscription.deleted');
    return true;
  }

  if (event.type === 'invoice.payment_failed') {
    const { data: p } = await supabase.from('academy_profiles').select('user_id').eq('stripe_customer_id', obj.customer).maybeSingle();
    if (p) { console.warn('[academy-billing] payment failed for', p.user_id); return true; }
  }
  return false;
}

async function applySubscription(supabase, userId, plan, sub, deleted) {
  if (!userId || !PLANS[plan]) return;
  const active = !deleted && ['active', 'trialing'].includes(sub.status);
  if (!active && !deleted && ['past_due', 'incomplete'].includes(sub.status)) return;   // keep current plan while Stripe retries
  await supabase.from('academy_profiles').update(active
    ? { plan, plan_expires_at: periodEnd(sub), stripe_subscription_id: sub.id }
    : { plan: 'free', plan_expires_at: null, stripe_subscription_id: null }).eq('user_id', userId);
  console.log(`[academy-billing] ${userId} -> ${active ? plan : 'free'} (${sub.status})`);
}

module.exports = { handle, handleEvent, paymentsLive };
