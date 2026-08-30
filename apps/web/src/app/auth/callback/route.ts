import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * OAuth/password-reset callback route.
 *
 * Supabase sends the user here with a `code` search param after they
 * click a reset-password link. We exchange the code for a recovery session,
 * then redirect them to /reset-password to set a new password.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/reset-password';

  if (!code) {
    return NextResponse.redirect(new URL('/auth/error', request.url));
  }

  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Code exchange error:', error);
      return NextResponse.redirect(new URL('/auth/error', request.url));
    }

    // Code was valid and session is established. Redirect to the next page.
    // Make sure next is a safe in-app path (no open-redirect risks)
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/reset-password';
    return NextResponse.redirect(new URL(safeNext, request.url));
  } catch (err) {
    console.error('Unexpected error during code exchange:', err);
    return NextResponse.redirect(new URL('/auth/error', request.url));
  }
}
