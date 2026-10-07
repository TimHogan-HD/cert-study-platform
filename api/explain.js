/* api/explain.js — Vercel serverless function for "Explain Differently" */
import { TOPICS } from './topics.js';

const MODEL = 'claude-opus-5-5';

/* Production, its redirect alias, and this project's preview deployments. ALLOWED_ORIGIN
   (comma-separated) adds more, e.g. a custom domain. */
const ORIGINS = new Set([
  'https://learnitcerts.vercel.app',
  'https://cert-study-platform.vercel.app',
  ...(process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean),
]);
const PREVIEW = /^https:\/\/cert-study-platform-[a-z0-9-]+-timhogan-hds-projects\.vercel\.app$/;
const LOCAL = /^http:\/\/localhost(:\d+)?$/;
const originAllowed = origin =>
  ORIGINS.has(origin) || PREVIEW.test(origin) || (process.env.VERCEL_ENV === 'development' && LOCAL.test(origin));

/* Only the site's own topics are answerable, so the API key cannot be used as a
   general-purpose model. tools/check.js keeps topics.js in sync with the content. */
const KNOWN_TOPICS = new Set(TOPICS);

/* Best-effort per-instance limit; instances are short-lived, so this blunts bursts
   rather than enforcing a quota. */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

const SYSTEM = `You are a CompTIA Network+ exam tutor. The user message is the name of one exam topic. \
Explain it differently from the standard textbook definition, using a memorable analogy or real-world \
scenario. Keep it to 3-5 sentences, concise, vivid, and focused on what the exam tests. Reply with the \
explanation only.`;

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (!originAllowed(origin)) return res.status(403).json({ error: 'Forbidden' });

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic } = req.body || {};
  if (typeof topic !== 'string' || !KNOWN_TOPICS.has(topic)) {
    return res.status(400).json({ error: 'Unknown topic' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many requests' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // A declined request is retried server-side on the model Anthropic recommends for that refusal category.
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        // Thinking is always on for this model and counts toward max_tokens.
        max_tokens: 2048,
        output_config: { effort: 'low' },
        fallbacks: 'default',
        system: SYSTEM,
        messages: [{ role: 'user', content: topic }],
      }),
    });

    if (!response.ok) {
      console.error('Anthropic API error:', response.status, await response.text());
      return res.status(502).json({ error: 'AI service temporarily unavailable' });
    }

    const data = await response.json();
    if (data.stop_reason === 'refusal') {
      console.error('Explanation declined:', data.stop_details?.category);
      return res.status(502).json({ error: 'No explanation available for this topic' });
    }
    // Thinking blocks come first; the answer is in the text blocks.
    const explanation = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    if (!explanation) return res.status(502).json({ error: 'No explanation generated' });
    return res.status(200).json({ explanation });
  } catch (e) {
    console.error('AI explain error:', e);
    return res.status(502).json({ error: 'AI service temporarily unavailable' });
  }
}
