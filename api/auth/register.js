// ============================================================
// POST /api/auth/register
// Lightweight auth endpoint (Supabase Auth handles the heavy lifting)
// This validates + returns the session token for the frontend
// ============================================================

const { getSupabase, handleCors, ok, err } = require('../_lib');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const supabase = getSupabase();
  const { email, password } = req.body;

  if (!email || !password) return err(res, 'Email and password required');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message?.includes('Invalid login credentials')) {
      return err(res, 'Invalid email or password', 401);
    }
    return err(res, error.message, 400);
  }

  // Fetch provider profile
  const { data: provider } = await supabase
    .from('providers')
    .select('id, slug, business_name, plan, is_approved, is_verified')
    .eq('user_id', data.user.id)
    .single();

  return ok(res, {
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in:    data.session.expires_in,
    user: {
      id:    data.user.id,
      email: data.user.email,
    },
    provider: provider || null,
  });
};
