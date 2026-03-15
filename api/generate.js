// api/generate.js — HustleTax AI
// Simple key rotation — no KV needed

const GROQ_KEYS = [
  process.env.GROQ_KEY_1,
  process.env.GROQ_KEY_2,
  process.env.GROQ_KEY_3,
  process.env.GROQ_KEY_4,
  process.env.GROQ_KEY_5,
].filter(Boolean);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

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