// POST /api/auth/refresh  { refresh_token }
// Returns new access_token + refresh_token

const { getSupabase, handleCors, ok, err } = require('../_lib');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
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
};
