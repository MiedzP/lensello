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
