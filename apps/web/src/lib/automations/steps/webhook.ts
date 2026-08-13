/**
 * `webhook` (action) — an outbound HTTP call to a URL the photographer chose.
 *
 * Not a call to one of the studio's own integrations, so `getIntegrations()`
 * does not apply here — this is the generic escape hatch the schema's
 * `action_kind` check constraint names explicitly, for wiring an automation
 * into a spreadsheet, Zapier, or anything else outside this platform. `fetch`
 * is therefore the right tool for this one step, not a rule broken.
 *
 * A minimal SSRF guard blocks the obvious cases (localhost, loopback, link-
 * local) so a misconfigured URL cannot be used to probe the server's own
 * network. It is not exhaustive — a DNS name that resolves to a private
 * address at request time would slip through — and is not a substitute for
 * running this behind a proper egress policy in production.
 */

import { webhookConfigSchema } from '../schemas';
import { templateVars } from '../context';
import { parseStepConfig, type StepExecutor } from './exec-types';

const BLOCKED_HOSTS = /^(localhost|127\.|0\.0\.0\.0|::1|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i;

const TIMEOUT_MS = 10_000;

export const webhook: StepExecutor = async ({ step, context }) => {
  const config = parseStepConfig(webhookConfigSchema, step.config);

  const url = new URL(config.url);
  if (BLOCKED_HOSTS.test(url.hostname)) {
    throw new Error(`Refusing to call ${url.hostname} — it looks like a local or private address.`);
  }

  const vars = templateVars(context);
  const payload = {
    automation: vars.automation,
    trigger: context.trigger.kind,
    client: context.client
      ? { id: context.client.id, name: context.client.name, email: context.client.email }
      : null,
    data: context.trigger.payload,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: config.method,
      headers: config.method === 'POST' ? { 'content-type': 'application/json' } : undefined,
      body: config.method === 'POST' ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`The URL responded with HTTP ${response.status}.`);
    }

    return { output: { url: config.url, status: response.status } };
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw new Error(`The webhook did not respond within ${TIMEOUT_MS / 1000} seconds.`);
    }
    throw cause instanceof Error ? cause : new Error('The webhook call failed.');
  } finally {
    clearTimeout(timeout);
  }
};
