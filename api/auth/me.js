// GET /api/auth/me
// Header: Authorization: Bearer <token>
// Returns current user + provider profile

const { getSupabase, handleCors, ok, err } = require('../_lib');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return err(res, 'Unauthorized', 401);
  const token = auth.slice(7);

  const supabase = getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return err(res, 'Invalid or expired token', 401);

  const { data: provider } = await supabase
    .from('providers')
    .select('id, slug, business_name, plan, is_approved, is_verified, avatar_emoji, contact_email, profile_views, lead_count, rating_avg, review_count, plan_expires_at, location_city')
    .eq('user_id', user.id)
    .single();

  return ok(res, {
    user:     { id: user.id, email: user.email },
    provider: provider || null,
  });
};
