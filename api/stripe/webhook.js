// ============================================================
// POST /api/stripe/webhook
// Handles Stripe webhook events:
//   checkout.session.completed   → activate subscription
//   customer.subscription.updated → sync plan changes
//   customer.subscription.deleted → downgrade to free
//   invoice.payment_failed        → notify provider
// ============================================================

const Stripe                              = require('stripe');
const { getSupabase, getResend, handleCors, err, emails } = require('../_lib');

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  ()    => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Map Stripe price IDs back to plan names
function planFromPriceId(priceId) {
  const map = {
    [process.env.STRIPE_PRICE_GROWTH_MONTHLY]:  'growth',
    [process.env.STRIPE_PRICE_GROWTH_YEARLY]:   'growth',
    [process.env.STRIPE_PRICE_PRO_MONTHLY]:     'pro',
    [process.env.STRIPE_PRICE_PRO_YEARLY]:      'pro',
    [process.env.STRIPE_PRICE_AGENCY_MONTHLY]:  'agency',
    [process.env.STRIPE_PRICE_AGENCY_YEARLY]:   'agency',
  };
  return map[priceId] || 'free';
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = getSupabase();
  const resend   = getResend();

  const rawBody  = await getRawBody(req);
  const sig      = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('Webhook signature verification failed:', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  // ---- Idempotency: skip already-processed events ----
  const { data: existing } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .single();

  if (existing) {
    return res.status(200).json({ received: true, status: 'already_processed' });
  }

  // ---- Log event ----
  await supabase.from('stripe_events').insert({
    id:          event.id,
    type:        event.type,
    payload:     event.data.object,
    processed_at: new Date().toISOString(),
  }).catch(e => console.error('Event log error:', e));

  // ---- Handle event types ----
  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session     = event.data.object;
        const providerId  = session.metadata?.provider_id;
        const plan        = session.metadata?.plan;
        const subId       = session.subscription;

        if (!providerId || !plan) break;

        // Fetch subscription to get current_period_end
        const sub = await stripe.subscriptions.retrieve(subId);
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        const priceId   = sub.items.data[0]?.price?.id;

        await supabase
          .from('providers')
          .update({
            plan,
            plan_expires_at:       periodEnd,
            stripe_subscription_id: subId,
            stripe_price_id:        priceId,
            is_verified:            ['growth','pro','agency'].includes(plan),
            is_featured:            ['pro','agency'].includes(plan),
          })
          .eq('id', providerId);

        console.log(`✅ Plan activated: provider=${providerId} plan=${plan}`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub        = event.data.object;
        const customerId = sub.customer;
        const status     = sub.status; // active, past_due, canceled, etc.
        const priceId    = sub.items.data[0]?.price?.id;
        const plan       = planFromPriceId(priceId);
        const periodEnd  = new Date(sub.current_period_end * 1000).toISOString();

        const { data: provider } = await supabase
          .from('providers')
          .select('id, plan')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!provider) break;

        if (status === 'active') {
          await supabase
            .from('providers')
            .update({
              plan,
              plan_expires_at:  periodEnd,
              stripe_price_id:  priceId,
              is_verified:      ['growth','pro','agency'].includes(plan),
              is_featured:      ['pro','agency'].includes(plan),
            })
            .eq('id', provider.id);
        } else if (['past_due', 'unpaid'].includes(status)) {
          // Keep plan active but flag for follow-up
          console.warn(`Payment issue for provider ${provider.id}: ${status}`);
        }

        console.log(`🔄 Subscription updated: provider=${provider.id} plan=${plan} status=${status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub        = event.data.object;
        const customerId = sub.customer;

        const { data: provider } = await supabase
          .from('providers')
          .select('id, business_name, contact_email')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!provider) break;

        // Downgrade to free
        await supabase
          .from('providers')
          .update({
            plan:                  'free',
            plan_expires_at:       null,
            stripe_subscription_id: null,
            stripe_price_id:       null,
            is_featured:           false,
            is_verified:           false,
          })
          .eq('id', provider.id);

        // Email provider about cancellation
        if (provider.contact_email) {
          const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@automationhire.co.uk';
          resend.emails.send({
            from:    fromEmail,
            to:      provider.contact_email,
            subject: 'Your AutomationHire subscription has ended',
            html: `<p>Hi ${provider.business_name},</p><p>Your subscription has ended and your listing has been moved to the Free plan. You can reactivate anytime at <a href="${process.env.NEXT_PUBLIC_SITE_URL}/pricing.html">automationhire.co.uk/pricing</a>.</p>`,
          }).catch(() => {});
        }

        console.log(`❌ Subscription cancelled: provider=${provider.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice    = event.data.object;
        const customerId = invoice.customer;

        const { data: provider } = await supabase
          .from('providers')
          .select('id, business_name, contact_email')
          .eq('stripe_customer_id', customerId)
          .single();

        if (provider?.contact_email) {
          const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@automationhire.co.uk';
          resend.emails.send({
            from:    fromEmail,
            to:      provider.contact_email,
            subject: '⚠️ Payment failed — AutomationHire subscription',
            html: `<p>Hi ${provider.business_name},</p><p>We were unable to process your subscription payment. Please update your payment method to keep your listing active: <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard.html">Update Payment</a></p>`,
          }).catch(() => {});
        }

        console.log(`⚠️ Payment failed for customer: ${customerId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (handlerErr) {
    console.error(`Error handling event ${event.type}:`, handlerErr);
    // Still return 200 so Stripe doesn't retry
  }

  return res.status(200).json({ received: true });
};
