// ============================================================
// AutomationHire — Shared API utilities
// Imported by all API routes
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const { Resend }        = require('resend');

// --- Supabase (service role — bypasses RLS) ---
function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// --- Resend email client (returns null-safe stub when key is placeholder) ---
function getResend() {
  const key = process.env.RESEND_API_KEY || '';
  if (!key || key.startsWith('re_placeholder')) {
    // Return a stub so API routes don't crash during local dev without Resend
    return {
      emails: {
        send: (payload) => {
          console.log('[Resend STUB] Email would send:', payload.subject, '→', payload.to);
          return Promise.resolve({ id: 'stub' });
        }
      }
    };
  }
  return new Resend(key);
}

// --- CORS preflight handler ---
function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

// --- Standard JSON responses ---
function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, ...data });
}

function err(res, message, status = 400, details = null) {
  return res.status(status).json({ ok: false, error: message, ...(details ? { details } : {}) });
}

// --- Simple slug generator ---
function toSlug(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// --- Email templates (HTML strings) ---
const emails = {

  // To provider: you received a new lead
  leadNotification: ({ providerName, lead }) => ({
    subject: `⚡ New Lead Request — ${lead.client_company || lead.client_name}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#00e676,#2979ff);padding:28px 32px">
          <div style="font-size:24px;font-weight:800;color:#060810">⚡ AutomationHire</div>
          <div style="color:rgba(6,8,16,0.7);font-size:14px;margin-top:4px">New Lead Request</div>
        </div>
        <div style="padding:32px">
          <h2 style="font-size:22px;font-weight:700;margin:0 0 8px">Hi ${providerName},</h2>
          <p style="color:#9ca3af;font-size:15px;margin:0 0 24px">You have a new lead request on AutomationHire. Respond quickly to increase your chance of winning the project.</p>

          <div style="background:#161b27;border:1px solid #1e2535;border-radius:10px;padding:22px;margin-bottom:22px">
            <div style="font-size:12px;color:#00e676;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px">Project Brief</div>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:7px 0;color:#9ca3af;width:140px">From</td><td style="padding:7px 0;color:#fff;font-weight:600">${lead.client_name}${lead.client_company ? ' · ' + lead.client_company : ''}</td></tr>
              <tr><td style="padding:7px 0;color:#9ca3af">Type</td><td style="padding:7px 0;color:#fff">${lead.automation_type || 'Not specified'}</td></tr>
              <tr><td style="padding:7px 0;color:#9ca3af">Budget</td><td style="padding:7px 0;color:#00e676;font-weight:600">${lead.budget || 'Not specified'}</td></tr>
              <tr><td style="padding:7px 0;color:#9ca3af">Timeline</td><td style="padding:7px 0;color:#fff">${lead.timeline || 'Not specified'}</td></tr>
              <tr><td style="padding:7px 0;color:#9ca3af;vertical-align:top">Description</td><td style="padding:7px 0;color:#e5e7eb;line-height:1.6">${lead.description}</td></tr>
            </table>
          </div>

          <div style="background:rgba(0,230,118,0.08);border:1px solid rgba(0,230,118,0.2);border-radius:8px;padding:16px;margin-bottom:24px">
            <div style="font-size:13px;color:#9ca3af">Client Email</div>
            <a href="mailto:${lead.client_email}" style="color:#00e676;font-weight:600;font-size:16px;text-decoration:none">${lead.client_email}</a>
          </div>

          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard.html" style="display:block;text-align:center;background:linear-gradient(135deg,#00e676,#00b4d8);color:#060810;font-weight:700;font-size:15px;padding:16px 32px;border-radius:8px;text-decoration:none">View Lead in Dashboard →</a>

          <p style="color:#6b7280;font-size:12px;margin-top:24px;text-align:center">AutomationHire.co.uk · <a href="${process.env.NEXT_PUBLIC_SITE_URL}" style="color:#6b7280">automationhire.co.uk</a></p>
        </div>
      </div>
    `
  }),

  // To client: your quote request was received
  leadConfirmation: ({ clientName, providerName }) => ({
    subject: `✅ Quote Request Sent to ${providerName}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#00e676,#2979ff);padding:28px 32px">
          <div style="font-size:24px;font-weight:800;color:#060810">⚡ AutomationHire</div>
        </div>
        <div style="padding:32px">
          <h2 style="font-size:22px;font-weight:700;margin:0 0 8px">Your request is on its way, ${clientName}!</h2>
          <p style="color:#9ca3af;font-size:15px;line-height:1.7">We've forwarded your project brief to <strong style="color:#fff">${providerName}</strong>. They typically respond within 4 hours.</p>
          <div style="background:#161b27;border:1px solid #1e2535;border-radius:10px;padding:22px;margin:24px 0">
            <p style="color:#9ca3af;font-size:14px;margin:0">While you wait, browse more experts on AutomationHire who might be a great fit for your project.</p>
          </div>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/providers.html" style="display:block;text-align:center;background:linear-gradient(135deg,#00e676,#00b4d8);color:#060810;font-weight:700;font-size:15px;padding:16px 32px;border-radius:8px;text-decoration:none">Browse More Experts →</a>
        </div>
      </div>
    `
  }),

  // To client: matched with experts
  matchedExperts: ({ clientName, count }) => ({
    subject: `⚡ We found ${count} automation experts for your project`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#00e676,#2979ff);padding:28px 32px">
          <div style="font-size:24px;font-weight:800;color:#060810">⚡ AutomationHire</div>
        </div>
        <div style="padding:32px">
          <h2 style="font-size:22px;font-weight:700;margin:0 0 8px">Great news, ${clientName}!</h2>
          <p style="color:#9ca3af;font-size:15px;line-height:1.7">We've matched your project with <strong style="color:#00e676">${count} verified automation experts</strong>. Each provider has been notified and will respond to you directly at your email address within 4 hours.</p>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/providers.html" style="display:block;text-align:center;background:linear-gradient(135deg,#00e676,#00b4d8);color:#060810;font-weight:700;font-size:15px;padding:16px 32px;border-radius:8px;text-decoration:none;margin-top:24px">Browse All Experts →</a>
        </div>
      </div>
    `
  }),

  // To provider: listing submitted for review
  listingSubmitted: ({ name }) => ({
    subject: `🎉 Your AutomationHire listing is under review`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#00e676,#2979ff);padding:28px 32px">
          <div style="font-size:24px;font-weight:800;color:#060810">⚡ AutomationHire</div>
        </div>
        <div style="padding:32px">
          <h2 style="font-size:22px;font-weight:700;margin:0 0 8px">You're in the queue, ${name}!</h2>
          <p style="color:#9ca3af;font-size:15px;line-height:1.7">Thanks for submitting your listing to AutomationHire. Our team will review your profile within <strong style="color:#fff">24 hours</strong> and you'll receive an email confirmation once you're live.</p>
          <div style="background:rgba(0,230,118,0.08);border:1px solid rgba(0,230,118,0.2);border-radius:8px;padding:16px;margin:24px 0">
            <p style="color:#9ca3af;font-size:14px;margin:0 0 8px">💡 <strong style="color:#fff">Tip:</strong> Upgrade to our Growth plan to get a Verified badge, appear in category featured spots, and receive inbound leads from day one.</p>
          </div>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/pricing.html" style="display:block;text-align:center;background:linear-gradient(135deg,#00e676,#00b4d8);color:#060810;font-weight:700;font-size:15px;padding:16px 32px;border-radius:8px;text-decoration:none">View Pricing Plans →</a>
        </div>
      </div>
    `
  }),

  // Admin: new listing submitted
  adminNewListing: ({ name, email, type }) => ({
    subject: `[AutomationHire] New listing submitted: ${name}`,
    html: `<p>New provider listing submitted.</p><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Type:</strong> ${type}</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard.html">Review in Admin →</a></p>`
  }),

  // ── Expert welcome sequence (triggered by n8n) ──

  // Day 1: Welcome & profile tips
  expertWelcomeDay1: ({ name, businessName, slug }) => ({
    subject: `🎉 Welcome to AutomationHire, ${name}! Here's how to get your first lead`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#00e676,#2979ff);padding:28px 32px">
          <div style="font-size:24px;font-weight:800;color:#060810">⚡ AutomationHire</div>
          <div style="color:rgba(6,8,16,0.7);font-size:14px;margin-top:4px">Welcome to the community</div>
        </div>
        <div style="padding:32px">
          <h2 style="font-size:22px;font-weight:700;margin:0 0 12px">Welcome aboard, ${name}! 👋</h2>
          <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 24px">Your <strong style="color:#fff">${businessName}</strong> listing is now live on AutomationHire. Here's how to maximise your visibility and land your first client.</p>

          <div style="background:#161b27;border:1px solid #1e2535;border-radius:10px;padding:22px;margin-bottom:22px">
            <div style="font-size:12px;color:#00e676;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px">Your Day 1 Checklist</div>
            <div style="display:flex;flex-direction:column;gap:12px">
              ${[
                ['Share your profile link on LinkedIn', `${process.env.NEXT_PUBLIC_SITE_URL}/provider-profile?slug=${slug}`],
                ['Add a portfolio item to your dashboard', `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`],
                ['Set your response time to under 4 hours', `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`],
                ['Ask a past client for a review', `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`],
              ].map(([label, link]) => `
                <div style="display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#e5e7eb">
                  <span style="color:#00e676;flex-shrink:0">✓</span>
                  <span>${label} — <a href="${link}" style="color:#00e676">${link.replace('https://', '')}</a></span>
                </div>
              `).join('')}
            </div>
          </div>

          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/provider-profile?slug=${slug}" style="display:block;text-align:center;background:linear-gradient(135deg,#00e676,#00b4d8);color:#060810;font-weight:700;font-size:15px;padding:16px 32px;border-radius:8px;text-decoration:none">View Your Live Profile →</a>

          <p style="color:#6b7280;font-size:13px;margin-top:24px;line-height:1.6">Questions? Reply to this email — we're here to help. More tips coming in 3 days.</p>
        </div>
      </div>
    `
  }),

  // Day 3: Lead generation tips
  expertWelcomeDay3: ({ name, businessName }) => ({
    subject: `📈 3 ways to get more leads on AutomationHire (Day 3 tip)`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#00e676,#2979ff);padding:28px 32px">
          <div style="font-size:24px;font-weight:800;color:#060810">⚡ AutomationHire</div>
          <div style="color:rgba(6,8,16,0.7);font-size:14px;margin-top:4px">Pro tips for ${businessName}</div>
        </div>
        <div style="padding:32px">
          <h2 style="font-size:22px;font-weight:700;margin:0 0 12px">Hi ${name} — here are your Day 3 tips 🚀</h2>
          <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 24px">Experts who follow these steps get <strong style="color:#fff">3x more profile views</strong> in their first two weeks.</p>

          ${[
            ['Upgrade to Growth or Pro', 'Verified badge + priority placement = more trust + more clicks. Clients filter by verified experts first.', `${process.env.NEXT_PUBLIC_SITE_URL}/pricing`],
            ['Add specific tools to your profile', 'Clients search by tool (Zapier, Make, n8n, HubSpot). The more tools listed, the more searches you appear in.', `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`],
            ['Post your profile on niche communities', 'Reddit (r/automation, r/nocode), LinkedIn groups, and Facebook groups for small business owners are high-intent audiences.', null],
          ].map(([title, body, link]) => `
            <div style="background:#161b27;border:1px solid #1e2535;border-radius:10px;padding:18px;margin-bottom:14px">
              <div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:6px">⚡ ${title}</div>
              <div style="font-size:14px;color:#9ca3af;line-height:1.6">${body}</div>
              ${link ? `<a href="${link}" style="color:#00e676;font-size:13px;font-weight:600;text-decoration:none;display:inline-block;margin-top:8px">${link.replace('https://', '')} →</a>` : ''}
            </div>
          `).join('')}

          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/pricing" style="display:block;text-align:center;background:linear-gradient(135deg,#00e676,#00b4d8);color:#060810;font-weight:700;font-size:15px;padding:16px 32px;border-radius:8px;text-decoration:none;margin-top:8px">Upgrade My Plan →</a>
        </div>
      </div>
    `
  }),

  // Day 7: Social proof & conversion tips
  expertWelcomeDay7: ({ name, businessName }) => ({
    subject: `⭐ One week in — how to convert profile visitors into paying clients`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#00e676,#2979ff);padding:28px 32px">
          <div style="font-size:24px;font-weight:800;color:#060810">⚡ AutomationHire</div>
          <div style="color:rgba(6,8,16,0.7);font-size:14px;margin-top:4px">Week 1 complete — ${businessName}</div>
        </div>
        <div style="padding:32px">
          <h2 style="font-size:22px;font-weight:700;margin:0 0 12px">One week on AutomationHire, ${name} 🎯</h2>
          <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 24px">The experts who convert the most leads on AutomationHire do two things really well: <strong style="color:#fff">social proof</strong> and <strong style="color:#fff">fast response times</strong>.</p>

          <div style="background:#161b27;border:1px solid #1e2535;border-radius:10px;padding:22px;margin-bottom:22px">
            <div style="font-size:12px;color:#00e676;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px">Conversion Checklist</div>
            ${[
              'At least 3 reviews on your profile (ask past clients now)',
              'A portfolio item with a before/after result or case study',
              'Your response time set to 4 hours or less',
              'A clear, benefit-led tagline (not just your job title)',
              'Your LinkedIn and website linked on your profile',
            ].map(item => `
              <div style="display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#e5e7eb;margin-bottom:10px">
                <span style="color:#00e676;flex-shrink:0">✓</span>
                <span>${item}</span>
              </div>
            `).join('')}
          </div>

          <div style="background:rgba(0,230,118,0.08);border:1px solid rgba(0,230,118,0.2);border-radius:8px;padding:18px;margin-bottom:24px">
            <div style="font-size:14px;font-weight:700;color:#00e676;margin-bottom:6px">💬 Want feedback on your profile?</div>
            <div style="font-size:14px;color:#9ca3af;line-height:1.6">Reply to this email with your profile link and our team will give you personalised tips to improve your conversion rate — no charge.</div>
          </div>

          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard" style="display:block;text-align:center;background:linear-gradient(135deg,#00e676,#00b4d8);color:#060810;font-weight:700;font-size:15px;padding:16px 32px;border-radius:8px;text-decoration:none">Update My Profile →</a>
        </div>
      </div>
    `
  }),

  // Newsletter welcome
  newsletterWelcome: ({ email }) => ({
    subject: `Welcome to the AutomationHire newsletter 👋`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#00e676,#2979ff);padding:28px 32px">
          <div style="font-size:24px;font-weight:800;color:#060810">⚡ AutomationHire</div>
        </div>
        <div style="padding:32px">
          <h2 style="font-size:22px;font-weight:700;margin:0 0 8px">You're subscribed!</h2>
          <p style="color:#9ca3af;font-size:15px;line-height:1.7">Every Thursday you'll receive the best AI automation guides, tool comparisons, UK provider spotlights and case studies — straight to your inbox.</p>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/blog.html" style="display:block;text-align:center;background:linear-gradient(135deg,#00e676,#00b4d8);color:#060810;font-weight:700;font-size:15px;padding:16px 32px;border-radius:8px;text-decoration:none;margin-top:24px">Read the Blog →</a>
        </div>
      </div>
    `
  })
};

module.exports = { getSupabase, getResend, handleCors, ok, err, toSlug, emails };
