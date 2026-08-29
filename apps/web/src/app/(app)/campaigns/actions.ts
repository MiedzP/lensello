'use server';

/**
 * Every mutation for the campaigns module.
 *
 * Two rules hold everywhere in this file:
 *
 * 1. `requireUser()` first, always. These functions are reachable by direct
 *    POST; a button that only renders for staff proves nothing about the caller.
 * 2. Nothing from the client — or from the model — reaches the database without
 *    passing a schema in `@/lib/campaigns/validation` first.
 *
 * Cache invalidation uses `revalidatePath`. `updateTag`/`cacheTag` would be the
 * read-your-writes tool of choice, but tagging requires data cached under
 * `'use cache'`, and every read here is a cookie-scoped Supabase query that is
 * dynamic by construction and cannot be cached. `revalidatePath` from a Server
 * Action updates the UI for the affected path immediately, which is the same
 * outcome for this data.
 */

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  CAMPAIGN_OBJECTIVE_LABELS,
  type PostStatus,
  type SocialPlatform,
} from '@lensello/core';
import { buildCampaignPlanPrompt, buildCaptionPrompt } from '@lensello/core/ai';
import { requireUser } from '@/lib/auth';
import { AiError, generateJson, isAiConfigured } from '@/lib/ai';
import { friendlyDbError } from '@/lib/campaigns/db-errors';
import { publishOnePost } from '@/lib/campaigns/publish';
import type { Tables, TablesInsert } from '@/lib/db.types';
import { failed, ok, type ActionState } from '@/lib/campaigns/action-state';
import {
  getAssetsByIds,
  getCampaign,
  getCampaignPost,
  listAvailableShootTypes,
  listLibraryPhotos,
  shootTypeForAssets,
  toDomainAsset,
  type Db,
  type LibraryShoot,
} from '@/lib/campaigns/queries';
import {
  ALLOWED_POST_TRANSITIONS,
  MAX_ASSETS_PER_POST,
  addPostSchema,
  campaignPlanResponseSchema,
  captionResponseSchema,
  createCampaignSchema,
  firstIssue,
  normalizeHashtags,
  parseHashtagInput,
  postStatusChangeSchema,
  reviewPlannedPosts,
  sanitizeCaption,
  setCampaignCoverSchema,
  updateCampaignSchema,
  updatePostContentSchema,
  uuidSchema,
} from '@/lib/campaigns/validation';
import { buildCampaignTaskInserts } from '@/lib/planner/apply';
import { listPlaybookTasks } from '@/lib/planner/queries';
import { asCampaignPlatform, asCampaignObjective } from '@/lib/validators';

// --- small helpers ------------------------------------------------------

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function textList(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === 'string');
}

function refreshCampaign(campaignId: string): void {
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${campaignId}`);
}

/** Loads a post and its campaign together, or explains which one is missing. */
async function loadPost(
  db: Db,
  postId: string,
): Promise<
  | { post: Tables<'campaign_posts'>; campaign: Tables<'campaigns'>; error: null }
  | { post: null; campaign: null; error: string }
> {
  const post = await getCampaignPost(db, postId);
  if (!post) {
    return { post: null, campaign: null, error: 'That post no longer exists.' };
  }
  const campaign = await getCampaign(db, post.campaign_id);
  if (!campaign) {
    return {
      post: null,
      campaign: null,
      error: 'That post’s campaign no longer exists.',
    };
  }
  return { post, campaign, error: null };
}

// --- campaign creation --------------------------------------------------

export async function createCampaign(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = createCampaignSchema.safeParse({
    name: text(formData, 'name'),
    objective: text(formData, 'objective'),
    platforms: textList(formData, 'platforms'),
    audience: text(formData, 'audience'),
    brief: text(formData, 'brief'),
    postCount: text(formData, 'postCount') || '4',
    startsOn: text(formData, 'startsOn'),
    endsOn: text(formData, 'endsOn'),
    mode: text(formData, 'mode'),
    playbookId: text(formData, 'playbookId'),
    postingDays: textList(formData, 'postingDays'),
    postingTime: text(formData, 'postingTime'),
  });

  if (!parsed.success) return failed(firstIssue(parsed.error));
  const input = parsed.data;

  // The client may ask to generate; only the server decides whether it can.
  const generating = input.mode === 'generate' && isAiConfigured();

  let plannedName: string | null = null;
  let posts: Array<{ platform: SocialPlatform; caption: string; hashtags: string[] }> =
    [];
  let dropped = 0;

  if (generating) {
    const prompt = buildCampaignPlanPrompt({
      objective: input.objective,
      platforms: input.platforms,
      audience: input.audience,
      brief: input.brief,
      postCount: input.postCount,
      availableShootTypes: await listAvailableShootTypes(supabase),
    });

    let raw: unknown;
    try {
      // A plan of up to 8 captions does not fit the 2048-token default.
      raw = await generateJson<unknown>(prompt, { maxTokens: 4096 });
    } catch (cause) {
      // AiError messages are written for users; anything else is not.
      return failed(
        cause instanceof AiError
          ? cause.message
          : 'The AI request failed. Please try again.',
      );
    }

    const plan = campaignPlanResponseSchema.safeParse(raw);
    if (!plan.success) {
      return failed(
        'The AI returned a plan in an unexpected shape. Try again, or create the campaign and add posts yourself.',
      );
    }

    const review = reviewPlannedPosts(
      plan.data.posts,
      input.platforms,
      input.postCount,
    );

    if (review.posts.length === 0) {
      return failed(
        `The AI did not return any usable posts. ${review.rejections.join(' ')}`.trim(),
      );
    }

    posts = review.posts;
    dropped = Math.max(0, input.postCount - review.posts.length);
    plannedName = plan.data.name ? plan.data.name.trim().slice(0, 120) : null;
  }

  const name =
    input.name ??
    (plannedName && plannedName.length > 0 ? plannedName : null) ??
    `${CAMPAIGN_OBJECTIVE_LABELS[input.objective]} campaign`;

  const insert: TablesInsert<'campaigns'> = {
    name,
    objective: input.objective,
    status: 'draft',
    brief: input.brief,
    audience: input.audience,
    platforms: input.platforms,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    playbook_id: input.playbookId,
    posting_days: input.postingDays,
    posting_time: input.postingTime,
  };

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert(insert)
    .select('id')
    .single();

  if (error || !campaign) {
    return failed(
      friendlyDbError(
        error?.message ?? '',
        'Could not create the campaign. Please try again.',
      ),
    );
  }

  if (posts.length > 0) {
    const rows: TablesInsert<'campaign_posts'>[] = posts.map((post) => ({
      campaign_id: campaign.id,
      platform: post.platform,
      caption: post.caption,
      hashtags: post.hashtags,
      status: 'draft',
    }));

    const { error: postsError } = await supabase.from('campaign_posts').insert(rows);

    if (postsError) {
      // The campaign is seconds old and nothing references it, so rolling it
      // back is safer than leaving an empty shell the user did not ask for.
      await supabase.from('campaigns').delete().eq('id', campaign.id);
      return failed(
        friendlyDbError(
          postsError.message,
          'The plan was generated but could not be saved. Please try again.',
        ),
      );
    }
  }

  // The dropdown she asked for: picking a playbook populates the checklist —
  // and with it the calendar — the moment the campaign exists. A failure here
  // is not fatal to the campaign: it can still be applied by hand from the
  // detail page, so this only ever adds a note, never rolls back the create.
  let plannerNote = '';
  if (input.playbookId && input.startsOn) {
    const playbookTasks = await listPlaybookTasks(supabase, input.playbookId);
    if (playbookTasks.length > 0) {
      const rows = buildCampaignTaskInserts({
        campaignId: campaign.id,
        startsOn: input.startsOn,
        postingDays: input.postingDays,
        postingTime: input.postingTime,
        playbookTasks,
      });
      const { error: tasksError } = await supabase.from('campaign_tasks').insert(rows);
      if (tasksError) {
        plannerNote = '?playbookError=1';
      }
    }
  }

  revalidatePath('/campaigns');
  revalidatePath('/calendar');
  redirect(
    (dropped > 0
      ? `/campaigns/${campaign.id}?dropped=${dropped}`
      : plannerNote
        ? `/campaigns/${campaign.id}${plannerNote}`
        : `/campaigns/${campaign.id}`) as Route,
  );
}

// --- campaign metadata --------------------------------------------------

export async function updateCampaign(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = updateCampaignSchema.safeParse({
    campaignId: text(formData, 'campaignId'),
    name: text(formData, 'name'),
    objective: text(formData, 'objective'),
    status: text(formData, 'status'),
    platforms: textList(formData, 'platforms'),
    audience: text(formData, 'audience'),
    brief: text(formData, 'brief'),
    startsOn: text(formData, 'startsOn'),
    endsOn: text(formData, 'endsOn'),
    postingDays: textList(formData, 'postingDays'),
    postingTime: text(formData, 'postingTime'),
  });

  if (!parsed.success) return failed(firstIssue(parsed.error));
  const input = parsed.data;

  const { error } = await supabase
    .from('campaigns')
    .update({
      name: input.name,
      objective: input.objective,
      status: input.status,
      platforms: input.platforms,
      audience: input.audience,
      brief: input.brief,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      posting_days: input.postingDays,
      posting_time: input.postingTime,
    })
    .eq('id', input.campaignId);

  if (error) {
    return failed(friendlyDbError(error.message, 'Could not save the campaign.'));
  }

  refreshCampaign(input.campaignId);
  return ok('Campaign saved.');
}

/**
 * Sets (or clears) the campaign's cover photo.
 *
 * "Photographers are visual people" — a campaign in the list and on the
 * calendar reads as an admin row without one. Drawn from the same library
 * picker as a post's photos, but this is a single choice, not a carousel.
 */
export async function setCampaignCover(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = setCampaignCoverSchema.safeParse({
    campaignId: text(formData, 'campaignId'),
    assetId: text(formData, 'assetId'),
  });
  if (!parsed.success) return failed(firstIssue(parsed.error));
  const { campaignId, assetId } = parsed.data;

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) return failed('That campaign no longer exists.');

  if (assetId) {
    const assets = await getAssetsByIds(supabase, [assetId]);
    if (assets.length === 0) return failed('That photo is no longer in the library.');
  }

  const { error } = await supabase
    .from('campaigns')
    .update({ cover_asset_id: assetId })
    .eq('id', campaignId);

  if (error) {
    return failed(friendlyDbError(error.message, 'Could not save the cover photo.'));
  }

  refreshCampaign(campaignId);
  return ok(assetId ? 'Cover photo set.' : 'Cover photo removed.');
}

// --- post content -------------------------------------------------------

export async function updatePostContent(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = updatePostContentSchema.safeParse({
    postId: text(formData, 'postId'),
    caption: text(formData, 'caption'),
    hashtags: text(formData, 'hashtags'),
  });

  if (!parsed.success) return failed(firstIssue(parsed.error));

  const { post, error: loadError } = await loadPost(supabase, parsed.data.postId);
  if (!post) return failed(loadError);

  if (post.status === 'published') {
    return failed(
      'This post is already published — editing the copy here would not change what is live on the platform.',
    );
  }

  const { error } = await supabase
    .from('campaign_posts')
    .update({
      caption: sanitizeCaption(parsed.data.caption),
      hashtags: parseHashtagInput(parsed.data.hashtags),
    })
    .eq('id', post.id);

  if (error) {
    return failed(friendlyDbError(error.message, 'Could not save the post.'));
  }

  refreshCampaign(post.campaign_id);
  return ok('Post saved.');
}

export async function addPost(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = addPostSchema.safeParse({
    campaignId: text(formData, 'campaignId'),
    platform: text(formData, 'platform'),
    caption: text(formData, 'caption'),
  });

  if (!parsed.success) return failed(firstIssue(parsed.error));

  const campaign = await getCampaign(supabase, parsed.data.campaignId);
  if (!campaign) return failed('That campaign no longer exists.');

  const insert: TablesInsert<'campaign_posts'> = {
    campaign_id: campaign.id,
    platform: parsed.data.platform,
    caption: sanitizeCaption(parsed.data.caption),
    status: 'draft',
  };

  const { error } = await supabase.from('campaign_posts').insert(insert);
  if (error) {
    return failed(friendlyDbError(error.message, 'Could not add the post.'));
  }

  refreshCampaign(campaign.id);
  return ok('Post added.');
}

export async function deletePost(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = uuidSchema.safeParse(text(formData, 'postId'));
  if (!parsed.success) return failed('That post could not be identified.');

  const { post, error: loadError } = await loadPost(supabase, parsed.data);
  if (!post) return failed(loadError);

  const { error } = await supabase
    .from('campaign_posts')
    .delete()
    .eq('id', post.id);

  if (error) return failed('Could not delete the post.');

  refreshCampaign(post.campaign_id);
  return ok('Post deleted.');
}

// --- status transitions -------------------------------------------------

export async function changePostStatus(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = postStatusChangeSchema.safeParse({
    postId: text(formData, 'postId'),
    status: text(formData, 'status'),
    scheduledFor: text(formData, 'scheduledFor'),
  });

  if (!parsed.success) return failed(firstIssue(parsed.error));
  const { postId, status: next, scheduledFor } = parsed.data;

  const { post, error: loadError } = await loadPost(supabase, postId);
  if (!post) return failed(loadError);

  const current = post.status as PostStatus;

  if (next === 'published') {
    return failed(
      'A post becomes published by publishing it, so the platform post id is real. Use Publish.',
    );
  }
  if (next === 'failed') {
    return failed('“Failed” is set by a failed publish attempt, not by hand.');
  }
  if (current === next) {
    return ok(`Already ${next}.`);
  }
  if (!ALLOWED_POST_TRANSITIONS[current].includes(next)) {
    return failed(
      current === 'published'
        ? 'A published post cannot change status. Delete it here if you have removed it from the platform.'
        : `A ${current} post cannot move straight to ${next}.`,
    );
  }

  const update: {
    status: PostStatus;
    scheduled_for?: string;
    failure_reason?: null;
  } = { status: next };

  // Retrying clears the old reason; leaving it would keep a stale explanation
  // attached to a post that is no longer failed.
  if (current === 'failed') update.failure_reason = null;

  if (next === 'scheduled') {
    // The schema requires a time for a scheduled post; catch it here so the
    // user gets a sentence instead of a constraint violation.
    if (scheduledFor.trim().length === 0) {
      return failed('Pick the date and time this post should go out.');
    }
    const when = new Date(scheduledFor);
    if (Number.isNaN(when.getTime())) {
      return failed('That date and time could not be read.');
    }
    if (when.getTime() < Date.now() - 60_000) {
      return failed('Pick a time in the future.');
    }
    update.scheduled_for = when.toISOString();
  }

  const { error } = await supabase
    .from('campaign_posts')
    .update(update)
    .eq('id', post.id);

  if (error) {
    return failed(
      friendlyDbError(error.message, 'Could not update the post’s status.'),
    );
  }

  refreshCampaign(post.campaign_id);
  return ok(next === 'scheduled' ? 'Post scheduled.' : `Post moved to ${next}.`);
}

// --- photos -------------------------------------------------------------

/**
 * Replaces a post's attached photos with `assetIds`, in the given order.
 *
 * Called directly from the client rather than through a form: attach, remove,
 * reorder, and "make cover" are all the same write, and expressing them as one
 * ordered list keeps index 0 — the carousel cover — unambiguous.
 */
export async function setPostAssets(
  postId: string,
  assetIds: string[],
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const id = uuidSchema.safeParse(postId);
  if (!id.success) return failed('That post could not be identified.');

  if (!Array.isArray(assetIds)) return failed('Those photos could not be read.');

  const ordered: string[] = [];
  for (const assetId of assetIds) {
    if (typeof assetId !== 'string') continue;
    if (!uuidSchema.safeParse(assetId).success) {
      return failed('One of those photos could not be identified.');
    }
    if (!ordered.includes(assetId)) ordered.push(assetId);
  }

  if (ordered.length > MAX_ASSETS_PER_POST) {
    return failed(
      `A post can carry at most ${MAX_ASSETS_PER_POST} photos — that is the carousel limit.`,
    );
  }

  const { post, error: loadError } = await loadPost(supabase, id.data);
  if (!post) return failed(loadError);

  if (post.status === 'published') {
    return failed(
      'This post is already published — changing its photos here would not change what is live.',
    );
  }

  // Every id must be a real asset. An unknown one would otherwise sit in the
  // array forever, rendering as a hole in the carousel.
  const assets = await getAssetsByIds(supabase, ordered);
  if (assets.length !== ordered.length) {
    return failed('One of those photos is no longer in the library.');
  }

  const { error } = await supabase
    .from('campaign_posts')
    .update({ asset_ids: ordered })
    .eq('id', post.id);

  if (error) {
    return failed(friendlyDbError(error.message, 'Could not save the photos.'));
  }

  refreshCampaign(post.campaign_id);
  return ok(
    ordered.length === 0
      ? 'Photos removed.'
      : `${ordered.length} photo${ordered.length === 1 ? '' : 's'} attached.`,
  );
}

/**
 * Photo-picker source, loaded on demand.
 *
 * A read behind `'use server'` so the campaign detail page does not have to
 * embed (and sign) the whole library on every render just in case someone
 * opens a picker. It authenticates exactly like a mutation does.
 */
export async function fetchLibraryPhotos(): Promise<{
  shoots: LibraryShoot[];
  error: string | null;
}> {
  const { supabase } = await requireUser();
  try {
    return { shoots: await listLibraryPhotos(supabase), error: null };
  } catch {
    return { shoots: [], error: 'Could not load the photo library.' };
  }
}

// --- caption regeneration -----------------------------------------------

export async function regenerateCaption(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = uuidSchema.safeParse(text(formData, 'postId'));
  if (!parsed.success) return failed('That post could not be identified.');

  if (!isAiConfigured()) {
    return failed(
      'AI generation is unavailable: ANTHROPIC_API_KEY is not set on the server.',
    );
  }

  const { post, campaign, error: loadError } = await loadPost(
    supabase,
    parsed.data,
  );
  if (!post || !campaign) return failed(loadError);

  if (post.status === 'published') {
    return failed(
      'This post is already published — rewriting the caption here would not change what is live.',
    );
  }

  const assets = await getAssetsByIds(supabase, post.asset_ids);
  // Preserve the post's own order: the prompt describes the photos "in order".
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const ordered = post.asset_ids.flatMap((assetId) => {
    const asset = byId.get(assetId);
    return asset ? [toDomainAsset(asset)] : [];
  });

  const prompt = buildCaptionPrompt({
    platform: asCampaignPlatform(post.platform),
    campaign: {
      name: campaign.name,
      objective: asCampaignObjective(campaign.objective),
      brief: campaign.brief,
      audience: campaign.audience,
    },
    assets: ordered,
    shootType: await shootTypeForAssets(supabase, assets),
  });

  let raw: unknown;
  try {
    raw = await generateJson<unknown>(prompt, { maxTokens: 1024 });
  } catch (cause) {
    return failed(
      cause instanceof AiError
        ? cause.message
        : 'The AI request failed. Please try again.',
    );
  }

  const result = captionResponseSchema.safeParse(raw);
  if (!result.success) {
    return failed('The AI returned a caption in an unexpected shape. Try again.');
  }

  const caption = sanitizeCaption(result.data.caption);
  if (caption.length === 0) {
    return failed('The AI returned an empty caption. Try again.');
  }

  const { error } = await supabase
    .from('campaign_posts')
    .update({
      caption,
      hashtags: normalizeHashtags(
        (result.data.hashtags ?? []).filter(
          (tag): tag is string => typeof tag === 'string',
        ),
      ),
    })
    .eq('id', post.id);

  if (error) {
    return failed(friendlyDbError(error.message, 'Could not save the new caption.'));
  }

  refreshCampaign(post.campaign_id);
  return ok(
    ordered.length > 0
      ? 'Caption rewritten from the attached photos.'
      : 'Caption rewritten. Attach photos for copy that describes the images.',
  );
}

// --- publishing ---------------------------------------------------------


export async function publishPost(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = uuidSchema.safeParse(text(formData, 'postId'));
  if (!parsed.success) return failed('That post could not be identified.');

  const { post, error: loadError } = await loadPost(supabase, parsed.data);
  if (!post) return failed(loadError);

  const outcome = await publishOnePost(supabase, post);
  refreshCampaign(post.campaign_id);

  return outcome.ok ? ok(outcome.detail) : failed(outcome.detail);
}

/**
 * Publishes every approved post in a campaign, reporting each outcome.
 *
 * Sequential and failure-tolerant on purpose: one platform rejecting a post
 * must not stop the rest of the set from going out.
 */
export async function publishApprovedPosts(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = uuidSchema.safeParse(text(formData, 'campaignId'));
  if (!parsed.success) return failed('That campaign could not be identified.');

  const campaign = await getCampaign(supabase, parsed.data);
  if (!campaign) return failed('That campaign no longer exists.');

  const { data: posts, error } = await supabase
    .from('campaign_posts')
    .select('*')
    .eq('campaign_id', campaign.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: true });

  if (error) return failed('Could not load the approved posts.');
  if (!posts || posts.length === 0) {
    return failed('No posts are approved yet. Approve a post to publish it.');
  }

  const failures: string[] = [];
  let published = 0;

  for (const post of posts) {
    const outcome = await publishOnePost(supabase, post);
    if (outcome.ok) published += 1;
    else failures.push(outcome.detail);
  }

  refreshCampaign(campaign.id);

  const summary = `Published ${published} of ${posts.length}.`;
  if (failures.length === 0) return ok(summary);
  return {
    error: `${summary} ${failures.join(' ')}`,
    message: published > 0 ? summary : null,
  };
}
