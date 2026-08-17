// ============================================================
// GET /api/blog-post?slug=...
// Server-side rendered wrapper around the blog-post.html template.
//
// The static template originally set <title>/<meta description>/
// hero content entirely via a client-side fetch to /api/agent, with
// no canonical tag and no structured data — invisible to crawlers
// that don't execute JS (Bing, most AI bots) and slow for the ones
// that do. This route fetches the post itself, injects real <head>
// tags + BlogPosting JSON-LD + the rendered hero/content into the
// same HTML shell, and serves it directly. vercel.json rewrites
// /blog/:slug here.
// ============================================================

const fs = require('fs');
const path = require('path');
const { getSupabase } = require('./_lib');

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://automationhire.co.uk';
const TEMPLATE_PATH = path.join(process.cwd(), 'blog-post.html');

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderNotFound(template) {
  let html = template
    .replace(/<title id="page-title">[^<]*<\/title>/, '<title>Post Not Found | AutomationHire Blog</title>')
    .replace(/<meta name="description" id="page-desc" content="" \/>/, '<meta name="description" content="This article may have been moved or removed." />\n  <meta name="robots" content="noindex, follow" />')
    .replace('id="post-loading"', 'id="post-loading" style="display:none"')
    .replace('id="post-error" style="display:none"', 'id="post-error"');
  return html;
}

module.exports = async function handler(req, res) {
  const slug = req.query.slug;
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  if (!slug) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(renderNotFound(template));
  }

  const supabase = getSupabase();
  const { data: p, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error || !p) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(renderNotFound(template));
  }

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
    publisher: {
      '@type': 'Organization',
      name: 'AutomationHire',
      logo: { '@type': 'ImageObject', url: `${SITE}/assets/og/logo.png` },
    },
    image: ogImage,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  };

  const headInjection = `
  <link rel="canonical" href="${canonical}" />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:site_name" content="AutomationHire" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="article:published_time" content="${dateISO}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

  let html = template
    .replace(/<title id="page-title">[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" id="page-desc" content="" \/>/, `<meta name="description" content="${esc(description)}" />${headInjection}`)
    // Reveal + fill hero server-side
    .replace('id="post-hero" style="display:none"', 'id="post-hero"')
    .replace('<div class="post-cat" id="post-cat"></div>', `<div class="post-cat" id="post-cat">${esc(primaryKw)}</div>`)
    .replace('<h1 class="post-h1" id="post-h1"></h1>', `<h1 class="post-h1" id="post-h1">${esc(p.title)}</h1>`)
    .replace('<p class="post-deck" id="post-deck"></p>', `<p class="post-deck" id="post-deck">${esc(p.excerpt)}</p>`)
    .replace('<span id="post-date"></span>', `<span id="post-date">${esc(formatDate(dateISO))}</span>`)
    .replace('<span id="post-read"></span>', `<span id="post-read">${p.reading_time ? ` &middot; ${esc(p.reading_time)} min read` : ''}</span>`)
    .replace('<div class="post-kws" id="post-kws"></div>', `<div class="post-kws" id="post-kws">${keywords.map(k => `<span class="post-kw">${esc(k)}</span>`).join('')}</div>`)
    // Reveal + fill content server-side (content is stored as HTML, not escaped)
    .replace('id="post-loading"', 'id="post-loading" style="display:none"')
    .replace('id="post-main" style="display:none"', 'id="post-main"')
    .replace('<div class="post-content" id="post-content"></div>', `<div class="post-content" id="post-content">${p.content || ''}</div>`)
    // Let the client script know it doesn't need to re-fetch
    .replace(/<script>\r?\n\(async function \(\) \{/, `<script>\nwindow.__SSR_POST__ = true;\n(async function () {\n  if (window.__SSR_POST__) return;`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
};
