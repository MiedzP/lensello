/**
 * `notify_staff` — an internal email, never seen by the client.
 *
 * Reuses `notifyStudio` rather than reimplementing recipient resolution: one
 * function decides who "the studio" is (`LENSELLO_NOTIFY_EMAIL`, or every
 * owner), and this step and the inbound-message alert should not be able to
 * disagree about who that is.
 */
import { notifyStudio } from '@/lib/notifications/notify';
import { notifyStaffConfigSchema } from '../schemas';
import { renderTemplate } from '../template';
import { templateVars } from '../context';
import { StepUnsupported } from './errors';
import { parseStepConfig, type StepExecutor } from './exec-types';

export const notifyStaff: StepExecutor = async ({ step, context }) => {
  const config = parseStepConfig(notifyStaffConfigSchema, step.config);
  const vars = templateVars(context);

  const subject = renderTemplate(config.subject, vars);
  const body = renderTemplate(config.body, vars);

  const sent = await notifyStudio(subject, body);

  if (!sent) {
    throw new StepUnsupported(
      'Nothing was sent — no studio notification recipient is configured ' +
        '(set LENSELLO_NOTIFY_EMAIL or provision an owner with an email address).',
    );
  }

  return { output: { subject } };
};
