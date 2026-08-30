import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Renamed from `middleware` in Next.js 16 — the file must be `proxy.ts` and the
 * export must be named `proxy`. Node.js runtime only; `edge` is unsupported here.
 *
 * With custom JWT auth, the proxy simply:
 * 1. Check if the user has a valid JWT token (no refresh needed)
 * 2. Bounce unauthenticated visitors to the login page
 *
 * No more calls to Supabase auth API. This is a convenience gate, not a security
 * boundary. RLS is what actually protects data.
 */

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const COOKIE_NAME = 'auth-token';
const key = new TextEncoder().encode(JWT_SECRET);

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  // Invitation links
  '/join',
  '/auth/error',
  // Public enquiry form
  '/inquire',
  // Client galleries and contracts (token-based, not session-based)
  '/g',
  '/c',
  // Stripe return
  '/paid',
  // Client portal (separate auth)
  '/portal',
  // Public API (API-key auth)
  '/api/v1',
  // Cron (CRON_SECRET auth)
  '/api/cron',
  // Webhooks (provider secret auth)
  '/api/webhooks',
];

/** Signed-in visitors have no use for these and are sent to the dashboard. */
const SIGNED_OUT_ONLY = ['/login', '/signup', '/forgot-password', '/reset-password'];

/**
 * Verify JWT from cookie
 */
async function verifyToken(token: string) {
  try {
    const verified = await jwtVerify(token, key);
    return verified.payload;
  } catch (err) {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if path is public
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  // Get JWT from cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  // Redirect unauthenticated visitors to login (unless path is public)
  if (!user && !isPublic) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect signed-in visitors away from auth-only pages
  if (user && SIGNED_OUT_ONLY.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Allow the request
  return NextResponse.next();
}

export const config = {
  // Skip static assets and image optimization; they don't need a session.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)'],
};
