/**
 * Live ad adapter: Meta Marketing API.
 *
 * UNVERIFIED, like the social adapter beside it. It has never run against
 * Meta's API because that needs an ad account, a token with `ads_management`,
 * and App Review — a *separate* review from the one Instagram publishing
 * needs. Written against Meta's documented request shapes; treat the first run
 * as a test.
 *
 * The shape of this file is dictated by Meta, not by us. `createAd` looks like
 * one call in `AdManager` and is four on the wire, because Meta models an ad as
 * a chain:
 *
 *   campaign   what you are trying to achieve, and the objective
 *     ad set   who sees it, how much you spend, when it runs
 *   creative   the picture and the words
 *         ad   the creative placed in the ad set
 *
 * Each step needs the id of the one above. Creating them and then failing part
 * way leaves orphans that still cost money if they are live, so everything is
 * created PAUSED and only activated once the whole chain exists.
 *
 * Only Meta is implemented. Google Ads and TikTok have entirely different APIs
 * and their own approval processes; they throw rather than pretending.
 */

import { IntegrationError, NotImplementedError } from '../types';
import type { AdPlatform, DateOnly } from '../../types';
import type { AdManager, AdMetricRow, CreateAdInput, PublishResult } from '../types';

/** Pinned. Meta ships breaking changes between versions. */
const GRAPH_VERSION = 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Objective and optimisation.
 *
 * A photography studio advertises to get enquiries, so the campaign optimises
 * for leads rather than reach: paying for impressions that never produce a
 * booking is the most common way a small ad budget disappears.
 */
const OBJECTIVE = 'OUTCOME_LEADS';
const OPTIMIZATION_GOAL = 'LEAD_GENERATION';
const BILLING_EVENT = 'IMPRESSIONS';

export function isMetaAdsConfigured(): boolean {
  return Boolean(
    process.env.META_AD_ACCOUNT_ID?.trim() && process.env.META_ADS_ACCESS_TOKEN?.trim(),
  );
}

function requireConfig(): { accountId: string; token: string } {
  const accountId = process.env.META_AD_ACCOUNT_ID?.trim();
  const token = process.env.META_ADS_ACCESS_TOKEN?.trim();

  if (!accountId || !token) {
    throw new IntegrationError(
      'Meta ads are not configured. Set META_AD_ACCOUNT_ID and META_ADS_ACCESS_TOKEN.',
      'meta-ads',
    );
  }

  // Meta wants `act_<id>`; people paste the bare number off the dashboard.
  return {
    accountId: accountId.startsWith('act_') ? accountId : `act_${accountId}`,
    token,
  };
}

interface GraphError {
  error?: { message?: string; code?: number; error_user_msg?: string };
}

async function graph<T>(
  path: string,
  options: {
    token: string;
    method?: string;
    body?: Record<string, string>;
    params?: Record<string, string>;
  },
): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [key, value] of Object.entries(options.params ?? {})) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('access_token', options.token);

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
      body: options.body ? new URLSearchParams(options.body).toString() : undefined,
    });
  } catch (cause) {
    throw new IntegrationError(
      `Could not reach Meta: ${cause instanceof Error ? cause.message : 'network error'}.`,
      'meta-ads',
      true,
    );
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new IntegrationError(
      `Meta returned a non-JSON response (HTTP ${response.status}).`,
      'meta-ads',
      response.status >= 500,
    );
  }

  if (!response.ok) {
    const body = parsed as GraphError;
    // error_user_msg is the one written for humans; message is for developers.
    const detail =
      body.error?.error_user_msg ?? body.error?.message ?? `HTTP ${response.status}`;
    const retryable =
      response.status >= 500 || body.error?.code === 4 || body.error?.code === 17;
    throw new IntegrationError(`Meta ads: ${detail}`, 'meta-ads', retryable);
  }

  return parsed as T;
}

function assertMeta(platform: AdPlatform): void {
  if (platform !== 'meta') {
    throw new NotImplementedError(
      'meta-ads',
      `${platform} advertising. Only Meta has an adapter; Google Ads and TikTok have their own APIs and approvals`,
    );
  }
}

/** Meta expects a Unix timestamp for scheduling, not a calendar date. */
function toUnix(date: DateOnly | null, endOfDay = false): string | undefined {
  if (!date) return undefined;
  const parsed = new Date(`${date}T${endOfDay ? '23:59:59' : '00:00:00'}Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return String(Math.floor(parsed.getTime() / 1000));
}

interface Created {
  id: string;
}

interface InsightRow {
  ad_id?: string;
  date_start?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  actions?: Array<{ action_type: string; value: string }>;
}

/**
 * Which Meta action types count as a lead.
 *
 * Meta reports dozens of action types on one row and they overlap — counting
 * them all would inflate a lead count several times over. These are the ones
 * that mean somebody actually asked to be contacted.
 */
const LEAD_ACTIONS = new Set([
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
]);

class MetaAdManager implements AdManager {
  readonly provider = 'meta-ads';

  async createAd(input: CreateAdInput): Promise<PublishResult> {
    assertMeta(input.platform);
    const { accountId, token } = requireConfig();

    if (!input.imageUrl) {
      throw new IntegrationError(
        'Meta requires an image on the creative. Attach a photograph first.',
        'meta-ads',
      );
    }

    // 1. Campaign. PAUSED so nothing can spend before the chain is complete.
    const campaign = await graph<Created>(`/${accountId}/campaigns`, {
      token,
      method: 'POST',
      body: {
        name: `${input.name} — campaign`,
        objective: OBJECTIVE,
        status: 'PAUSED',
        special_ad_categories: '[]',
      },
    });

    // 2. Ad set: budget, schedule, audience.
    const adSetBody: Record<string, string> = {
      name: `${input.name} — ad set`,
      campaign_id: campaign.id,
      // Meta takes minor units of the account currency, which is the same unit
      // this application stores. No conversion, deliberately: a factor of 100
      // in either direction here is somebody's real money.
      daily_budget: String(input.dailyBudgetCents),
      billing_event: BILLING_EVENT,
      optimization_goal: OPTIMIZATION_GOAL,
      status: 'PAUSED',
      // Free-text audience is a note to the operator, not something Meta can
      // target on. Targeting has to be built in Ads Manager; sending a guess
      // would spend the budget on the wrong people.
      targeting: JSON.stringify({ geo_locations: { countries: ['GB'] } }),
    };

    const start = toUnix(input.startsOn);
    const end = toUnix(input.endsOn, true);
    if (start) adSetBody.start_time = start;
    if (end) adSetBody.end_time = end;

    const adSet = await graph<Created>(`/${accountId}/adsets`, {
      token,
      method: 'POST',
      body: adSetBody,
    });

    // 3. Creative.
    const creative = await graph<Created>(`/${accountId}/adcreatives`, {
      token,
      method: 'POST',
      body: {
        name: `${input.name} — creative`,
        object_story_spec: JSON.stringify({
          page_id: process.env.META_PAGE_ID?.trim() ?? '',
          link_data: {
            message: input.primaryText,
            name: input.headline,
            picture: input.imageUrl,
            link: process.env.LENSELLO_PUBLIC_URL?.trim() ?? 'https://lensello-web-kappa.vercel.app',
            call_to_action: { type: 'LEARN_MORE' },
          },
        }),
      },
    });

    // 4. The ad itself, still paused. `setAdStatus` is what starts spending.
    const ad = await graph<Created>(`/${accountId}/ads`, {
      token,
      method: 'POST',
      body: {
        name: input.name,
        adset_id: adSet.id,
        creative: JSON.stringify({ creative_id: creative.id }),
        status: 'PAUSED',
      },
    });

    return {
      externalId: ad.id,
      url: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${accountId.replace('act_', '')}&selected_ad_ids=${ad.id}`,
      publishedAt: new Date().toISOString(),
    };
  }

  async setAdStatus(externalId: string, active: boolean): Promise<void> {
    const { token } = requireConfig();
    await graph(`/${externalId}`, {
      token,
      method: 'POST',
      body: { status: active ? 'ACTIVE' : 'PAUSED' },
    });
  }

  async fetchMetrics(
    externalIds: readonly string[],
    from: DateOnly,
    to: DateOnly,
  ): Promise<AdMetricRow[]> {
    if (externalIds.length === 0) return [];
    const { accountId, token } = requireConfig();

    const insights = await graph<{ data: InsightRow[] }>(`/${accountId}/insights`, {
      token,
      params: {
        level: 'ad',
        // Daily rows, which is what the metrics table stores. Without this Meta
        // returns one aggregate row for the whole window.
        time_increment: '1',
        fields: 'ad_id,date_start,impressions,clicks,spend,actions',
        time_range: JSON.stringify({ since: from, until: to }),
        filtering: JSON.stringify([
          { field: 'ad.id', operator: 'IN', value: [...externalIds] },
        ]),
        limit: '500',
      },
    });

    return (insights.data ?? []).flatMap((row) => {
      if (!row.ad_id || !row.date_start) return [];

      const leads = (row.actions ?? [])
        .filter((action) => LEAD_ACTIONS.has(action.action_type))
        .reduce((total, action) => total + Number(action.value ?? 0), 0);

      return [
        {
          externalId: row.ad_id,
          day: row.date_start,
          impressions: Number(row.impressions ?? 0),
          clicks: Number(row.clicks ?? 0),
          // Meta reports spend as a decimal string in the account currency;
          // everything here is stored in minor units.
          spendCents: Math.round(Number(row.spend ?? 0) * 100),
          leads,
        },
      ];
    });
  }
}

export function createMetaAdManager(): AdManager {
  return new MetaAdManager();
}
