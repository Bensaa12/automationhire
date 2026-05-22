// ============================================================
// POST /api/sharon
// Sharon voice receptionist — Claude Haiku, Sharon persona
// Body: { messages: [{role, content}] }
// Returns: { reply: "..." }
// ============================================================

const { handleCors, ok, err, getSupabase } = require('./_lib');

const SHARON_SYSTEM = `You are Sharon, the AI receptionist and guide for AutomationHire — the UK's leading directory platform connecting businesses with verified AI automation specialists, agencies, and workflow engineers. You are professional, warm, confident, and knowledgeable. You speak with clarity and enthusiasm about automation, and your job is to make every visitor feel welcomed, informed, and excited about what AutomationHire can do for their business.

## The Platform
AutomationHire (automationhire.co.uk) is a UK-based directory platform that connects businesses with over 500 verified AI automation experts — including agencies, freelancers, and consultants.

## Key Facts
- 500+ verified automation providers
- 2,400+ completed projects
- 4.8/5 average expert rating, 98% client satisfaction
- Average 4-hour response time when matched
- Businesses save 40+ hours per week on average
- Free to browse and get matched — no platform fees
- Expert rates: £50–£95/hr; projects from £500–£12,000+

## Automation Categories
AI Agents, Workflow Automation (Make.com, Zapier, n8n), CRM Automation (HubSpot, Salesforce), Chatbot Development, Email & Lead Generation, E-Commerce Automation, Document Processing, Ad Production.

## Key Pages
- Browse experts: automationhire.co.uk/providers
- Free match: automationhire.co.uk/request-quote
- List as provider: automationhire.co.uk/submit-listing

## How to Handle Visitors
- Business owners → Ask what they want to automate, recommend the right expert category, direct to free matching
- Unsure about automation → Educate warmly, mention 40h/week savings, make it feel achievable
- Pricing questions → Transparent: free to browse/match, experts set own rates from £50/hr
- Experts wanting to list → Direct to submit-listing page warmly

## Style Rules (CRITICAL for voice)
- VOICE OUTPUT: Keep every response to 1–3 short sentences maximum. You are being read aloud — no bullet points, no markdown, no lists, no asterisks, no symbols.
- Natural spoken English only. Use contractions. Sound warm and human.
- Ask only one question at a time.
- Never use dashes, colons, slashes, or any formatting characters in your reply.
- End each reply with either a helpful statement or a single conversational question.`;

async function getLiveExperts() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('providers')
      .select('business_name, tagline, categories, hourly_rate_min, hourly_rate_max, slug')
      .eq('is_approved', true)
      .eq('is_active', true)
      .order('rating_avg', { ascending: false })
      .limit(10);

    if (error || !data?.length) return '';

    const lines = data.map(p => {
      const rate = p.hourly_rate_min ? `£${p.hourly_rate_min}/hr` : 'rate on request';
      return `${p.business_name}: ${p.tagline || ''}. ${rate}.`;
    });
    return `\n\nLive experts on the platform: ${lines.join(' | ')}`;
  } catch {
    return '';
  }
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith('sk-ant-placeholder')) {
    return ok(res, {
      reply: "Welcome to AutomationHire! I'm Sharon, your AI guide. What brings you in today?"
    });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  const { messages = [] } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return err(res, 'messages required');
  }

  const clean = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) }));

  if (!clean.length || clean[clean.length - 1].role !== 'user') {
    return err(res, 'Last message must be from user');
  }

  try {
    const expertsCtx = await getLiveExperts();
    const systemPrompt = SHARON_SYSTEM + expertsCtx;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: systemPrompt,
        messages: clean,
      }),
    });

    if (!response.ok) {
      console.error('[sharon] Anthropic error:', response.status);
      return err(res, 'AI unavailable', 502);
    }

    const data = await response.json();
    const reply = data?.content?.[0]?.text?.trim()
      || "I'm sorry, could you say that again?";

    return ok(res, { reply });
  } catch (e) {
    console.error('[sharon] Error:', e.message);
    return err(res, 'Internal error', 500);
  }
};
