// api/generate.js — HustleTax AI
// Key rotation + IP throttling (10 requests/day per IP)

const GROQ_KEYS = [
  process.env.GROQ_KEY_1,
  process.env.GROQ_KEY_2,
  process.env.GROQ_KEY_3,
  process.env.GROQ_KEY_4,
  process.env.GROQ_KEY_5,
].filter(Boolean);

// In-memory IP store — resets on cold start (good enough for serverless)
// Each entry: { count, resetAt }
const ipStore = new Map();

const DAILY_LIMIT = 10;      // max requests per IP per day
const ONE_DAY_MS  = 86400000; // 24 hours in ms

function checkIPThrottle(ip) {
  const now = Date.now();
  const entry = ipStore.get(ip);

  if (!entry || now > entry.resetAt) {
    // First request or window expired — reset
    ipStore.set(ip, { count: 1, resetAt: now + ONE_DAY_MS });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }

  if (entry.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: DAILY_LIMIT - entry.count };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Get real IP (Vercel sets x-forwarded-for)
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

  // Check throttle
  const throttle = checkIPThrottle(ip);
  if (!throttle.allowed) {
    return res.status(429).json({ error: 'Daily limit reached. Try again tomorrow or upgrade for unlimited access.' });
  }

  const { systemPrompt, userPrompt, max_tokens } = req.body || {};
  if (!systemPrompt || !userPrompt) {
    return res.status(400).json({ error: 'Missing prompts' });
  }

  // Try each key until one works
  for (const key of GROQ_KEYS) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: max_tokens || 1200,
          response_format: { type: 'json_object' },
        }),
      });

      if (r.status === 429) continue; // rate limited — try next key
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err?.error?.message || 'AI error' });
      }

      const data = await r.json();
      return res.status(200).json(data);

    } catch {
      continue;
    }
  }

  return res.status(503).json({ error: 'AI temporarily at capacity. Please try again in a minute.' });
}
