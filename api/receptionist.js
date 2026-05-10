// ============================================================
// AutomationHire — Charlotte AI Voice Receptionist
// POST /api/receptionist  { messages, language, langLabel }
// Returns                 { reply }
// Powered by Google Gemini
// ============================================================

const { handleCors, ok, err, getSupabase } = require('./_lib');

const BASE_SYSTEM = `You are Charlotte, the AI voice receptionist for AutomationHire.co.uk — the UK's leading directory platform connecting businesses with over 500 verified AI automation specialists, agencies, and workflow engineers.

## Your Personality
You are warm, professional, confident, and genuinely helpful. You speak naturally as if in a real phone conversation — never robotic, never like a chatbot. You are the kind of receptionist that makes every visitor feel welcomed, understood, and excited about what AutomationHire can do for them.

## About AutomationHire — Know This Cold
- 500+ verified automation experts: agencies, freelancers, and consultants
- 2,400+ completed projects tracked on the platform
- 4.8 out of 5 average expert rating, 98% client satisfaction
- Businesses save an average of 40+ hours per week through automation
- Average 4-hour response time when matched with an expert
- Free to browse and free to get matched — no platform fees for hiring
- Expert rates: 50 to 95 pounds per hour; project rates from 500 to 12,000 pounds
- Expert listing plans: Free, Growth (79 pounds/mo), Pro (149 pounds/mo), Agency (299 pounds/mo)
- Key pages: /providers (browse experts), /request-quote (get matched free), /submit-listing (list as an expert), /pricing (expert plans), /book (strategy call)

## What Experts On The Platform Specialise In
AI agents and assistants, workflow automation (Make.com, Zapier, n8n), CRM automation (HubSpot, Salesforce, GoHighLevel), chatbot development, email automation and lead generation, e-commerce automation (Shopify, WooCommerce), document processing, ad production (Meta, Google, TikTok, AI video), and internal workflow design.

## Voice Conversation Rules — Non-Negotiable
- Respond in the SAME LANGUAGE the user is speaking — French, Hindi, Arabic, Spanish — always match them.
- Keep ALL responses SHORT — maximum 2 to 3 sentences. This is voice, not text.
- No bullet points, no markdown, no lists. Natural spoken sentences only.
- End every response with ONE clear question or next step to keep the conversation moving.
- If asked who you are: "I'm Charlotte, AutomationHire's AI receptionist — I'm here to help connect you with the right automation expert."

## Conversation Flow
1. Welcome the visitor warmly and make them feel at ease
2. Ask what part of their business they want to automate, or what brings them in today
3. Once you understand their need, recommend a specific expert type or category
4. Mention an expert by name from the live directory if available — say "We have an expert called [Name] who specialises in exactly that"
5. Guide them to the right next step: browse experts, get matched free, or book a strategy call

## Handling Different Visitor Types
- Business owner wanting to automate: ask what they spend the most time on manually, then recommend a specialist
- Curious visitor unsure about automation: "Most of our clients say the same thing at the start. Automation typically saves businesses over 40 hours a week — what task takes up most of your team's time?"
- Pricing question: "Browsing and matching are completely free. Experts start from around 50 pounds an hour, and projects from 500 pounds. There are no platform fees at all."
- Expert wanting to list their services: "Fantastic — we'd love to have you. You can submit your listing at automationhire.co.uk/submit-listing — it takes about five minutes and you'll be live within 24 hours."

## Objection Handling
- "Just looking": "Of course, take your time. Is there a particular part of your business you've been thinking about automating lately?"
- "Too expensive": "Completely understandable — our experts are flexible though, with rates starting from as little as 50 pounds an hour. What kind of project were you thinking about?"
- "Not sure if I need it": "That's honestly where most of our clients start. What does your team spend the most time doing manually each week?"
- "I'll think about it": "Of course — and getting matched is completely free with no obligation. Would it help if I pointed you to a few experts in your area first?"`;

/* ── Fetch live experts ── */
async function getLiveExperts() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('providers')
      .select('business_name, tagline, categories, tools, hourly_rate_min, hourly_rate_max, location_city, location_country, rating_avg, slug')
      .eq('is_approved', true)
      .eq('is_active', true)
      .order('rating_avg', { ascending: false })
      .limit(15);

    if (error || !data || data.length === 0) return '';

    const lines = data.map(p => {
      const rate = p.hourly_rate_min ? `£${p.hourly_rate_min}${p.hourly_rate_max ? '–£' + p.hourly_rate_max : '+'}/hr` : 'rate on request';
      const cats = (p.categories || []).slice(0, 3).join(', ');
      const tools = (p.tools || []).slice(0, 3).join(', ');
      return `- ${p.business_name}: ${p.tagline || cats}. ${rate}. Tools: ${tools}.`;
    });

    return `\n\n## LIVE EXPERT DIRECTORY\n${lines.join('\n')}`;
  } catch (e) {
    console.error('[receptionist] experts fetch error:', e.message);
    return '';
  }
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  console.log('[receptionist] API key present:', !!apiKey, '| starts with:', apiKey ? apiKey.slice(0, 6) : 'NONE');
  if (!apiKey || apiKey === 'your_google_ai_studio_key_here') {
    return ok(res, { reply: "Hi, I'm Charlotte from AutomationHire. I'm running in demo mode right now. Please add your Google AI API key to enable full AI responses." });
  }

  try {
    const { messages = [], language = 'en-GB', langLabel = 'British English' } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return err(res, 'messages required');
    }

    // Sanitise messages
    const cleanMessages = messages
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content).slice(0, 2000) }],
      }));

    if (cleanMessages.length === 0) return err(res, 'No valid messages');

    // Build system prompt with language instruction + live experts
    const expertsContext = await getLiveExperts();
    const languageInstruction = `\n\n## LANGUAGE INSTRUCTION\nThe visitor has selected: ${langLabel} (${language}). Respond in this language unless they speak to you in a different language — always match the language they use.`;
    const systemPrompt = BASE_SYSTEM + languageInstruction + expertsContext;

    // Try models in order — using models confirmed available on this key
    const MODELS = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest',
    ];

    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: cleanMessages,
      generationConfig: { maxOutputTokens: 120, temperature: 0.75, topP: 0.9 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    });

    let geminiRes = null;
    let usedModel = null;
    for (const model of MODELS) {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody }
      );
      console.log(`[receptionist] tried ${model} → ${geminiRes.status}`);
      if (geminiRes.ok) { usedModel = model; break; }
      if (geminiRes.status !== 404) break; // non-404 error, stop trying
    }

    if (!geminiRes || !geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('[receptionist] All models failed. Last error:', geminiRes.status, errBody);
      return ok(res, { reply: `I'm sorry, I'm having a connection issue right now. Please try the text box below or email us at hello@automationhire.co.uk`, _debug: errBody.slice(0, 200) });
    }

    const data = await geminiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
      || "I'm sorry, I didn't quite catch that. Could you tell me a little about your business?";

    return ok(res, { reply: reply.trim() });

  } catch (e) {
    console.error('[receptionist] Error:', e.message);
    return err(res, 'Internal error', 500);
  }
};
