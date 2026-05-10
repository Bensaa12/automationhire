// ============================================================
// AutomationHire — OpenAI Text-to-Speech endpoint
// POST /api/tts  { text, voice? }
// Returns        audio/mpeg stream
// ============================================================

const { handleCors, err } = require('./_lib');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return err(res, 'OpenAI API key not configured', 500);

  const { text, voice = 'nova' } = req.body || {};
  if (!text || !text.trim()) return err(res, 'text required');

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text.slice(0, 4096),
        voice,
        response_format: 'mp3',
        speed: 0.95,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[tts] OpenAI error:', response.status, errText);
      return err(res, 'TTS generation failed', 500);
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(Buffer.from(audioBuffer));

  } catch (e) {
    console.error('[tts] Error:', e.message);
    return err(res, 'Internal error', 500);
  }
};
