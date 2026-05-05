// ============================================================
// AutomationHire — Expert Lead Manager
//
// Manages the full expert journey:
//   new → invited → signed_up → listed → upgraded → cold
//
// Commands:
//   node lead-manager.js run      → process all leads (send due emails)
//   node lead-manager.js status   → print dashboard of all leads
//   node lead-manager.js add email@example.com "Name" "source"
//   node lead-manager.js mark email@example.com signed_up
//   node lead-manager.js mark email@example.com listed
//   node lead-manager.js mark email@example.com upgraded
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const fs   = require('fs');
const path = require('path');

const LEADS_FILE = path.join(__dirname, 'leads.json');
const LOG_FILE   = path.join(__dirname, 'leads.log');

const RESEND_API_KEY  = process.env.RESEND_API_KEY;
const FROM_EMAIL      = process.env.RESEND_EXPERTS_EMAIL      || 'experts@automationhire.co.uk';
const REPLY_TO        = process.env.RESEND_REPLY_TO           || 'hello@automationhire.co.uk';
const SITE_URL        = process.env.NEXT_PUBLIC_SITE_URL      || 'https://automationhire.co.uk';

// ── Logging ───────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ── Load / save leads ─────────────────────────────────────
function loadLeads() {
  if (!fs.existsSync(LEADS_FILE)) return [];
  return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
}
function saveLeads(leads) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
}

// ── Days since a date ─────────────────────────────────────
function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ── Send email via Resend ─────────────────────────────────
async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY || RESEND_API_KEY.includes('placeholder')) {
    log(`[DRY RUN] Would send "${subject}" to ${to}`);
    return true;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:     `Ben at AutomationHire <${FROM_EMAIL}>`,
      to,
      reply_to: REPLY_TO,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend ${res.status}: ${err}`);
  }
  return true;
}

// ── Email Templates ───────────────────────────────────────

function emailInvite(name) {
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
  return {
    subject: 'Free listing on AutomationHire — UK leads, no commission',
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
  <div style="background:#060810;padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <span style="font-size:28px">⚡</span>
    <span style="color:#fff;font-size:20px;font-weight:700;margin-left:8px">AutomationHire</span>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #eee">
    <p style="font-size:16px">${greeting}</p>
    <p>I came across your work in the n8n community and wanted to reach out personally.</p>
    <p>We've just launched <strong>AutomationHire.co.uk</strong> — the UK's dedicated directory for automation and AI specialists. We connect verified experts directly with UK businesses that have budget and a real need.</p>
    <p><strong>Here's the deal:</strong></p>
    <ul>
      <li>✅ Free listing — no credit card, no catch</li>
      <li>✅ You keep 100% of every project fee</li>
      <li>✅ Inbound enquiries from businesses actively searching</li>
      <li>✅ Your profile, your brand — not Upwork's</li>
    </ul>
    <p>Takes about 10 minutes to set up your profile:</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${SITE_URL}/submit-listing.html"
         style="background:#00e676;color:#060810;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
        Create Your Free Profile →
      </a>
    </div>
    <p style="color:#666;font-size:14px">Any questions, just reply to this email — I read every message personally.</p>
    <p style="color:#666;font-size:14px">Ben<br>Founder, AutomationHire</p>
  </div>
  <p style="text-align:center;font-size:12px;color:#999;margin-top:16px">
    AutomationHire.co.uk · <a href="${SITE_URL}" style="color:#999">Visit site</a>
  </p>
</div>`
  };
}

function emailReminder(name) {
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
  return {
    subject: 'Your AutomationHire profile is still waiting for you',
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
  <div style="background:#060810;padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <span style="font-size:28px">⚡</span>
    <span style="color:#fff;font-size:20px;font-weight:700;margin-left:8px">AutomationHire</span>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #eee">
    <p style="font-size:16px">${greeting}</p>
    <p>Just following up on my message from a couple of days ago. Your free profile on AutomationHire is still unclaimed.</p>
    <p>We're seeing real enquiries come in from UK businesses looking for n8n specialists specifically — and we want to make sure you don't miss out.</p>
    <p>It only takes 10 minutes:</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${SITE_URL}/submit-listing.html"
         style="background:#00e676;color:#060810;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
        Claim Your Free Profile →
      </a>
    </div>
    <p style="color:#666;font-size:14px">If this isn't a good fit right now, no worries — just let me know and I won't follow up again.</p>
    <p style="color:#666;font-size:14px">Ben<br>AutomationHire</p>
  </div>
</div>`
  };
}

function emailWelcome(name) {
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
  return {
    subject: 'Welcome to AutomationHire — here\'s how to get your first lead',
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
  <div style="background:#060810;padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <span style="font-size:28px">⚡</span>
    <span style="color:#fff;font-size:20px;font-weight:700;margin-left:8px">AutomationHire</span>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #eee">
    <p style="font-size:16px">${greeting}</p>
    <p>Welcome aboard! Your profile is under review and will be live within 24 hours.</p>
    <p><strong>3 things to do right now to maximise your leads:</strong></p>
    <ol>
      <li style="margin-bottom:12px"><strong>Add your portfolio link</strong> — profiles with portfolio URLs get 3x more clicks. Even a Notion page or Google Doc works.</li>
      <li style="margin-bottom:12px"><strong>Set your response time to &lt;24hrs</strong> — buyers filter by this heavily. Fast responders win more enquiries.</li>
      <li style="margin-bottom:12px"><strong>Share your profile link</strong> — post it on LinkedIn, in your n8n community bio, your email signature. Every visit builds your ranking.</li>
    </ol>
    <p>Your profile URL will be: <strong>automationhire.co.uk/provider-profile?slug=your-slug</strong></p>
    <div style="text-align:center;margin:28px 0">
      <a href="${SITE_URL}/dashboard.html"
         style="background:#00e676;color:#060810;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
        View Your Dashboard →
      </a>
    </div>
    <p style="color:#666;font-size:14px">Ben<br>AutomationHire</p>
  </div>
</div>`
  };
}

function emailOptimise(name) {
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
  return {
    subject: 'Quick tip: the #1 thing that gets automation experts more leads',
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
  <div style="background:#060810;padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <span style="font-size:28px">⚡</span>
    <span style="color:#fff;font-size:20px;font-weight:700;margin-left:8px">AutomationHire</span>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #eee">
    <p style="font-size:16px">${greeting}</p>
    <p>Your profile has been live for a few days — here's the #1 thing that separates experts who get regular leads from those who don't:</p>
    <div style="background:#f0fdf4;border-left:4px solid #00e676;padding:16px;margin:20px 0;border-radius:0 8px 8px 0">
      <strong>Specificity wins.</strong> Instead of "I do automation", say "I build n8n workflows that connect Shopify to HubSpot, automate order fulfilment, and reduce manual data entry by 80%."
    </div>
    <p>Buyers are not technical. They respond to <em>outcomes</em>, not tools. Try updating your description with:</p>
    <ul>
      <li>A specific industry you work in (e-commerce, SaaS, legal, finance)</li>
      <li>A specific pain point you solve ("saves 15 hours/week")</li>
      <li>The tools you connect together</li>
    </ul>
    <div style="text-align:center;margin:28px 0">
      <a href="${SITE_URL}/dashboard.html"
         style="background:#00e676;color:#060810;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
        Update My Profile →
      </a>
    </div>
    <p style="color:#666;font-size:14px">Ben<br>AutomationHire</p>
  </div>
</div>`
  };
}

function emailUpgrade(name) {
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
  return {
    subject: 'Your profile is live — want 3x more visibility?',
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
  <div style="background:#060810;padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <span style="font-size:28px">⚡</span>
    <span style="color:#fff;font-size:20px;font-weight:700;margin-left:8px">AutomationHire</span>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #eee">
    <p style="font-size:16px">${greeting}</p>
    <p>Your free profile has been live for a week. Here's what upgrading to our <strong>Growth plan (£79/month, or £55/month billed yearly)</strong> gets you:</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <tr style="background:#f9f9f9">
        <td style="padding:10px;border:1px solid #eee"></td>
        <td style="padding:10px;border:1px solid #eee;text-align:center;font-weight:700">Free</td>
        <td style="padding:10px;border:1px solid #eee;text-align:center;font-weight:700;background:#f0fdf4">Growth £79/mo</td>
      </tr>
      <tr>
        <td style="padding:10px;border:1px solid #eee">Directory listing</td>
        <td style="padding:10px;border:1px solid #eee;text-align:center">✅</td>
        <td style="padding:10px;border:1px solid #eee;text-align:center;background:#f0fdf4">✅</td>
      </tr>
      <tr style="background:#f9f9f9">
        <td style="padding:10px;border:1px solid #eee">Priority placement</td>
        <td style="padding:10px;border:1px solid #eee;text-align:center">—</td>
        <td style="padding:10px;border:1px solid #eee;text-align:center;background:#f0fdf4">✅</td>
      </tr>
      <tr>
        <td style="padding:10px;border:1px solid #eee">Featured badge</td>
        <td style="padding:10px;border:1px solid #eee;text-align:center">—</td>
        <td style="padding:10px;border:1px solid #eee;text-align:center;background:#f0fdf4">✅</td>
      </tr>
      <tr style="background:#f9f9f9">
        <td style="padding:10px;border:1px solid #eee">Unlimited lead enquiries</td>
        <td style="padding:10px;border:1px solid #eee;text-align:center">—</td>
        <td style="padding:10px;border:1px solid #eee;text-align:center;background:#f0fdf4">✅</td>
      </tr>
    </table>
    <p style="color:#666;font-size:14px">One client project at your rates more than pays for a full year. Cancel anytime.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${SITE_URL}/pricing.html"
         style="background:#00e676;color:#060810;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
        Upgrade My Listing →
      </a>
    </div>
    <p style="color:#666;font-size:14px">Ben<br>AutomationHire</p>
  </div>
</div>`
  };
}

function emailFinalChance(name) {
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
  return {
    subject: 'Last message from me — still worth 5 minutes?',
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
  <div style="background:#060810;padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <span style="font-size:28px">⚡</span>
    <span style="color:#fff;font-size:20px;font-weight:700;margin-left:8px">AutomationHire</span>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #eee">
    <p style="font-size:16px">${greeting}</p>
    <p>This is my last follow-up — I don't want to fill your inbox.</p>
    <p>If the timing isn't right, I completely understand. But if you're open to it, your free AutomationHire profile could be generating UK inbound leads while you focus on client work.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${SITE_URL}/submit-listing.html"
         style="background:#00e676;color:#060810;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
        Create Profile — Takes 10 Minutes →
      </a>
    </div>
    <p style="color:#666;font-size:14px">If you'd rather not hear from us, just reply "unsubscribe" and I'll remove you immediately.</p>
    <p style="color:#666;font-size:14px">Ben<br>AutomationHire</p>
  </div>
</div>`
  };
}

// ── The drip sequence rules ───────────────────────────────
//
// Status: new        → send invite immediately
// Status: invited    → day 2:  send reminder  (if not signed up)
//                   → day 14: send final chance (if still not signed up)
//                   → day 21: mark as cold
// Status: signed_up  → day 0 after sign up: send welcome
//                   → day 3: send optimise tips
//                   → day 7: send upgrade pitch
// Status: listed     → day 7 after listed: send upgrade pitch (if not already sent)
// Status: upgraded   → no more emails (convert complete!)
// Status: cold       → no more emails

async function processLead(lead, index, allLeads) {
  const updates  = {};
  const emailKey = (key) => lead.emails_sent.includes(key);
  let   sent     = false;

  if (lead.status === 'new' && lead.email && !lead.email.includes('PASTE_EMAIL')) {
    // Send invite immediately
    if (!emailKey('invite')) {
      const tpl = emailInvite(lead.name);
      await sendEmail(lead.email, tpl.subject, tpl.html);
      log(`INVITE sent to ${lead.email}`);
      updates.status       = 'invited';
      updates.invited_at   = new Date().toISOString();
      updates.emails_sent  = [...lead.emails_sent, 'invite'];
      sent = true;
    }
  }

  else if (lead.status === 'invited') {
    const daysSinceInvite = daysSince(lead.invited_at);

    if (daysSinceInvite >= 2 && !emailKey('reminder')) {
      const tpl = emailReminder(lead.name);
      await sendEmail(lead.email, tpl.subject, tpl.html);
      log(`REMINDER sent to ${lead.email} (day ${daysSinceInvite})`);
      updates.emails_sent = [...lead.emails_sent, 'reminder'];
      sent = true;
    }

    if (daysSinceInvite >= 14 && !emailKey('final_chance')) {
      const tpl = emailFinalChance(lead.name);
      await sendEmail(lead.email, tpl.subject, tpl.html);
      log(`FINAL CHANCE sent to ${lead.email} (day ${daysSinceInvite})`);
      updates.emails_sent = [...lead.emails_sent, 'final_chance'];
      sent = true;
    }

    if (daysSinceInvite >= 21 && !emailKey('final_chance')) {
      updates.status = 'cold';
      log(`Marked ${lead.email} as COLD (no response after 21 days)`);
    }
  }

  else if (lead.status === 'signed_up') {
    const daysSinceSignup = daysSince(lead.signed_up_at);

    if (!emailKey('welcome')) {
      const tpl = emailWelcome(lead.name);
      await sendEmail(lead.email, tpl.subject, tpl.html);
      log(`WELCOME sent to ${lead.email}`);
      updates.emails_sent = [...lead.emails_sent, 'welcome'];
      sent = true;
    }

    if (daysSinceSignup >= 3 && !emailKey('optimise')) {
      const tpl = emailOptimise(lead.name);
      await sendEmail(lead.email, tpl.subject, tpl.html);
      log(`OPTIMISE TIPS sent to ${lead.email} (day ${daysSinceSignup})`);
      updates.emails_sent = [...(updates.emails_sent || lead.emails_sent), 'optimise'];
      sent = true;
    }

    if (daysSinceSignup >= 7 && !emailKey('upgrade')) {
      const tpl = emailUpgrade(lead.name);
      await sendEmail(lead.email, tpl.subject, tpl.html);
      log(`UPGRADE PITCH sent to ${lead.email} (day ${daysSinceSignup})`);
      updates.emails_sent = [...(updates.emails_sent || lead.emails_sent), 'upgrade'];
      sent = true;
    }
  }

  else if (lead.status === 'listed') {
    const daysSinceListed = daysSince(lead.listed_at);

    if (daysSinceListed >= 7 && !emailKey('upgrade')) {
      const tpl = emailUpgrade(lead.name);
      await sendEmail(lead.email, tpl.subject, tpl.html);
      log(`UPGRADE PITCH sent to ${lead.email} (listed ${daysSinceListed} days ago)`);
      updates.emails_sent = [...lead.emails_sent, 'upgrade'];
      sent = true;
    }
  }

  // Apply updates
  if (Object.keys(updates).length > 0) {
    allLeads[index] = { ...lead, ...updates };
    saveLeads(allLeads);
  }

  return sent;
}

// ── Status dashboard ──────────────────────────────────────
function printStatus(leads) {
  const counts = { new: 0, invited: 0, signed_up: 0, listed: 0, upgraded: 0, cold: 0 };

  console.log('\n══════════════════════════════════════════════════');
  console.log('  AutomationHire — Lead Manager Dashboard');
  console.log('══════════════════════════════════════════════════\n');

  const valid = leads.filter(l => l.email && !l.email.includes('PASTE_EMAIL'));

  valid.forEach(l => {
    counts[l.status] = (counts[l.status] || 0) + 1;
    const daysAgo = l.invited_at ? `${daysSince(l.invited_at)}d ago` : 'not sent';
    const emailsSent = l.emails_sent.join(', ') || 'none';
    console.log(`  ${l.email.padEnd(35)} [${l.status.padEnd(10)}] emails: ${emailsSent}`);
  });

  console.log('\n──────────────────────────────────────────────────');
  console.log(`  Total: ${valid.length} leads`);
  console.log(`  new: ${counts.new}  invited: ${counts.invited}  signed_up: ${counts.signed_up}  listed: ${counts.listed}  upgraded: ${counts.upgraded}  cold: ${counts.cold}`);

  const placeholder = leads.filter(l => l.email.includes('PASTE_EMAIL')).length;
  if (placeholder > 0) {
    console.log(`\n  ⚠️  ${placeholder} email slots still need real addresses in leads.json`);
  }
  console.log('══════════════════════════════════════════════════\n');
}

// ── CLI ───────────────────────────────────────────────────
async function main() {
  const [,, command, ...args] = process.argv;
  const leads = loadLeads();

  if (command === 'status') {
    printStatus(leads);
    return;
  }

  if (command === 'add') {
    const [email, name = '', source = 'manual'] = args;
    if (!email) { console.log('Usage: node lead-manager.js add email@example.com "Name" "source"'); return; }
    if (leads.find(l => l.email === email)) { console.log(`${email} already exists`); return; }
    leads.push({ email, name, source, status: 'new', invited_at: null, signed_up_at: null, listed_at: null, upgraded_at: null, emails_sent: [], notes: '' });
    saveLeads(leads);
    log(`Added lead: ${email}`);
    console.log(`✅ Added ${email}`);
    return;
  }

  if (command === 'mark') {
    const [email, newStatus] = args;
    const validStatuses = ['signed_up', 'listed', 'upgraded', 'cold', 'new', 'invited'];
    if (!email || !newStatus) { console.log('Usage: node lead-manager.js mark email@example.com signed_up'); return; }
    if (!validStatuses.includes(newStatus)) { console.log(`Invalid status. Use: ${validStatuses.join(', ')}`); return; }
    const idx = leads.findIndex(l => l.email === email);
    if (idx === -1) { console.log(`${email} not found`); return; }
    leads[idx].status = newStatus;
    if (newStatus === 'signed_up') leads[idx].signed_up_at = new Date().toISOString();
    if (newStatus === 'listed')    leads[idx].listed_at    = new Date().toISOString();
    if (newStatus === 'upgraded')  leads[idx].upgraded_at  = new Date().toISOString();
    saveLeads(leads);
    log(`Marked ${email} as ${newStatus}`);
    console.log(`✅ ${email} → ${newStatus}`);
    return;
  }

  if (!command || command === 'run') {
    log('=== Lead Manager run starting ===');
    printStatus(leads);

    const valid = leads.filter(l => l.email && !l.email.includes('PASTE_EMAIL'));
    if (valid.length === 0) {
      console.log('No valid leads yet. Add emails to leads.json first.');
      return;
    }

    let emailsSent = 0;
    for (let i = 0; i < leads.length; i++) {
      if (leads[i].email.includes('PASTE_EMAIL')) continue;
      try {
        const sent = await processLead(leads[i], i, leads);
        if (sent) emailsSent++;
        // Small pause between sends
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        log(`ERROR processing ${leads[i].email}: ${e.message}`);
      }
    }
    log(`Run complete. ${emailsSent} emails sent.`);
    console.log(`\n✅ Done. ${emailsSent} emails sent this run.\n`);
    return;
  }

  console.log(`
AutomationHire Lead Manager
Usage:
  node lead-manager.js run                              → process all leads
  node lead-manager.js status                           → view dashboard
  node lead-manager.js add email@x.com "Name" "source" → add a lead
  node lead-manager.js mark email@x.com signed_up      → update status
  node lead-manager.js mark email@x.com listed
  node lead-manager.js mark email@x.com upgraded
`);
}

main().catch(e => { log(`FATAL: ${e.message}`); console.error(e); });
