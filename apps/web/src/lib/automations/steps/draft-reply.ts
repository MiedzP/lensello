/**
 * `draft_reply` — prepares a reply for a human to send, rather than sending
 * anything to the client.
 *
 * There is no drafts table this could write to that the Clients inbox already
 * reads (`messages.is_ai_draft` marks a draft *shown in the composer during a
 * live session*, not a persisted queue an automation can add to — inserting an
 * `outbound` row here would misrepresent something nobody sent as sent). So
 * this reuses `notifyStudio`: the drafted subject and body are emailed to the
 * studio, who copy it into a real reply. Slower than a one-click send, but
 * honest about what actually happened, which is the same trade-off the brief
 * makes for `send_sms` and `add_tag`.
 */

import { notifyStudio } from '@/lib/notifications/notify';
import { draftReplyConfigSchema } from '../schemas';
import { renderTemplate } from '../template';
import { templateVars } from '../context';
import { StepUnsupported } from './errors';
import { parseStepConfig, type StepExecutor } from './exec-types';

export const draftReply: StepExecutor = async ({ step, context }) => {
  const config = parseStepConfig(draftReplyConfigSchema, step.config);
  const vars = templateVars(context);

  const subject = renderTemplate(config.subject, vars);
  const body = renderTemplate(config.body, vars);
  const clientName = context.client?.name ?? 'a client';

  const sent = await notifyStudio(
    `Draft ready: ${subject}`,
    `A drafted reply for ${clientName} is ready to review and send by hand.\n\n` +
      `Subject: ${subject}\n\n${body}`,
  );

  if (!sent) {
    throw new StepUnsupported(
      'The draft could not be delivered — no studio notification recipient is configured ' +
        '(set LENSELLO_NOTIFY_EMAIL or provision an owner with an email address).',
    );
  }

  return { output: { subject, clientName } };
};
