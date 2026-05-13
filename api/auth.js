// /api/auth?action=login    POST { email, password }
// /api/auth?action=me       GET  Authorization: Bearer <token>
// /api/auth?action=refresh  POST { refresh_token }
// Reached via vercel.json rewrites so frontend URLs stay unchanged.

const { getSupabase, handleCors, ok, err } = require('./_lib');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const action = req.query.action;

  if (action === 'login') {
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);
    const { email, password } = req.body || {};
    if (!email || !password) return err(res, 'Email and password required', 400);

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return err(res, 'Invalid email or password', 401);

    const { data: provider } = await supabase
      .from('providers')
      .select('id, slug, business_name, plan, is_approved, is_verified, avatar_emoji')
      .eq('user_id', data.user.id)
      .single();

    return ok(res, {
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in:    data.session.expires_in,
      user:     { id: data.user.id, email: data.user.email },
      provider: provider || null,
    });
  }

  if (action === 'me') {
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
  }

  if (action === 'refresh') {
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);
    const { refresh_token } = req.body || {};
    if (!refresh_token) return err(res, 'Refresh token required', 400);

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error || !data.session) return err(res, 'Session expired — please log in again', 401);

    return ok(res, {
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in:    data.session.expires_in,
    });
  }

  return err(res, 'Unknown auth action', 404);
};
