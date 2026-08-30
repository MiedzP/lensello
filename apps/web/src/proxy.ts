import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Renamed from `middleware` in Next.js 16 — the file must be `proxy.ts` and the
 * export must be named `proxy`. Node.js runtime only; `edge` is unsupported here.
 *
 * Two jobs: refresh the Supabase session cookie (Server Components can't set
 * cookies, so it has to happen here), and bounce unauthenticated visitors to
 * the login page.
 *
 * This is a convenience gate, not a security boundary. RLS is what actually
 * protects data.
 */

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  // Invitation links. The person opening one has no account yet — that is
  // what they are for.
  '/join',
  '/auth/callback',
  '/auth/error',
  // The public enquiry form. Bouncing a prospective client to a login screen
  // would lose the enquiry entirely.
  '/inquire',
  // Client galleries. Access is the unguessable token in the URL, not a
  // session — asking a wedding couple to make an account to see their own
  // photographs is how galleries go unseen.
  '/g',
  // Contract acceptance. Same reasoning as galleries: the client signing is
  // not a user of the studio's workspace and must not be given a session.
  '/c',
  // Where Stripe returns a client after checkout. They have no account.
  '/paid',
  // The client portal. A client signing in here gets a portal session scoped to
  // their own record — deliberately not a Supabase session, which would put
  // them inside the studio's RLS perimeter. It authenticates itself.
  '/portal',
  // Public API, authenticated by an API key rather than a cookie. Refusing it
  // here would bounce every key-holding caller to a login page.
  '/api/v1',
  // Cron endpoints have no session to refresh and would be bounced to /login.
  // They are not unprotected: each one checks CRON_SECRET itself and refuses
  // to run when it is unset.
  '/api/cron',
  // Same for provider webhooks, which authenticate with their own shared
  // secret and likewise fail closed when it is missing.
  '/api/webhooks',
];

/** Signed-in visitors have no use for these and are sent to the dashboard. */
const SIGNED_OUT_ONLY = ['/login', '/signup', '/forgot-password'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes the auth token as a side effect. Must run before any redirect
  // decision so an expiring session is renewed rather than bounced.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!user && !isPublic) {
    const loginUrl = new URL('/login', request.url);
    // Preserve intent so login can return the user where they were headed.
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && SIGNED_OUT_ONLY.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  // Skip static assets and image optimization; they don't need a session.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)'],
};
