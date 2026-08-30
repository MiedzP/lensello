import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '7d'; // Token expires in 7 days
const COOKIE_NAME = 'auth-token';

const key = new TextEncoder().encode(JWT_SECRET);

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Create a signed JWT token
 */
export async function createToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(key);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const verified = await jwtVerify(token, key);
    return verified.payload as JWTPayload;
  } catch (err) {
    return null;
  }
}

/**
 * Get the current user from the JWT cookie
 */
export async function getCurrentUser(): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    return verifyToken(token);
  } catch (err) {
    return null;
  }
}

/**
 * Set the JWT cookie (called after successful login/signup)
 */
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

/**
 * Clear the JWT cookie (called on logout)
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
