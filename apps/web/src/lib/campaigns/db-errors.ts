/**
 * Postgres constraint names, translated.
 *
 * Shared by the Server Actions and by the scheduled publisher, which has no
 * user to show a message to but still writes the reason onto the post row.
 */

import { MAX_ASSETS_PER_POST } from './validation';

/**
 * Turns a Postgres error into something a photographer can act on.
 *
 * The app validates before writing, so hitting one of these means a check we
 * did not think of fired — the user still deserves a sentence rather than
 * `new row for relation "campaign_posts" violates check constraint ...`.
 */
export function friendlyDbError(message: string, fallback: string): string {
  const constraints: Array<[string, string]> = [
    [
      'campaign_posts_scheduled_needs_time',
      'A scheduled post needs a date and time.',
    ],
    [
      'campaign_posts_published_needs_time',
      'A published post needs a publish time, which only the publish action can set.',
    ],
    [
      'campaign_posts_failed_needs_reason',
      'A failed post needs a failure reason.',
    ],
    [
      'campaign_posts_caption_length',
      'That caption is too long for the platform.',
    ],
    [
      'campaign_posts_asset_limit',
      `A post can carry at most ${MAX_ASSETS_PER_POST} photos.`,
    ],
    ['campaign_posts_platform_check', 'That is not a platform we can publish to.'],
    ['campaigns_platforms_valid', 'One of those platforms is not supported.'],
    [
      'campaigns_ends_after_starts',
      'The end date cannot be before the start date.',
    ],
    ['campaigns_name_check', 'Give the campaign a name.'],
  ];

  for (const [needle, friendly] of constraints) {
    if (message.includes(needle)) return friendly;
  }
  return fallback;
}
