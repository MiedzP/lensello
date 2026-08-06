/**
 * Live social adapter: Instagram (and Facebook Pages) via the Meta Graph API.
 *
 * UNVERIFIED. Every other adapter in this codebase has been exercised against
 * the thing it talks to. This one has not, because it cannot be: it needs a
 * Meta app, a Professional Instagram account linked to a Facebook Page, and
 * App Review approval, none of which exist yet. It is written against Meta's
 * documented request shapes and should be treated as a starting point to test
 * once credentials arrive — not as known-good code. See docs/META_SETUP.md.
 *
 * Where a shape is genuinely uncertain the code fails loudly rather than
 * guessing quietly, because a social adapter that silently does the wrong
 * thing posts to a real audience.
 *
 * Scope note: only Instagram is implemented. Facebook, TikTok, and Pinterest
 * still throw, so `getIntegrations().social` being "live" does not mean every
 * platform works — each is checked per call.
 */

import { IntegrationError, NotImplementedError } from '../types';
import type { SocialPlatform, Timestamp } from '../../types';
import type {
  PublishPostInput,
  PublishResult,
  SocialAccount,
  SocialAuthorization,
  SocialConnection,
  SocialGateway,
  SocialMessage,
} from '../types';

/**
 * Pinned rather than floating. Meta ships breaking changes between versions,
 * and an adapter that follows "latest" breaks on their schedule instead of
 * ours.
 */
const GRAPH_VERSION = 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

/**
 * Permissions requested at consent time.
 *
 * Every one of these is behind App Review. Until review passes, the token
 * comes back with a subset and calls fail with a permissions error — which is
 * why `completeAuthorization` reports capabilities from the granted scopes
 * rather than assuming it got what it asked for.
 */
const SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
] as const;

export function isMetaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim());
}

function requireConfig(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new IntegrationError(
      'Meta is not configured. Set META_APP_ID and META_APP_SECRET.',
      'meta',
    );
  }
  return { appId, appSecret };
}

function assertInstagram(platform: SocialPlatform): void {
  if (platform !== 'instagram') {
    throw new NotImplementedError(
      'meta',
      `${platform}. Only Instagram has a live adapter; the others are still mock-only`,
    );
  }
}

interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
}

async function graph<T>(
  path: string,
  options: { method?: string; token?: string; params?: Record<string, string>; body?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [key, value] of Object.entries(options.params ?? {})) {
    url.searchParams.set(key, value);
  }
  if (options.token) url.searchParams.set('access_token', options.token);

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
      'meta',
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
      'meta',
      response.status >= 500,
    );
  }

  if (!response.ok) {
    const body = parsed as GraphErrorBody;
    const message = body.error?.message ?? `HTTP ${response.status}`;
    // Code 4 and 17 are Meta's rate limits; 5xx is theirs to fix. Everything
    // else means this request was wrong and will stay wrong.
    const retryable =
      response.status >= 500 || body.error?.code === 4 || body.error?.code === 17;
    throw new IntegrationError(`Meta: ${message}`, 'meta', retryable);
  }

  return parsed as T;
}

class MetaSocialGateway implements SocialGateway {
  readonly provider = 'meta';

  // --- oauth ------------------------------------------------------------

  async beginAuthorization(input: {
    platform: SocialPlatform;
    redirectUri: string;
    state: string;
  }): Promise<SocialAuthorization> {
    assertInstagram(input.platform);
    const { appId } = requireConfig();

    const url = new URL(OAUTH_DIALOG);
    url.searchParams.set('client_id', appId);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('state', input.state);
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('response_type', 'code');

    return { url: url.toString(), codeVerifier: null };
  }

  async completeAuthorization(input: {
    platform: SocialPlatform;
    code: string;
    redirectUri: string;
  }): Promise<SocialConnection> {
    assertInstagram(input.platform);
    const { appId, appSecret } = requireConfig();

    // 1. Code -> short-lived user token.
    const short = await graph<{ access_token: string }>('/oauth/access_token', {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: input.redirectUri,
        code: input.code,
      },
    });

    // 2. Exchange for a long-lived token. The short-lived one expires in about
    //    an hour, which would make every connection dead by the next sync.
    const long = await graph<{ access_token: string; expires_in?: number }>(
      '/oauth/access_token',
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: short.access_token,
        },
      },
    );

    const userToken = long.access_token;

    // 3. Find the Page, and through it the Instagram business account. An
    //    Instagram Professional account is always reached via its Page — there
    //    is no direct path, which is why the setup doc insists on linking one.
    const pages = await graph<{
      data: Array<{
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: { id: string };
      }>;
    }>('/me/accounts', {
      token: userToken,
      params: { fields: 'id,name,access_token,instagram_business_account' },
    });

    const page = pages.data?.find((candidate) => candidate.instagram_business_account);
    if (!page?.instagram_business_account) {
      throw new IntegrationError(
        'No Instagram Professional account is linked to a Facebook Page on this ' +
          'login. Convert the Instagram account to Business or Creator and link ' +
          'it to a Page, then connect again.',
        'meta',
      );
    }

    const igId = page.instagram_business_account.id;

    const profile = await graph<{
      username: string;
      name?: string;
      followers_count?: number;
    }>(`/${igId}`, {
      token: page.access_token,
      params: { fields: 'username,name,followers_count' },
    });

    // What was actually granted, which is not necessarily what was asked for.
    const granted = await graph<{
      data: Array<{ permission: string; status: string }>;
    }>('/me/permissions', { token: userToken });

    const scopes = (granted.data ?? [])
      .filter((entry) => entry.status === 'granted')
      .map((entry) => entry.permission);

    return {
      platform: 'instagram',
      handle: profile.username,
      displayName: profile.name ?? profile.username,
      followers: profile.followers_count ?? 0,
      externalAccountId: igId,
      // The Page token, not the user token: publishing and messaging both act
      // as the Page, and Page tokens derived from a long-lived user token do
      // not expire on their own.
      accessToken: page.access_token,
      refreshToken: null,
      expiresAt: long.expires_in
        ? new Date(Date.now() + long.expires_in * 1000).toISOString()
        : null,
      scopes,
      canPublish: scopes.includes('instagram_content_publish'),
      canCollectMessages: scopes.includes('instagram_manage_messages'),
    };
  }

  async revoke(input: { platform: SocialPlatform; accessToken: string }): Promise<void> {
    assertInstagram(input.platform);
    await graph('/me/permissions', { method: 'DELETE', token: input.accessToken });
  }

  // --- publishing -------------------------------------------------------

  async listAccounts(): Promise<SocialAccount[]> {
    // The linked-account list is `social_accounts` in our own database, which
    // the connections page already reads. Asking Meta would need a token this
    // method is not given.
    throw new NotImplementedError(
      'meta',
      'listing accounts without a token. Read social_accounts instead',
    );
  }

  async publish(input: PublishPostInput): Promise<PublishResult> {
    assertInstagram(input.platform);

    if (!input.accessToken) {
      throw new IntegrationError(
        'Publishing to Instagram needs the linked account’s token.',
        'meta',
      );
    }
    if (input.imageUrls.length === 0) {
      throw new IntegrationError('Instagram requires at least one image.', 'meta');
    }

    const token = input.accessToken;
    const igId = process.env.META_IG_USER_ID?.trim();
    if (!igId) {
      throw new IntegrationError(
        'META_IG_USER_ID is not set. It is the Instagram business account id ' +
          'recorded when the account was linked.',
        'meta',
      );
    }

    const caption = [input.caption, input.hashtags.map((tag) => `#${tag}`).join(' ')]
      .filter((part) => part.trim().length > 0)
      .join('\n\n');

    // Publishing is two steps: build a container, then publish it. A carousel
    // needs a container per image plus a parent container.
    let creationId: string;

    if (input.imageUrls.length === 1) {
      const container = await graph<{ id: string }>(`/${igId}/media`, {
        method: 'POST',
        token,
        body: { image_url: input.imageUrls[0]!, caption },
      });
      creationId = container.id;
    } else {
      const children: string[] = [];
      for (const imageUrl of input.imageUrls) {
        const child = await graph<{ id: string }>(`/${igId}/media`, {
          method: 'POST',
          token,
          body: { image_url: imageUrl, is_carousel_item: 'true' },
        });
        children.push(child.id);
      }

      const parent = await graph<{ id: string }>(`/${igId}/media`, {
        method: 'POST',
        token,
        body: { media_type: 'CAROUSEL', children: children.join(','), caption },
      });
      creationId = parent.id;
    }

    const published = await graph<{ id: string }>(`/${igId}/media_publish`, {
      method: 'POST',
      token,
      body: { creation_id: creationId },
    });

    const permalink = await graph<{ permalink?: string }>(`/${published.id}`, {
      token,
      params: { fields: 'permalink' },
    }).catch(() => ({ permalink: undefined }));

    return {
      externalId: published.id,
      url: permalink.permalink ?? null,
      publishedAt: new Date().toISOString(),
    };
  }

  async unpublish(): Promise<void> {
    // Instagram's API has no delete for published media. Saying so is more
    // useful than a no-op that implies the post is gone.
    throw new NotImplementedError(
      'meta',
      'deleting a published post — Instagram has no API for it. Remove it in the app',
    );
  }

  // --- messages ---------------------------------------------------------

  async fetchMessages(input: {
    platform: SocialPlatform;
    accessToken: string;
    since?: Timestamp;
  }): Promise<SocialMessage[]> {
    assertInstagram(input.platform);

    const conversations = await graph<{
      data: Array<{
        id: string;
        messages?: {
          data: Array<{
            id: string;
            created_time: string;
            from?: { id: string; username?: string; name?: string };
            message?: string;
          }>;
        };
      }>;
    }>('/me/conversations', {
      token: input.accessToken,
      params: {
        platform: 'instagram',
        fields: 'id,messages{id,created_time,from,message}',
      },
    });

    const cutoff = input.since ? new Date(input.since).getTime() : null;
    const messages: SocialMessage[] = [];

    for (const conversation of conversations.data ?? []) {
      for (const message of conversation.messages?.data ?? []) {
        const receivedAt = new Date(message.created_time);
        if (Number.isNaN(receivedAt.getTime())) continue;
        if (cutoff !== null && receivedAt.getTime() <= cutoff) continue;
        if (!message.message?.trim()) continue;

        const handle = message.from?.username?.trim();
        // Without a handle there is no key to file the message under, and
        // guessing one would attach a stranger's DM to a real client.
        if (!handle) continue;

        messages.push({
          externalId: message.id,
          platform: 'instagram',
          fromHandle: handle,
          fromName: message.from?.name?.trim() || handle,
          kind: 'direct_message',
          body: message.message,
          receivedAt: receivedAt.toISOString(),
          contextUrl: null,
        });
      }
    }

    return messages.sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
    );
  }
}

export function createMetaSocialGateway(): SocialGateway {
  return new MetaSocialGateway();
}
