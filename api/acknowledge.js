// api/acknowledge.js — HumanCover AI
// Called when owner clicks "I've Added New Keys" button in alert email
// Resets KV state so fresh keys are tried and emails stop

import { kv } from '@vercel/kv';

const ACK_TOKEN    = process.env.ACK_TOKEN || 'humancover2025secret';
const KV_EXHAUSTED = 'hc:exhausted_indices';
const KV_LAST_ALERT = 'hc:last_alert_ms';
const KV_ACKED     = 'hc:alert_acknowledged';
const SITE_URL     = 'https://humancover.vercel.app';

export default async function handler(req, res) {
  const token = req.query?.token;

  if (token !== ACK_TOKEN) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(403).send(`
      <html><body style="font-family:sans-serif;background:#050508;color:#ede8d8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;">
        <div><div style="font-size:3rem;">❌</div><h2 style="color:#ff4f6b;">Invalid or expired link</h2></div>
      </body></html>
    `);
  }

  // Reset all KV state so fresh keys work immediately
  try {
    await Promise.all([
      kv.set(KV_EXHAUSTED, []),      // clear exhausted key list
      kv.set(KV_ACKED, '1'),         // mark as acknowledged → stops future emails
      kv.del(KV_LAST_ALERT),         // reset email timer
    ]);
  } catch (e) {
    console.error('KV reset error:', e.message);
    // Still show success page — owner should redeploy anyway
  }

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Acknowledged — HumanCover AI</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Cabinet+Grotesk:wght@500;700&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Cabinet Grotesk',sans-serif;background:#050508;color:#ede8d8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
    .card{background:#0d0d14;border:1px solid #2a2a3a;border-radius:20px;padding:48px 40px;max-width:500px;width:100%;text-align:center;position:relative;overflow:hidden;}
    .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#4fffb0,transparent);}
    .icon{font-size:3.5rem;margin-bottom:20px;}
    h1{color:#4fffb0;font-size:1.5rem;margin-bottom:12px;letter-spacing:-0.02em;}
    .sub{color:#6a6558;font-size:0.85rem;line-height:1.7;margin-bottom:28px;}
    .steps{background:#14141f;border:1px solid #2a2a3a;border-radius:12px;padding:20px 24px;text-align:left;margin-bottom:28px;}
    .step{display:flex;gap:12px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #1a1a26;font-size:0.85rem;line-height:1.5;}
    .step:last-child{border-bottom:none;}
    .step-num{color:#e8c97a;font-family:'Space Mono',monospace;font-size:0.75rem;flex-shrink:0;padding-top:1px;}
    .step-text{color:#ede8d8;}
    .step-text a{color:#e8c97a;text-decoration:none;}
    .btn{display:inline-block;background:linear-gradient(135deg,#e8c97a,#f5e0a0);color:#000;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:0.95rem;}
    .note{color:#3a3a4a;font-size:0.72rem;margin-top:20px;}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Alert Stopped!</h1>
    <p class="sub">
      Email alerts for <strong style="color:#ede8d8;">HumanCover AI</strong> have been acknowledged.<br/>
      Now add fresh keys and redeploy to restore service.
    </p>
    <div class="steps">
      <div class="step"><span class="step-num">01</span><span class="step-text">Go to <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a> → create 10 new API keys</span></div>
      <div class="step"><span class="step-num">02</span><span class="step-text">Open <a href="https://vercel.com/dashboard" target="_blank">Vercel Dashboard</a> → your project → Settings → Environment Variables</span></div>
      <div class="step"><span class="step-num">03</span><span class="step-text">Update GROQ_KEY_1 through GROQ_KEY_10 with your new keys</span></div>
      <div class="step"><span class="step-num">04</span><span class="step-text">Click "Redeploy" in Vercel → service restores automatically</span></div>
    </div>
    <a class="btn" href="https://vercel.com/dashboard" target="_blank">Open Vercel Dashboard →</a>
    <p class="note">Once redeployed, the site will work again and emails will stay off.</p>
  </div>
</body>
</html>
  `);
}
