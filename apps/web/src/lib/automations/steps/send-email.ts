/**
 * `send_email` — the one step most automations exist for.
 *
 * Two safety checks before anything reaches `getIntegrations().mail`:
 *  1. The client needs an email address at all.
 *  2. If this email is marked `category: 'marketing'`, the client's
 *     `marketing_consent` must be true. That column is maintained by a
 *     trigger on `client_consents` (see `20260806180000_consent_and_audit.sql`)
 *     — this step reads it, never writes it. A transactional email (booking
 *     confirmations, gallery-ready notices — things the studio owes the
 *     client regardless of marketing preference) skips the check entirely.
 */

import { getIntegrations } from '@lensello/core/integrations';
import { sendEmailConfigSchema } from '../schemas';
import { renderTemplate } from '../template';
import { templateVars } from '../context';
import { StepSkipped } from './errors';
import { parseStepConfig, type StepExecutor } from './exec-types';

export const sendEmail: StepExecutor = async ({ step, context }) => {
  const config = parseStepConfig(sendEmailConfigSchema, step.config);
  const { client } = context;

  if (!client) {
    throw new Error('No client is attached to this run, so there is no address to email.');
  }
  if (!client.email) {
    throw new Error(`${client.name} has no email address on record.`);
  }
  if (config.category === 'marketing' && !client.marketing_consent) {
    throw new StepSkipped(
      `${client.name} has not given marketing consent, so this marketing email was not sent.`,
    );
  }

  const vars = templateVars(context);
  const subject = renderTemplate(config.subject, vars);
  const body = renderTemplate(config.body, vars);

  const { mail } = getIntegrations();
  const result = await mail.send({ toEmail: client.email, toName: client.name, subject, body });

  return {
    output: {
      to: client.email,
      subject,
      externalId: result.externalId,
      publishedAt: result.publishedAt,
    },
  };
};
