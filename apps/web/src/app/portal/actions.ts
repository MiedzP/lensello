'use server';

/**
 * Portal sign-in, passcode reset, and sign-out.
 *
 * None of this touches Supabase auth. A portal visitor is never an
 * `auth.users` row — they get a row in `client_portal_sessions` instead,
 * checked by hand on every request, exactly as `/g/[token]` checks a gallery
 * token by hand. Giving them a Supabase session would put them inside the
 * studio's RLS perimeter, which is precisely the thing a client is not.
 */

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getIntegrations } from '@lensello/core/integrations';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashVisitor } from '@/lib/crypto/share-token';
import { signInWithPasscode, PortalThrottled } from '@/lib/portal/auth';
import { issuePortalInvite } from '@/lib/portal/invite';
import {
  createPortalSession,
  destroyPortalSession,
  PORTAL_COOKIE_NAME,
  PORTAL_SESSION_TTL_SECONDS,
} from '@/lib/portal/session';
import { PORTAL_IDLE, type PortalState } from './portal-state';

async function callerIpHash(): Promise<string | null> {
  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim();
  return ip ? hashVisitor(ip, 'portal') : null;
}

/** Best guess at this deployment's own origin, for links inside emails. */
async function appOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
  const proto = headerList.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : 'https://lensello-web-kappa.vercel.app';
}

const signInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  passcode: z.string().min(1, 'Enter your passcode.'),
});

export async function signIn(_previous: PortalState, formData: FormData): Promise<PortalState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    passcode: formData.get('passcode'),
  });

  if (!parsed.success) {
    return { ...PORTAL_IDLE, error: parsed.error.issues[0]?.message ?? 'Check those details.' };
  }

  const admin = createAdminClient();
  const ipHash = await callerIpHash();

  let result;
  try {
    result = await signInWithPasscode(admin, parsed.data.email, parsed.data.passcode, ipHash);
  } catch (cause) {
    if (cause instanceof PortalThrottled) return { ...PORTAL_IDLE, error: cause.message };
    console.error('[portal] sign-in failed', cause);
    return { ...PORTAL_IDLE, error: 'Something went wrong. Try again.' };
  }

  if (!result.ok) {
    return { ...PORTAL_IDLE, error: result.error };
  }

  const token = await createPortalSession(admin, result.account.id, ipHash);

  const store = await cookies();
  store.set(PORTAL_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/portal',
    maxAge: PORTAL_SESSION_TTL_SECONDS,
  });

  redirect('/portal');
}

const resetSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
});

/**
 * "I forgot my passcode." Issues the same single-use setup link an initial
 * invite would, so there is exactly one code path that ever sets a passcode.
 *
 * Always returns the same message regardless of whether the address has
 * portal access — confirming one way or the other would turn this form into a
 * way to discover which email addresses the studio has clients registered
 * under.
 */
export async function requestPasscodeReset(
  _previous: PortalState,
  formData: FormData,
): Promise<PortalState> {
  const parsed = resetSchema.safeParse({ email: formData.get('email') });

  const generic: PortalState = {
    error: null,
    message: "If that address has portal access, we've emailed a link to set a new passcode.",
  };

  if (!parsed.success) return generic;

  const admin = createAdminClient();
  const email = parsed.data.email.trim().toLowerCase();

  const { data: account } = await admin
    .from('client_portal_accounts')
    .select('id, client_id')
    .eq('email', email)
    .is('revoked_at', null)
    .maybeSingle();

  if (!account) return generic;

  const invite = await issuePortalInvite(admin, account.client_id, email);
  if (invite.ok === false) {
    console.error('[portal] could not issue a reset token', invite.error);
    return generic;
  }

  try {
    const origin = await appOrigin();
    const { mail } = getIntegrations();
    await mail.send({
      toEmail: email,
      toName: null,
      subject: 'Set a new passcode for your gallery portal',
      body: [
        'You asked to set a new passcode for your photo gallery portal.',
        '',
        `Choose one here: ${origin}/portal/setup?token=${invite.token}`,
        '',
        'This link works once and expires in 7 days.',
        '',
        "If you didn't ask for this, you can ignore this email.",
      ].join('\n'),
    });
  } catch (cause) {
    console.error('[portal] could not send the reset email', cause);
  }

  return generic;
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(PORTAL_COOKIE_NAME)?.value;

  const admin = createAdminClient();
  await destroyPortalSession(admin, token);

  store.delete(PORTAL_COOKIE_NAME);
  redirect('/portal');
}
