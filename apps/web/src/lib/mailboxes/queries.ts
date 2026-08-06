/**
 * Reads for the connected mailbox.
 *
 * Nothing a page can call returns the password. `mailbox_secrets` is reachable
 * only through `resolveMailClient`, which demands the service-role client, so a
 * Server Component cannot leak a credential into a payload by selecting `*`.
 */

import {
  createMailboxClient,
  getIntegrations,
  type MailboxConfig,
} from '@lensello/core/integrations';
import type { MailClient } from '@lensello/core/integrations';
import type { Session } from '@/lib/auth';
import type { Tables } from '@/lib/db.types';
import type { createAdminClient } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/crypto/secret-box';

type Supabase = Session['supabase'];
type Admin = ReturnType<typeof createAdminClient>;

export type MailboxRow = Tables<'mailboxes'>;

/** The mailbox replies are sent from, or null when none is connected. */
export async function getPrimaryMailbox(supabase: Supabase): Promise<MailboxRow | null> {
  const { data, error } = await supabase
    .from('mailbox_roles')
    .select('mailbox_id, is_primary, mailboxes(*)')
    .eq('is_primary', true)
    .maybeSingle();

  if (error || !data) return null;

  // The embedded row comes back as an object for a to-one relationship; the
  // generated types model it loosely, so it is narrowed here rather than cast
  // at every call site.
  const mailbox = (data as unknown as { mailboxes: MailboxRow | null }).mailboxes;
  return mailbox ?? null;
}

/** Every connected mailbox, for the connections page. */
export async function listMailboxes(supabase: Supabase): Promise<MailboxRow[]> {
  const { data, error } = await supabase
    .from('mailboxes')
    .select('*')
    .order('created_at');

  if (error) throw new Error(`Could not load mailboxes: ${error.message}`);
  return data ?? [];
}

/**
 * The mail client to use for outbound and inbound client mail.
 *
 * A connected mailbox wins, because replies from the studio's real address
 * thread properly and land back in the inbox the photographer watches. With no
 * mailbox connected this falls through to whatever the registry provides —
 * Postmark if configured, the mock otherwise — so the app keeps working during
 * setup rather than failing until a mailbox exists.
 */
export async function resolveMailClient(
  supabase: Supabase,
  admin: Admin,
): Promise<{ mail: MailClient; mailbox: MailboxRow | null }> {
  const mailbox = await getPrimaryMailbox(supabase);
  if (!mailbox || mailbox.status === 'disabled') {
    return { mail: getIntegrations().mail, mailbox: null };
  }

  const { data: secret } = await admin
    .from('mailbox_secrets')
    .select('password')
    .eq('mailbox_id', mailbox.id)
    .maybeSingle();

  if (!secret) {
    // Metadata without a secret means a half-finished connect. Falling back
    // silently would send from the wrong address, so this is surfaced.
    throw new Error(
      `The mailbox ${mailbox.email_address} has no stored password. Reconnect it on Connections.`,
    );
  }

  const config: MailboxConfig = {
    emailAddress: mailbox.email_address,
    displayName: mailbox.display_name,
    password: decryptSecret(secret.password),
    imapHost: mailbox.imap_host,
    imapPort: mailbox.imap_port,
    smtpHost: mailbox.smtp_host,
    smtpPort: mailbox.smtp_port,
  };

  return { mail: createMailboxClient(config), mailbox };
}
