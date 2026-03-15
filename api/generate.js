// api/generate.js — HumanCover AI
// 10-key rotation with Vercel KV persistence (works across all serverless instances)
// Emails both owners when all keys dead, repeats every 6hrs until acknowledged
//
// SETUP REQUIRED IN VERCEL DASHBOARD:
// 1. Storage tab → Create KV Database → it auto-sets KV_URL, KV_REST_API_* env vars
// 2. Add GROQ_KEY_1 through GROQ_KEY_10
// 3. Add RESEND_API_KEY (from resend.com, free)
// 4. Add ACK_TOKEN = any secret string you choose

import { kv } from '@vercel/kv';

const GROQ_KEYS = [
  process.env.GROQ_KEY_1,  process.env.GROQ_KEY_2,
  process.env.GROQ_KEY_3,  process.env.GROQ_KEY_4,
  process.env.GROQ_KEY_5,  process.env.GROQ_KEY_6,
  process.env.GROQ_KEY_7,  process.env.GROQ_KEY_8,
  process.env.GROQ_KEY_9,  process.env.GROQ_KEY_10,
].filter(Boolean);

const SITE_NAME  = 'HumanCover AI';
const SITE_URL   = 'https://humancover.vercel.app';
const ALERT_EMAILS = ['amanagrawal69420@gmail.com', 'gurdeepsaxena123@gmail.com'];
const ACK_TOKEN  = process.env.ACK_TOKEN || 'humancover2025secret';
const SIX_HOURS  = 6 * 60 * 60 * 1000;

// Vercel KV keys
const KV_EXHAUSTED   = 'hc:exhausted_indices'; // array of exhausted key indices
const KV_LAST_ALERT  = 'hc:last_alert_ms';     // timestamp of last email sent
const KV_ACKED       = 'hc:alert_acknowledged'; // "1" when owner clicked button

async function callGroq(key, systemPrompt, userPrompt) {
  return fetch('https://api.groq.com/openai/v1/chat/completions', {
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
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });
}

async function sendAlertEmail() {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) { console.error('No RESEND_API_KEY'); return; }

  const ackLink = `${SITE_URL}/api/acknowledge?token=${encodeURIComponent(ACK_TOKEN)}`;
  const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:32px;background:#050508;font-family:Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#0d0d14;border-radius:16px;border:1px solid #2a2a3a;overflow:hidden;">
  <div style="background:linear-gradient(135deg,rgba(232,201,122,0.15),rgba(232,201,122,0.03));padding:32px;text-align:center;border-bottom:1px solid #2a2a3a;">
    <div style="font-size:3rem;margin-bottom:12px;">🚨</div>
    <h1 style="color:#e8c97a;margin:0;font-size:1.4rem;">All API Keys Exhausted</h1>
    <p style="color:#6a6558;font-size:0.78rem;margin:8px 0 0;letter-spacing:0.08em;">
      ALERT FROM: <strong style="color:#ede8d8;">${SITE_NAME} — ${SITE_URL}</strong>
    </p>
  </div>
  <div style="padding:32px;">
    <p style="color:#ede8d8;line-height:1.7;margin:0 0 16px;">
      All <strong style="color:#e8c97a;">${GROQ_KEYS.length} Groq API keys</strong> on 
      <strong>${SITE_NAME}</strong> have hit their rate limits. 
      Users <strong style="color:#ff4f6b;">cannot generate cover letters</strong> right now.
    </p>
    <div style="background:#14141f;border-radius:10px;padding:16px;margin:0 0 20px;font-size:0.82rem;">
      <div style="color:#6a6558;margin-bottom:4px;">🕐 Time: <span style="color:#ede8d8;">${time} IST</span></div>
      <div style="color:#6a6558;margin-bottom:4px;">🌐 Site: <span style="color:#ede8d8;">${SITE_URL}</span></div>
      <div style="color:#6a6558;">🔑 Keys: <span style="color:#ff4f6b;">All ${GROQ_KEYS.length} exhausted</span></div>
    </div>
    <p style="color:#ede8d8;line-height:1.9;margin:0 0 24px;font-size:0.9rem;">
      <strong>Steps to fix:</strong><br/>
      1. <a href="https://console.groq.com/keys" style="color:#e8c97a;">console.groq.com/keys</a> → create new keys<br/>
      2. Vercel Dashboard → Project → Settings → Environment Variables<br/>
      3. Update GROQ_KEY_1 through GROQ_KEY_10 → Redeploy<br/>
      4. Click the button below to stop these emails
    </p>
    <div style="text-align:center;">
      <a href="${ackLink}" style="display:inline-block;background:linear-gradient(135deg,#e8c97a,#f5e0a0);color:#000;font-weight:700;padding:16px 36px;border-radius:10px;text-decoration:none;font-size:1rem;">
        ✅ I've Added New Keys — Stop Emails
      </a>
    </div>
    <p style="color:#3a3a4a;font-size:0.7rem;text-align:center;margin-top:20px;">
      This email repeats every 6 hours until the button above is clicked.
    </p>
  </div>
</div></body></html>`;

  for (const email of ALERT_EMAILS) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'HumanCover AI Alerts <onboarding@resend.dev>',
          to: email,
          subject: `🚨 [${SITE_NAME}] All API Keys Exhausted — Fix Required`,
          html,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) console.error(`Resend failed for ${email}:`, JSON.stringify(body));
      else console.log(`Alert sent to ${email}`);
    } catch (e) {
      console.error(`Email error ${email}:`, e.message);
    }
  }

  await kv.set(KV_LAST_ALERT, Date.now());
}

async function maybeAlert() {
  try {
    // Don't send if owner already acknowledged
    const acked = await kv.get(KV_ACKED);
    if (acked) return;

    const lastSent = await kv.get(KV_LAST_ALERT);
    if (!lastSent || (Date.now() - Number(lastSent)) >= SIX_HOURS) {
      await sendAlertEmail();
    }
  } catch (e) {
    // KV unavailable — send anyway (better to over-notify than miss)
    console.error('KV error in maybeAlert:', e.message);
    try { await sendAlertEmail(); } catch {}
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { systemPrompt, userPrompt } = req.body || {};
  if (!systemPrompt || !userPrompt) {
    return res.status(400).json({ error: 'Missing prompts' });
  }

  // Load exhausted key indices from KV (shared across all instances)
  let exhaustedSet = new Set();
  try {
    const stored = await kv.get(KV_EXHAUSTED);
    if (Array.isArray(stored)) exhaustedSet = new Set(stored);
  } catch (e) {
    console.error('KV read error:', e.message);
    // Degraded mode — continue without persistence
  }

  let anyNewlyExhausted = false;

  for (let i = 0; i < GROQ_KEYS.length; i++) {
    if (exhaustedSet.has(i)) continue;

    try {
      const groqRes = await callGroq(GROQ_KEYS[i], systemPrompt, userPrompt);

      if (groqRes.status === 429) {
        // Rate limited — mark this key exhausted
        exhaustedSet.add(i);
        anyNewlyExhausted = true;
        continue;
      }

      if (!groqRes.ok) {
        const err = await groqRes.json().catch(() => ({}));
        // Persist any newly exhausted keys before returning
        if (anyNewlyExhausted) {
          kv.set(KV_EXHAUSTED, [...exhaustedSet]).catch(() => {});
        }
        return res.status(groqRes.status).json({ error: err?.error?.message || 'AI error' });
      }

      // ✅ Success
      if (anyNewlyExhausted) {
        kv.set(KV_EXHAUSTED, [...exhaustedSet]).catch(() => {});
      }
      const data = await groqRes.json();
      return res.status(200).json(data);

    } catch {
      continue; // network error — try next key
    }
  }

  // All keys exhausted
  try {
    await kv.set(KV_EXHAUSTED, [...exhaustedSet]);
  } catch {}

  maybeAlert(); // fire and forget — don't block response

  return res.status(503).json({
    error: 'AI temporarily at capacity. Our team has been notified. Please try again soon.'
  });
}
