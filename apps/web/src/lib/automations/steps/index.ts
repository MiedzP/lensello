import type { ActionKind } from '../types';
import type { StepExecutor } from './exec-types';
import { sendEmail } from './send-email';
import { sendSms } from './send-sms';
import { sendDm } from './send-dm';
import { createTask } from './create-task';
import { createClient } from './create-client';
import { updateClientStage } from './update-client-stage';
import { addTag } from './add-tag';
import { draftReply } from './draft-reply';
import { notifyStaff } from './notify-staff';
import { webhook } from './webhook';
import { wait } from './wait';
import { branch } from './branch';

export * from './exec-types';
export { StepSkipped, StepUnsupported } from './errors';

export const STEP_EXECUTORS: Record<ActionKind, StepExecutor> = {
  send_email: sendEmail,
  send_sms: sendSms,
  send_dm: sendDm,
  create_task: createTask,
  create_client: createClient,
  update_client_stage: updateClientStage,
  add_tag: addTag,
  draft_reply: draftReply,
  notify_staff: notifyStaff,
  webhook,
  wait,
  branch,
};
