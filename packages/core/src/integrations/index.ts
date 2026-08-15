/**
 * Integration entry point. Modules call `getIntegrations()` and nothing else.
 *
 * Each capability resolves on its own. That matters because approvals arrive at
 * different times: email needs nobody's permission, while Instagram waits on
 * Meta App Review. All-or-nothing mode selection would mean holding real email
 * hostage to an unrelated approval.
 *
 * The rule that survives from the original design: **live mode never silently
 * hands back a mock.** In live mode an unconfigured capability throws when it
 * is used, so a half-configured deploy cannot look like it is posting to
 * Instagram when it isn't. What changed is only *when* it throws — on use of
 * that capability, rather than on construction of the whole registry, so one
 * missing credential no longer takes down the capabilities that are ready.
 *
 * Resolution is lazy: a module that only sends mail never constructs the
 * social adapter, and therefore never trips its missing-credential error.
 */

import { createMockDriveSource, createMockIntegrations } from './mock';
import { createPostmarkMailClient, isPostmarkConfigured } from './live/postmark';
import { createMetaSocialGateway, isMetaConfigured } from './live/meta';
import { createStripePaymentClient, isStripeConfigured } from './live/stripe';
import { createMetaAdManager, isMetaAdsConfigured } from './live/meta-ads';
import {
  createGoogleCalendarClient,
  isGoogleCalendarConfigured,
} from './live/google-calendar';
import { createGoogleDriveSource, isGoogleDriveConfigured } from './live/google-drive';
import {
  IntegrationError,
  NotImplementedError,
  type AdManager,
  type CalendarClient,
  type DriveSource,
  type IntegrationMode,
  type Integrations,
  type MailClient,
  type PaymentClient,
  type SocialGateway,
} from './types';

export * from './types';
export { createMockIntegrations } from './mock';
// The inbound webhook normalises Postmark's payload with the same function the
// polling adapter uses, so pushed and pulled copies of one email produce
// identical rows.
export { toInboundMessage } from './live/postmark';
// A connected mailbox is built per request from credentials in the database,
// not from the environment, so it is not part of the registry below.
export {
  createMailboxClient,
  guessHosts,
  type MailboxConfig,
} from './live/mailbox';

let cached: Integrations | null = null;

function resolveMode(): IntegrationMode {
  const raw = process.env.LENSELLO_INTEGRATION_MODE?.trim().toLowerCase();
  if (!raw || raw === 'mock') return 'mock';
  if (raw === 'live') return 'live';
  throw new IntegrationError(
    `Unknown LENSELLO_INTEGRATION_MODE "${raw}". Expected "mock" or "live".`,
    'config',
  );
}

/**
 * Memoises a getter so the adapter is built once, on first use.
 *
 * The laziness is the point — see the module comment. Building eagerly would
 * make an unconfigured capability throw for callers that never touch it.
 */
function lazy<T>(build: () => T): () => T {
  let value: T | undefined;
  let built = false;
  return () => {
    if (!built) {
      value = build();
      built = true;
    }
    return value as T;
  };
}

export function getIntegrations(): Integrations {
  if (cached) return cached;

  const mode = resolveMode();
  const mocks = createMockIntegrations();

  const social = lazy<SocialGateway>(() => {
    if (isMetaConfigured()) return createMetaSocialGateway();
    if (mode === 'mock') return mocks.social;
    throw new NotImplementedError(
      'meta',
      'social publishing and messaging. Set META_APP_ID and META_APP_SECRET, ' +
        'and complete Meta App Review',
    );
  });

  const mail = lazy<MailClient>(() => {
    if (isPostmarkConfigured()) return createPostmarkMailClient();
    if (mode === 'mock') return mocks.mail;
    throw new NotImplementedError(
      'postmark',
      'sending and reading mail. Set POSTMARK_SERVER_TOKEN and ' +
        'LENSELLO_FROM_EMAIL',
    );
  });

  const ads = lazy<AdManager>(() => {
    if (isMetaAdsConfigured()) return createMetaAdManager();
    if (mode === 'mock') return mocks.ads;
    throw new NotImplementedError(
      'meta-ads',
      'ad management. Set META_AD_ACCOUNT_ID and META_ADS_ACCESS_TOKEN, and ' +
        'complete Meta App Review for ads_management',
    );
  });

  const calendar = lazy<CalendarClient>(() => {
    if (isGoogleCalendarConfigured()) return createGoogleCalendarClient();
    if (mode === 'mock') return mocks.calendar;
    throw new NotImplementedError(
      'google-calendar',
      'calendar sync. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, ' +
        'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY and GOOGLE_CALENDAR_ID, and share ' +
        'the studio calendar with the service account',
    );
  });

  const payments = lazy<PaymentClient>(() => {
    if (isStripeConfigured()) return createStripePaymentClient();
    if (mode === 'mock') return mocks.payments;
    throw new NotImplementedError(
      'stripe',
      'deposits and invoices. Set STRIPE_SECRET_KEY',
    );
  });

  cached = {
    mode,
    get social() {
      return social();
    },
    get ads() {
      return ads();
    },
    get mail() {
      return mail();
    },
    get calendar() {
      return calendar();
    },
    get payments() {
      return payments();
    },
  };

  return cached;
}

/**
 * Which capabilities are backed by something real.
 *
 * For UI that needs to say "this is a simulation" without constructing an
 * adapter — asking the registry directly would throw for the very capabilities
 * it is trying to describe.
 */
export function integrationStatus(): {
  mode: IntegrationMode;
  social: 'live' | 'mock' | 'unavailable';
  mail: 'live' | 'mock' | 'unavailable';
  payments: 'live' | 'mock' | 'unavailable';
  ads: 'live' | 'mock' | 'unavailable';
  calendar: 'live' | 'mock' | 'unavailable';
} {
  const mode = resolveMode();
  const describe = (configured: boolean) =>
    configured ? 'live' : mode === 'mock' ? 'mock' : 'unavailable';

  return {
    mode,
    social: describe(isMetaConfigured()),
    mail: describe(isPostmarkConfigured()),
    payments: describe(isStripeConfigured()),
    ads: describe(isMetaAdsConfigured()),
    calendar: describe(isGoogleCalendarConfigured()),
  };
}

/** Test seam: drops the memoised registry. */
export function resetIntegrations(): void {
  cached = null;
}

// --- drive (photo import) -------------------------------------------------
//
// Deliberately not a field on `Integrations`: every other capability there is
// something several modules reach for, so it belongs on the shared registry.
// Drive photo import is owned start to finish by one module (browsing,
// selecting, importing), the same shape as the connected-mailbox client
// above — so it is resolved the same lazy, throw-when-unconfigured way
// (see the module comment at the top of this file) without widening the
// registry interface for every other module that never touches it.

let driveSource: DriveSource | null = null;

export function getDriveSource(): DriveSource {
  if (driveSource) return driveSource;

  if (isGoogleDriveConfigured()) {
    driveSource = createGoogleDriveSource();
    return driveSource;
  }

  if (resolveMode() === 'mock') {
    driveSource = createMockDriveSource();
    return driveSource;
  }

  throw new NotImplementedError(
    'google-drive',
    'importing photos from Drive. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and ' +
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and share the Drive folder with ' +
      'the service account',
  );
}

export { isGoogleDriveConfigured };

/**
 * Which mode Drive is actually running in, without constructing the adapter —
 * same reasoning as `integrationStatus()` above, kept separate because Drive
 * is not one of its fields.
 */
export function driveStatus(): 'live' | 'mock' | 'unavailable' {
  if (isGoogleDriveConfigured()) return 'live';
  return resolveMode() === 'mock' ? 'mock' : 'unavailable';
}

/** Test seam: drops the memoised Drive adapter. */
export function resetDriveSource(): void {
  driveSource = null;
}
