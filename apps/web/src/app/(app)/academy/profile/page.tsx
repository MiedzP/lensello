import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { getBusinessProfile, getProfileName, listProfileKeyWorksheets } from '@/lib/academy/queries';
import type { CustomerJourneyStage } from '@/lib/academy/profile';
import type { SwotValue } from '../components/profile-swot-editor';
import type { SevenPsValue } from '../components/profile-seven-ps-editor';
import { ProfileJourneyEditor } from '../components/profile-journey-editor';
import { ProfileSevenPsEditor } from '../components/profile-seven-ps-editor';
import { ProfileSwotEditor } from '../components/profile-swot-editor';
import { ProfileTextField } from '../components/profile-text-field';

export const metadata: Metadata = { title: 'Business profile' };

/**
 * What Lensello knows about this business — every fact a worksheet can roll
 * up into, plus the plain business details that only ever get typed in
 * directly. Multi-tenant-ready by construction: everything here is *data*,
 * not something hardcoded for one studio.
 */
export default async function BusinessProfilePage() {
  const { supabase } = await requireUserOrRedirect();

  const [profile, worksheetLinks] = await Promise.all([
    getBusinessProfile(supabase),
    listProfileKeyWorksheets(supabase),
  ]);

  const updatedByName = profile?.updated_by
    ? await getProfileName(supabase, profile.updated_by)
    : null;

  function worksheetHref(key: 'positioning' | 'target_client' | 'brand_voice' | 'price_point' | 'swot' | 'seven_ps' | 'customer_journey') {
    const link = worksheetLinks.get(key);
    if (!link) return undefined;
    return `/academy/${link.moduleSlug}/${link.lessonSlug}`;
  }

  function worksheetLabel(key: Parameters<typeof worksheetHref>[0]) {
    return worksheetLinks.get(key)?.worksheetTitle;
  }

  const blankCount = profile
    ? [
        profile.business_name,
        profile.positioning,
        profile.target_client,
        profile.price_point,
        profile.unique_value,
        profile.brand_voice,
        profile.service_area,
      ].filter((v) => !v).length
    : 7;

  return (
    <>
      <Link href="/academy" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} aria-hidden="true" />
        Academy
      </Link>

      <PageHeader
        title="Business profile"
        description="What the platform knows about this business, filled in through the academy's worksheets — or edited directly here."
      />

      <p className="mb-6 text-sm text-muted">
        {blankCount === 0
          ? 'Every field below has something in it.'
          : `${blankCount} of 7 core fields ${blankCount === 1 ? 'is' : 'are'} still blank.`}
        {profile ? (
          <>
            {' '}
            Last updated {new Date(profile.updated_at).toLocaleDateString()}
            {updatedByName ? ` by ${updatedByName}` : ''}.
          </>
        ) : null}
      </p>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Identity" description="The basics — who this business is and where it operates." />
          <CardBody className="space-y-5">
            <ProfileTextField field="business_name" label="Business name" value={profile?.business_name ?? null} multiline={false} />
            <ProfileTextField field="service_area" label="Service area" value={profile?.service_area ?? null} multiline={false} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Positioning" description="What makes this business different, and who it's for." />
          <CardBody className="space-y-5">
            <ProfileTextField
              field="positioning"
              label="Positioning statement"
              value={profile?.positioning ?? null}
              worksheetHref={worksheetHref('positioning')}
              worksheetLabel={worksheetLabel('positioning')}
            />
            <ProfileTextField
              field="unique_value"
              label="Unique value"
              value={profile?.unique_value ?? null}
            />
            <ProfileTextField
              field="target_client"
              label="Target client"
              value={profile?.target_client ?? null}
              worksheetHref={worksheetHref('target_client')}
              worksheetLabel={worksheetLabel('target_client')}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Pricing & voice" />
          <CardBody className="space-y-5">
            <ProfileTextField
              field="price_point"
              label="Pricing approach"
              value={profile?.price_point ?? null}
              worksheetHref={worksheetHref('price_point')}
              worksheetLabel={worksheetLabel('price_point')}
            />
            <ProfileTextField
              field="brand_voice"
              label="Brand voice"
              value={profile?.brand_voice ?? null}
              worksheetHref={worksheetHref('brand_voice')}
              worksheetLabel={worksheetLabel('brand_voice')}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="SWOT" />
          <CardBody>
            <ProfileSwotEditor
              value={(profile?.swot as SwotValue | null) ?? null}
              worksheetHref={worksheetHref('swot')}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="The 7 Ps" />
          <CardBody>
            <ProfileSevenPsEditor
              value={(profile?.seven_ps as SevenPsValue | null) ?? null}
              worksheetHref={worksheetHref('seven_ps')}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Customer journey" />
          <CardBody>
            <ProfileJourneyEditor
              value={(profile?.customer_journey as unknown as CustomerJourneyStage[] | null) ?? null}
              worksheetHref={worksheetHref('customer_journey')}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
