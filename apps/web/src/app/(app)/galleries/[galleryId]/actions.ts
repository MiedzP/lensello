'use server';

/**
 * Staff-side presentation, sections, client link and portal access for one
 * gallery.
 *
 * Every action starts with `requireUser()` and writes through the caller's
 * own Supabase client — including the portal-account writes, which are
 * covered by `client_portal_accounts_staff_all`. The one exception is
 * `client_portal_sessions`, which has no staff policy at all by design (see
 * the migration); nothing here touches it, so revoking access relies on
 * `revoked_at`, exactly as `readPortalSession` already checks for.
 */

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getIntegrations } from '@lensello/core/integrations';
import { requireUser } from '@/lib/auth';
import { friendlyDbError } from '@/lib/schema-errors';
import { DISPLAY_STYLES } from '@/lib/galleries/queries';
import { issuePortalInvite, revokePortalAccount } from '@/lib/portal/invite';
import { GALLERY_ADMIN_IDLE, type GalleryAdminState } from './admin-state';

const galleryIdSchema = z.string().uuid('Unknown gallery.');

/** Best guess at this deployment's own origin, for the link inside the invite email. */
async function appOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
  const proto = headerList.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : 'https://lensello-web-kappa.vercel.app';
}

// --- presentation ----------------------------------------------------------

const presentationSchema = z.object({
  galleryId: galleryIdSchema,
  displayStyle: z.enum(DISPLAY_STYLES),
  accentColor: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => value === undefined || /^#[0-9a-fA-F]{6}$/.test(value), {
      message: 'Enter a hex colour like #4a6b8a, or leave it blank.',
    }),
  coverAssetId: z.string().trim().uuid().optional().or(z.literal('')),
});

export async function updatePresentation(
  _previous: GalleryAdminState,
  formData: FormData,
): Promise<GalleryAdminState> {
  const { supabase } = await requireUser();

  const parsed = presentationSchema.safeParse({
    galleryId: formData.get('galleryId'),
    displayStyle: formData.get('displayStyle'),
    accentColor: formData.get('accentColor') || undefined,
    coverAssetId: formData.get('coverAssetId') || '',
  });

  if (!parsed.success) {
    return { ...GALLERY_ADMIN_IDLE, error: parsed.error.issues[0]?.message ?? 'Check those details.' };
  }

  const { error } = await supabase
    .from('galleries')
    .update({
      display_style: parsed.data.displayStyle,
      accent_color: parsed.data.accentColor ?? null,
      cover_asset_id: parsed.data.coverAssetId || null,
    })
    .eq('id', parsed.data.galleryId);

  if (error) {
    return { ...GALLERY_ADMIN_IDLE, error: friendlyDbError(error, 'Could not save those changes.') };
  }

  revalidatePath(`/galleries/${parsed.data.galleryId}`);
  return { ...GALLERY_ADMIN_IDLE, message: 'Presentation saved.' };
}

// --- client link -------------------------------------------------------

const clientLinkSchema = z.object({
  galleryId: galleryIdSchema,
  clientId: z.string().trim().uuid().optional().or(z.literal('')),
});

export async function linkClient(
  _previous: GalleryAdminState,
  formData: FormData,
): Promise<GalleryAdminState> {
  const { supabase } = await requireUser();

  const parsed = clientLinkSchema.safeParse({
    galleryId: formData.get('galleryId'),
    clientId: formData.get('clientId') || '',
  });
  if (!parsed.success) {
    return { ...GALLERY_ADMIN_IDLE, error: 'Check those details.' };
  }

  const { error } = await supabase
    .from('galleries')
    .update({ client_id: parsed.data.clientId || null })
    .eq('id', parsed.data.galleryId);

  if (error) {
    return { ...GALLERY_ADMIN_IDLE, error: friendlyDbError(error, 'Could not link that client.') };
  }

  revalidatePath(`/galleries/${parsed.data.galleryId}`);
  return {
    ...GALLERY_ADMIN_IDLE,
    message: parsed.data.clientId ? 'Client linked.' : 'Client unlinked.',
  };
}

// --- sections ----------------------------------------------------------

const sectionCreateSchema = z.object({
  galleryId: galleryIdSchema,
  title: z.string().trim().min(1, 'Give the section a name.').max(120),
  blurb: z.string().trim().max(500).optional(),
});

export async function createSection(
  _previous: GalleryAdminState,
  formData: FormData,
): Promise<GalleryAdminState> {
  const { supabase } = await requireUser();

  const parsed = sectionCreateSchema.safeParse({
    galleryId: formData.get('galleryId'),
    title: formData.get('title'),
    blurb: formData.get('blurb') || undefined,
  });
  if (!parsed.success) {
    return { ...GALLERY_ADMIN_IDLE, error: parsed.error.issues[0]?.message ?? 'Check those details.' };
  }

  const { count } = await supabase
    .from('gallery_sections')
    .select('id', { count: 'exact', head: true })
    .eq('gallery_id', parsed.data.galleryId);

  const { error } = await supabase.from('gallery_sections').insert({
    gallery_id: parsed.data.galleryId,
    title: parsed.data.title,
    blurb: parsed.data.blurb || null,
    sort_order: count ?? 0,
  });

  if (error) {
    return { ...GALLERY_ADMIN_IDLE, error: friendlyDbError(error, 'Could not create that section.') };
  }

  revalidatePath(`/galleries/${parsed.data.galleryId}`);
  return { ...GALLERY_ADMIN_IDLE, message: 'Section added.' };
}

const sectionUpdateSchema = z.object({
  sectionId: z.string().uuid('Unknown section.'),
  galleryId: galleryIdSchema,
  title: z.string().trim().min(1, 'Give the section a name.').max(120),
  blurb: z.string().trim().max(500).optional(),
});

export async function updateSection(
  _previous: GalleryAdminState,
  formData: FormData,
): Promise<GalleryAdminState> {
  const { supabase } = await requireUser();

  const parsed = sectionUpdateSchema.safeParse({
    sectionId: formData.get('sectionId'),
    galleryId: formData.get('galleryId'),
    title: formData.get('title'),
    blurb: formData.get('blurb') || undefined,
  });
  if (!parsed.success) {
    return { ...GALLERY_ADMIN_IDLE, error: parsed.error.issues[0]?.message ?? 'Check those details.' };
  }

  const { error } = await supabase
    .from('gallery_sections')
    .update({ title: parsed.data.title, blurb: parsed.data.blurb || null })
    .eq('id', parsed.data.sectionId)
    .eq('gallery_id', parsed.data.galleryId);

  if (error) {
    return { ...GALLERY_ADMIN_IDLE, error: friendlyDbError(error, 'Could not save that section.') };
  }

  revalidatePath(`/galleries/${parsed.data.galleryId}`);
  return { ...GALLERY_ADMIN_IDLE, message: 'Section saved.' };
}

const sectionRefSchema = z.object({
  sectionId: z.string().uuid('Unknown section.'),
  galleryId: galleryIdSchema,
});

export async function deleteSection(
  _previous: GalleryAdminState,
  formData: FormData,
): Promise<GalleryAdminState> {
  const { supabase } = await requireUser();

  const parsed = sectionRefSchema.safeParse({
    sectionId: formData.get('sectionId'),
    galleryId: formData.get('galleryId'),
  });
  if (!parsed.success) return { ...GALLERY_ADMIN_IDLE, error: 'Unknown section.' };

  const { error } = await supabase
    .from('gallery_sections')
    .delete()
    .eq('id', parsed.data.sectionId)
    .eq('gallery_id', parsed.data.galleryId);

  if (error) {
    return { ...GALLERY_ADMIN_IDLE, error: friendlyDbError(error, 'Could not remove that section.') };
  }

  revalidatePath(`/galleries/${parsed.data.galleryId}`);
  return { ...GALLERY_ADMIN_IDLE, message: 'Section removed.' };
}

const sectionMoveSchema = z.object({
  sectionId: z.string().uuid('Unknown section.'),
  galleryId: galleryIdSchema,
  direction: z.enum(['up', 'down']),
});

/** Swaps this section's `sort_order` with its neighbour in the given direction. */
export async function moveSection(
  _previous: GalleryAdminState,
  formData: FormData,
): Promise<GalleryAdminState> {
  const { supabase } = await requireUser();

  const parsed = sectionMoveSchema.safeParse({
    sectionId: formData.get('sectionId'),
    galleryId: formData.get('galleryId'),
    direction: formData.get('direction'),
  });
  if (!parsed.success) return { ...GALLERY_ADMIN_IDLE, error: 'Unknown section.' };

  const { data: sections } = await supabase
    .from('gallery_sections')
    .select('id, sort_order')
    .eq('gallery_id', parsed.data.galleryId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (!sections?.length) return GALLERY_ADMIN_IDLE;

  const index = sections.findIndex((section) => section.id === parsed.data.sectionId);
  if (index === -1) return { ...GALLERY_ADMIN_IDLE, error: 'Unknown section.' };

  const swapWith = parsed.data.direction === 'up' ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= sections.length) return GALLERY_ADMIN_IDLE;

  const a = sections[index]!;
  const b = sections[swapWith]!;

  await Promise.all([
    supabase.from('gallery_sections').update({ sort_order: b.sort_order }).eq('id', a.id),
    supabase.from('gallery_sections').update({ sort_order: a.sort_order }).eq('id', b.id),
  ]);

  revalidatePath(`/galleries/${parsed.data.galleryId}`);
  return GALLERY_ADMIN_IDLE;
}

const sectionAssetSchema = z.object({
  sectionId: z.string().uuid('Unknown section.'),
  galleryId: galleryIdSchema,
  assetId: z.string().uuid('Unknown photograph.'),
});

/** Toggles one photograph's membership in one section. */
export async function toggleSectionAsset(
  _previous: GalleryAdminState,
  formData: FormData,
): Promise<GalleryAdminState> {
  const { supabase } = await requireUser();

  const parsed = sectionAssetSchema.safeParse({
    sectionId: formData.get('sectionId'),
    galleryId: formData.get('galleryId'),
    assetId: formData.get('assetId'),
  });
  if (!parsed.success) return { ...GALLERY_ADMIN_IDLE, error: 'Check those details.' };

  const { data: existing } = await supabase
    .from('gallery_section_assets')
    .select('asset_id')
    .eq('section_id', parsed.data.sectionId)
    .eq('asset_id', parsed.data.assetId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('gallery_section_assets')
      .delete()
      .eq('section_id', parsed.data.sectionId)
      .eq('asset_id', parsed.data.assetId);
  } else {
    const { count } = await supabase
      .from('gallery_section_assets')
      .select('asset_id', { count: 'exact', head: true })
      .eq('section_id', parsed.data.sectionId);

    await supabase.from('gallery_section_assets').insert({
      section_id: parsed.data.sectionId,
      asset_id: parsed.data.assetId,
      sort_order: count ?? 0,
    });
  }

  revalidatePath(`/galleries/${parsed.data.galleryId}`);
  return GALLERY_ADMIN_IDLE;
}

// --- portal access -------------------------------------------------------

const inviteSchema = z.object({
  galleryId: galleryIdSchema,
  clientId: z.string().uuid('Link a client before sending an invite.'),
  email: z.string().trim().email('Enter a valid email address.'),
});

/**
 * Sends (or resends) the "set your passcode" link. Reuses `issuePortalInvite`
 * whether this is the client's first invite or the studio resetting a
 * forgotten passcode — both need nothing but a fresh token.
 */
export async function sendPortalInvite(
  _previous: GalleryAdminState,
  formData: FormData,
): Promise<GalleryAdminState> {
  const { supabase } = await requireUser();

  const parsed = inviteSchema.safeParse({
    galleryId: formData.get('galleryId'),
    clientId: formData.get('clientId'),
    email: formData.get('email'),
  });
  if (!parsed.success) {
    return { ...GALLERY_ADMIN_IDLE, error: parsed.error.issues[0]?.message ?? 'Check those details.' };
  }

  const invite = await issuePortalInvite(supabase, parsed.data.clientId, parsed.data.email);
  if (invite.ok === false) {
    return { ...GALLERY_ADMIN_IDLE, error: invite.error };
  }

  revalidatePath(`/galleries/${parsed.data.galleryId}`);

  try {
    const origin = await appOrigin();
    const { mail } = getIntegrations();
    await mail.send({
      toEmail: invite.account.email,
      toName: null,
      subject: 'Set your passcode to view your gallery',
      body: [
        'Your photographer has set up an online portal where you can sign in and see your galleries any time.',
        '',
        `Choose a passcode here: ${origin}/portal/setup?token=${invite.token}`,
        '',
        'This link works once and expires in 7 days.',
      ].join('\n'),
    });
  } catch (cause) {
    console.error('[galleries] could not send the portal invite email', cause);
    return {
      ...GALLERY_ADMIN_IDLE,
      message: 'Invite created, but the email could not be sent. Share the link with the client yourself.',
    };
  }

  return { ...GALLERY_ADMIN_IDLE, message: `Invite sent to ${invite.account.email}.` };
}

const revokeSchema = z.object({
  accountId: z.string().uuid('Unknown account.'),
  galleryId: galleryIdSchema,
});

export async function revokePortalAccess(
  _previous: GalleryAdminState,
  formData: FormData,
): Promise<GalleryAdminState> {
  const { supabase } = await requireUser();

  const parsed = revokeSchema.safeParse({
    accountId: formData.get('accountId'),
    galleryId: formData.get('galleryId'),
  });
  if (!parsed.success) return { ...GALLERY_ADMIN_IDLE, error: 'Unknown account.' };

  await revokePortalAccount(supabase, parsed.data.accountId);

  revalidatePath(`/galleries/${parsed.data.galleryId}`);
  return { ...GALLERY_ADMIN_IDLE, message: 'Portal access revoked.' };
}
