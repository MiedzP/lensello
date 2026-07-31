/**
 * Input validation for the campaigns module.
 *
 * Two kinds of untrusted input arrive here and both are treated the same way:
 *
 * 1. Form data — a Server Action is reachable by direct POST, so the fields are
 *    whatever the caller felt like sending.
 * 2. Model output — `generateJson` returns `unknown` shaped only by a prompt.
 *    A hallucinated platform must be rejected here, not by a Postgres CHECK
 *    constraint surfacing as a 500 in the user's face.
 */

import { z } from 'zod';
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_STATUSES,
  POST_STATUSES,
  SOCIAL_PLATFORMS,
  type PostStatus,
  type SocialPlatform,
} from '@lensello/core';

/** Instagram's cap, and the tightest of the four platforms. Mirrors the CHECK. */
export const MAX_CAPTION_LENGTH = 2200;
/** Instagram carousel cap. Mirrors the CHECK in 0003_campaigns.sql. */
export const MAX_ASSETS_PER_POST = 10;
export const MAX_HASHTAGS = 15;
export const MIN_POST_COUNT = 1;
/**
 * Eight is as many as one `generateJson` call reliably fits inside its token
 * budget; more than that starts getting truncated mid-JSON.
 */
export const MAX_POST_COUNT = 8;

// --- shared field helpers -----------------------------------------------

/**
 * '' and whitespace become null, so an untouched optional input clears the
 * column. Deliberately not `.catch(null)`: swallowing an over-long value would
 * silently delete what the user wrote instead of telling them it is too long.
 */
const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Keep this under ${max} characters.`)
    .transform((value) => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    });

const optionalDate = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: 'Use a valid date, or leave the field empty.',
  })
  .transform((value) => (value === '' ? null : value));

const platformList = z
  .array(z.enum(SOCIAL_PLATFORMS))
  .min(1, 'Pick at least one platform.')
  .transform((platforms) => [...new Set(platforms)]);

export const objectiveSchema = z.enum(CAMPAIGN_OBJECTIVES);
export const campaignStatusSchema = z.enum(CAMPAIGN_STATUSES);
export const postStatusSchema = z.enum(POST_STATUSES);
export const platformSchema = z.enum(SOCIAL_PLATFORMS);
export const uuidSchema = z.uuid('That is not a valid id.');

// --- campaign creation --------------------------------------------------

export const createCampaignSchema = z
  .object({
    // Optional: when generating, the model proposes the name.
    name: optionalText(120),
    objective: objectiveSchema,
    platforms: platformList,
    audience: optionalText(500),
    brief: optionalText(2000),
    postCount: z.coerce
      .number()
      .int('Choose a whole number of posts.')
      .min(MIN_POST_COUNT, `At least ${MIN_POST_COUNT} post.`)
      .max(MAX_POST_COUNT, `At most ${MAX_POST_COUNT} posts per generation.`),
    startsOn: optionalDate,
    endsOn: optionalDate,
    /** The client asks; `isAiConfigured()` decides. */
    mode: z.enum(['generate', 'manual']).catch('manual'),
  })
  .refine(
    (value) =>
      value.startsOn === null ||
      value.endsOn === null ||
      value.endsOn >= value.startsOn,
    { message: 'The end date cannot be before the start date.', path: ['endsOn'] },
  );

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

// --- campaign metadata --------------------------------------------------

export const updateCampaignSchema = z
  .object({
    campaignId: uuidSchema,
    name: z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value.length > 0, { message: 'Give the campaign a name.' })
      .refine((value) => value.length <= 120, {
        message: 'Keep the name under 120 characters.',
      }),
    objective: objectiveSchema,
    status: campaignStatusSchema,
    platforms: platformList,
    audience: optionalText(500),
    brief: optionalText(2000),
    startsOn: optionalDate,
    endsOn: optionalDate,
  })
  .refine(
    (value) =>
      value.startsOn === null ||
      value.endsOn === null ||
      value.endsOn >= value.startsOn,
    { message: 'The end date cannot be before the start date.', path: ['endsOn'] },
  );

// --- posts --------------------------------------------------------------

export const updatePostContentSchema = z.object({
  postId: uuidSchema,
  caption: z
    .string()
    .max(
      MAX_CAPTION_LENGTH,
      `Captions are capped at ${MAX_CAPTION_LENGTH} characters — Instagram will reject anything longer.`,
    )
    .transform((value) => value.trim()),
  hashtags: z
    .string()
    .max(1000, 'That is more hashtag text than any platform will accept.'),
});

export const addPostSchema = z.object({
  campaignId: uuidSchema,
  platform: platformSchema,
  caption: z
    .string()
    .max(MAX_CAPTION_LENGTH, `Captions are capped at ${MAX_CAPTION_LENGTH} characters.`)
    .transform((value) => value.trim()),
});

export const postStatusChangeSchema = z.object({
  postId: uuidSchema,
  status: postStatusSchema,
  /** Only read when moving to `scheduled`. */
  scheduledFor: z.string().catch(''),
});

/**
 * Which status moves the UI offers, and the action enforces.
 *
 * `published` is deliberately absent from every list: a post becomes published
 * only by going through the social adapter, so that a published row always has
 * an `external_id` that corresponds to something real. `failed` likewise is set
 * by the publish path, never chosen.
 */
export const ALLOWED_POST_TRANSITIONS: Record<PostStatus, readonly PostStatus[]> = {
  draft: ['approved'],
  approved: ['draft', 'scheduled'],
  scheduled: ['approved', 'draft'],
  published: [],
  failed: ['draft', 'approved'],
};

/** Statuses the publish action accepts as a starting point. */
export const PUBLISHABLE_STATUSES: readonly PostStatus[] = [
  'approved',
  'scheduled',
  'failed',
];

// --- sanitizers ---------------------------------------------------------

/**
 * Normalises a hashtag: no '#', lowercase, no spaces or punctuation. Platforms
 * silently drop malformed tags, so cleaning them is more useful than rejecting.
 */
export function normalizeHashtags(input: readonly string[]): string[] {
  const seen = new Set<string>();

  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    for (const piece of raw.split(/[\s,]+/)) {
      const tag = piece
        .trim()
        .toLowerCase()
        .replace(/^#+/, '')
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 40);
      if (tag.length > 0) seen.add(tag);
      if (seen.size >= MAX_HASHTAGS) break;
    }
    if (seen.size >= MAX_HASHTAGS) break;
  }

  return [...seen];
}

/** Parses the free-text hashtag input on a post card. */
export function parseHashtagInput(input: string): string[] {
  return normalizeHashtags([input]);
}

export function sanitizeCaption(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    // Collapse the run-on blank lines models like to emit.
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_CAPTION_LENGTH);
}

// --- model output -------------------------------------------------------

/**
 * The shape `buildCampaignPlanPrompt` asks for. Everything is loose on purpose:
 * a plan that is 90% usable should not be thrown away because the model added a
 * stray field or omitted `angle`.
 */
export const campaignPlanResponseSchema = z.object({
  name: z.string().optional(),
  posts: z
    .array(
      z.object({
        platform: z.string(),
        angle: z.string().optional(),
        caption: z.string().optional(),
        hashtags: z.array(z.unknown()).optional(),
      }),
    )
    .default([]),
});

/** The shape `buildCaptionPrompt` asks for. */
export const captionResponseSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.unknown()).optional(),
});

export interface PlannedPost {
  platform: SocialPlatform;
  caption: string;
  hashtags: string[];
}

export interface PlanReview {
  posts: PlannedPost[];
  /** Human-readable reasons posts were discarded, for the UI to report. */
  rejections: string[];
}

/**
 * Turns a parsed plan into rows we are willing to insert.
 *
 * A post is dropped — not corrected — when its platform was never requested.
 * Silently reassigning it would publish to an account the user did not choose.
 */
export function reviewPlannedPosts(
  posts: readonly {
    platform: string;
    caption?: string;
    hashtags?: readonly unknown[];
  }[],
  requestedPlatforms: readonly SocialPlatform[],
  limit: number,
): PlanReview {
  const allowed = new Set<string>(requestedPlatforms);
  const accepted: PlannedPost[] = [];
  const rejections: string[] = [];

  for (const post of posts) {
    if (accepted.length >= limit) {
      rejections.push('Extra posts beyond the number requested were discarded.');
      break;
    }

    const platform = String(post.platform ?? '')
      .trim()
      .toLowerCase();

    if (!allowed.has(platform)) {
      rejections.push(
        `A post for "${platform || 'an unnamed platform'}" was discarded — that platform was not selected.`,
      );
      continue;
    }

    const caption = sanitizeCaption(String(post.caption ?? ''));
    if (caption.length === 0) {
      rejections.push(`An empty ${platform} caption was discarded.`);
      continue;
    }

    accepted.push({
      // Safe: `allowed` only ever contains SocialPlatform values.
      platform: platform as SocialPlatform,
      caption,
      hashtags: normalizeHashtags(
        (post.hashtags ?? []).filter(
          (tag): tag is string => typeof tag === 'string',
        ),
      ),
    });
  }

  // Collapse repeats so the notice reads as a summary, not a log.
  return { posts: accepted, rejections: [...new Set(rejections)] };
}

/** First message from a ZodError, or a generic fallback. */
export function firstIssue(error: z.ZodError, fallback = 'Check the form and try again.'): string {
  return error.issues[0]?.message ?? fallback;
}
