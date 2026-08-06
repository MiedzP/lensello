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
 * Which platforms Lensello can actually talk to.
 *
 * Only Instagram has a live adapter, and even that is unverified. Facebook,
 * TikTok and Pinterest have none — the Meta adapter rejects them outright, and
 * nothing else implements them. Offering a Connect button for those produced a
 * convincing simulation and nothing else: a green "Connected" badge, an
 * invented follower count, and no path to making any of it real.
 *
 * So they are listed as unavailable rather than offered. A button that can only
 * ever lie is worse than no button.
 */
export const CONNECTABLE_PLATFORMS: readonly SocialPlatform[] = ['instagram'];

export const UNSUPPORTED_PLATFORMS: ReadonlyArray<{
  platform: SocialPlatform;
  reason: string;
}> = [
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
