/**
 * `create_client` — files a new client record if this email is not known yet.
 *
 * Mirrors the dedupe reasoning in `lib/inquiries/submit.ts`: `upsert` with
 * `ignoreDuplicates` rather than a plain insert, so a race between two events
 * for the same email cannot produce two client rows, and — just as important —
 * cannot silently reset an existing client's `stage` back to whatever this
 * automation was configured with.
 */

import { createClientConfigSchema } from '../schemas';
import { renderTemplate } from '../template';
import { templateVars } from '../context';
import { parseStepConfig, type StepExecutor } from './exec-types';

export const createClient: StepExecutor = async ({ admin, step, context }) => {
  const config = parseStepConfig(createClientConfigSchema, step.config);
  const vars = templateVars(context);

  const name = renderTemplate(config.nameTemplate, vars).trim();
  const email = renderTemplate(config.emailTemplate, vars).trim().toLowerCase();

  if (!email || !email.includes('@')) {
    throw new Error(
      `The email template ("${config.emailTemplate}") did not resolve to a usable address for this trigger.`,
    );
  }

  const { data: existing } = await admin.from('clients').select('id').eq('email', email).maybeSingle();
  if (existing) {
    return { output: { clientId: existing.id, created: false, email } };
  }

  const { data: created, error } = await admin
    .from('clients')
    .upsert(
      { name: name || email, email, stage: config.stage, source: 'other' },
      { onConflict: 'email', ignoreDuplicates: true },
    )
    .select('id');

  if (error) throw new Error(`Could not create the client: ${error.message}`);

  if (created?.[0]) {
    return { output: { clientId: created[0].id, created: true, email } };
  }

  // Lost a race with a concurrent writer. The row exists now; read the winner.
  const { data: raced } = await admin.from('clients').select('id').eq('email', email).maybeSingle();
  if (!raced) throw new Error('The client record could not be created or found after a race.');
  return { output: { clientId: raced.id, created: false, email } };
};
