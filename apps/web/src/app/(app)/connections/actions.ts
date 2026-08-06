'use server';

/**
 * Connections Server Actions.
 *
 * Every one of these starts with `requireUser()`. Server Actions are reachable
 * by direct POST, so the fact that the page only renders these buttons for a
 * signed-in staff member proves nothing about who can invoke them.
 */

import { randomBytes } from 'node:crypto';
import type { Route } from 'next';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { SOCIAL_PLATFORMS } from '@lensello/core';
import {
  IntegrationError,
  createMailboxClient,
  getIntegrations,
  guessHosts,
} from '@lensello/core/integrations';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptSecret, isEncryptionConfigured } from '@/lib/crypto/secret-box';
import { failed, ok, type ActionState } from '@/lib/connections/action-state';
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
  callbackUrl,
  encodeState,
  resolveOrigin,
} from '@/lib/connections/oauth';
import {
  listCollectableAccounts,
  readAccessToken,
} from '@/lib/connections/queries';
import { syncSocialMessages } from '@/lib/connections/sync';

const platformSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
});

const port = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? Number(value) : undefined))
  .refine(
    (value) => value === undefined || (Number.isInteger(value) && value > 0 && value < 65536),
    'Ports must be between 1 and 65535.',
  );

const mailboxSchema = z.object({
  emailAddress: z.string().trim().email('Enter a valid email address.'),
  displayName: z.string().trim().max(120).optional(),
  // Gmail shows app passwords with spaces in them; people paste what they see.
  password: z
    .string()
    .min(1, 'Enter the app password.')
    .transform((value) => value.replace(/\s+/g, '')),
  imapHost: z.string().trim().optional(),
  smtpHost: z.string().trim().optional(),
  imapPort: port,
  smtpPort: port,
});

function describe(cause: unknown, fallback: string): string {
  if (cause instanceof IntegrationError) {
    return cause.message + (cause.retryable ? ' You can try again.' : '');
  }
  if (cause instanceof Error) return cause.message;
  return fallback;
}

/**
 * Starts the linking handshake and sends the browser to the provider.
 *
 * The `state` is minted here, stored in an httpOnly cookie, and compared on the
 * way back. Without that comparison an attacker can hand a staff member a
 * crafted callback URL and have them link an account the studio does not own.
 */
export async function startConnection(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const parsed = platformSchema.safeParse({ platform: formData.get('platform') });
  if (!parsed.success) return failed('Unknown platform.');
  const { platform } = parsed.data;

  const state = randomBytes(32).toString('base64url');

  let url: string;
  try {
    const origin = await resolveOrigin();
    const { social } = getIntegrations();
    const authorization = await social.beginAuthorization({
      platform,
      redirectUri: callbackUrl(origin, platform),
      state,
    });
    url = authorization.url;
  } catch (cause) {
    return failed(
      `Could not start linking ${platform}: ${describe(cause, 'no social adapter is available.')}`,
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, encodeState(platform, state), {
    httpOnly: true,
    // Lax rather than Strict: the provider sends the browser back with a
    // top-level GET, and Strict would withhold the cookie on exactly that
    // navigation, breaking every link attempt.
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/connections',
    maxAge: OAUTH_STATE_TTL_SECONDS,
  });

  // Throws NEXT_REDIRECT, so nothing below runs. Deliberately outside the
  // try/catch above, which would otherwise swallow it as a failure.
  //
  // `typedRoutes` wants a literal in-app path; this target is the provider's
  // own consent screen and cannot be one, so the cast is the documented escape
  // hatch — the same one login/actions.ts uses for its dynamic `next`.
  redirect(url as Route);
}

export async function disconnect(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = platformSchema.safeParse({ platform: formData.get('platform') });
  if (!parsed.success) return failed('Unknown platform.');
  const { platform } = parsed.data;

  const { data: account } = await supabase
    .from('social_accounts')
    .select('id, handle')
    .eq('platform', platform)
    .maybeSingle();

  if (!account) return failed(`${platform} is not linked.`);

  // Tell the provider first, while the token still exists. Best effort: a
  // token the platform has already invalidated is not a reason to leave a dead
  // row in the table.
  try {
    const admin = createAdminClient();
    const accessToken = await readAccessToken(admin, account.id);
    if (accessToken) {
      await getIntegrations().social.revoke({ platform, accessToken });
    }
  } catch {
    // Intentionally ignored — see above.
  }

  // Cascades to social_account_secrets, so the token does not outlive the link.
  const { error } = await supabase.from('social_accounts').delete().eq('id', account.id);
  if (error) return failed(`Could not unlink ${platform}: ${error.message}`);

  revalidatePath('/connections');
  return ok(`Unlinked @${account.handle}.`);
}

/**
 * Connects the studio mailbox.
 *
 * The credentials are proven before anything is written: a stored mailbox that
 * has never been tested is a mailbox that fails the first time somebody tries
 * to answer a client, which is the worst possible moment to find out.
 */
export async function connectMailbox(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, supabase } = await requireUser();

  if (!isEncryptionConfigured()) {
    return failed(
      'LENSELLO_ENCRYPTION_KEY is not set, so the password cannot be stored ' +
        'safely. Generate one with: openssl rand -base64 32',
    );
  }

  const parsed = mailboxSchema.safeParse({
    emailAddress: formData.get('emailAddress'),
    displayName: formData.get('displayName') ?? undefined,
    password: formData.get('password'),
    imapHost: formData.get('imapHost') ?? undefined,
    smtpHost: formData.get('smtpHost') ?? undefined,
    imapPort: formData.get('imapPort') ?? undefined,
    smtpPort: formData.get('smtpPort') ?? undefined,
  });

  if (!parsed.success) {
    return failed(parsed.error.issues[0]?.message ?? 'Check those details.');
  }

  const input = parsed.data;
  const emailAddress = input.emailAddress.toLowerCase();
  const guessed = guessHosts(emailAddress);

  const imapHost = input.imapHost || guessed?.imapHost;
  const smtpHost = input.smtpHost || guessed?.smtpHost;

  if (!imapHost || !smtpHost) {
    return failed(
      `We do not know the mail servers for ${emailAddress.split('@')[1]}. ` +
        'Enter the IMAP and SMTP hostnames — your provider publishes them.',
    );
  }

  const config = {
    emailAddress,
    displayName: input.displayName || '',
    password: input.password,
    imapHost,
    imapPort: input.imapPort ?? guessed?.imapPort ?? 993,
    smtpHost,
    smtpPort: input.smtpPort ?? guessed?.smtpPort ?? 465,
  };

  // Proves both reading and sending before a single row is written.
  try {
    await createMailboxClient(config).testConnection();
  } catch (cause) {
    return failed(describe(cause, 'Could not connect to that mailbox.'));
  }

  const { data: mailbox, error: mailboxError } = await supabase
    .from('mailboxes')
    .upsert(
      {
        email_address: config.emailAddress,
        display_name: config.displayName,
        imap_host: config.imapHost,
        imap_port: config.imapPort,
        smtp_host: config.smtpHost,
        smtp_port: config.smtpPort,
        status: 'connected',
        last_error: null,
        connected_by: user.id,
      },
      { onConflict: 'email_address' },
    )
    .select('id')
    .single();

  if (mailboxError || !mailbox) {
    return failed(`Could not save the mailbox: ${mailboxError?.message ?? 'unknown error.'}`);
  }

  const admin = createAdminClient();
  const { error: secretError } = await admin.from('mailbox_secrets').upsert(
    { mailbox_id: mailbox.id, password: encryptSecret(config.password) },
    { onConflict: 'mailbox_id' },
  );

  if (secretError) {
    // A mailbox row with no password would look connected and fail on use.
    await supabase.from('mailboxes').delete().eq('id', mailbox.id);
    return failed(`Could not store the password: ${secretError.message}`);
  }

  // Exactly one primary is a database guarantee, so the old one is stood down
  // before this one is promoted rather than relying on the insert to win.
  await supabase.from('mailbox_roles').delete().neq('mailbox_id', mailbox.id);
  await supabase
    .from('mailbox_roles')
    .upsert({ mailbox_id: mailbox.id, is_primary: true }, { onConflict: 'mailbox_id' });

  revalidatePath('/connections');
  revalidatePath('/clients');
  return ok(`${config.emailAddress} is connected. Replies will send from it.`);
}

export async function disconnectMailbox(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const mailboxId = formData.get('mailboxId');
  if (typeof mailboxId !== 'string' || !mailboxId) return failed('Unknown mailbox.');

  // Cascades to mailbox_roles and mailbox_secrets, so the password does not
  // outlive the connection.
  const { error } = await supabase.from('mailboxes').delete().eq('id', mailboxId);
  if (error) return failed(`Could not disconnect the mailbox: ${error.message}`);

  revalidatePath('/connections');
  return ok('Mailbox disconnected.');
}

/**
 * Pulls messages from linked accounts that can supply them.
 *
 * A `platform` field narrows it to one account; without it every collectable
 * account is synced. One account failing does not stop the others — an expired
 * Instagram token should not silently cost you the Facebook inquiries.
 */
export async function syncMessages(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const admin = createAdminClient();

  const requested = formData.get('platform');
  const only = platformSchema.safeParse({ platform: requested });
  if (requested !== null && !only.success) return failed('Unknown platform.');

  let accounts;
  try {
    accounts = await listCollectableAccounts(supabase);
  } catch (cause) {
    return failed(describe(cause, 'Could not load linked accounts.'));
  }

  if (only.success) {
    accounts = accounts.filter((account) => account.platform === only.data.platform);
  }

  if (accounts.length === 0) {
    return failed(
      only.success
        ? `${only.data.platform} is not linked, or was not granted access to messages.`
        : 'No linked account can collect messages yet. Link one below first.',
    );
  }

  let newMessages = 0;
  let newClients = 0;
  const failures: string[] = [];

  for (const account of accounts) {
    try {
      const result = await syncSocialMessages(supabase, admin, account);
      newMessages += result.newMessages;
      newClients += result.newClients;
    } catch (cause) {
      failures.push(`${account.platform}: ${describe(cause, 'sync failed.')}`);
    }
  }

  revalidatePath('/connections');
  revalidatePath('/clients');

  if (failures.length === accounts.length) {
    return failed(failures.join(' '));
  }

  const summary =
    `Filed ${newMessages} new ${newMessages === 1 ? 'message' : 'messages'}` +
    (newClients > 0
      ? ` and created ${newClients} new ${newClients === 1 ? 'client' : 'clients'}.`
      : '.');

  return failures.length > 0
    ? { error: failures.join(' '), message: summary }
    : ok(summary);
}
