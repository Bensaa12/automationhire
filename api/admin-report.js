// ============================================================
// GET/POST /api/admin-report
// Daily site-admin report: crawls live pages for mojibake
// artifacts + broken links, summarizes new leads/signups from
// Supabase, and emails the digest to ADMIN_EMAIL via Resend.
//
// Triggered by Vercel Cron (see vercel.json "crons"). Vercel
// automatically sends `Authorization: Bearer $CRON_SECRET` for
// cron-triggered requests — this route rejects anything else,
// so CRON_SECRET must be set in the Vercel project env vars.
// A manual run is also allowed via ?secret=<CRON_SECRET>.
// ============================================================

const { getSupabase, getResend, handleCors, ok, err, getSender } = require('./_lib');
const { findMojibake } = require('./_mojibake');

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://automationhire.co.uk';

const ROUTES = [
  '', 'admin', 'ai-automation-for-uk-business', 'auth-callback', 'blog-post', 'blog',
  'book', 'dashboard', 'decision-maker', 'email-prestige-pumps', 'forge', 'free',
  'hire-ai-automation-expert-uk', 'how-much-does-workflow-automation-cost-uk',
  'image-tool', 'login', 'mortgage-manager-pro', 'mortgage-manager', 'mortgage-thanks',
  'plant-3d-piping-automation-uk', 'pricing', 'privacy', 'provider-profile', 'providers',
  'pump-spec-gam100', 'pump-spec-sxs2000', 'request-quote', 'reviews', 'roi-calculator',
  'submit-listing', 'terms', 'thank-you', 'zapier-vs-make-vs-n8n-uk', 'fr/forge',
];

async function crawlBatch(routes, concurrency = 6) {
  const results = [];
  for (let i = 0; i < routes.length; i += concurrency) {
    const batch = routes.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(async (route) => {
      const url = `${SITE}/${route}`;
      try {
        const res = await fetch(url, { redirect: 'follow' });
        const status = res.status;
        const body = status < 400 ? await res.text() : '';
        const issues = body ? findMojibake(body).slice(0, 5) : [];
        return { route: route || '/', url, status, issues, ok: status < 400 };
      } catch (e) {
        return { route: route || '/', url, status: 0, issues: [], ok: false, fetchError: e.message };
      }
    }));
    results.push(...batchResults);
  }
  return results;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function buildReportHtml({ crawl, newLeads, leadsBySource, leadsByType, newProviders, totalLeads, totalProviders }) {
  const broken = crawl.filter(p => !p.ok);
  const withArtifacts = crawl.filter(p => p.ok && p.issues.length > 0);
  const healthy = crawl.length - broken.length - withArtifacts.length;

  const healthSection = (broken.length === 0 && withArtifacts.length === 0)
    ? `<p style="color:#00e676;font-weight:600">✅ All ${crawl.length} pages healthy — no broken pages, no artifacts.</p>`
    : `
      ${broken.length > 0 ? `
        <div style="margin-bottom:16px">
          <div style="color:#ff5252;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Broken Pages (${broken.length})</div>
          ${broken.map(p => `<div style="font-size:14px;color:#e5e7eb;padding:4px 0">/${escapeHtml(p.route)} — status ${p.status || 'fetch failed'}</div>`).join('')}
        </div>` : ''}
      ${withArtifacts.length > 0 ? `
        <div>
          <div style="color:#ffb020;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Pages With Artifacts (${withArtifacts.length})</div>
          ${withArtifacts.map(p => `<div style="font-size:14px;color:#e5e7eb;padding:4px 0">/${escapeHtml(p.route)} — ${p.issues.map(i => `"${escapeHtml(i.original)}"→"${escapeHtml(i.fixed)}"`).join(', ')}</div>`).join('')}
        </div>` : ''}
    `;

  const leadsSection = newLeads.length === 0
    ? `<p style="color:#9ca3af">No new leads in the last 24h.</p>`
    : `
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
        <tr style="color:#9ca3af;text-align:left"><th style="padding:6px 8px 6px 0">Name</th><th>Type</th><th>Budget</th><th>Source Page</th></tr>
        ${newLeads.map(l => `
          <tr style="border-top:1px solid #1e2535">
            <td style="padding:6px 8px 6px 0;color:#fff">${escapeHtml(l.client_name)}${l.client_company ? ` (${escapeHtml(l.client_company)})` : ''}</td>
            <td style="color:#e5e7eb">${escapeHtml(l.automation_type || '—')}</td>
            <td style="color:#00e676">${escapeHtml(l.budget || '—')}</td>
            <td style="color:#9ca3af">${escapeHtml(l.source_page || '—')}</td>
          </tr>`).join('')}
      </table>`;

  const topSources = Object.entries(leadsBySource).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topTypes = Object.entries(leadsByType).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return `
    <div style="font-family:Inter,sans-serif;max-width:640px;margin:0 auto;background:#0d1117;color:#fff;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#00e676,#2979ff);padding:28px 32px">
        <div style="font-size:22px;font-weight:800;color:#060810">⚡ AutomationHire — Daily Site Report</div>
        <div style="color:rgba(6,8,16,0.7);font-size:13px;margin-top:4px">${new Date().toISOString().slice(0, 10)}</div>
      </div>
      <div style="padding:32px">

        <h2 style="font-size:16px;color:#fff;margin:0 0 12px">🛠 Site Health (${crawl.length} pages checked)</h2>
        ${healthSection}

        <h2 style="font-size:16px;color:#fff;margin:28px 0 12px">📥 New Leads — last 24h (${newLeads.length})</h2>
        ${leadsSection}
        ${topSources.length ? `<div style="font-size:13px;color:#9ca3af;margin-bottom:6px">Top source pages: ${topSources.map(([p, c]) => `${escapeHtml(p)} (${c})`).join(', ')}</div>` : ''}
        ${topTypes.length ? `<div style="font-size:13px;color:#9ca3af">Top interest types: ${topTypes.map(([t, c]) => `${escapeHtml(t)} (${c})`).join(', ')}</div>` : ''}

        <h2 style="font-size:16px;color:#fff;margin:28px 0 12px">🆕 New Provider Signups — last 24h (${newProviders.length})</h2>
        ${newProviders.length === 0 ? `<p style="color:#9ca3af">None.</p>` : newProviders.map(p => `<div style="font-size:14px;color:#e5e7eb;padding:3px 0">${escapeHtml(p.business_name)} — ${escapeHtml(p.plan)}</div>`).join('')}

        <h2 style="font-size:16px;color:#fff;margin:28px 0 12px">📊 Totals</h2>
        <div style="font-size:14px;color:#e5e7eb">${totalLeads} leads all-time · ${totalProviders} providers all-time</div>

        <div style="margin-top:24px;padding:14px 16px;background:#161b27;border:1px solid #1e2535;border-radius:8px;font-size:12px;color:#6b7280">
          Traffic/click analytics aren't included yet — Vercel Web Analytics needs to be enabled in the project dashboard, and pulling numbers into this email needs a Vercel API token added later.
        </div>
      </div>
    </div>
  `;
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const authHeader = req.headers.authorization;
  const bearerOk = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const queryOk = process.env.CRON_SECRET && req.query.secret === process.env.CRON_SECRET;
  if (!process.env.CRON_SECRET || !(bearerOk || queryOk)) {
    return err(res, 'Unauthorized', 401);
  }

  const supabase = getSupabase();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [crawl, leadsRes, providersRes, totalLeadsRes, totalProvidersRes] = await Promise.all([
    crawlBatch(ROUTES),
    supabase.from('leads')
      .select('client_name, client_company, automation_type, budget, source_page, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
    supabase.from('providers')
      .select('business_name, plan, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    supabase.from('providers').select('id', { count: 'exact', head: true }),
  ]);

  const newLeads = leadsRes.data || [];
  const newProviders = providersRes.data || [];

  const leadsBySource = {};
  const leadsByType = {};
  for (const l of newLeads) {
    if (l.source_page) leadsBySource[l.source_page] = (leadsBySource[l.source_page] || 0) + 1;
    if (l.automation_type) leadsByType[l.automation_type] = (leadsByType[l.automation_type] || 0) + 1;
  }

  const html = buildReportHtml({
    crawl,
    newLeads,
    leadsBySource,
    leadsByType,
    newProviders,
    totalLeads: totalLeadsRes.count || 0,
    totalProviders: totalProvidersRes.count || 0,
  });

  const broken = crawl.filter(p => !p.ok).length;
  const artifacts = crawl.filter(p => p.ok && p.issues.length > 0).length;
  const subject = (broken || artifacts)
    ? `⚠️ AutomationHire Site Report — ${broken} broken, ${artifacts} with artifacts`
    : `✅ AutomationHire Site Report — all clear, ${newLeads.length} new leads`;

  const resend = getResend();
  await resend.emails.send({
    from: getSender('system'),
    to: process.env.ADMIN_EMAIL,
    subject,
    html,
  });

  return ok(res, {
    pages_checked: crawl.length,
    broken_pages: broken,
    pages_with_artifacts: artifacts,
    new_leads: newLeads.length,
    new_providers: newProviders.length,
  });
};
