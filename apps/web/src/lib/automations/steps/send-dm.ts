/**
 * `send_dm` — a direct message on whichever platform the client is linked on.
 *
 * Mirrors the reasoning in `clients/actions.ts::sendByDirectMessage`: addressed
 * by the platform-scoped `external_user_id`, never by handle, because handles
 * get reassigned and a message sent to whoever holds the handle today is not
 * a recoverable mistake. This is a separate, smaller implementation rather
 * than an import of that function — this module only ever holds the
 * service-role client, and that helper is written against the cookie-bound
 * session client, so re-querying the two small tables directly here avoids
 * coupling this runner to a type it does not actually need.
 */

import { getIntegrations, IntegrationError } from '@lensello/core/integrations';
import type { SocialPlatform } from '@lensello/core';
import { sendDmConfigSchema } from '../schemas';
import { renderTemplate } from '../template';
import { templateVars } from '../context';
import { parseStepConfig, type StepExecutor } from './exec-types';

export const sendDm: StepExecutor = async ({ admin, step, context }) => {
  const config = parseStepConfig(sendDmConfigSchema, step.config);
  const { client } = context;

  if (!client) {
    throw new Error('No client is attached to this run, so there is nowhere to send a direct message.');
  }

  const inferredPlatform =
    context.trigger.payload && typeof context.trigger.payload.channel === 'string'
      ? (context.trigger.payload.channel as string)
      : null;

  const { data: handles } = await admin
    .from('client_social_handles')
    .select('platform, handle, external_user_id')
    .eq('client_id', client.id);

  const handle =
    (inferredPlatform && handles?.find((row) => row.platform === inferredPlatform)) ??
    handles?.[0] ??
    null;

  if (!handle) {
    throw new Error(`${client.name} has no linked social handle to message.`);
  }
  if (!handle.external_user_id) {
    throw new Error(
      `The ${handle.platform} sender id for @${handle.handle} was never captured, so a message cannot be addressed.`,
    );
  }

  const platform = handle.platform as SocialPlatform;

  const { data: account } = await admin
    .from('social_accounts')
    .select('id')
    .eq('platform', platform)
    .eq('status', 'connected')
    .eq('can_publish', true)
    .maybeSingle();

  if (!account) {
    throw new IntegrationError(`${platform} is not linked, so this message cannot be sent.`, platform);
  }

  const { data: secret } = await admin
    .from('social_account_secrets')
    .select('access_token, expires_at')
    .eq('account_id', account.id)
    .maybeSingle();

  if (!secret || (secret.expires_at && new Date(secret.expires_at).getTime() <= Date.now())) {
    throw new IntegrationError(`The ${platform} connection has expired. Reconnect it on Connections.`, platform);
  }

  const body = renderTemplate(config.body, templateVars(context));

  const result = await getIntegrations().social.sendMessage({
    platform,
    accessToken: secret.access_token,
    toExternalId: handle.external_user_id,
    body,
  });

  return { output: { platform, externalId: result.externalId, publishedAt: result.publishedAt } };
};
