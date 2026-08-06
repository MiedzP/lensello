/**
 * Publishing one campaign post.
 *
 * Extracted from the Server Actions so the scheduled publisher can reuse it
 * verbatim. It takes the Supabase client as an argument rather than resolving
 * one itself: an action passes the caller's session client so RLS applies, and
 * the cron passes the service-role client because a cron has no session. The
 * publishing rules must not differ between those two paths.
 *
 * All outbound traffic goes through `getIntegrations().social`; this module
 * never calls a platform API itself. On failure the row is parked in `failed`
 * with the reason, which is what the detail page surfaces.
 */

import { getIntegrations } from '@lensello/core/integrations';
import type { PostStatus } from '@lensello/core';
import type { Tables } from '@/lib/db.types';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getPublishableAccount,
  readAccessToken,
} from '@/lib/connections/queries';
import {
  PUBLISH_URL_TTL_SECONDS,
  getAssetsByIds,
  signPhotoUrls,
  type Db,
} from './queries';
import { PUBLISHABLE_STATUSES } from './validation';
import { friendlyDbError } from './db-errors';

export interface PublishOutcome {
  ok: boolean;
  /** One line, safe to show the user. */
  detail: string;
}

/**
 * Publishes one post through the social adapter.
 *
 * All outbound traffic goes through `getIntegrations().social`; this module
 * never calls a platform API itself. On failure the row is parked in `failed`
 * with the reason, which is what the detail page surfaces.
 */
export async function publishOnePost(
  db: Db,
  post: Tables<'campaign_posts'>,
): Promise<PublishOutcome> {
  const label = `${post.platform} post`;

  if (!PUBLISHABLE_STATUSES.includes(post.status as PostStatus)) {
    return {
      ok: false,
      detail:
        post.status === 'published'
          ? `${label}: already published.`
          : `${label}: approve it before publishing.`,
    };
  }

  if (post.caption.trim().length === 0) {
    return { ok: false, detail: `${label}: write a caption first.` };
  }

  if (post.asset_ids.length === 0) {
    return {
      ok: false,
      detail: `${label}: attach at least one photo — every platform we publish to needs an image.`,
    };
  }

  // Photos live in a private bucket, so the platform gets long-lived signed
  // URLs: it fetches the image itself, sometimes well after the API call.
  const assets = await getAssetsByIds(db, post.asset_ids);
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const paths = post.asset_ids.flatMap((assetId) => {
    const asset = byId.get(assetId);
    return asset ? [asset.storage_path] : [];
  });

  const signed = await signPhotoUrls(db, paths, PUBLISH_URL_TTL_SECONDS);
  const imageUrls = paths.flatMap((path) => {
    const url = signed.get(path);
    return url ? [url] : [];
  });

  if (imageUrls.length !== post.asset_ids.length) {
    // Nothing was sent anywhere, so the post keeps its current status.
    return {
      ok: false,
      detail: `${label}: could not create signed URLs for every attached photo. Nothing was published.`,
    };
  }

  // Resolved outside the try: a misconfigured integration registry is an
  // environment problem, and parking the post in `failed` over it would blame
  // the content for something the content cannot fix.
  let social;
  try {
    social = getIntegrations().social;
  } catch (cause) {
    return {
      ok: false,
      detail: `${label}: publishing is not configured — ${
        cause instanceof Error ? cause.message : 'no social adapter is available.'
      }`,
    };
  }

  // An unlinked platform is the same class of problem: an environment gap, not
  // a content one, so the post keeps its status and stays publishable once the
  // account is linked on /connections.
  const account = await getPublishableAccount(db, post.platform);
  if (!account) {
    return {
      ok: false,
      detail: `${label}: ${post.platform} is not linked. Link it on Connections, then publish.`,
    };
  }

  const accessToken = await readAccessToken(createAdminClient(), account.id);
  if (!accessToken) {
    return {
      ok: false,
      detail: `${label}: the ${post.platform} token has expired. Reconnect the account on Connections.`,
    };
  }

  try {
    const result = await social.publish({
      platform: post.platform,
      caption: post.caption,
      hashtags: post.hashtags,
      imageUrls,
      accessToken,
    });

    const { error } = await db
      .from('campaign_posts')
      .update({
        status: 'published',
        published_at: result.publishedAt,
        external_id: result.externalId,
        failure_reason: null,
      })
      .eq('id', post.id);

    if (error) {
      // Worth being loud about: it is live on the platform but our row says
      // otherwise, and only the id in this message can reconcile it.
      return {
        ok: false,
        detail: `${label}: published as ${result.externalId} but the record could not be updated. ${friendlyDbError(error.message, 'Please retry.')}`,
      };
    }

    return { ok: true, detail: `${label}: published.` };
  } catch (cause) {
    // The schema requires a non-null reason on a failed post, and a blank one
    // would render as "Publishing failed." with nothing to act on.
    const raw = cause instanceof Error ? cause.message.trim() : '';
    const reason = raw.length > 0 ? raw : 'The platform rejected the post.';

    const { error } = await db
      .from('campaign_posts')
      .update({
        status: 'failed',
        failure_reason: reason.slice(0, 500),
      })
      .eq('id', post.id);

    return {
      ok: false,
      detail: error
        ? `${label}: failed (${reason}). The failure could not be recorded.`
        : `${label}: failed — ${reason}`,
    };
  }
}
