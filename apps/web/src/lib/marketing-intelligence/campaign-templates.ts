/**
 * Lensello Phase 2: Campaign Templates Library
 * Pre-built marketing frameworks by photography category and priority
 */

import {
  CampaignTemplate,
  CampaignPriority,
  PhotographyCategory,
} from './types';

// ============================================================================
// WEDDING TEMPLATES
// ============================================================================

export const weddingsMoreEnquiries: CampaignTemplate = {
  id: 'weddings-more-enquiries',
  name: 'Weddings: Boost Enquiry Volume',
  category: 'weddings',
  priority: CampaignPriority.WEDDINGS_MORE_ENQUIRIES,
  description:
    'Targeted campaign to increase wedding photographer enquiries from engaged couples 12-18 months out',

  framework: {
    meta: {
      platforms: ['facebook', 'instagram'],
      audienceSegment: 'Engaged couples, 25-45, with kids, household income $75k+',
      budget: 2000,
      duration: 30,
      sampleAds: [
        {
          headline: 'Your Love Story Deserves a Photographer Who Gets It',
          copy: 'We capture the real moments—the laughs, the tears, the joy. Not just posed shots.',
          cta: 'Check Our Work',
        },
        {
          headline: 'Couple-Friendly Photography That Feels Natural',
          copy: 'You'll forget the camera is there. We promise.',
          cta: 'See Gallery',
        },
      ],
    },
    landingPage: {
      template: 'wedding_gallery_3cta',
      headline: 'Beautiful, Genuine Wedding Photography',
      subheading: 'For couples who want their wedding photographed, not performed.',
      propositionPoints: [
        'Unposed, storytelling-focused approach',
        'Included second shooter & 40+ edited images',
        'Timeline planning consultation',
      ],
      cta: 'Book Your Consultation',
    },
    form: {
      fields: [
        { name: 'email', type: 'email', required: true },
        { name: 'wedding_date', type: 'date', required: true },
        { name: 'venue_city', type: 'text', required: false },
        { name: 'guest_count', type: 'number', required: false },
        { name: 'budget_range', type: 'select', required: false },
      ],
      successMessage: 'Thanks! Check your email for our wedding packages and availability.',
      autoResponder: true,
    },
    crm: {
      automationSequence: 'wedding_enquiry_nurture_7day',
      segmentTag: 'wedding_enquiry_2024',
    },
    nurture: {
      emailSequence: [
        {
          subject: 'Your Wedding Photography Packages + Gallery',
          dayOffset: 1,
          body: 'Hi [Name],\n\nThanks for reaching out! Here\'s what we offer for weddings...',
        },
        {
          subject: 'See How We Photograph Real Moments',
          dayOffset: 3,
          body: 'Check out this wedding from last month. Notice the candid joy?...',
        },
        {
          subject: '[Name], Are you still looking for your wedding photographer?',
          dayOffset: 7,
          body: 'Just checking in! Wedding season fills fast...',
        },
      ],
      smsTemplates: [
        {
          message: 'Hi [Name]! Download our wedding gallery: [link]. Any questions? Reply here.',
          dayOffset: 1,
        },
      ],
    },
    appointment: {
      calendarSync: true,
      bookingPage: 'calendly_30min_wedding_consult',
      reminderSequence: 2,
    },
    booking: {
      proposalTemplate: 'wedding_proposal_2025',
      contractTemplate: 'wedding_contract_2025',
      paymentTerms: '50% deposit to secure date, 50% due 7 days before wedding',
    },
    reporting: {
      kpis: ['impressions', 'clicks', 'leads', 'lead_quality', 'conversions', 'cpl', 'roas'],
      dashboard: 'wedding_campaign_dashboard',
    },
  },

  benchmarks: {
    expectedCTR: 0.035, // 3.5% click-through rate
    expectedConversion: 0.12, // 12% enquiry-to-consultation
    expectedCPL: 45, // $45 cost per lead
    expectedBookingValue: 3500, // Average wedding booking
    paybackPeriod: 60, // 2 months
  },

  implementation: {
    setup: [
      'Create 3-5 ad variations with couple testimonials',
      'Design landing page with portfolio gallery (10-15 best wedding images)',
      'Set up 7-day nurture email sequence',
      'Configure Zapier integration to tag leads in CRM',
      'Create SMS follow-up template',
    ],
    timeline: [
      {
        phase: 'Setup',
        duration: 3,
        tasks: ['Ad design', 'Landing page build', 'CRM integration', 'Email setup'],
      },
      {
        phase: 'Launch',
        duration: 1,
        tasks: ['A/B test 2 ad sets', 'Monitor early metrics', 'Daily budget optimization'],
      },
      {
        phase: 'Scale',
        duration: 26,
        tasks: ['Pause underperformers', 'Scale winners', 'Nurture optimization'],
      },
    ],
    ownerRole: 'Marketing lead or photographer',
    dependencies: [
      'Portfolio gallery (minimum 10 wedding galleries)',
      'CRM (Supabase or connected)',
      'Email marketing platform',
      'Calendar integration for booking',
    ],
  },
};

export const weddingsHigherValue: CampaignTemplate = {
  id: 'weddings-higher-value',
  name: 'Weddings: Premium Package Upsell',
  category: 'weddings',
  priority: CampaignPriority.WEDDINGS_HIGHER_VALUE,
  description: 'Upsell premium packages (videography, engagement sessions, albums) to warm enquiries',

  framework: {
    meta: {
      platforms: ['facebook', 'instagram'],
      audienceSegment: 'Website visitors (retargeting), past leads, recent consultations',
      budget: 1000,
      duration: 30,
      sampleAds: [
        {
          headline: 'Why Couples Add Film to Their Wedding Package',
          copy: 'Your vows, your first kiss, your entrance—captured in motion. See the difference.',
          cta: 'Watch Highlight Video',
        },
      ],
    },
    landingPage: {
      template: 'wedding_premium_addon',
      headline: 'Bring Your Wedding to Life: Videography & More',
      subheading: 'Add film, engagement session, or heirloom album to your package.',
      propositionPoints: [
        '4K cinematic wedding film',
        'Professional videographer (full day)',
        'Highlight reel + edited wedding film',
      ],
      cta: 'See Premium Packages',
    },
    form: {
      fields: [
        { name: 'email', type: 'email', required: true },
        { name: 'interested_addon', type: 'checkbox', required: true },
      ],
      successMessage: 'Thanks! Check your email for premium package pricing.',
      autoResponder: true,
    },
    crm: {
      automationSequence: 'wedding_upsell_3day',
      segmentTag: 'wedding_upsell_prospect',
    },
    nurture: {
      emailSequence: [
        {
          subject: '[Name], Your Wedding Videography Options',
          dayOffset: 1,
          body: 'Adding film makes your wedding unforgettable...',
        },
        {
          subject: 'Before You Book: Check Out These Upgrades',
          dayOffset: 3,
          body: 'Heirloom albums are back in style. See why...',
        },
      ],
      smsTemplates: [],
    },
    appointment: {
      calendarSync: true,
      bookingPage: 'calendly_15min_addon_consult',
      reminderSequence: 1,
    },
    booking: {
      proposalTemplate: 'wedding_addon_proposal',
      contractTemplate: 'wedding_addon_contract',
      paymentTerms: 'Full payment upfront for add-on services',
    },
    reporting: {
      kpis: ['impressions', 'clicks', 'leads', 'conversions', 'addon_revenue'],
      dashboard: 'wedding_upsell_dashboard',
    },
  },

  benchmarks: {
    expectedCTR: 0.045, // 4.5% (retargeting is hotter)
    expectedConversion: 0.25, // 25% (warm audience)
    expectedCPL: 20, // $20 (retargeting is cheaper)
    expectedBookingValue: 1200, // Add-on value
    paybackPeriod: 30,
  },

  implementation: {
    setup: [
      'Create videography testimonial video (60 sec)',
      'Design landing page showcasing premium offerings',
      'Set up Facebook retargeting pixel',
      'Create 3-email upsell sequence',
    ],
    timeline: [
      {
        phase: 'Setup',
        duration: 5,
        tasks: ['Video production', 'Landing page', 'Retargeting pixel', 'Email sequence'],
      },
      {
        phase: 'Launch & Optimize',
        duration: 25,
        tasks: ['Test 2 ad versions', 'Monitor conversion', 'Refine messaging'],
      },
    ],
    ownerRole: 'Sales or marketing',
    dependencies: [
      'Videography testimonials or demo video',
      'Retargeting pixel installed on website',
      'Warm lead list (past enquiries)',
    ],
  },
};

// ============================================================================
// ENGAGEMENT TEMPLATES
// ============================================================================

export const engagementsMoreEnquiries: CampaignTemplate = {
  id: 'engagements-more-enquiries',
  name: 'Engagements: Couple Session Campaign',
  category: 'engagements',
  priority: CampaignPriority.ENGAGEMENTS_MORE_ENQUIRIES,
  description: 'Drive engagement photography session bookings from newly engaged couples',

  framework: {
    meta: {
      platforms: ['instagram', 'facebook'],
      audienceSegment: 'Newly engaged, 25-40, engaged 0-6 months ago',
      budget: 1500,
      duration: 30,
      sampleAds: [
        {
          headline: 'Celebrate Your Engagement (With Great Photos)',
          copy: 'Professional photos for your save-the-dates, invitations, and announcements.',
          cta: 'Book Your Session',
        },
      ],
    },
    landingPage: {
      template: 'engagement_session_promo',
      headline: 'Your Engagement Deserves Professional Photos',
      subheading: 'Beautiful portraits for your save-the-dates & social media.',
      propositionPoints: [
        '1.5-hour romantic session',
        '30+ edited digital photos',
        'Print rights included',
      ],
      cta: 'Book Engagement Session',
    },
    form: {
      fields: [
        { name: 'email', type: 'email', required: true },
        { name: 'proposal_date', type: 'date', required: false },
        { name: 'wedding_date', type: 'date', required: false },
        { name: 'preferred_location', type: 'text', required: false },
      ],
      successMessage: 'Great! Check your email for our engagement session packages.',
      autoResponder: true,
    },
    crm: {
      automationSequence: 'engagement_session_nurture',
      segmentTag: 'engagement_session_lead',
    },
    nurture: {
      emailSequence: [
        {
          subject: 'Your Engagement Session Package Details',
          dayOffset: 1,
          body: 'Hi [Name],\n\nWe love photographing engagement sessions...',
        },
      ],
      smsTemplates: [
        {
          message: 'Hi [Name]! Dates filling fast for engagement sessions. Reserve yours: [link]',
          dayOffset: 2,
        },
      ],
    },
    appointment: {
      calendarSync: true,
      bookingPage: 'calendly_30min_engagement_consult',
      reminderSequence: 1,
    },
    booking: {
      proposalTemplate: 'engagement_session_proposal',
      contractTemplate: 'engagement_session_contract',
      paymentTerms: 'Full payment due at booking',
    },
    reporting: {
      kpis: ['impressions', 'clicks', 'leads', 'conversions', 'revenue'],
      dashboard: 'engagement_dashboard',
    },
  },

  benchmarks: {
    expectedCTR: 0.04,
    expectedConversion: 0.1,
    expectedCPL: 50,
    expectedBookingValue: 400,
    paybackPeriod: 45,
  },

  implementation: {
    setup: [
      'Curate 5-8 best engagement session photos',
      'Create landing page with before/after gallery',
      'Set up booking calendar integration',
      'Create SMS + email nurture (2-3 touchpoints)',
    ],
    timeline: [
      {
        phase: 'Setup',
        duration: 2,
        tasks: ['Photo curation', 'Landing page', 'SMS/email setup'],
      },
      {
        phase: 'Launch',
        duration: 28,
        tasks: ['A/B test ads', 'Optimize for bookings', 'Track cost per booking'],
      },
    ],
    ownerRole: 'Marketing lead',
    dependencies: [
      'Portfolio of engagement sessions (5+ galleries)',
      'Available calendar slots',
    ],
  },
};

// ============================================================================
// GENERAL REACTIVATION TEMPLATE (All Categories)
// ============================================================================

export const reactivatePastClients: CampaignTemplate = {
  id: 'reactivate-past-clients',
  name: 'Multi-Category: Past Client Reactivation',
  category: 'family', // Generic, applies to all
  priority: CampaignPriority.REACTIVATE_PAST_CLIENTS,
  description:
    'Email + social campaign to re-engage past clients (no booking >12 months) with special offers',

  framework: {
    meta: {
      platforms: ['email'],
      audienceSegment: 'Past clients, no booking in 12+ months',
      budget: 200, // Minimal paid spend, mostly email
      duration: 45,
      sampleAds: [
        {
          headline: 'We Miss You! Here\'s 20% Off Your Next Session',
          copy: 'Come back and let\'s create new memories together.',
          cta: 'Claim Offer',
        },
      ],
    },
    landingPage: {
      template: 'past_client_reactivation',
      headline: 'We\'d Love to Work With You Again',
      subheading: 'Special offer inside for our favorite past clients.',
      propositionPoints: [
        '20% off your next session',
        'New packages & styles since we last worked together',
        'Fast booking process',
      ],
      cta: 'Book Your Session',
    },
    form: {
      fields: [
        { name: 'email', type: 'email', required: true },
        { name: 'service_interested', type: 'select', required: true },
      ],
      successMessage: 'Welcome back! Here\'s your exclusive code: [CODE].',
      autoResponder: true,
    },
    crm: {
      automationSequence: 'past_client_winback_5day',
      segmentTag: 'past_client_reactivation',
    },
    nurture: {
      emailSequence: [
        {
          subject: '[Name], We Miss Your Smile! Here\'s 20% Off',
          dayOffset: 0,
          body: 'It\'s been a while! Check out what\'s new...',
        },
        {
          subject: '[Name], Look What You Can Do Now',
          dayOffset: 5,
          body: 'We\'ve added new services and styles...',
        },
        {
          subject: 'Last Chance: 20% Off Ends This Weekend',
          dayOffset: 10,
          body: 'Don\'t miss this special offer...',
        },
      ],
      smsTemplates: [
        {
          message: '[Name], 20% off your next session! Code: [CODE]. Book today: [link]',
          dayOffset: 2,
        },
      ],
    },
    appointment: {
      calendarSync: true,
      bookingPage: 'calendly_30min_service_select',
      reminderSequence: 1,
    },
    booking: {
      proposalTemplate: 'standard_proposal_with_discount',
      contractTemplate: 'standard_contract',
      paymentTerms: 'Discount applied to invoice; payment due before session',
    },
    reporting: {
      kpis: ['email_opens', 'clicks', 'conversions', 'reactivation_rate', 'revenue'],
      dashboard: 'reactivation_dashboard',
    },
  },

  benchmarks: {
    expectedCTR: 0.06, // Email CTR higher than paid
    expectedConversion: 0.15, // Past clients warm audience
    expectedCPL: 5, // Very cheap (email-based)
    expectedBookingValue: 500, // Average across categories
    paybackPeriod: 20,
  },

  implementation: {
    setup: [
      'Query CRM for past clients (no booking >12 months)',
      'Segment by service type (wedding, family, etc)',
      'Create 3-email sequence with special offer code',
      'Design landing page with updated portfolio',
      'Set up discount code in booking system',
    ],
    timeline: [
      {
        phase: 'Prepare',
        duration: 3,
        tasks: ['CRM query', 'Email sequence', 'Landing page', 'Discount code setup'],
      },
      {
        phase: 'Launch',
        duration: 1,
        tasks: ['Send email 1', 'Monitor opens/clicks'],
      },
      {
        phase: 'Nurture',
        duration: 14,
        tasks: [
          'Send email 2 (day 5)',
          'Send SMS reminder (day 2-3)',
          'Final email (day 10)',
        ],
      },
    ],
    ownerRole: 'Owner or marketing lead',
    dependencies: [
      'CRM data with past client email list',
      'Discount code management in booking system',
      'Updated portfolio to showcase new work',
    ],
  },
};

// ============================================================================
// TEMPLATE REGISTRY (for lookup by category + priority)
// ============================================================================

export const campaignTemplateLibrary: CampaignTemplate[] = [
  weddingsMoreEnquiries,
  weddingsHigherValue,
  engagementsMoreEnquiries,
  reactivatePastClients,
  // Additional templates would be added here...
];

export function getCampaignTemplate(
  category: PhotographyCategory,
  priority: CampaignPriority,
): CampaignTemplate | null {
  return (
    campaignTemplateLibrary.find((t) => t.category === category && t.priority === priority) ||
    null
  );
}

export function getCampaignTemplatesByCategory(
  category: PhotographyCategory,
): CampaignTemplate[] {
  return campaignTemplateLibrary.filter((t) => t.category === category);
}

export function getCampaignTemplatesByPriority(priority: CampaignPriority): CampaignTemplate[] {
  return campaignTemplateLibrary.filter((t) => t.priority === priority);
}
