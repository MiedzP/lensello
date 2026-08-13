/**
 * `add_tag` — deliberately unimplemented.
 *
 * `clients` has no tag column and there is no `client_tags` table (only
 * `assets.tags`, which belongs to photo library items, not people). Rather
 * than repurpose an unrelated column or silently drop the tag, this fails
 * visibly — same reasoning as `send_sms`. Flagged in the build report as a
 * schema gap for whoever owns `clients` next.
 */
import { StepUnsupported } from './errors';
import type { StepExecutor } from './exec-types';

export const addTag: StepExecutor = async () => {
  throw new StepUnsupported(
    'Client tagging is not available yet — the clients table has no tag storage. ' +
      'Add a tags column or client_tags table before enabling this step.',
  );
};
