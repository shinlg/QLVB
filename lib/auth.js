import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'SuperSecretKeyForQLVB2026SecureAuthentication!@#'
);

export async function getUserIdFromRequest(request) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.userId || null;
  } catch (err) {
    return null;
  }
}