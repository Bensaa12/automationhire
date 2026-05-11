// POST /api/auth/login  { email, password }
// Returns session tokens + provider profile

const { getSupabase, handleCors, ok, err } = require('../_lib');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const { email, password } = req.body || {};
  if (!email || !password) return err(res, 'Email and password required', 400);

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const status = error.message?.includes('Invalid login credentials') ? 401 : 400;
    return err(res, 'Invalid email or password', status);
  }

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
};
