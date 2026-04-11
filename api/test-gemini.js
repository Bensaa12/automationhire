// ============================================================
// Temporary diagnostic — DELETE after fixing
// GET /api/test-gemini
// ============================================================
module.exports = async function handler(req, res) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ error: 'GOOGLE_AI_API_KEY is not set in Vercel env vars' });
  }

  // List available models for this key
  const listRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  const listData = await listRes.json();

  if (!listRes.ok) {
    return res.status(200).json({
      keyPrefix: apiKey.slice(0, 8) + '...',
      listStatus: listRes.status,
      error: listData,
    });
  }

  const models = (listData.models || []).map(m => m.name);

  // Try a simple generateContent call with the first flash model found
  const flashModel = models.find(m => m.includes('flash')) || 'models/gemini-1.5-flash';
  const genRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${flashModel}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Say hello in one word.' }] }],
      }),
    }
  );
  const genData = await genRes.json();

  return res.status(200).json({
    keyPrefix: apiKey.slice(0, 8) + '...',
    keyLength: apiKey.length,
    availableModels: models,
    testModel: flashModel,
    testStatus: genRes.status,
    testReply: genData?.candidates?.[0]?.content?.parts?.[0]?.text || null,
    testError: genRes.ok ? null : genData,
  });
};
