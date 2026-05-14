// ============================================================
// GET/POST /api/agent?action=...
// Blog pipeline agent: research topics, write posts, publish
// Actions: check, research, write, publish, delete, posts, post
// ============================================================

const Anthropic = require('@anthropic-ai/sdk');
const crypto    = require('crypto');
const { getSupabase, handleCors, ok, err, toSlug } = require('./_lib');

const MODEL = 'claude-sonnet-4-6';

// --- Admin password token (HMAC of ADMIN_PASSWORD) ---
function makeToken(pass) {
  return crypto.createHmac('sha256', pass).update('cs-auth').digest('hex');
}

// --- Admin auth guard: accepts either HMAC token or Supabase JWT ---
async function isAdmin(req) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return false;
  const token = h.slice(7);

  // Method 1: simple admin password token
  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminPass && token === makeToken(adminPass)) return true;

  // Method 2: Supabase JWT (fallback for existing expert accounts)
  try {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return false;
    const allowed = (process.env.ADMIN_EMAIL || '').split(',').map(e => e.trim().toLowerCase());
    return allowed.includes(user.email.toLowerCase());
  } catch { return false; }
}

// --- Tavily web search ---
async function tavilySearch(query, days = 30, n = 8) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ api_key: key, query, search_depth: 'advanced', max_results: n, days }),
    });
    if (!r.ok) return [];
    return (await r.json()).results || [];
  } catch { return []; }
}

// --- Claude API call ---
async function askClaude(system, user, maxTokens = 2048) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const m = await client.messages.create({
    model:      MODEL,
    max_tokens: maxTokens,
    system,
    messages:   [{ role: 'user', content: user }],
  });
  return m.content[0].text;
}

// --- JSON extractor (handles occasional markdown fences) ---
function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]+?)```/) || text.match(/(\{[\s\S]+\})/s);
  if (m?.[1]) try { return JSON.parse(m[1]); } catch {}
  return null;
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const { action } = req.query;
  const supabase   = getSupabase();

  // ── Public: list published posts ──────────────────────────────────────
  if (action === 'posts' && req.method === 'GET' && req.query.public === '1') {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id,title,slug,excerpt,keywords,reading_time,published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20);
    if (error) return err(res, 'Fetch failed', 500);
    return ok(res, { posts: data || [] });
  }

  // ── Public: get single published post ─────────────────────────────────
  if (action === 'post' && req.method === 'GET' && req.query.public === '1') {
    const slug = req.query.slug;
    if (!slug) return err(res, 'slug required');
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();
    if (error || !data) return err(res, 'Post not found', 404);
    return ok(res, { post: data });
  }

  // ── Password login (public — no auth required) ───────────────────────
  if (action === 'auth' && req.method === 'POST') {
    const { password } = req.body || {};
    const adminPass = process.env.ADMIN_PASSWORD;
    if (!adminPass) return err(res, 'ADMIN_PASSWORD not set in Vercel env vars.', 503);
    if (!password || password !== adminPass) return err(res, 'Incorrect password', 401);
    return ok(res, { token: makeToken(adminPass) });
  }

  // ── All other admin actions require auth ──────────────────────────────
  const admin = await isAdmin(req);
  if (!admin) return err(res, 'Unauthorised', 401);

  // ── Check admin status ────────────────────────────────────────────────
  if (action === 'check') return ok(res, { is_admin: true });

  // ── Admin: list all posts ─────────────────────────────────────────────
  if (action === 'posts' && req.method === 'GET') {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id,title,slug,excerpt,status,reading_time,word_count,published_at,created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return err(res, 'Fetch failed', 500);
    return ok(res, { posts: data || [] });
  }

  // ── Admin: publish / unpublish ────────────────────────────────────────
  if (action === 'publish' && req.method === 'POST') {
    const { post_id, status = 'published' } = req.body || {};
    if (!post_id) return err(res, 'post_id required');
    const { error } = await supabase
      .from('blog_posts')
      .update({ status, published_at: status === 'published' ? new Date().toISOString() : null })
      .eq('id', post_id);
    if (error) return err(res, 'Update failed', 500, error.message);
    return ok(res, { status });
  }

  // ── Admin: delete post ────────────────────────────────────────────────
  if (action === 'delete' && req.method === 'POST') {
    const { post_id } = req.body || {};
    if (!post_id) return err(res, 'post_id required');
    const { error } = await supabase.from('blog_posts').delete().eq('id', post_id);
    if (error) return err(res, 'Delete failed', 500, error.message);
    return ok(res, { deleted: true });
  }

  // ── AI-powered actions (require ANTHROPIC_API_KEY) ────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return err(res, 'ANTHROPIC_API_KEY not configured. Add it in Vercel → Settings → Environment Variables, then redeploy.', 503);
  }

  // ── Research topics ───────────────────────────────────────────────────
  if (action === 'research' && req.method === 'POST') {
    const [r1, r2] = await Promise.all([
      tavilySearch('AI automation UK business trends news 2025', 30, 6),
      tavilySearch('no-code automation Zapier Make n8n UK small business', 30, 6),
    ]);

    const ctx = [...r1, ...r2].slice(0, 10)
      .map(r => `• ${r.title}\n  ${r.url}\n  ${(r.content || '').slice(0, 220)}`)
      .join('\n\n');

    const today = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    const raw = await askClaude(
      `You are a content strategist for AutomationHire.co.uk — a UK directory connecting businesses with AI automation experts. Generate 7 blog post topics for the coming week. Topics must: relate to AI automation, no-code tools (Zapier, Make, n8n), process automation, AI agents, or hiring automation experts in the UK; use UK English; target businesses or automation freelancers/agencies. Return ONLY valid JSON — no markdown, no commentary.`,
      `Today is ${today}.\n\nRecent web research:\n${ctx || '[Use your knowledge of current UK automation trends]'}\n\nReturn this exact JSON structure:\n{"topics":[{"title":"string","angle":"string","target_reader":"clients|experts|both","primary_keyword":"string","day":"Monday"}]}\n\nRules: assign each topic a unique weekday Mon–Sun; make titles SEO-friendly (include keyword naturally); angle is 1 sentence on the post's unique perspective.`,
      1800
    );

    const parsed = parseJson(raw);
    return ok(res, { topics: parsed?.topics || [] });
  }

  // ── Write post ────────────────────────────────────────────────────────
  if (action === 'write' && req.method === 'POST') {
    const { title, keyword, angle } = req.body || {};
    if (!title) return err(res, 'title required');

    const results = await tavilySearch(`${title} UK automation business`, 30, 6);
    const ctx = results
      .map(r => `Source: ${r.url}\n${r.title}\n${(r.content || '').slice(0, 350)}`)
      .join('\n\n---\n\n');

    const raw = await askClaude(
      `You are a professional blog writer for AutomationHire.co.uk (UK). Write SEO-optimised, practical posts for UK businesses or automation professionals. Requirements: 800–1100 words; UK English spelling throughout; clear H2 subheadings; helpful and actionable; end with a CTA encouraging readers to visit automationhire.co.uk to find or list automation services. Return ONLY valid JSON — no markdown, no commentary.`,
      `Write a complete blog post:\nTitle: ${title}\nPrimary keyword: ${keyword || title}\nAngle: ${angle || 'Practical guide for UK businesses'}\n\nWeb research (use as background, do not copy):\n${ctx || '[Use your expertise on UK automation trends]'}\n\nReturn this exact JSON:\n{"title":"string","meta_description":"string (150–160 chars, includes primary keyword)","excerpt":"string (2–3 engaging sentences for post listing)","keywords":["kw1","kw2","kw3","kw4","kw5"],"content":"string (full HTML body — use <h2>, <p>, <ul>, <li>, <strong>; do NOT include an outer <h1>)","reading_time":5,"word_count":950}`,
      4500
    );

    const parsed = parseJson(raw);
    if (!parsed?.content) return err(res, 'AI failed to generate the post. Please try again.', 500);

    const slug = `${toSlug(parsed.title || title)}-${Date.now().toString(36)}`;
    const row  = {
      title:            parsed.title,
      slug,
      meta_description: parsed.meta_description || '',
      excerpt:          parsed.excerpt || '',
      content:          parsed.content,
      keywords:         parsed.keywords || [],
      reading_time:     parsed.reading_time || 5,
      word_count:       parsed.word_count || 0,
      status:           'draft',
      created_at:       new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('blog_posts')
      .insert(row)
      .select('id,slug')
      .single();

    if (error) return err(res, 'Save failed', 500, error.message);
    return ok(res, { post: { ...parsed, id: data.id, slug: data.slug, status: 'draft' } });
  }

  // ── Generate social media copy ────────────────────────────────────────
  if (action === 'social' && req.method === 'POST') {
    const { post_id } = req.body || {};
    if (!post_id) return err(res, 'post_id required');

    const { data: post, error: fetchErr } = await supabase
      .from('blog_posts')
      .select('title,excerpt,keywords,content,slug')
      .eq('id', post_id)
      .single();
    if (fetchErr || !post) return err(res, 'Post not found', 404);

    // Strip HTML tags from content for the prompt
    const plainContent = (post.content || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200);

    // Tavily: fresh 30-day context on the topic
    const keyword = (post.keywords || [])[0] || post.title;
    const results = await tavilySearch(`${keyword} UK automation 2025`, 30, 6);
    const ctx = results
      .map(r => `• ${r.title}: ${(r.content || '').slice(0, 200)}`)
      .join('\n');

    const postUrl = `https://automationhire.co.uk/blog/${post.slug}`;

    const raw = await askClaude(
      `You are a social media copywriter for AutomationHire.co.uk — a UK directory for AI automation experts. Write punchy, engaging social copy that drives clicks. Use UK English. Return ONLY valid JSON — no markdown, no commentary.`,
      `Generate social media posts for this blog article:

Title: ${post.title}
Excerpt: ${post.excerpt}
Key content: ${plainContent}
Post URL: ${postUrl}

Fresh web context (last 30 days — use for hooks/stats if relevant):
${ctx || '[use your knowledge of UK automation trends]'}

Return this exact JSON:
{
  "linkedin": {
    "hook": "string (opening line — bold claim or surprising stat, max 20 words)",
    "body": "string (150–200 words; 3–4 short paragraphs; practical insight; UK audience; end with a soft CTA + URL)",
    "hashtags": ["#Automation","#AI","#UKBusiness","#NoCode","#Zapier"]
  },
  "twitter": {
    "thread": [
      "string (tweet 1 — hook, max 270 chars, include a number or stat)",
      "string (tweet 2 — key insight, max 270 chars)",
      "string (tweet 3 — practical tip, max 270 chars)",
      "string (tweet 4 — contrarian or surprising angle, max 270 chars)",
      "string (tweet 5 — CTA + URL, max 270 chars)"
    ]
  }
}`,
      2000
    );

    const parsed = parseJson(raw);
    if (!parsed?.linkedin || !parsed?.twitter) {
      return err(res, 'AI failed to generate social copy. Please try again.', 500);
    }
    return ok(res, { social: parsed, post: { title: post.title, slug: post.slug } });
  }

  return err(res, 'Unknown action', 404);
};
