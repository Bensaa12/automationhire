// GET /api/dashboard
// Header: Authorization: Bearer <token>
// Returns provider profile + recent leads + stats

const { getSupabase, handleCors, ok, err } = require('./_lib');

const PLAN_LIMITS = { free: 0, growth: 20, pro: Infinity, agency: Infinity };

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return err(res, 'Unauthorized', 401);
  const token = auth.slice(7);

  const supabase = getSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return err(res, 'Invalid or expired token', 401);

  // Provider profile
  const { data: provider, error: provErr } = await supabase
    .from('providers')
    .select('id, slug, business_name, plan, is_approved, is_verified, avatar_emoji, contact_email, profile_views, lead_count, rating_avg, review_count, plan_expires_at, location_city, categories')
    .eq('user_id', user.id)
    .single();

  if (provErr || !provider) return err(res, 'Provider profile not found', 404);

  // Recent leads (last 10)
  const { data: leads } = await supabase
    .from('leads')
    .select('id, client_name, client_company, description, budget, automation_type, status, created_at, is_matched_lead')
    .eq('provider_id', provider.id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Leads this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: leadsThisMonth } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('provider_id', provider.id)
    .gte('created_at', monthStart.toISOString());

  const planLimit = PLAN_LIMITS[provider.plan] ?? 0;

  return ok(res, {
    provider,
    leads:            leads || [],
    leads_this_month: leadsThisMonth || 0,
    plan_limit:       planLimit === Infinity ? null : planLimit,
    user:             { id: user.id, email: user.email },
  });
};
