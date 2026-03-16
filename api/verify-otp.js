// api/verify-otp.js — HustleTax AI
// Verifies OTP entered by user

// Same in-memory store — must be same serverless instance
// Note: in production with high traffic use Redis/KV, but fine for this scale
const otpStore = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, otp } = req.body || {};
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

  const entry = otpStore.get(email.toLowerCase());

  // No OTP found
  if (!entry) return res.status(400).json({ error: 'No OTP found. Request a new one.' });

  // Expired
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return res.status(400).json({ error: 'OTP expired. Request a new one.' });
  }

  // Wrong OTP
  if (entry.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Incorrect OTP. Try again.' });
  }

  // Valid — delete OTP so it can't be reused
  otpStore.delete(email.toLowerCase());
  return res.status(200).json({ success: true });
}
