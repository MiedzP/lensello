'use server';

/**
 * Spending a setup token: the client chooses a passcode and, having just
 * proved who they are by holding a link only they were sent, is signed
 * straight in — asking them to then type the passcode they just chose a
 * second time would be a redundant extra step.
 */

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashVisitor } from '@/lib/crypto/share-token';
import { completeSetup } from '@/lib/portal/invite';
import {
  createPortalSession,
  PORTAL_COOKIE_NAME,
  PORTAL_SESSION_TTL_SECONDS,
} from '@/lib/portal/session';
import { PORTAL_IDLE, type PortalState } from '../portal-state';

const schema = z
  .object({
    token: z.string().trim().min(20).max(200),
    passcode: z.string().min(6, 'Choose a passcode of at least 6 characters.').max(200),
    confirm: z.string(),
  })
  .refine((data) => data.passcode === data.confirm, {
    message: 'Those two passcodes do not match.',
    path: ['confirm'],
  });

export async function submitPasscode(
  _previous: PortalState,
  formData: FormData,
): Promise<PortalState> {
  const parsed = schema.safeParse({
    token: formData.get('token'),
    passcode: formData.get('passcode'),
    confirm: formData.get('confirm'),
  });

  if (!parsed.success) {
    return { ...PORTAL_IDLE, error: parsed.error.issues[0]?.message ?? 'Check those details.' };
  }

  const admin = createAdminClient();
  const result = await completeSetup(admin, parsed.data.token, parsed.data.passcode);

  if (!result.ok) {
    return { ...PORTAL_IDLE, error: result.error };
  }

  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim();
  const token = await createPortalSession(
    admin,
    result.account.id,
    ip ? hashVisitor(ip, 'portal') : null,
  );

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
