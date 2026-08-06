/**
 * OAuth callback: the provider sends the browser back here with a code.
 *
 * A route handler rather than a Server Action because the provider performs a
 * plain top-level GET — there is no form to submit and no action id to carry.
 *
 * Everything this returns to the page is a fixed `reason` code, never a message
 * built from the query string. Reflecting attacker-supplied text onto a signed-in
 * page is a phishing surface even when React escapes it, and the operator-useful
 * detail belongs in the server log, not in a URL the user can edit.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@lensello/core';
import { getIntegrations } from '@lensello/core/integrations';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  OAUTH_STATE_COOKIE,
  callbackUrl,
  decodeState,
  resolveOrigin,
  statesMatch,
} from '@/lib/connections/oauth';

type Reason = 'denied' | 'state' | 'exchange' | 'store' | 'platform';

function isSupported(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

function back(origin: string, params: Record<string, string>): NextResponse {
  const url = new URL('/connections', origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(
  request: Request,
  context: RouteContext<'/connections/callback/[platform]'>,
) {
  const origin = await resolveOrigin();
  const { platform: rawPlatform } = await context.params;

  // The cookie is single-use regardless of how this turns out. Leaving a
  // consumed state behind would let a replayed callback be accepted twice.
  const cookieStore = await cookies();
  const stored = decodeState(cookieStore.get(OAUTH_STATE_COOKIE)?.value);
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!isSupported(rawPlatform)) {
    return back(origin, { reason: 'platform' satisfies Reason });
  }
  const platform: SocialPlatform = rawPlatform;

  // A signed-out caller has no business completing a link, and `requireUser`
  // throws rather than redirecting, so translate it here.
  let session;
  try {
    session = await requireUser();
  } catch {
    return NextResponse.redirect(new URL('/login?next=%2Fconnections', origin));
  }
  const { supabase, user } = session;

  const query = new URL(request.url).searchParams;

  // The user pressed "Cancel" on the consent screen, or the provider refused.
  if (query.get('error')) {
    return back(origin, { reason: 'denied' satisfies Reason, platform });
  }

  const code = query.get('code');
  const state = query.get('state');

  if (
    !code ||
    !state ||
    !stored ||
    stored.platform !== platform ||
    !statesMatch(stored.state, state)
  ) {
    return back(origin, { reason: 'state' satisfies Reason, platform });
  }

  let connection;
  try {
    connection = await getIntegrations().social.completeAuthorization({
      platform,
      code,
      redirectUri: callbackUrl(origin, platform),
    });
  } catch (cause) {
    console.error(`[connections] ${platform} token exchange failed`, cause);
    return back(origin, { reason: 'exchange' satisfies Reason, platform });
  }

  // Upsert on the platform: re-linking an account that already exists has to
  // update the existing row, not collide with social_accounts_one_per_platform.
  const { data: account, error: accountError } = await supabase
    .from('social_accounts')
    .upsert(
      {
        platform,
        handle: connection.handle,
        display_name: connection.displayName,
        followers: connection.followers,
        status: 'connected',
        external_account_id: connection.externalAccountId,
        can_publish: connection.canPublish,
        can_collect_messages: connection.canCollectMessages,
        connected_by: user.id,
        connected_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: 'platform' },
    )
    .select('id')
    .single();

  if (accountError || !account) {
    console.error(`[connections] could not store the ${platform} account`, accountError);
    return back(origin, { reason: 'store' satisfies Reason, platform });
  }

  // Service role: social_account_secrets has RLS on and no policies, so the
  // staff session that got this far still cannot write a token.
  const admin = createAdminClient();
  const { error: secretError } = await admin.from('social_account_secrets').upsert(
    {
      account_id: account.id,
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
      expires_at: connection.expiresAt,
      scopes: connection.scopes,
    },
    { onConflict: 'account_id' },
  );

  if (secretError) {
    // A linked row with no token would look connected and fail on every use.
    // Removing it makes the failure honest and the retry obvious.
    await supabase.from('social_accounts').delete().eq('id', account.id);
    console.error(`[connections] could not store the ${platform} token`, secretError);
    return back(origin, { reason: 'store' satisfies Reason, platform });
  }

  revalidatePath('/connections');
  return back(origin, { linked: platform });
}
