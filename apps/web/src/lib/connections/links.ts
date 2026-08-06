/**
 * Platform link types and their display strings.
 *
 * Separate from `queries.ts` because Client Components need these, and
 * `queries.ts` imports server-only modules. Keeping the types here means a
 * picker in a form can describe a connection without pulling the database
 * layer into the browser bundle.
 */

import type { SocialPlatform } from '@lensello/core';

export type PlatformLinkStatus = 'connected' | 'expired' | 'revoked' | 'unlinked';

export interface PlatformLink {
  platform: SocialPlatform;
  handle: string | null;
  status: PlatformLinkStatus;
  /** Linked, still connected, and granted posting access. */
  canPublish: boolean;
}

export type PlatformLinks = Record<SocialPlatform, PlatformLink>;

/**
 * One short phrase describing the link, for a checkbox or option label.
 *
 * "Linked but cannot post" is its own case on purpose: the account is
 * connected and the messages side may work, while posting was never granted.
 * Collapsing it into "not linked" would send someone to reconnect an account
 * that is already connected.
 */
export function linkNote(link: PlatformLink): string {
  switch (link.status) {
    case 'connected':
      return link.canPublish
        ? `@${link.handle} · connected`
        : `@${link.handle} · cannot post`;
    case 'expired':
      return 'token expired';
    case 'revoked':
      return 'access revoked';
    case 'unlinked':
      return 'not linked';
  }
}

/** Platforms this campaign targets that cannot currently be published to. */
export function unpublishablePlatforms(
  links: PlatformLinks,
  platforms: readonly SocialPlatform[],
): PlatformLink[] {
  return platforms.map((platform) => links[platform]).filter((link) => !link.canPublish);
}

/**
 * Which platforms Lensello can actually talk to: none, today.
 *
 * Instagram has an adapter but it has never run against Meta's API and there
 * are no credentials for it, so connecting it produced a simulation exactly
 * like the other three did — a green badge, an invented handle, an invented
 * follower count. Having one platform behave differently only made it harder
 * to tell which parts of the screen were real.
 *
 * A Connect button that can only ever lie is worse than no button, so none is
 * offered. The list below says what each would need instead.
 */
export const CONNECTABLE_PLATFORMS: readonly SocialPlatform[] = [];

export const UNSUPPORTED_PLATFORMS: ReadonlyArray<{
  platform: SocialPlatform;
  reason: string;
}> = [
  {
    platform: 'instagram',
    reason:
      'The adapter is written but unverified — it has never run against Meta’s API. Needs a Meta app, a Professional account linked to a Facebook Page, and App Review. Weeks, and the review is the slow part.',
  },
  {
    platform: 'facebook',
    reason:
      'Needs a Page adapter and Meta App Review. Shares the Meta app with Instagram, so it becomes cheap once that is approved.',
  },
  {
    platform: 'tiktok',
    reason:
      'Needs an adapter against TikTok’s own API and their developer approval. Nothing is written yet.',
  },
  {
    platform: 'pinterest',
    reason:
      'Needs an adapter against Pinterest’s API. It also has no messaging product, so it would be publishing only.',
  },
];

export function isConnectable(platform: SocialPlatform): boolean {
  return CONNECTABLE_PLATFORMS.includes(platform);
}
