/**
 * Reads for the connections module.
 *
 * Token material is deliberately absent from everything a page can call.
 * `social_account_secrets` is only reachable through `readAccessToken`, which
 * demands the service-role client, so a Server Component cannot leak a token
 * into a payload by selecting `*`.
 */

import { SOCIAL_PLATFORMS, type SocialPlatform } from '@lensello/core';
import type { Session } from '@/lib/auth';
import type { Tables } from '@/lib/db.types';
import type { createAdminClient } from '@/lib/supabase/admin';
import type { PlatformLink, PlatformLinks } from './links';

type Supabase = Session['supabase'];
type Admin = ReturnType<typeof createAdminClient>;

export type SocialAccountRow = Tables<'social_accounts'>;

/** One entry per supported platform, linked or not. */
export interface ConnectionView {
  platform: SocialPlatform;
  account: SocialAccountRow | null;
}

/**
 * Normalizes a platform handle to the stored form.
 *
 * The CHECK on `client_social_handles` enforces exactly this shape, and
 * matching an inbound DM to an existing client depends on it. '@' is stripped
 * because platforms display it but do not consider it part of the handle.
 */
export function normalizeHandle(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '')
    .trim()
    .replace(/^@+/, '')
    .trim()
    .toLowerCase();

  if (!trimmed) return null;
  // Longer than any real handle on the four supported platforms; almost
  // certainly a display name or a pasted URL, and a bad matching key either way.
  if (trimmed.length > 100) return null;
  return trimmed;
}

export async function listConnections(supabase: Supabase): Promise<ConnectionView[]> {
  const { data, error } = await supabase
    .from('social_accounts')
    .select('*')
    .order('platform');

  if (error) {
    throw new Error(`Could not load linked accounts: ${error.message}`);
  }

  const byPlatform = new Map((data ?? []).map((row) => [row.platform, row]));

  // Driven by the supported-platform list, not by what happens to be in the
  // table, so an unlinked platform still gets a card offering to link it.
  return SOCIAL_PLATFORMS.map((platform) => ({
    platform,
    account: byPlatform.get(platform) ?? null,
  }));
}

/**
 * Link state for every supported platform, keyed by platform.
 *
 * A complete record rather than a list of what happens to be linked, so a
 * caller rendering a platform picker cannot accidentally omit the unlinked
 * ones — those are exactly the entries worth showing.
 */
export async function listPlatformLinks(supabase: Supabase): Promise<PlatformLinks> {
  const { data, error } = await supabase
    .from('social_accounts')
    .select('platform, handle, status, can_publish');

  if (error) {
    throw new Error(`Could not load linked accounts: ${error.message}`);
  }

  const byPlatform = new Map((data ?? []).map((row) => [row.platform, row]));

  return Object.fromEntries(
    SOCIAL_PLATFORMS.map((platform) => {
      const account = byPlatform.get(platform);
      return [
        platform,
        {
          platform,
          handle: account?.handle ?? null,
          status: account ? account.status : ('unlinked' as const),
          canPublish: account?.status === 'connected' && account.can_publish,
        } satisfies PlatformLink,
      ];
    }),
  ) as PlatformLinks;
}

/** Linked accounts that can actually be synced for messages. */
export async function listCollectableAccounts(
  supabase: Supabase,
): Promise<SocialAccountRow[]> {
  const { data, error } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('status', 'connected')
    .eq('can_collect_messages', true);

  if (error) {
    throw new Error(`Could not load linked accounts: ${error.message}`);
  }
  return data ?? [];
}

/** The connected account for a platform, or null. Used by publishing. */
export async function getPublishableAccount(
  supabase: Supabase,
  platform: SocialPlatform,
): Promise<SocialAccountRow | null> {
  const { data, error } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('platform', platform)
    .eq('status', 'connected')
    .eq('can_publish', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the ${platform} account: ${error.message}`);
  }
  return data;
}

/**
 * The access token for a linked account.
 *
 * Requires the service-role client because `social_account_secrets` has RLS on
 * and no policies. Keep the returned value inside the request that fetched it:
 * never put it in an action result, a log line, or a component prop.
 */
export async function readAccessToken(
  admin: Admin,
  accountId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('social_account_secrets')
    .select('access_token, expires_at')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) return null;

  // An expired token is treated as absent. Handing it to an adapter would
  // produce a confusing provider error instead of "reconnect this account".
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    return null;
  }
  return data.access_token;
}
