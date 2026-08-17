// ============================================================
// GET /api/providers
// Returns paginated, filtered provider listings for the directory.
// Query params: page, limit, category, tool, location, plan,
//               verified, rating_min, sort, search
// ============================================================

const { getSupabase, handleCors, ok, err } = require('./_lib');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

  const supabase = getSupabase();
  const {
    page       = 1,
    limit      = 12,
    category,
    tool,
    location,
    country,
    plan,
    verified,
    featured,
    rating_min,
    sort       = 'featured',
    search,
    type,        // agency | freelancer | consultant
    industry,
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const offset   = (pageNum - 1) * limitNum;

  let query = supabase
    .from('providers')
    .select(`
      id, slug, business_name, provider_type, tagline,
      avatar_emoji, location_city, location_country, remote_work,
      hourly_rate_min, hourly_rate_max, categories, tools, industries,
      plan, is_verified, is_featured, rating_avg, review_count,
      profile_views, response_time_hrs, years_experience, team_size,
      created_at
    `, { count: 'exact' })
    .eq('is_active', true)
    .eq('is_approved', true);

  // ---- Filters ----
  if (category)   query = query.contains('categories', [category]);
  if (tool)       query = query.contains('tools', [tool]);
  if (industry)   query = query.contains('industries', [industry]);
  if (type)       query = query.eq('provider_type', type);
  if (country)    query = query.ilike('location_country', `%${country}%`);
  if (location)   query = query.or(`location_city.ilike.%${location}%,location_country.ilike.%${location}%`);
  if (verified === 'true') query = query.eq('is_verified', true);
  if (featured === 'true') query = query.eq('is_featured', true);
  if (plan)       query = query.eq('plan', plan);

  if (rating_min) {
    const rMin = parseFloat(rating_min);
    if (!isNaN(rMin)) query = query.gte('rating_avg', rMin);
  }

  // ---- Full-text search ----
  if (search?.trim()) {
    query = query.textSearch(
      'business_name, description, tagline',
      search.trim(),
      { type: 'websearch', config: 'english' }
    );
  }

  // ---- Sorting ----
  switch (sort) {
    case 'rating':    query = query.order('rating_avg',    { ascending: false }); break;
    case 'reviews':   query = query.order('review_count',  { ascending: false }); break;
    case 'newest':    query = query.order('created_at',    { ascending: false }); break;
    case 'price_asc': query = query.order('hourly_rate_min', { ascending: true,  nullsFirst: false }); break;
    case 'price_desc':query = query.order('hourly_rate_min', { ascending: false, nullsFirst: false }); break;
    default:
      // "featured" sort: featured + pro/agency first, then rating
      query = query
        .order('is_featured',  { ascending: false })
        .order('plan',         { ascending: false })
        .order('rating_avg',   { ascending: false });
  }

  query = query.range(offset, offset + limitNum - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('Providers query error:', error);
    return err(res, 'Failed to fetch providers', 500);
  }

  return ok(res, {
    providers:   data || [],
    total:       count || 0,
    page:        pageNum,
    limit:       limitNum,
    total_pages: Math.ceil((count || 0) / limitNum),
  });
};
