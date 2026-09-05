/**
 * Lensello Phase 2: Intelligence Engine
 * Core TypeScript types for priority scoring, operating rhythm, and campaign building
 */

// ============================================================================
// PHOTOGRAPHY CATEGORIES
// ============================================================================

export type PhotographyCategory =
  | 'weddings'
  | 'engagements'
  | 'family'
  | 'newborns'
  | 'portraits'
  | 'pets'
  | 'boudoir'
  | 'headshots'
  | 'commercial'
  | 'schools'
  | 'sports'
  | 'events'
  | 'property'
  | 'albums_upsell';

// ============================================================================
// PRIORITY CLASSIFICATION (RED/AMBER/GREEN)
// ============================================================================

export enum PriorityLevel {
  RED = 'red',
  AMBER = 'amber',
  GREEN = 'green',
}

export enum RedIndicator {
  // CPL has risen
  CPL_RISEN = 'cpl_risen',
  // Conversion rate fallen below threshold
  CONVERSION_DROPPED = 'conversion_dropped',
  // Warm leads not followed up within SLA
  LEADS_NOT_FOLLOWED = 'leads_not_followed',
  // Bookings behind monthly/quarterly target
  BOOKINGS_BEHIND_TARGET = 'bookings_behind_target',
  // Active campaign stopped performing
  CAMPAIGN_PERFORMANCE_DROPPED = 'campaign_performance_dropped',
  // High lead volume but low conversion (leaky funnel)
  FUNNEL_LEAKING = 'funnel_leaking',
}

export enum AmberIndicator {
  // Historic enquiries (30-90 days) never nurtured
  HISTORIC_LEADS_UNNURTURED = 'historic_leads_unnurtured',
  // Seasonal campaign window opening (e.g., wedding season ramp)
  SEASONAL_OPPORTUNITY = 'seasonal_opportunity',
  // Venue/location page ranking opportunity imminent
  SEO_OPPORTUNITY_WINDOW = 'seo_opportunity_window',
  // Past clients eligible for reactivation campaign
  PAST_CLIENT_REACTIVATION = 'past_client_reactivation',
  // Lead quality declining (lower engagement, longer sales cycle)
  LEAD_QUALITY_DECLINING = 'lead_quality_declining',
  // Ad spend efficiency declining but not critical
  AD_SPEND_EFFICIENCY_DROP = 'ad_spend_efficiency_drop',
}

export enum GreenIndicator {
  // SEO consistently generating qualified enquiries
  SEO_GENERATING = 'seo_generating',
  // CPL improving trend
  CPL_IMPROVING = 'cpl_improving',
  // Conversion rate healthy and stable
  CONVERSION_HEALTHY = 'conversion_healthy',
  // Nurture sequences converting at target rate
  NURTURE_CONVERTING = 'nurture_converting',
  // Booking value rising
  BOOKING_VALUE_RISING = 'booking_value_rising',
  // Campaign ROI exceeding target
  CAMPAIGN_ROI_STRONG = 'campaign_roi_strong',
  // Lead pipeline sufficient for next 30 days
  PIPELINE_HEALTHY = 'pipeline_healthy',
}

export interface PriorityScore {
  businessId: string;
  category: PhotographyCategory;
  level: PriorityLevel;
  score: number; // 0-100, higher = more urgent
  indicators: (RedIndicator | AmberIndicator | GreenIndicator)[];
  recommendedActions: string[];
  confidence: number; // 0-1, confidence in classification
  lastUpdated: Date;
  scoringMetadata: {
    cpl: number;
    conversionRate: number;
    leadFollowUpRate: number;
    bookingsVsTarget: number; // % of target
    campaignPerformanceChange: number; // % change
  };
}

// ============================================================================
// LENS METRICS (LEADERSHIP ENQUIRY NET SEO)
// ============================================================================

export interface LENSMetrics {
  businessId: string;
  category: PhotographyCategory;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  date: Date;

  // L = Leads (enquiries)
  leads: {
    total: number;
    new: number;
    followedUp: number;
    responseTime: number; // avg hours
    source: {
      website: number;
      social: number;
      referral: number;
      organic: number;
      paid: number;
    };
  };

  // E = Enquiry-to-Enquiry quality (engagement)
  enquiry: {
    avgQualityScore: number; // 0-100
    engagementRate: number; // % that engage with content
    averageTimeToResponse: number; // hours
    abandonmentRate: number; // % of leads lost
  };

  // N = Nurture (conversion through pipeline)
  nurture: {
    leadsInSequence: number;
    conversionRate: number;
    avgTimeInNurture: number; // days
    dropoffPoints: {
      stage: string;
      lossPercentage: number;
    }[];
  };

  // S = Sales (bookings + value)
  sales: {
    bookings: number;
    totalValue: number;
    avgBookingValue: number;
    conversionRateFromLeads: number;
    pipeline: {
      stage: string;
      count: number;
      value: number;
    }[];
  };

  // Additional
  cpl: number; // cost per lead
  roas: number; // return on ad spend
  seoRanking: {
    topKeywords: { keyword: string; position: number; volume: number }[];
    trafficFromOrganic: number;
  };
}

// ============================================================================
// OPERATING RHYTHM VIEWS
// ============================================================================

export interface OperatingRhythmAlert {
  id: string;
  type: 'new_lead' | 'unanswered_enquiry' | 'followup_due' | 'pipeline_move' | 'task_reminder';
  priority: 'high' | 'medium' | 'low';
  message: string;
  actionUrl?: string;
  createdAt: Date;
  read: boolean;
}

export interface DailyView {
  businessId: string;
  date: Date;
  alerts: OperatingRhythmAlert[];
  compactMetrics: {
    leadsReceived: number;
    leadsFollowedUp: number;
    unansweredEnquiries: number;
    appointmentsSet: number;
    pipelineValue: number;
  };
}

export interface WeeklyView {
  businessId: string;
  weekStartDate: Date;
  priorities: Array<{
    slot: 'red_fix' | 'amber_grow' | 'green_continue';
    priority: PriorityScore;
    focus: string;
    expectedOutcome: string;
    dueDate: Date;
  }>;
  metrics: {
    leadsGenerated: number;
    enquiriesConverted: number;
    bookingsCreated: number;
    totalValue: number;
  };
}

export interface MonthlyView {
  businessId: string;
  month: string; // YYYY-MM
  lens: LENSMetrics;
  performanceVsTarget: {
    metric: string;
    target: number;
    actual: number;
    variance: number; // %
  }[];
  topPerformingCategory: PhotographyCategory;
  bottleneck: string; // narrative description
}

export interface QuarterlyView {
  businessId: string;
  quarter: string; // Q1-Q4 YYYY
  businessVsGoals: {
    goal: string;
    target: number;
    actual: number;
    onTrack: boolean;
  }[];
  constraints: string[]; // limiting factors
  seasonalConsiderations: string[];
  nextQuarterPlan: {
    focus: string;
    investmentAreas: string[];
    expectedOutcome: string;
  };
}

// ============================================================================
// CAMPAIGN BUILDER
// ============================================================================

export enum CampaignPriority {
  // For Weddings
  WEDDINGS_MORE_ENQUIRIES = 'weddings_more_enquiries',
  WEDDINGS_HIGHER_VALUE = 'weddings_higher_value',
  WEDDINGS_DESTINATION = 'weddings_destination',
  WEDDINGS_FILL_DATES = 'weddings_fill_dates',
  WEDDINGS_NEXT_YEAR_PIPELINE = 'weddings_next_year_pipeline',
  WEDDINGS_INCREASE_SALE = 'weddings_increase_sale',
  WEDDINGS_RECONNECT_OLD = 'weddings_reconnect_old',
  WEDDINGS_VENUE_SPECIFIC = 'weddings_venue_specific',

  // For Engagements
  ENGAGEMENTS_MORE_ENQUIRIES = 'engagements_more_enquiries',
  ENGAGEMENTS_ADD_ON_WEDDING = 'engagements_add_on_wedding',
  ENGAGEMENTS_LOCATION_PACKAGES = 'engagements_location_packages',

  // For Family / Portraits / Events
  RECURRING_BOOKINGS = 'recurring_bookings',
  SEASONAL_FILL = 'seasonal_fill',
  UPSELL_PRINTS = 'upsell_prints',
  GROUP_SESSIONS = 'group_sessions',

  // General
  REACTIVATE_PAST_CLIENTS = 'reactivate_past_clients',
  REFERRAL_PROGRAM = 'referral_program',
  NEWSLETTER_GROWTH = 'newsletter_growth',
}

export interface CampaignTemplate {
  id: string;
  name: string;
  category: PhotographyCategory;
  priority: CampaignPriority;
  description: string;

  // Marketing framework components
  framework: {
    meta: {
      platforms: ('facebook' | 'instagram' | 'tiktok' | 'google' | 'pinterest')[];
      audienceSegment: string;
      budget: number;
      duration: number; // days
      sampleAds: { headline: string; copy: string; cta: string }[];
    };
    landingPage: {
      template: string; // name/ref
      headline: string;
      subheading: string;
      propositionPoints: string[];
      cta: string;
    };
    form: {
      fields: { name: string; type: string; required: boolean }[];
      successMessage: string;
      autoResponder: boolean;
    };
    crm: {
      automationSequence: string; // name/ref
      segmentTag: string;
    };
    nurture: {
      emailSequence: { subject: string; dayOffset: number; body: string }[];
      smsTemplates: { message: string; dayOffset: number }[];
    };
    appointment: {
      calendarSync: boolean;
      bookingPage: string;
      reminderSequence: number; // count of reminders
    };
    booking: {
      proposalTemplate: string;
      contractTemplate: string;
      paymentTerms: string;
    };
    reporting: {
      kpis: string[]; // metric names to track
      dashboard: string; // reference to dashboard config
    };
  };

  // Performance expectations
  benchmarks: {
    expectedCTR: number;
    expectedConversion: number;
    expectedCPL: number;
    expectedBookingValue: number;
    paybackPeriod: number; // days
  };

  // Implementation guide
  implementation: {
    setup: string[]; // step-by-step
    timeline: { phase: string; duration: number; tasks: string[] }[];
    ownerRole: string;
    dependencies: string[];
  };
}

export interface CampaignBuilderStep {
  stepNumber: 1 | 2 | 3;
  title: string;
  description: string;
}

export interface CampaignBuilderRequest {
  stepA: {
    category: PhotographyCategory;
  };
  stepB: {
    priority: CampaignPriority;
  };
  stepC?: {
    template: CampaignTemplate;
    customizations: {
      budget?: number;
      duration?: number;
      additionalNotes?: string;
    };
  };
}

export interface GeneratedCampaign {
  id: string;
  businessId: string;
  request: CampaignBuilderRequest;
  template: CampaignTemplate;
  customizations: {
    budget: number;
    duration: number;
    startDate: Date;
    additionalNotes: string;
  };
  status: 'draft' | 'approved' | 'active' | 'paused' | 'completed';
  createdAt: Date;
  launchedAt?: Date;
  performance?: {
    impressions: number;
    clicks: number;
    leads: number;
    conversions: number;
    spend: number;
  };
}

// ============================================================================
// BUSINESS PROFILE (Phase 1 integration)
// ============================================================================

export interface BusinessProfile {
  id: string;
  name: string;
  categories: PhotographyCategory[];
  goals: {
    category: PhotographyCategory;
    metric: string;
    target: number;
    period: string; // monthly, quarterly
  }[];
  constraints: {
    maxDailyLeads?: number;
    seasonalClosures: { start: Date; end: Date }[];
    marketingBudget: number;
    teamSize: number;
  };
}
