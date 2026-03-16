// api/send-otp.js — HustleTax AI
// Generates OTP, sends via Resend, returns signed token to client
// Token = base64(email:otp:expiresAt) — verified in verify-otp.js

const RESEND_KEY = process.env.RESEND_API_KEY;
const OTP_EXPIRY = 10 * 60 * 1000; // 10 min
const SECRET = process.env.OTP_SECRET || 'hustletax_otp_secret_2025';

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Simple HMAC-like signature using secret
function signToken(email, otp, expiresAt) {
  const payload = `${email}|${otp}|${expiresAt}|${SECRET}`;
  // Simple hash — good enough for OTP use case
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) - hash) + payload.charCodeAt(i);
    hash |= 0;
  }
  const data = `${email}|${otp}|${expiresAt}`;
  return btoa(data) + '.' + Math.abs(hash).toString(36);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });
  if (!RESEND_KEY) return res.status(500).json({ error: 'Email service not configured' });

  const otp = generateOTP();
  const expiresAt = Date.now() + OTP_EXPIRY;
  const token = signToken(email.toLowerCase(), otp, expiresAt);

  const html = `
<!DOCTYPE html><html>
<body style="margin:0;padding:32px;background:#06080f;font-family:Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#0d1018;border-radius:16px;border:1px solid #1a1f2e;overflow:hidden;">
    <div style="padding:28px 32px;text-align:center;border-bottom:1px solid #1a1f2e;">
      <div style="font-size:1.3rem;font-weight:800;color:#c8f135;">HustleTax AI</div>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#edeae0;font-size:1.1rem;margin:0 0 8px;">Password Reset Code</h2>
      <p style="color:#5a5e6a;font-size:0.85rem;margin:0 0 24px;">Use this code to reset your password. Expires in 10 minutes.</p>
      <div style="background:#131720;border:1px solid #1a1f2e;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px;">
        <div style="font-size:2.6rem;font-weight:800;letter-spacing:0.35em;color:#c8f135;font-family:monospace;">${otp}</div>
        <div style="color:#5a5e6a;font-size:0.68rem;margin-top:8px;letter-spacing:0.1em;">EXPIRES IN 10 MINUTES</div>
      </div>
      <p style="color:#5a5e6a;font-size:0.75rem;">If you didn't request this, ignore this email.</p>
    </div>
  </div>
</body></html>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: 'HustleTax AI <onboarding@resend.dev>',
        to: email,
        subject: `${otp} — your HustleTax reset code`,
        html,
      }),
    });
    if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e?.message || 'Resend failed'); }

    // Return token to client — client sends it back with verify-otp
    return res.status(200).json({ success: true, token });

  } catch (e) {
    console.error('send-otp error:', e.message);
    return res.status(500).json({ error: 'Failed to send email. Try again.' });
  }
}