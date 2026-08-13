/**
 * `send_sms` — deliberately unimplemented.
 *
 * There is no SMS adapter in `@lensello/core/integrations` (`mail`, `social`,
 * `payments`, `calendar` only). The brief is explicit that this must fail
 * visibly as unconfigured rather than silently doing nothing: a step that
 * quietly no-ops looks, from the run history, exactly like a step that ran
 * and had nothing to do — and "why didn't this client get a text" would have
 * no answer. Throwing gives it one: the run/step is recorded as `failed`
 * with this message, in the same place every other failure lands.
 */
import { StepUnsupported } from './errors';
import type { StepExecutor } from './exec-types';

export const sendSms: StepExecutor = async () => {
  throw new StepUnsupported(
    'Text messages are not available yet — there is no SMS provider configured for this workspace. ' +
      'Add an SMS adapter to packages/core/src/integrations before enabling this step.',
  );
};
