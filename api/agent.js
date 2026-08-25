// ============================================================
// GET/POST /api/agent?action=...
// Blog pipeline agent: research topics, write posts, publish
// Actions: check, research, write, publish, delete, posts, post
// ============================================================

const Anthropic = require('@anthropic-ai/sdk');
const crypto    = require('crypto');
const fs        = require('fs');
const path      = require('path');
const { getSupabase, getBody, handleCors, ok, err, toSlug } = require('./_lib');

const MODEL = 'claude-sonnet-4-6';
const SITE  = process.env.NEXT_PUBLIC_SITE_URL || 'https://automationhire.co.uk';
const BLOG_TEMPLATE_PATH = path.join(process.cwd(), 'blog-post.html');

// ─── Paid Garage packs ────────────────────────────────────────────────
// One-off downloadable products sold via Stripe Checkout Sessions.
// Add new packs here. For each, set the Stripe Price ID env var
// (Stripe dashboard → Products → your product → Price ID) and upload
// the ZIP into the referenced Supabase Storage bucket + path.
const GARAGE_PAID_PACKS = {
  'plant-3d-cable-tray': {
    priceEnv:      'STRIPE_PRICE_CABLE_TRAY_PACK',   // e.g. price_1XxxxxYyy
    returnPath:    '/garage/plant-3d-cable-tray',
    storageBucket: 'garage-paid',
    storagePath:   'plant-3d-cable-tray/AutomationHire_CableTrayPack_v1.0.0.zip',
  },
};

// --- Server-render blog-post.html for a given slug (SEO: real <title>/
// description/canonical/JSON-LD instead of client-JS-only injection) ---
function escBlog(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatBlogDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
function renderBlogNotFound(template) {
  return template
    .replace(/<title id="page-title">[^<]*<\/title>/, '<title>Post Not Found | AutomationHire Blog</title>')
    .replace(/<meta name="description" id="page-desc" content="" \/>/, '<meta name="description" content="This article may have been moved or removed." />\n  <meta name="robots" content="noindex, follow" />')
    .replace('id="post-loading"', 'id="post-loading" style="display:none"')
    .replace('id="post-error" style="display:none"', 'id="post-error"');
}
function renderBlogPost(template, p) {
  const canonical = `${SITE}/blog/${p.slug}`;
  const title = `${p.title} | AutomationHire Blog`;
  const description = p.meta_description || p.excerpt || '';
  const dateISO = p.published_at || p.created_at || new Date().toISOString();
  const keywords = Array.isArray(p.keywords) ? p.keywords : [];
  const primaryKw = keywords[0] || 'AI Automation';
  const ogImage = `${SITE}/assets/og/og-default.png`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.title,
    description,
    url: canonical,
    datePublished: dateISO,
    dateModified: dateISO,
    keywords: keywords.join(', '),
    wordCount: p.word_count || undefined,
    author: { '@type': 'Organization', name: 'AutomationHire', url: SITE },
    publisher: { '@type': 'Organization', name: 'AutomationHire', logo: { '@type': 'ImageObject', url: `${SITE}/assets/og/logo.png` } },
    image: ogImage,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  };

  const headInjection = `
  <link rel="canonical" href="${canonical}" />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <meta property="og:title" content="${escBlog(title)}" />
  <meta property="og:description" content="${escBlog(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:site_name" content="AutomationHire" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="article:published_time" content="${dateISO}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escBlog(title)}" />
  <meta name="twitter:description" content="${escBlog(description)}" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

  return template
    .replace(/<title id="page-title">[^<]*<\/title>/, `<title>${escBlog(title)}</title>`)
    .replace(/<meta name="description" id="page-desc" content="" \/>/, `<meta name="description" content="${escBlog(description)}" />${headInjection}`)
    .replace('id="post-hero" style="display:none"', 'id="post-hero"')
    .replace('<div class="post-cat" id="post-cat"></div>', `<div class="post-cat" id="post-cat">${escBlog(primaryKw)}</div>`)
    .replace('<h1 class="post-h1" id="post-h1"></h1>', `<h1 class="post-h1" id="post-h1">${escBlog(p.title)}</h1>`)
    .replace('<p class="post-deck" id="post-deck"></p>', `<p class="post-deck" id="post-deck">${escBlog(p.excerpt)}</p>`)
    .replace('<span id="post-date"></span>', `<span id="post-date">${escBlog(formatBlogDate(dateISO))}</span>`)
    .replace('<span id="post-read"></span>', `<span id="post-read">${p.reading_time ? ` &middot; ${escBlog(p.reading_time)} min read` : ''}</span>`)
    .replace('<div class="post-kws" id="post-kws"></div>', `<div class="post-kws" id="post-kws">${keywords.map(k => `<span class="post-kw">${escBlog(k)}</span>`).join('')}</div>`)
    .replace('id="post-loading"', 'id="post-loading" style="display:none"')
    .replace('id="post-main" style="display:none"', 'id="post-main"')
    .replace('<div class="post-content" id="post-content"></div>', `<div class="post-content" id="post-content">${p.content || ''}</div>`)
    .replace(/<script>\r?\n\(async function \(\) \{/, `<script>\nwindow.__SSR_POST__ = true;\n(async function () {\n  if (window.__SSR_POST__) return;`);
}

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

  // ── Public: server-rendered blog post page (SEO — real <head> tags) ────
  if (action === 'render' && req.method === 'GET') {
    const slug = req.query.slug;
    const template = fs.readFileSync(BLOG_TEMPLATE_PATH, 'utf8');
    if (!slug) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(renderBlogNotFound(template));
    }
    const { data: p, error: renderErr } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (renderErr || !p) return res.status(404).send(renderBlogNotFound(template));
    return res.status(200).send(renderBlogPost(template, p));
  }

  // ── Public: list published AutoCAD Garage items ───────────────────────
  if (action === 'garage-list' && req.method === 'GET' && req.query.public === '1') {
    const { data, error } = await supabase
      .from('garage_items')
      .select('id,title,description,category,file_name,file_path,file_size,file_type,downloads_count,created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false });
    if (error) return err(res, 'Fetch failed', 500);
    const base = `${process.env.SUPABASE_URL}/storage/v1/object/public/garage-files/`;
    const items = (data || []).map(i => ({ ...i, download_url: base + i.file_path }));
    return ok(res, { items });
  }

  // ── Password login (public — no auth required) ───────────────────────
  if (action === 'auth' && req.method === 'POST') {
    const { password } = await getBody(req);
    const adminPass = process.env.ADMIN_PASSWORD;
    if (!adminPass) return err(res, 'ADMIN_PASSWORD not set in Vercel env vars.', 503);
    if (!password || password !== adminPass) return err(res, 'Incorrect password', 401);
    return ok(res, { token: makeToken(adminPass) });
  }

  // ── Public: AI decision analysis ─────────────────────────────────────────────
  if (action === 'decision' && req.method === 'POST') {
    if (!process.env.ANTHROPIC_API_KEY) return err(res, 'AI service not configured', 503);

    const {
      question, options = [], criteria = [],
      style = 'analyst', stakes = 'medium', timeframe = 'considered',
    } = await getBody(req);

    if (!question?.trim()) return err(res, 'question required');
    const validOpts = options.filter(o => o?.trim());
    if (validOpts.length < 2) return err(res, 'At least 2 options required');

    const STYLE_SYSTEM = {
      comparator: `You are a decision analyst who specialises in clear, structured side-by-side comparison. Compare options systematically across shared dimensions so trade-offs are immediately visible. Use tables or parallel lists with consistent categories. Be direct — pick a winner. End with one punchy recommendation sentence.`,
      analyst:    `You are a rigorous cost-benefit analyst. For each option enumerate: concrete benefits, realistic costs (including hidden and opportunity costs), key risks, and the critical assumption that must hold. Quantify wherever possible. Challenge wishful thinking. Synthesise into a clear recommendation you'd stake your professional reputation on.`,
      scorer:     `You are a decision scientist who builds weighted scoring models. Use the user's criteria if provided, or infer the 4–5 most important ones. Score each option 1–10 against each criterion and show your working. Apply weighting where criteria differ in importance. Calculate totals and rank. Explain any counterintuitive scores.`,
      challenger: `You are a devil's advocate facilitator. For each option: (1) Steelman it — make the absolute strongest possible case FOR choosing it. (2) Then systematically dismantle it — present the most powerful argument AGAINST it. Do not be polite. Help the user see what they might be rationalising. End with which option survives the most scrutiny.`,
      gut:        `You are an intuitive decision coach who honours both instinct and evidence. Open with your immediate gut read: "My gut says [option] because [rapid intuitive reason]." Validate or challenge that gut reaction with 3 specific considerations the user may not have weighed. Name the cognitive bias most likely at play. End with a recommendation that honours both data and instinct.`,
    };

    const sys = STYLE_SYSTEM[style] || STYLE_SYSTEM.analyst;
    const optStr  = validOpts.map((o, i) => `${String.fromCharCode(65 + i)}. ${o.trim()}`).join('\n');
    const critStr = criteria.filter(c => c?.trim()).length
      ? `\nCriteria (in rough priority order):\n${criteria.filter(c=>c?.trim()).map((c,i)=>`${i+1}. ${c.trim()}`).join('\n')}`
      : '';
    const stakesLabel = { low:'low — reversible, low cost', medium:'medium — meaningful but recoverable', high:'high — hard to reverse, significant impact' }[stakes] || stakes;
    const timeLabel   = { quick:'quick — decide today', considered:'considered — days to weeks', strategic:'strategic — months, long-term' }[timeframe] || timeframe;

    const userMsg = `Decision: ${question.trim()}

Options:
${optStr}${critStr}

Stakes: ${stakesLabel}
Timeframe: ${timeLabel}

Provide your analysis. Use ## headings. Be specific and actionable.

End your response with EXACTLY this block (no variation in formatting):
---RESULT---
RECOMMENDATION: [exact option name]
CONFIDENCE: [integer 50-95]
KEY INSIGHT: [one sharp memorable sentence]
---END---`;

    let raw;
    try { raw = await askClaude(sys, userMsg, 1800); }
    catch (e) { return err(res, 'AI analysis failed — please try again', 500); }

    const m = raw.match(/---RESULT---\s*\nRECOMMENDATION:\s*(.+)\nCONFIDENCE:\s*(\d+)\nKEY INSIGHT:\s*(.+)\n---END---/s);
    const recommendation = m?.[1]?.trim() || null;
    const confidence     = m ? Math.min(95, Math.max(50, parseInt(m[2]))) : null;
    const keyInsight     = m?.[3]?.trim() || null;
    const analysis       = raw.replace(/---RESULT---[\s\S]*---END---\s*$/, '').trim();

    return ok(res, { analysis, recommendation, confidence, keyInsight, style });
  }

  // ── PUBLIC: Paid Garage pack — create a Stripe Checkout session ───────
  // POST { pack: 'plant-3d-cable-tray' }  returns { url } for client redirect
  if (action === 'garage-checkout' && req.method === 'POST') {
    const { pack } = await getBody(req);
    const config = GARAGE_PAID_PACKS[pack];
    if (!config)                        return err(res, `Unknown pack: ${pack}`);
    if (!process.env.STRIPE_SECRET_KEY) return err(res, 'Stripe not configured', 500);
    if (!config.priceEnv || !process.env[config.priceEnv]) {
      return err(res, `Stripe price env var not set: ${config.priceEnv}`, 500);
    }
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = req.headers.origin || SITE;
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: process.env[config.priceEnv], quantity: 1 }],
        success_url: `${origin}${config.returnPath}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${origin}${config.returnPath}?canceled=1`,
        allow_promotion_codes: true,
        metadata: { pack },
        payment_intent_data: { metadata: { pack } },
      });
      return ok(res, { url: session.url });
    } catch (e) {
      return err(res, 'Checkout session failed', 500, e.message);
    }
  }

  // ── PUBLIC: Paid Garage pack — verify session_id and return signed URL ─
  // GET ?action=garage-download&pack=plant-3d-cable-tray&session_id=cs_...
  if (action === 'garage-download' && req.method === 'GET') {
    const pack = req.query.pack;
    const session_id = req.query.session_id;
    const config = GARAGE_PAID_PACKS[pack];
    if (!config)     return err(res, `Unknown pack: ${pack}`);
    if (!session_id) return err(res, 'session_id required');
    if (!process.env.STRIPE_SECRET_KEY) return err(res, 'Stripe not configured', 500);

    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id);
    } catch (e) {
      return err(res, 'Invalid session', 404, e.message);
    }
    if (session.payment_status !== 'paid') {
      return err(res, `Payment not completed (status: ${session.payment_status})`, 402);
    }
    if (session.metadata?.pack !== pack) {
      return err(res, 'Session does not match this pack', 403);
    }

    const { data, error } = await supabase.storage
      .from(config.storageBucket)
      .createSignedUrl(config.storagePath, 60 * 60);
    if (error || !data?.signedUrl) {
      return err(res, 'Failed to create signed download URL', 500, error?.message);
    }
    return ok(res, {
      paid: true,
      download_url: data.signedUrl,
      expires_in: 3600,
      pack,
      customer_email: session.customer_details?.email || null,
    });
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
    const { post_id, status = 'published' } = await getBody(req);
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
    const { post_id } = await getBody(req);
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
    const { title, keyword, angle } = await getBody(req);
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
    const { post_id } = await getBody(req);
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

  // ── Admin: list all providers (replaces client-side service-role fetch) ─
  if (action === 'admin-providers' && req.method === 'GET') {
    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return err(res, 'Fetch failed', 500);
    return ok(res, { providers: data || [] });
  }

  // ── Admin: approve / reject a provider listing ────────────────────────
  if (action === 'admin-provider-approve' && req.method === 'POST') {
    const { id } = await getBody(req);
    if (!id) return err(res, 'id required');
    const { error } = await supabase
      .from('providers')
      .update({ is_approved: true, is_active: true })
      .eq('id', id);
    if (error) return err(res, 'Update failed', 500, error.message);
    return ok(res, { approved: true });
  }

  if (action === 'admin-provider-reject' && req.method === 'POST') {
    const { id } = await getBody(req);
    if (!id) return err(res, 'id required');
    const { error } = await supabase
      .from('providers')
      .update({ is_approved: false, is_active: false })
      .eq('id', id);
    if (error) return err(res, 'Update failed', 500, error.message);
    return ok(res, { rejected: true });
  }

  // ── Admin: AutoCAD Garage — request a signed upload URL ───────────────
  if (action === 'garage-upload-url' && req.method === 'POST') {
    const { file_name } = await getBody(req);
    if (!file_name) return err(res, 'file_name required');
    const ext = (file_name.split('.').pop() || '').toLowerCase();
    const allowed = ['dwg', 'dxf', 'zip', 'lsp', 'step', 'stp'];
    if (!allowed.includes(ext)) return err(res, `File type .${ext} not allowed. Allowed: ${allowed.join(', ')}`);

    const path = `${Date.now()}-${toSlug(file_name.replace(/\.[^.]+$/, ''))}.${ext}`;
    const { data, error } = await supabase.storage
      .from('garage-files')
      .createSignedUploadUrl(path);
    if (error) return err(res, 'Failed to create upload URL', 500, error.message);
    return ok(res, { path, token: data.token, signedUrl: data.signedUrl });
  }

  // ── Admin: AutoCAD Garage — save item metadata after upload ───────────
  if (action === 'garage-save' && req.method === 'POST') {
    const { title, description, category, file_name, file_path, file_size, file_type } = await getBody(req);
    if (!title?.trim())     return err(res, 'Title is required');
    if (!file_path)         return err(res, 'file_path is required');

    const { data, error } = await supabase
      .from('garage_items')
      .insert({
        title:       title.trim(),
        description: description?.trim() || null,
        category:    category || null,
        file_name,
        file_path,
        file_size:   file_size || null,
        file_type:   file_type || null,
        is_published: true,
      })
      .select('id')
      .single();
    if (error) return err(res, 'Save failed', 500, error.message);
    return ok(res, { id: data.id });
  }

  // ── Admin: AutoCAD Garage — delete an item ────────────────────────────
  if (action === 'garage-delete' && req.method === 'POST') {
    const { id } = await getBody(req);
    if (!id) return err(res, 'id required');

    const { data: item } = await supabase
      .from('garage_items')
      .select('file_path')
      .eq('id', id)
      .single();

    if (item?.file_path) {
      await supabase.storage.from('garage-files').remove([item.file_path]).catch(() => {});
    }
    const { error } = await supabase.from('garage_items').delete().eq('id', id);
    if (error) return err(res, 'Delete failed', 500, error.message);
    return ok(res, { deleted: true });
  }

  return err(res, 'Unknown action', 404);
};
