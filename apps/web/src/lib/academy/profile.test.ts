import { describe, expect, it } from 'vitest';
import { buildProfilePatch } from './profile';
import type { WorksheetField } from './types';

/**
 * `buildProfilePatch` is the whole point of the worksheets: a submitted
 * response has to land on the exact `business_profile` column the rest of
 * the platform reads. Getting a key wrong here is exactly the kind of bug
 * that fails silently — the response saves fine, the profile just never
 * updates — so every profile_key gets a case.
 */

const SWOT_FIELDS: WorksheetField[] = [
  { key: 'strengths', label: 'Strengths', type: 'list' },
  { key: 'weaknesses', label: 'Weaknesses', type: 'list' },
  { key: 'opportunities', label: 'Opportunities', type: 'list' },
  { key: 'threats', label: 'Threats', type: 'list' },
];

const JOURNEY_FIELDS: WorksheetField[] = [
  { key: 'awareness', label: 'Awareness', type: 'textarea' },
  { key: 'booking', label: 'Booking', type: 'textarea' },
];

describe('buildProfilePatch', () => {
  it('returns null for a worksheet with no profile_key — a pure exercise', () => {
    expect(buildProfilePatch(null, SWOT_FIELDS, { strengths: ['fast'] })).toBeNull();
  });

  it('builds the four SWOT quadrants as arrays, trimming and dropping blank lines', () => {
    const patch = buildProfilePatch('swot', SWOT_FIELDS, {
      strengths: ['Fast turnaround', '', '  Great reviews  '],
      weaknesses: 'Limited availability\n\nNo second shooter',
      opportunities: [],
      threats: undefined as unknown as string[],
    });

    expect(patch).toEqual({
      swot: {
        strengths: ['Fast turnaround', 'Great reviews'],
        weaknesses: ['Limited availability', 'No second shooter'],
        opportunities: [],
        threats: [],
      },
    });
  });

  it('builds all seven Ps even when some are left blank', () => {
    const patch = buildProfilePatch(
      'seven_ps',
      [],
      { product: 'Wedding photography', price: 'Packages from £1,200' },
    );

    expect(patch).toEqual({
      seven_ps: {
        product: 'Wedding photography',
        price: 'Packages from £1,200',
        place: '',
        promotion: '',
        people: '',
        process: '',
        physical_evidence: '',
      },
    });
  });

  it('builds the customer journey as an ordered array from the schema, not a hardcoded list', () => {
    const patch = buildProfilePatch('customer_journey', JOURNEY_FIELDS, {
      awareness: 'Finds us on Instagram',
      booking: 'Enquiry form, then a call',
    });

    expect(patch).toEqual({
      customer_journey: [
        { stage: 'Awareness', touchpoints: 'Finds us on Instagram' },
        { stage: 'Booking', touchpoints: 'Enquiry form, then a call' },
      ],
    });
  });

  it('rolls a scalar worksheet up to its designated summary field, not every field in it', () => {
    const fields: WorksheetField[] = [
      { key: 'demographics', label: 'Who are they?', type: 'textarea' },
      { key: 'summary', label: 'Describe your ideal client', type: 'textarea' },
    ];

    const patch = buildProfilePatch('target_client', fields, {
      demographics: 'Engaged couples, 28-38',
      summary: 'Couples planning a destination wedding on a design-forward budget.',
    });

    expect(patch).toEqual({
      target_client: 'Couples planning a destination wedding on a design-forward budget.',
    });
  });

  it('rolls the price_point worksheet up into the price_point column', () => {
    const fields: WorksheetField[] = [{ key: 'summary', label: 'Summary', type: 'textarea' }];
    const patch = buildProfilePatch('price_point', fields, { summary: 'Premium, package-based.' });
    expect(patch).toEqual({ price_point: 'Premium, package-based.' });
  });

  it('writes null, not an empty string, when the rollup field was left blank', () => {
    const fields: WorksheetField[] = [{ key: 'statement', label: 'Statement', type: 'textarea' }];
    expect(buildProfilePatch('positioning', fields, {})).toEqual({ positioning: null });
    expect(buildProfilePatch('positioning', fields, { statement: '   ' })).toEqual({
      positioning: null,
    });
  });
});
