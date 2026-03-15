// api/support.js — HumanCover AI — Hana Support AI
// Same 10-key rotation as generate.js, using shared KV state
// Always available to ALL users regardless of trial/paywall status

import { kv } from '@vercel/kv';

const GROQ_KEYS = [
  process.env.GROQ_KEY_1,  process.env.GROQ_KEY_2,
  process.env.GROQ_KEY_3,  process.env.GROQ_KEY_4,
  process.env.GROQ_KEY_5,  process.env.GROQ_KEY_6,
  process.env.GROQ_KEY_7,  process.env.GROQ_KEY_8,
  process.env.GROQ_KEY_9,  process.env.GROQ_KEY_10,
].filter(Boolean);

const KV_EXHAUSTED = 'hc:exhausted_indices'; // shared with generate.js

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length > 22) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // Load exhausted keys from shared KV
  let exhaustedSet = new Set();
  try {
    const stored = await kv.get(KV_EXHAUSTED);
    if (Array.isArray(stored)) exhaustedSet = new Set(stored);
  } catch {}

  let anyNewlyExhausted = false;

  for (let i = 0; i < GROQ_KEYS.length; i++) {
    if (exhaustedSet.has(i)) continue;

    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEYS[i]}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.7,
          max_tokens: 300,
        }),
      });

      if (groqRes.status === 429) {
        exhaustedSet.add(i);
        anyNewlyExhausted = true;
        continue;
      }

      if (!groqRes.ok) {
        if (anyNewlyExhausted) kv.set(KV_EXHAUSTED, [...exhaustedSet]).catch(() => {});
        const err = await groqRes.json().catch(() => ({}));
        return res.status(groqRes.status).json({ error: err?.error?.message || 'AI error' });
      }

      if (anyNewlyExhausted) kv.set(KV_EXHAUSTED, [...exhaustedSet]).catch(() => {});
      const data = await groqRes.json();
      return res.status(200).json(data);

    } catch {
      continue;
    }
  }

  if (anyNewlyExhausted) kv.set(KV_EXHAUSTED, [...exhaustedSet]).catch(() => {});

  return res.status(503).json({
    error: 'Support AI temporarily unavailable. Email support@humancover.ai'
  });
}
