/**
 * Authorizing a shop action against a gallery token.
 *
 * The buying page has no session, so it is authorized exactly like
 * `app/g/[token]/actions.ts` authorizes favouriting a photo: re-resolve the
 * token from scratch on every call, and re-check password protection, rather
 * than trusting a gallery id the caller supplied. A gallery id on its own
 * would let one valid token double as a key into a basket for any other
 * gallery in the studio; only the token itself is ever trusted here.
 */

import { cookies } from 'next/headers';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveGallery, type ResolvedGallery } from '@/lib/galleries/queries';
import { verifyUnlock, unlockCookieName } from '@/lib/galleries/unlock';

type Admin = ReturnType<typeof createAdminClient>;

const tokenSchema = z.string().trim().min(20).max(200);

export type ShopAuthResult =
  | { ok: false; error: string }
  | { ok: true; admin: Admin; resolved: ResolvedGallery };

export async function authorizeShopToken(rawToken: FormDataEntryValue | null): Promise<ShopAuthResult> {
  const parsed = tokenSchema.safeParse(rawToken);
  if (!parsed.success) return { ok: false, error: 'That link is not valid.' };

  const admin = createAdminClient();
  const resolved = await resolveGallery(admin, parsed.data);

  if (!resolved) return { ok: false, error: 'That gallery could not be found.' };
  if (resolved.problem === 'revoked') return { ok: false, error: 'This gallery has been closed by the studio.' };
  if (resolved.problem === 'expired') return { ok: false, error: 'This gallery link has expired.' };

  if (resolved.requiresPassword) {
    const store = await cookies();
    const cookie = store.get(unlockCookieName(resolved.gallery.id))?.value;
    if (!verifyUnlock(cookie, resolved.gallery.id, resolved.gallery.password_hash!)) {
      return { ok: false, error: 'Enter the gallery password first.' };
    }
  }

  return { ok: true, admin, resolved };
}
