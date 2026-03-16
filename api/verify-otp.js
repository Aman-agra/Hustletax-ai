// api/verify-otp.js — HustleTax AI
// Verifies OTP using token returned by send-otp.js
// No shared memory needed — token contains everything

const SECRET = process.env.OTP_SECRET || 'hustletax_otp_secret_2025';

function verifyToken(token, email, otp) {
  try {
    const [dataB64, hash] = token.split('.');
    const data = atob(dataB64);
    const [tEmail, tOtp, tExpiresAt] = data.split('|');

    // Check expiry
    if (Date.now() > Number(tExpiresAt)) return { valid: false, error: 'OTP expired. Request a new one.' };

    // Check email and OTP match
    if (tEmail !== email.toLowerCase()) return { valid: false, error: 'Invalid token.' };
    if (tOtp !== otp.trim()) return { valid: false, error: 'Incorrect code. Try again.' };

    // Verify hash
    const payload = `${tEmail}|${tOtp}|${tExpiresAt}|${SECRET}`;
    let expectedHash = 0;
    for (let i = 0; i < payload.length; i++) {
      expectedHash = ((expectedHash << 5) - expectedHash) + payload.charCodeAt(i);
      expectedHash |= 0;
    }
    if (Math.abs(expectedHash).toString(36) !== hash) return { valid: false, error: 'Invalid token.' };

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid token.' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, otp, token } = req.body || {};
  if (!email || !otp || !token) return res.status(400).json({ error: 'Missing fields' });

  const result = verifyToken(token, email, otp);
  if (!result.valid) return res.status(400).json({ error: result.error });

  return res.status(200).json({ success: true });
}