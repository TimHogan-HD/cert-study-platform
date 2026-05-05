/* api/explain.js — Vercel serverless function for AI explanations */
export default async function handler(req, res) {
  /* CORS / origin check */
  const origin = req.headers.origin || '';
  const allowed = process.env.ALLOWED_ORIGIN || '';
  if (allowed && origin !== allowed && !origin.endsWith('.vercel.app') && origin !== '') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic } = req.body || {};
  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or invalid topic' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const sanitizedTopic = topic.trim().slice(0, 200);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `You are a Network+ exam tutor. Explain "${sanitizedTopic}" in a different way than the standard textbook definition, using a memorable analogy or real-world scenario. Keep it to 3–5 sentences. Be concise, vivid, and exam-focused.`
        }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      throw new Error(`Anthropic API returned ${response.status}`);
    }

    const data = await response.json();
    const explanation = data.content?.[0]?.text || 'No explanation generated.';
    return res.status(200).json({ explanation });
  } catch (e) {
    console.error('AI explain error:', e);
    return res.status(500).json({ error: 'AI service temporarily unavailable' });
  }
}
