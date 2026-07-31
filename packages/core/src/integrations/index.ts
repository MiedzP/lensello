/**
 * Integration entry point. Modules call `getIntegrations()` and nothing else.
 *
 * `LENSELLO_INTEGRATION_MODE=live` is accepted but not yet servable — no live
 * adapter exists until Meta app review, Google OAuth verification, and Stripe
 * onboarding are done. Asking for `live` fails loudly rather than silently
 * handing back mocks, so a half-configured deploy can't look like it is
 * posting to Instagram when it isn't.
 */

import { createMockIntegrations } from './mock';
import { IntegrationError, type IntegrationMode, type Integrations } from './types';

export * from './types';
export { createMockIntegrations } from './mock';

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

export function getIntegrations(): Integrations {
  if (cached) return cached;

  const mode = resolveMode();
  if (mode === 'live') {
    throw new IntegrationError(
      'LENSELLO_INTEGRATION_MODE=live is not supported yet. Live adapters for ' +
        'Meta, Google, and Stripe are still to be built — see the integration ' +
        'checklist in README.md. Set the mode back to "mock" to run the app.',
      'config',
    );
  }

  cached = createMockIntegrations();
  return cached;
}

/** Test seam: drops the memoised registry. */
export function resetIntegrations(): void {
  cached = null;
}
