// api/send-otp.js — HustleTax AI
// Generates a 6-digit OTP, stores it in memory, sends via Resend

// In-memory OTP store: { email: { otp, expiresAt } }
const otpStore = new Map();

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: 'Email service not configured' });

  // Generate OTP and store it
  const otp = generateOTP();
  otpStore.set(email.toLowerCase(), {
    otp,
    expiresAt: Date.now() + OTP_EXPIRY_MS
  });

  // Send email via Resend
  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:32px;background:#06080f;font-family:Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#0d1018;border-radius:16px;border:1px solid #1a1f2e;overflow:hidden;">
    <div style="padding:32px;text-align:center;border-bottom:1px solid #1a1f2e;">
      <div style="font-family:Arial;font-size:1.4rem;font-weight:800;color:#c8f135;letter-spacing:-0.02em;">
        HustleTax AI
      </div>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#edeae0;font-size:1.2rem;margin:0 0 8px;">Password Reset</h2>
      <p style="color:#5a5e6a;font-size:0.88rem;margin:0 0 28px;line-height:1.6;">
        Use this OTP to reset your password. It expires in 10 minutes.
      </p>
      <div style="background:#131720;border:1px solid #1a1f2e;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
        <div style="font-size:2.4rem;font-weight:800;letter-spacing:0.3em;color:#c8f135;font-family:monospace;">
          ${otp}
        </div>
        <div style="color:#5a5e6a;font-size:0.72rem;margin-top:8px;letter-spacing:0.1em;">
          EXPIRES IN 10 MINUTES
        </div>
      </div>
      <p style="color:#5a5e6a;font-size:0.78rem;line-height:1.6;margin:0;">
        If you didn't request this, ignore this email. Your password won't change.
      </p>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #1a1f2e;text-align:center;">
      <p style="color:#2a2f3e;font-size:0.68rem;margin:0;">HustleTax AI — Tax clarity for the global gig economy</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'HustleTax AI <onboarding@resend.dev>',
        to: email,
        subject: `${otp} is your HustleTax AI reset code`,
        html,
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      console.error('Resend error:', JSON.stringify(err));
      return res.status(500).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ success: true });

  } catch (e) {
    console.error('Send OTP error:', e.message);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
