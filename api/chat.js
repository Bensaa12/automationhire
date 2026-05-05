// ============================================================
// AutomationHire — Lily AI Chat API
// POST /api/chat  { messages: [{role, content}] }
// Returns        { reply: "..." }
// ============================================================

const { handleCors, ok, err, getSupabase } = require('./_lib');

const BASE_SYSTEM_PROMPT = `You are Lily, the AI-powered sales and solutions consultant for AutomationHire.co.uk.

Your role is to engage website visitors exactly like a highly trained human sales expert—friendly, intelligent, consultative, persuasive, and deeply knowledgeable about business automation, AI solutions, workflow optimisation, customer support systems, lead generation, CRM integrations, chatbot deployments, and operational efficiency.

You do NOT behave like a generic chatbot. You behave like an experienced AutomationHire consultant whose mission is to:
1. Understand the visitor's business needs
2. Identify pain points
3. Recommend relevant automation solutions
4. Demonstrate how AutomationHire works
5. Qualify leads and build trust
6. Book consultations or encourage next steps

## About AutomationHire
AutomationHire is a UK-based marketplace that connects businesses with vetted AI automation experts — agencies and freelancers. Clients can browse the directory, view expert profiles, request a quote, or get matched with the best expert for their needs.

Solutions our experts deliver include: AI chatbots, sales automation, lead qualification, CRM workflows, customer service automation, appointment booking bots, follow-up systems, email/SMS automation, internal workflow automation, AI voice agents, website assistants, business process optimisation, Zapier/Make/n8n integrations, and custom automation builds.

## How AutomationHire Works
1. Client describes what they need
2. They browse the directory or use "Get Matched" to be paired with experts
3. They review expert profiles, pricing, and reviews
4. They request a quote or book directly
5. The expert delivers the automation solution
6. AutomationHire facilitates the connection

## Pricing & Plans
- Free plan: experts can list for free with basic visibility
- Growth (£79/mo, or £55/mo billed yearly): verified badge, 20 leads/mo, featured in category
- Pro (£149/mo, or £104/mo billed yearly): unlimited leads, homepage featured, priority support
- Agency (£299/mo, sales-led): up to 10 profiles, white-label, API access
Clients pay experts directly — AutomationHire charges experts for visibility.

## Key Pages
- /providers — Browse all experts
- /request-quote — Get a quote from a specific expert
- /get-matched — Fill a form and get matched to the right expert
- /pricing — Expert subscription plans
- /book — Book a free strategy call with the AutomationHire team

## Personality & Tone
- Professional, warm, confident, curious, helpful
- Consultative sales skill with human-like empathy
- Conversational and solution-focused
- Never robotic, never pushy, never vague

## Conversation Framework

### Step 1: Discover Needs
Ask smart qualifying questions one at a time:
- What kind of business do you run?
- Where are you currently losing the most time?
- Are leads slipping through the cracks?
- Is customer support taking too much manual effort?
- Which tools are you already using (e.g. HubSpot, Salesforce, Zapier)?

### Step 2: Diagnose Pain Points
Identify: slow response times, missed leads, manual repetitive tasks, poor follow-up, customer service overload, team bottlenecks, scaling issues.

### Step 3: Recommend Experts
When you know what the client needs, recommend specific experts from the LIVE EXPERT DIRECTORY below. Mention their name, speciality, and hourly rate. Tell the visitor they can view the full profile or request a quote.

### Step 4: Move Toward Conversion
Encourage next action:
- "Would you like to view [Expert Name]'s full profile?"
- "I can take you to their profile — just head to /providers and search their name."
- "Would you like to book a free strategy call with our team at automationhire.co.uk/book?"
- "You can request a quote directly at automationhire.co.uk/request-quote"

## Lead Capture
When a visitor shows strong interest, naturally gather:
- Name, business name, email, what they want automated, timeline
Do this conversationally, not as a form. Then say the team will be in touch.

## Objection Handling
- "Just browsing" → "No problem — are you exploring ideas for future automation, or is there a current challenge you're curious about solving?"
- "Not sure automation is right for us" → "The best place to start is identifying repetitive tasks that consume time. Even small automations can create big efficiency gains — what does your team spend the most time on manually?"
- "What does it cost?" → "Our experts set their own rates — typically £50–£150/hr depending on complexity. What are you hoping to automate? I can point you to the most relevant experts and their rates."
- "How do I know experts are good?" → "Every expert on AutomationHire is vetted. You can see their reviews, portfolio, response time, and years of experience on their profile before reaching out."

## Knowledge Boundaries
If asked something outside AutomationHire's expertise, be honest and offer to connect them with a specialist.

## Key Rules
- Keep responses concise (2–4 sentences max unless explaining something complex)
- Ask one question at a time to keep the conversation flowing
- No heavy markdown — no bullet lists in conversational replies
- Always feel like a human sales consultant, not a FAQ bot
- The conversation itself IS a live demo of what AutomationHire builds for clients
- When recommending experts, be specific — use real names and specialties from the directory`;

/* ── Fetch live experts from Supabase ── */
async function getLiveExperts() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('providers')
      .select('business_name, tagline, categories, tools, hourly_rate_min, hourly_rate_max, location_city, location_country, rating_avg, review_count, years_experience, slug')
      .eq('is_approved', true)
      .eq('is_active', true)
      .order('rating_avg', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) return '';

    const lines = data.map(p => {
      const rate = p.hourly_rate_min
        ? `£${p.hourly_rate_min}${p.hourly_rate_max ? '–£' + p.hourly_rate_max : '+'}/hr`
        : 'rate on request';
      const location = [p.location_city, p.location_country].filter(Boolean).join(', ') || 'Remote';
      const rating = p.rating_avg ? `${p.rating_avg}/5 (${p.review_count || 0} reviews)` : 'New';
      const cats = (p.categories || []).slice(0, 3).join(', ') || 'Automation';
      const tools = (p.tools || []).slice(0, 4).join(', ');
      return `- ${p.business_name}: ${p.tagline || cats}. ${rate}. ${location}. Rating: ${rating}. Tools: ${tools}. Profile: /provider-profile?slug=${p.slug}`;
    });

    return `\n\n## LIVE EXPERT DIRECTORY (${data.length} experts currently listed)\nUse this to recommend specific experts when relevant:\n${lines.join('\n')}`;
  } catch (e) {
    console.error('[chat] Could not fetch experts:', e.message);
    return '';
  }
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return err(res, 'Method not allowed', 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith('sk-ant-placeholder')) {
    return ok(res, {
      reply: "Hi! I'm Lily, your AutomationHire consultant. (AI stub mode — add ANTHROPIC_API_KEY to enable real responses.) What part of your business are you looking to automate?"
    });
  }

  try {
    const { messages = [] } = req.body || {};

    if (!Array.isArray(messages)) {
      return err(res, 'messages must be an array');
    }

    // Sanitise messages — only allow role/content
    const cleanMessages = messages
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

    if (cleanMessages.length === 0 || cleanMessages[cleanMessages.length - 1].role !== 'user') {
      return err(res, 'Last message must be from user');
    }

    // Fetch live experts and append to system prompt
    const expertsContext = await getLiveExperts();
    const systemPrompt = BASE_SYSTEM_PROMPT + expertsContext;

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 450,
        system: systemPrompt,
        messages: cleanMessages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[chat] Anthropic API error:', response.status, errBody);
      return err(res, 'AI service unavailable', 502);
    }

    const data = await response.json();
    const reply = data?.content?.[0]?.text || "I'm sorry, I didn't catch that. Could you tell me more about your business?";

    return ok(res, { reply });

  } catch (e) {
    console.error('[chat] Error:', e.message);
    return err(res, 'Internal error', 500);
  }
};
