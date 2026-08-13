/**
 * Prompt construction for Lensello's AI features.
 *
 * Pure functions only — no SDK, no network. They build the system prompt and
 * user message; `apps/web/src/lib/ai.ts` does the calling. Keeping them pure
 * means prompts are unit-testable and reviewable as text.
 */

import type {
  Asset,
  Campaign,
  CampaignObjective,
  Client,
  Message,
  ShootType,
  SocialPlatform,
} from '../types';
import { CAMPAIGN_OBJECTIVE_LABELS, SHOOT_TYPE_LABELS } from '../types';

export interface Prompt {
  system: string;
  user: string;
}

/**
 * Shared voice definition. Every feature inherits this so campaign copy, ad
 * copy, and client replies all sound like the same studio.
 */
const BRAND_VOICE = `
You write for Lensello, a photography studio. Their voice:
- Warm and direct. Speaks to one person, not an audience.
- Concrete over flowery. "The light came through the barn doors at 6pm" beats
  "magical golden moments captured forever."
- Never uses: "capture your special day", "timeless memories", "let us tell
  your story", "magical", "dream team", or exclamation stacking.
- Confident about craft without being precious about it.
- Emoji: at most one, and only when it genuinely adds warmth. Usually zero.
`.trim();

const PLATFORM_GUIDANCE: Record<SocialPlatform, string> = {
  instagram:
    'Instagram: 1-3 short paragraphs, up to ~600 characters. Lead with a ' +
    'specific detail or a line of real dialogue, not a greeting. A soft ' +
    'call-to-action at the end is fine; a hard sell is not.',
  facebook:
    'Facebook: slightly longer and more narrative than Instagram, up to ~800 ' +
    'characters. An older audience — plain language, no platform slang.',
  tiktok:
    'TikTok: one or two punchy lines, under 150 characters, written as a hook ' +
    'for a video. Present tense.',
  pinterest:
    'Pinterest: descriptive and searchable, under 200 characters. Read as a ' +
    'useful caption for someone planning an event, and front-load keywords ' +
    'like location, season, and shoot type.',
};

function describeAssets(assets: readonly Asset[]): string {
  if (assets.length === 0) {
    return 'No photos were selected, so keep the copy about the offering rather than describing specific images.';
  }

  const lines = assets.map((asset, index) => {
    const parts = [`${index + 1}.`];
    parts.push(asset.altText ?? asset.filename);
    if (asset.tags.length > 0) parts.push(`[tags: ${asset.tags.join(', ')}]`);
    return parts.join(' ');
  });

  return `The post features these photos, in order:\n${lines.join('\n')}`;
}

/** Copy for one social post within a campaign. */
export function buildCaptionPrompt(input: {
  platform: SocialPlatform;
  campaign: Pick<Campaign, 'name' | 'objective' | 'brief' | 'audience'>;
  assets: readonly Asset[];
  shootType: ShootType | null;
}): Prompt {
  const { platform, campaign, assets, shootType } = input;

  const context = [
    `Campaign: ${campaign.name}`,
    `Goal: ${CAMPAIGN_OBJECTIVE_LABELS[campaign.objective]}`,
    campaign.audience ? `Audience: ${campaign.audience}` : null,
    shootType ? `Shoot type: ${SHOOT_TYPE_LABELS[shootType]}` : null,
    campaign.brief ? `Photographer's notes: ${campaign.brief}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    system: `${BRAND_VOICE}\n\n${PLATFORM_GUIDANCE[platform]}\n\nReturn JSON matching exactly: {"caption": string, "hashtags": string[]}. Provide 5-12 hashtags, lowercase, no "#" prefix, mixing broad reach tags with location- and niche-specific ones. No commentary outside the JSON.`,
    user: `${context}\n\n${describeAssets(assets)}\n\nWrite the ${platform} caption.`,
  };
}

/** A full campaign plan: several posts across the chosen platforms. */
export function buildCampaignPlanPrompt(input: {
  objective: CampaignObjective;
  platforms: readonly SocialPlatform[];
  audience: string | null;
  brief: string | null;
  postCount: number;
  availableShootTypes: readonly ShootType[];
}): Prompt {
  const { objective, platforms, audience, brief, postCount, availableShootTypes } =
    input;

  const context = [
    `Goal: ${CAMPAIGN_OBJECTIVE_LABELS[objective]}`,
    `Platforms: ${platforms.join(', ')}`,
    audience ? `Audience: ${audience}` : null,
    brief ? `Photographer's notes: ${brief}` : null,
    availableShootTypes.length > 0
      ? `Work available to draw from: ${availableShootTypes
          .map((type) => SHOOT_TYPE_LABELS[type])
          .join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    system: `${BRAND_VOICE}

You are planning a short social campaign for a photography studio. Each post
should do distinct work — vary the angle across the set: one behind-the-scenes,
one client-outcome, one craft or process detail, one direct offer. Do not write
${postCount} variations of the same post.

Return JSON matching exactly:
{"name": string, "posts": [{"platform": string, "angle": string, "caption": string, "hashtags": string[]}]}

"name" is a short internal campaign name. "angle" is a 3-6 word internal label
describing that post's job. Produce exactly ${postCount} posts, distributed
across the requested platforms. No commentary outside the JSON.`,
    user: `${context}\n\nPlan the campaign.`,
  };
}

/** A reply draft for a client inquiry. Always human-reviewed before sending. */
export function buildClientReplyPrompt(input: {
  client: Pick<Client, 'name' | 'stage' | 'source'>;
  /** Conversation so far, oldest first. */
  thread: readonly Pick<Message, 'direction' | 'subject' | 'body' | 'sentAt'>[];
  /** Facts the reply may state. Anything absent must not be invented. */
  facts: {
    isDateAvailable: boolean | null;
    startingPriceCents: number | null;
    typicalTurnaroundDays: number | null;
    travelPolicy: string | null;
  };
}): Prompt {
  const { client, thread, facts } = input;

  const transcript = thread
    .map((message) => {
      const who = message.direction === 'inbound' ? client.name : 'Lensello';
      const subject = message.subject ? ` (re: ${message.subject})` : '';
      return `${who}${subject}:\n${message.body}`;
    })
    .join('\n\n---\n\n');

  const knownFacts = [
    facts.isDateAvailable === null
      ? 'Date availability: unknown — do not claim the date is open or booked.'
      : `Date availability: ${facts.isDateAvailable ? 'the requested date is open' : 'the requested date is already booked'}.`,
    facts.startingPriceCents === null
      ? 'Pricing: not provided — do not quote a number.'
      : `Pricing starts at $${(facts.startingPriceCents / 100).toFixed(0)}.`,
    facts.typicalTurnaroundDays === null
      ? 'Turnaround: not provided — do not promise a timeline.'
      : `Typical delivery turnaround: ${facts.typicalTurnaroundDays} days.`,
    facts.travelPolicy ?? 'Travel policy: not provided — do not invent one.',
  ].join('\n');

  return {
    system: `${BRAND_VOICE}

You are drafting a reply from Lensello to a prospective or existing client.

Hard rules:
- State ONLY facts given below. If something is marked unknown or not
  provided, do not guess, estimate, or hedge into a number. Instead, either
  omit it or say you will follow up with it.
- Never invent prices, dates, availability, package contents, or timelines.
- Answer the questions the client actually asked, in the order they asked them.
- End with one clear next step.
- 120-200 words. Plain text, no markdown. Sign off as "Lensello".
- This draft will be reviewed by a human before sending, but write it as if it
  were going out as-is.

Return JSON matching exactly: {"subject": string, "body": string}. No commentary outside the JSON.`,
    user: `Client: ${client.name} (stage: ${client.stage}, came from: ${client.source})

Facts you may use:
${knownFacts}

Conversation so far:
${transcript}

Draft the reply.`,
  };
}

/** Ad creative variants for split-testing. */
export function buildAdCopyPrompt(input: {
  shootType: ShootType;
  audience: string | null;
  offer: string | null;
  variantCount: number;
}): Prompt {
  const { shootType, audience, offer, variantCount } = input;

  const context = [
    `Service: ${SHOOT_TYPE_LABELS[shootType]} photography`,
    audience ? `Audience: ${audience}` : null,
    offer ? `Offer: ${offer}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    system: `${BRAND_VOICE}

You are writing paid social ad creative. Constraints:
- headline: under 40 characters, no period at the end.
- primaryText: under 125 characters — it must not truncate in the feed.
- callToAction: choose one of "Book now", "Learn more", "Get quote", "See portfolio", "Check availability".
- Each variant must test a genuinely different angle (price, outcome, urgency,
  social proof, curiosity). Not reworded twins.
- No claims about awards, rankings, or client counts — those cannot be verified.

Return JSON matching exactly:
{"variants": [{"angle": string, "headline": string, "primaryText": string, "callToAction": string}]}

Produce exactly ${variantCount} variants. "angle" is a short internal label. No commentary outside the JSON.`,
    user: `${context}\n\nWrite the ad variants.`,
  };
}

/** Alt text / description for a photo, used to ground later caption generation. */
export function buildAltTextPrompt(): Prompt {
  return {
    system:
      'You describe photographs for a photography studio\'s asset library. ' +
      'Write one sentence, under 140 characters, naming the subject, setting, ' +
      'and light. Concrete and factual — this is indexing metadata, not marketing ' +
      'copy. Return JSON matching exactly: {"altText": string}. No commentary outside the JSON.',
    user: 'Describe this photograph.',
  };
}

// --- studio: interpreting a plain-English brief -------------------------

/**
 * Turns a photographer's free-text request ("a post about the groom's
 * speech") into the structured search the studio module runs against
 * `asset_ai_labels` and `assets.tags`.
 *
 * There is no vision model wired into `generateJson` — this reasons about the
 * *words* of the brief only, same as the heuristic fallback the studio module
 * uses when no key is configured. It is a better parser than the heuristic,
 * not a different kind of input.
 */
export function buildStudioInterpretPrompt(input: {
  prompt: string;
  knownShootTypes: readonly ShootType[];
}): Prompt {
  const { prompt, knownShootTypes } = input;

  return {
    system: `You turn a photography studio's plain-English request into a structured
photo search over an existing library. The library is indexed by short,
lowercase, single-concept labels (e.g. "speech", "confetti", "first dance",
"beach"), not by sentences — so break the request into the concrete concepts
someone would tag a photo with, not a restatement of the sentence.

Shoot types in this studio's library: ${knownShootTypes.join(', ') || 'unknown'}.

Return JSON matching exactly:
{"summary": string, "labels": string[], "shootType": string | null, "count": number, "notes": string | null}

- "summary" restates the request in one short sentence, for the photographer to confirm.
- "labels": 2-8 lowercase, single-concept search terms. Split compound ideas
  ("groom's speech") into their parts ("speech", "groom"). No sentences, no
  hashtags, no duplicates.
- "shootType": one of the known shoot types above if the request implies one, else null.
- "count": how many photos were asked for. Read a number if one was stated
  ("10 photos"); otherwise use a sensible default for a single social post (10).
- "notes": anything else worth carrying forward (a mood, an exclusion), or null.

No commentary outside the JSON.`,
    user: `The photographer typed: "${prompt}"\n\nInterpret it.`,
  };
}

// --- studio: captioning a photograph from what is already known ---------

/**
 * Describes a photograph without looking at it.
 *
 * `generateJson` sends text only — nothing here attaches image bytes to the
 * request. So this grounds the model in metadata that already exists (the
 * filename, the photographer's own tags, any existing alt text, the shoot it
 * belongs to) and asks it to describe *that*, explicitly forbidding it from
 * inventing visual detail no one gave it. That is a real limitation: it
 * produces a better-written summary of known facts, not a new observation
 * about the image. True vision captioning needs `generateJson` (or a
 * dedicated path) to carry image content, which does not exist yet.
 */
export function buildAssetAnalysisPrompt(input: {
  filename: string;
  existingTags: readonly string[];
  existingAltText: string | null;
  shootType: ShootType | null;
  shootTitle: string | null;
}): Prompt {
  const { filename, existingTags, existingAltText, shootType, shootTitle } = input;

  const known = [
    `Filename: ${filename}`,
    shootTitle ? `Shoot: ${shootTitle}` : null,
    shootType ? `Shoot type: ${SHOOT_TYPE_LABELS[shootType]}` : null,
    existingTags.length > 0 ? `Photographer's tags: ${existingTags.join(', ')}` : null,
    existingAltText ? `Existing description: ${existingAltText}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    system: `You index photographs for a photography studio's library so staff can find
them later by describing what they want in plain English.

You are NOT shown the photograph. Work only from the facts given below — do
not invent a subject, setting, or moment that is not implied by them. If the
facts are thin, write a short, honest, generic caption and propose fewer, more
cautious labels rather than guessing specifics.

Return JSON matching exactly:
{"caption": string, "labels": [{"label": string, "kind": string, "confidence": number}]}

- "caption": one factual sentence, under 140 characters.
- "labels": 1-6 lowercase, single-concept tags. "kind" is one of: subject,
  scene, moment, emotion, object, colour, people. "confidence" is 0-1, and
  should be lower (under 0.5) when a label is inferred rather than stated in
  the facts.

No commentary outside the JSON.`,
    user: `${known || 'No metadata is available for this photograph.'}\n\nDescribe it.`,
  };
}
