'use server';

import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { buildAdCopyPrompt } from '@lensello/core/ai';
import { getIntegrations, IntegrationError } from '@lensello/core/integrations';
import type { AdStatus } from '@lensello/core';
import { requireUser } from '@/lib/auth';
import { AiError, generateJson, isAiConfigured } from '@/lib/ai';
import type { Session } from '@/lib/auth';
import type { TablesInsert } from '@/lib/db.types';
import { CREATIVE_URL_TTL_SECONDS } from '@/lib/ads/constants';
import { getAd, getAdCreative } from '@/lib/ads/queries';
import {
  firstIssue,
  generateCopySchema,
  parseAdInput,
  statusChangeSchema,
  syncSchema,
  toCopyVariants,
  type AdStatusIntent,
  type CopyVariant,
  type GenerateCopyInput,
} from '@/lib/ads/schema';
import {
  describeSyncResult,
  resolveSyncWindow,
  toMetricInserts,
} from '@/lib/ads/sync';
import type { AdFormState } from './form-state';

/**
 * All mutations for the ads module.
 *
 * Two rules hold without exception in this file:
 *
 * 1. Every export starts with `await requireUser()`. These functions are
 *    reachable by direct POST — the fact that the UI only renders the Launch
 *    button for a complete ad says nothing about who can call `changeAdStatus`.
 * 2. Nothing reaches Meta, Google, or TikTok except through
 *    `getIntegrations().ads`.
 *
 * Business-rule failures are returned as readable messages rather than thrown.
 * Only genuine authorization failures throw, because a thrown error is the
 * right outcome for a caller who should not be here at all.
 */

/** Cache tag for anything that renders the ads list or an ad's numbers. */
const ADS_TAG = 'ads';

export interface ActionResult {
  ok: boolean;
  message: string | null;
}

type SupabaseClient = Session['supabase'];

// --- create / update ----------------------------------------------------

export async function createAd(
  _previous: AdFormState,
  formData: FormData,
): Promise<AdFormState> {
  const { supabase } = await requireUser();

  const parsed = parseAdInput(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const input = parsed.data;

  const insert: TablesInsert<'ads'> = {
    name: input.name,
    platform: input.platform,
    // New ads always start as drafts. Reaching 'active' goes through
    // `changeAdStatus`, which is where the launch adapter call and the
    // completeness check live — a form field could otherwise skip both.
    status: 'draft',
    headline: input.headline,
    primary_text: input.primaryText,
    call_to_action: input.callToAction,
    asset_id: input.assetId,
    campaign_id: input.campaignId,
    daily_budget_cents: input.dailyBudgetCents,
    audience: input.audience,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
  };

  const { data, error } = await supabase
    .from('ads')
    .insert(insert)
    .select('id')
    .single();

  if (error || !data) {
    return { error: 'Could not save the ad. Please try again.' };
  }

  updateTag(ADS_TAG);
  redirect(`/ads/${data.id}`);
}

export async function updateAd(
  _previous: AdFormState,
  formData: FormData,
): Promise<AdFormState> {
  const { supabase } = await requireUser();

  const adId = formData.get('adId');
  if (typeof adId !== 'string' || adId.length === 0) {
    return { error: 'Missing which ad to update.' };
  }

  const parsed = parseAdInput(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const input = parsed.data;

  const existing = await getAd(supabase, adId);
  if (!existing) return { error: 'That ad no longer exists.' };

  // An ad that is already live must stay complete. Postgres enforces
  // `ads_active_is_complete` regardless; checking here means the user reads a
  // sentence instead of a constraint name.
  const incomplete = describeIncompleteness({
    headline: input.headline,
    primaryText: input.primaryText,
    dailyBudgetCents: input.dailyBudgetCents,
  });

  if (incomplete && (existing.status === 'active' || existing.status === 'review')) {
    return {
      error: `This ad is ${existing.status === 'active' ? 'running' : 'in review'}, so it cannot be saved incomplete: ${incomplete} Pause it first if you need to strip it back.`,
    };
  }

  const { error } = await supabase
    .from('ads')
    .update({
      name: input.name,
      platform: input.platform,
      headline: input.headline,
      primary_text: input.primaryText,
      call_to_action: input.callToAction,
      asset_id: input.assetId,
      campaign_id: input.campaignId,
      daily_budget_cents: input.dailyBudgetCents,
      audience: input.audience,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    })
    .eq('id', adId);

  if (error) return { error: 'Could not save your changes. Please try again.' };

  updateTag(ADS_TAG);
  return { error: null, saved: true };
}

// --- status transitions -------------------------------------------------

/**
 * The `ads_active_is_complete` check, in prose.
 *
 * Returns null when the ad may be active. Kept as one function so the launch
 * path, the resume path, and the edit path cannot drift from each other or from
 * the constraint.
 */
function describeIncompleteness(ad: {
  headline: string;
  primaryText: string;
  dailyBudgetCents: number;
}): string | null {
  const missing: string[] = [];
  if (ad.headline.trim().length === 0) missing.push('a headline');
  if (ad.primaryText.trim().length === 0) missing.push('primary text');
  if (ad.dailyBudgetCents <= 0) missing.push('a daily budget above $0');

  if (missing.length === 0) return null;
  if (missing.length === 1) return `it still needs ${missing[0]}.`;
  const last = missing.pop();
  return `it still needs ${missing.join(', ')} and ${last}.`;
}

const INTENT_TARGET: Record<AdStatusIntent, AdStatus> = {
  launch: 'active',
  pause: 'paused',
  resume: 'active',
  end: 'ended',
};

export async function changeAdStatus(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const parsed = statusChangeSchema.safeParse({
    adId: formData.get('adId'),
    intent: formData.get('intent'),
  });

  if (!parsed.success) {
    return { ok: false, message: firstIssue(parsed.error) };
  }

  const { adId, intent } = parsed.data;
  const target = INTENT_TARGET[intent];

  const ad = await getAd(supabase, adId);
  if (!ad) return { ok: false, message: 'That ad no longer exists.' };

  if (ad.status === target) {
    return { ok: true, message: null };
  }

  if (target === 'active') {
    const incomplete = describeIncompleteness({
      headline: ad.headline,
      primaryText: ad.primary_text,
      dailyBudgetCents: ad.daily_budget_cents,
    });
    if (incomplete) {
      return {
        ok: false,
        message: `This ad cannot go live — ${incomplete}`,
      };
    }
  }

  if (ad.status === 'ended' && target === 'active') {
    return {
      ok: false,
      message:
        'This ad has ended. Duplicate it into a new ad rather than restarting a finished flight.',
    };
  }

  const platform = await applyPlatformStatus(supabase, { ...ad, platform: ad.platform as 'meta' | 'google' | 'tiktok' }, target);
  if (!platform.ok) return platform;

  const { error } = await supabase
    .from('ads')
    .update({
      status: target,
      ...(platform.externalId ? { external_id: platform.externalId } : {}),
    })
    .eq('id', adId);

  if (error) {
    // The platform side already moved. Say so plainly — a silent "failed" here
    // would leave someone thinking the ad is off when it is spending.
    return {
      ok: false,
      message:
        'The platform accepted the change but saving it here failed. Reload before retrying so the two do not drift.',
    };
  }

  updateTag(ADS_TAG);
  return { ok: true, message: platform.message };
}

interface PlatformOutcome extends ActionResult {
  externalId?: string;
}

/**
 * Pushes the status change to the ad platform through the adapter.
 *
 * First launch creates the ad and returns an `external_id` to record; every
 * later transition is `setAdStatus`. An ad with no `external_id` that is being
 * paused or ended never existed on the platform, so there is nothing to call.
 */
async function applyPlatformStatus(
  supabase: SupabaseClient,
  ad: {
    id: string;
    name: string;
    platform: 'meta' | 'google' | 'tiktok';
    headline: string;
    primary_text: string;
    call_to_action: string;
    asset_id: string | null;
    daily_budget_cents: number;
    audience: string | null;
    starts_on: string | null;
    ends_on: string | null;
    external_id: string | null;
  },
  target: AdStatus,
): Promise<PlatformOutcome> {
  const ads = getIntegrations().ads;

  try {
    if (!ad.external_id) {
      if (target !== 'active') {
        // Never launched: pausing or ending is a local bookkeeping change.
        return { ok: true, message: null };
      }

      // The platform fetches the creative itself, after this request is over,
      // so the signed URL needs a lifetime measured in days rather than the
      // hour a browser preview gets.
      const creative = await getAdCreative(
        supabase,
        ad.asset_id,
        CREATIVE_URL_TTL_SECONDS,
      );

      const result = await ads.createAd({
        platform: ad.platform,
        name: ad.name,
        headline: ad.headline,
        primaryText: ad.primary_text,
        callToAction: ad.call_to_action,
        imageUrl: creative?.url ?? null,
        dailyBudgetCents: ad.daily_budget_cents,
        audience: ad.audience,
        startsOn: ad.starts_on,
        endsOn: ad.ends_on,
      });

      return {
        ok: true,
        externalId: result.externalId,
        message: `Launched on ${ads.provider} as ${result.externalId}.`,
      };
    }

    await ads.setAdStatus(ad.external_id, target === 'active');
    return { ok: true, message: null };
  } catch (cause) {
    if (cause instanceof IntegrationError) {
      return {
        ok: false,
        message: `${ad.platform} rejected the change: ${cause.message}`,
      };
    }
    return {
      ok: false,
      message: 'Could not reach the ad platform. Nothing was changed.',
    };
  }
}

// --- metrics sync ------------------------------------------------------

/**
 * Pulls daily performance from the platform and upserts it into `ad_metrics`.
 *
 * **Idempotent by construction.** The write is a single upsert with
 * `onConflict: 'ad_id,day'`, which is backed by the `ad_metrics_unique_day`
 * constraint. Re-syncing an overlapping window therefore *updates* the days it
 * already has and inserts only the genuinely new ones. Two supporting details
 * in `toMetricInserts` keep that true: no `id` is supplied (a generated one
 * would make every row novel to the primary key), and days are deduplicated
 * within the payload (Postgres refuses to let one statement update the same row
 * twice).
 *
 * Ads without an `external_id` have nothing to fetch and are counted as skipped
 * rather than treated as an error.
 */
export async function syncPerformance(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const parsed = syncSchema.safeParse({
    adId: formData.get('adId') ?? undefined,
    days: formData.get('days') ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: firstIssue(parsed.error) };
  }

  const { adId, days } = parsed.data;

  let query = supabase.from('ads').select('id, external_id, starts_on, ends_on');

  if (adId) query = query.eq('id', adId);

  const { data: ads, error: adsError } = await query;

  if (adsError) {
    return { ok: false, message: 'Could not load ads to sync. Please try again.' };
  }
  if (!ads || ads.length === 0) {
    return { ok: true, message: 'Nothing to sync yet.' };
  }

  const launched = ads.filter(
    (ad): ad is typeof ad & { external_id: string } => Boolean(ad.external_id),
  );
  const skipped = ads.length - launched.length;

  if (launched.length === 0) {
    return {
      ok: true,
      message: describeSyncResult({ adsSynced: 0, daysWritten: 0, skipped }),
    };
  }

  const manager = getIntegrations().ads;
  const inserts: TablesInsert<'ad_metrics'>[] = [];
  let adsSynced = 0;
  let windowless = 0;

  for (const ad of launched) {
    const window = resolveSyncWindow(ad, days);
    if (!window) {
      windowless += 1;
      continue;
    }

    let fetched;
    try {
      // One call per ad, deliberately. `fetchMetrics` takes a list of external
      // ids but returns rows carrying only a day — there is no field tying a
      // row back to which ad it belongs to. Batching would mean guessing at the
      // attribution, and guessing here means charging the wrong ad for the
      // spend.
      fetched = await manager.fetchMetrics([ad.external_id], window.from, window.to);
    } catch (cause) {
      const detail =
        cause instanceof IntegrationError
          ? cause.message
          : 'the platform did not respond';
      return {
        ok: false,
        message: `Sync stopped partway: ${detail} Days already written are saved; run it again to finish.`,
      };
    }

    const rows = toMetricInserts(ad.id, fetched, window);
    if (rows.length > 0) {
      inserts.push(...rows);
      adsSynced += 1;
    }
  }

  if (inserts.length === 0) {
    return {
      ok: true,
      message: describeSyncResult({
        adsSynced: 0,
        daysWritten: 0,
        skipped: skipped + windowless,
      }),
    };
  }

  const { error } = await supabase
    .from('ad_metrics')
    // The idempotency guarantee. `(ad_id, day)` is a unique constraint, so a
    // day already present is updated in place instead of duplicated.
    .upsert(inserts, { onConflict: 'ad_id,day' });

  if (error) {
    return {
      ok: false,
      message: 'Fetched the numbers but could not save them. Please try again.',
    };
  }

  updateTag(ADS_TAG);
  return {
    ok: true,
    message: describeSyncResult({
      adsSynced,
      daysWritten: inserts.length,
      skipped: skipped + windowless,
    }),
  };
}

// --- AI copy generation ------------------------------------------------

export interface GenerateCopyResult {
  variants: CopyVariant[];
  error: string | null;
}

/**
 * Generates ad copy variants through `buildAdCopyPrompt`.
 *
 * The prompt is a pure function in `@lensello/core/ai`; `generateJson` does the
 * calling. Nothing generated here is persisted — the variants go back to the
 * form as suggestions, and `adInputSchema` validates whatever the user
 * ultimately submits. That ordering is what keeps model output from becoming a
 * write path.
 */
export async function generateAdCopy(
  input: GenerateCopyInput,
): Promise<GenerateCopyResult> {
  // Generation costs money and reveals which shoot types the studio runs.
  // Authenticate before spending either.
  await requireUser();

  if (!isAiConfigured()) {
    return {
      variants: [],
      error:
        'AI generation is not configured on this deployment. Write the copy manually — everything else on this form works.',
    };
  }

  const parsed = generateCopySchema.safeParse(input);
  if (!parsed.success) {
    return { variants: [], error: firstIssue(parsed.error) };
  }

  const prompt = buildAdCopyPrompt({
    shootType: parsed.data.shootType,
    audience: parsed.data.audience,
    offer: parsed.data.offer,
    variantCount: parsed.data.variantCount,
  });

  try {
    const raw = await generateJson<unknown>(prompt, { maxTokens: 1500 });
    const variants = toCopyVariants(raw);

    if (variants.length === 0) {
      return {
        variants: [],
        error: 'The model returned nothing usable. Try again, or write the copy yourself.',
      };
    }

    return { variants, error: null };
  } catch (cause) {
    if (cause instanceof AiError) {
      return { variants: [], error: cause.message };
    }
    // A schema mismatch lands here: the model answered, but not in the shape
    // the prompt asked for.
    return {
      variants: [],
      error:
        'The model replied in an unexpected shape. Try again, or write the copy yourself.',
    };
  }
}
