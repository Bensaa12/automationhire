// ============================================================
// AutomationHire — Aria AI Voice Receptionist
// POST /api/receptionist  { messages, language, langLabel }
// Returns                 { reply }
// Powered by Google Gemini
// ============================================================

const { handleCors, ok, err, getSupabase } = require('./_lib');

const BASE_SYSTEM = `You are Aria, the AI voice receptionist for AutomationHire.co.uk — a UK-based marketplace connecting businesses with vetted AI automation experts.

## Your Role
You are the first point of contact for anyone visiting AutomationHire. You are warm, professional, intelligent, and helpful. You speak naturally as if in a real phone conversation — not like a chatbot.

## About AutomationHire
- UK-based marketplace for AI automation experts (agencies and freelancers)
- Clients hire experts to automate: sales, customer support, lead generation, CRM workflows, chatbots, email/SMS automation, AI voice agents, appointment booking, internal workflows, Zapier/Make/n8n integrations
- Experts list their profiles — clients browse, request quotes, or get matched
- Plans for experts: Free, Growth (£79/mo), Pro (£149/mo), Agency (£299/mo, sales-led)
- Key pages: /providers (browse experts), /get-matched (get paired), /request-quote (send brief), /pricing (plans), /book (strategy call)

## Voice Conversation Rules
- Respond in the SAME LANGUAGE the user is speaking — if they speak French, reply in French; Hindi, reply in Hindi; etc.
- Keep ALL responses SHORT — maximum 2-3 sentences. This is voice, not text.
- No bullet points, no markdown, no lists. Speak in natural sentences.
- Be warm and conversational, like a real receptionist on the phone.
- End every response with ONE clear question or next step to keep the conversation flowing.
- If the user asks who you are: "I'm Aria, AutomationHire's AI receptionist. I'm here to help connect your business with the right automation expert."

## Conversation Goal
1. Greet and make the visitor feel welcome
2. Understand their business and what they want to automate
3. Recommend a specific expert from the directory when relevant (name them by name)
4. Guide them to book a call, browse experts, or request a quote
5. Capture their interest and direct them to the right next step

## Expert Recommendations
When you know what the visitor needs, mention experts by name from the directory. Say things like:
"We have an expert called [Name] who specialises in exactly that — would you like me to tell you more about them?"

## Objection Handling (spoken style)
- "Just looking" → "Of course, take your time. Is there a particular part of your business you've been thinking about automating?"
- "Too expensive" → "Our experts have flexible rates — some start from as little as fifty pounds an hour. What kind of project were you thinking about?"
- "Not sure if I need it" → "That's a really common starting point. Most of our clients say the same thing before they automate. What does your team spend the most time on manually?"`;

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
    return ok(res, { reply: "Hi, I'm Aria from AutomationHire. I'm running in demo mode right now. Please add your Google AI API key to enable full AI responses." });
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
