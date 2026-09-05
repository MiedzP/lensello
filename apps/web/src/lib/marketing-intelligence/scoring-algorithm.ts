/**
 * Lensello Phase 2: Priority Scoring Algorithm
 * RED/AMBER/GREEN classification logic based on business metrics
 */

import {
  PriorityLevel,
  PriorityScore,
  RedIndicator,
  AmberIndicator,
  GreenIndicator,
  LENSMetrics,
  PhotographyCategory,
} from './types';

// ============================================================================
// SCORING THRESHOLDS & WEIGHTS
// ============================================================================

const SCORING_THRESHOLDS = {
  // RED indicators
  cpl_threshold_increase: 0.15, // 15% increase is concerning
  conversion_threshold_drop: 0.2, // 20% drop below rolling average
  lead_followup_sla_hours: 24, // Should respond within 24 hours
  bookings_target_threshold: 0.8, // Must achieve 80% of target
  campaign_performance_drop: 0.25, // 25% performance drop
  funnel_conversion_minimum: 0.05, // Minimum 5% conversion

  // AMBER indicators
  historic_leads_age_days: 30, // 30-90 days old
  historic_leads_unnurtured_percent: 0.3, // 30% of historic are unnurtured
  lead_quality_score_drop: 0.15, // 15% quality decline
  ad_spend_efficiency_drop: 0.1, // 10% efficiency drop

  // GREEN indicators
  seo_consistency_days: 14, // SEO leads in last 14 days
  cpl_improving_percent: 0.05, // 5% month-over-month improvement
  conversion_healthy_minimum: 0.15, // Minimum 15% conversion
  nurture_target_conversion: 0.2, // 20% nurture conversion
  booking_value_growth: 0.1, // 10% growth month-over-month
  campaign_roi_target: 3, // 3x ROI
  pipeline_days_cover: 30, // 30 days of pipeline
};

const SCORING_WEIGHTS = {
  red: {
    cpl_risen: 0.2,
    conversion_dropped: 0.25,
    leads_not_followed: 0.2,
    bookings_behind_target: 0.15,
    campaign_performance_dropped: 0.15,
    funnel_leaking: 0.05,
  },
  amber: {
    historic_leads_unnurtured: 0.25,
    seasonal_opportunity: 0.2,
    seo_opportunity_window: 0.2,
    past_client_reactivation: 0.15,
    lead_quality_declining: 0.1,
    ad_spend_efficiency_drop: 0.1,
  },
  green: {
    seo_generating: 0.15,
    cpl_improving: 0.15,
    conversion_healthy: 0.25,
    nurture_converting: 0.2,
    booking_value_rising: 0.15,
    campaign_roi_strong: 0.1,
    pipeline_healthy: 0.0,
  },
};

// ============================================================================
// SCORING ENGINE
// ============================================================================

/**
 * Main scoring function - classifies business state into RED/AMBER/GREEN
 */
export function scoreBusinessPriority(
  businessId: string,
  category: PhotographyCategory,
  metrics: LENSMetrics,
  previousMetrics: LENSMetrics | null,
  businessGoals: any, // from business profile
): PriorityScore {
  // Collect all indicators
  const redIndicators = detectRedIndicators(metrics, previousMetrics, businessGoals);
  const amberIndicators = detectAmberIndicators(metrics, previousMetrics, businessGoals);
  const greenIndicators = detectGreenIndicators(metrics, previousMetrics, businessGoals);

  // Calculate scores for each level
  const redScore = calculateCategoryScore(redIndicators, SCORING_WEIGHTS.red);
  const amberScore = calculateCategoryScore(amberIndicators, SCORING_WEIGHTS.amber);
  const greenScore = calculateCategoryScore(greenIndicators, SCORING_WEIGHTS.green);

  // Determine priority level
  const allIndicators = [...redIndicators, ...amberIndicators, ...greenIndicators];
  const level = determinePriorityLevel(redScore, amberScore, greenScore);
  const overallScore = calculateOverallScore(level, redScore, amberScore, greenScore);
  const confidence = calculateConfidence(allIndicators.length, metrics);

  // Generate recommended actions
  const actions = generateRecommendedActions(level, redIndicators, amberIndicators, greenIndicators);

  return {
    businessId,
    category,
    level,
    score: overallScore,
    indicators: allIndicators,
    recommendedActions: actions,
    confidence,
    lastUpdated: new Date(),
    scoringMetadata: {
      cpl: metrics.cpl,
      conversionRate: metrics.sales.conversionRateFromLeads,
      leadFollowUpRate: calculateLeadFollowUpRate(metrics),
      bookingsVsTarget: calculateBookingsVsTarget(metrics, businessGoals),
      campaignPerformanceChange: calculateCampaignPerformanceChange(metrics, previousMetrics),
    },
  };
}

// ============================================================================
// RED INDICATOR DETECTION
// ============================================================================

function detectRedIndicators(
  metrics: LENSMetrics,
  previousMetrics: LENSMetrics | null,
  businessGoals: any,
): RedIndicator[] {
  const indicators: RedIndicator[] = [];

  // 1. CPL_RISEN: Cost per lead increased by >15%
  if (previousMetrics) {
    const cplIncrease = (metrics.cpl - previousMetrics.cpl) / previousMetrics.cpl;
    if (cplIncrease > SCORING_THRESHOLDS.cpl_threshold_increase) {
      indicators.push(RedIndicator.CPL_RISEN);
    }
  }

  // 2. CONVERSION_DROPPED: Conversion fell >20% from rolling average
  if (previousMetrics) {
    const conversionDrop =
      (previousMetrics.sales.conversionRateFromLeads - metrics.sales.conversionRateFromLeads) /
      previousMetrics.sales.conversionRateFromLeads;
    if (conversionDrop > SCORING_THRESHOLDS.conversion_threshold_drop) {
      indicators.push(RedIndicator.CONVERSION_DROPPED);
    }
  }

  // 3. LEADS_NOT_FOLLOWED: Response time > SLA
  if (metrics.leads.responseTime > SCORING_THRESHOLDS.lead_followup_sla_hours) {
    indicators.push(RedIndicator.LEADS_NOT_FOLLOWED);
  }

  // 4. BOOKINGS_BEHIND_TARGET: Bookings <80% of target
  const bookingsRatio = calculateBookingsVsTarget(metrics, businessGoals);
  if (bookingsRatio < SCORING_THRESHOLDS.bookings_target_threshold) {
    indicators.push(RedIndicator.BOOKINGS_BEHIND_TARGET);
  }

  // 5. CAMPAIGN_PERFORMANCE_DROPPED: ROAS down >25%
  if (previousMetrics) {
    const roasChange = (previousMetrics.roas - metrics.roas) / previousMetrics.roas;
    if (roasChange > SCORING_THRESHOLDS.campaign_performance_drop) {
      indicators.push(RedIndicator.CAMPAIGN_PERFORMANCE_DROPPED);
    }
  }

  // 6. FUNNEL_LEAKING: High leads but low conversion (leaky funnel)
  const leadToConversion = metrics.sales.conversionRateFromLeads;
  if (metrics.leads.total > 50 && leadToConversion < SCORING_THRESHOLDS.funnel_conversion_minimum) {
    indicators.push(RedIndicator.FUNNEL_LEAKING);
  }

  return indicators;
}

// ============================================================================
// AMBER INDICATOR DETECTION
// ============================================================================

function detectAmberIndicators(
  metrics: LENSMetrics,
  previousMetrics: LENSMetrics | null,
  businessGoals: any,
): AmberIndicator[] {
  const indicators: AmberIndicator[] = [];

  // 1. HISTORIC_LEADS_UNNURTURED: Leads 30-90 days old never nurtured
  // (This would require looking at lead age data - placeholder logic)
  // In practice, this comes from CRM data query
  if (hasUnnurturedHistoricLeads(metrics)) {
    indicators.push(AmberIndicator.HISTORIC_LEADS_UNNURTURED);
  }

  // 2. SEASONAL_OPPORTUNITY: Seasonal period approaching
  const seasonalWindow = checkSeasonalOpportunitySoon(metrics.category);
  if (seasonalWindow) {
    indicators.push(AmberIndicator.SEASONAL_OPPORTUNITY);
  }

  // 3. SEO_OPPORTUNITY_WINDOW: Target keywords approaching first-page ranking
  if (checkSEOOpportunitySoon(metrics)) {
    indicators.push(AmberIndicator.SEO_OPPORTUNITY_WINDOW);
  }

  // 4. PAST_CLIENT_REACTIVATION: Eligible past clients found
  // (In practice, from CRM query: clients not booked in >12 months)
  if (hasPastClientsEligibleForReactivation()) {
    indicators.push(AmberIndicator.PAST_CLIENT_REACTIVATION);
  }

  // 5. LEAD_QUALITY_DECLINING: Quality score down >15%
  if (previousMetrics) {
    const qualityDrop =
      (previousMetrics.enquiry.avgQualityScore - metrics.enquiry.avgQualityScore) /
      previousMetrics.enquiry.avgQualityScore;
    if (qualityDrop > SCORING_THRESHOLDS.lead_quality_score_drop) {
      indicators.push(AmberIndicator.LEAD_QUALITY_DECLINING);
    }
  }

  // 6. AD_SPEND_EFFICIENCY_DROP: Ad spend ROI down 10%
  if (previousMetrics) {
    const efficiencyDrop = (previousMetrics.roas - metrics.roas) / previousMetrics.roas;
    if (
      efficiencyDrop > SCORING_THRESHOLDS.ad_spend_efficiency_drop &&
      efficiencyDrop < SCORING_THRESHOLDS.campaign_performance_drop
    ) {
      indicators.push(AmberIndicator.AD_SPEND_EFFICIENCY_DROP);
    }
  }

  return indicators;
}

// ============================================================================
// GREEN INDICATOR DETECTION
// ============================================================================

function detectGreenIndicators(
  metrics: LENSMetrics,
  previousMetrics: LENSMetrics | null,
  businessGoals: any,
): GreenIndicator[] {
  const indicators: GreenIndicator[] = [];

  // 1. SEO_GENERATING: Organic enquiries in last 14 days
  if (
    metrics.leads.source.organic > 0 &&
    daysSinceLastSeqEntry(metrics) < SCORING_THRESHOLDS.seo_consistency_days
  ) {
    indicators.push(GreenIndicator.SEO_GENERATING);
  }

  // 2. CPL_IMPROVING: Month-over-month CPL improved by >5%
  if (previousMetrics) {
    const cplImprovement = (previousMetrics.cpl - metrics.cpl) / previousMetrics.cpl;
    if (cplImprovement > SCORING_THRESHOLDS.cpl_improving_percent) {
      indicators.push(GreenIndicator.CPL_IMPROVING);
    }
  }

  // 3. CONVERSION_HEALTHY: Conversion >= 15%
  if (metrics.sales.conversionRateFromLeads >= SCORING_THRESHOLDS.conversion_healthy_minimum) {
    indicators.push(GreenIndicator.CONVERSION_HEALTHY);
  }

  // 4. NURTURE_CONVERTING: Nurture sequence >20% conversion
  if (metrics.nurture.conversionRate >= SCORING_THRESHOLDS.nurture_target_conversion) {
    indicators.push(GreenIndicator.NURTURE_CONVERTING);
  }

  // 5. BOOKING_VALUE_RISING: Booking value up >10%
  if (previousMetrics) {
    const valueGrowth = (metrics.sales.avgBookingValue - previousMetrics.sales.avgBookingValue) /
      previousMetrics.sales.avgBookingValue;
    if (valueGrowth > SCORING_THRESHOLDS.booking_value_growth) {
      indicators.push(GreenIndicator.BOOKING_VALUE_RISING);
    }
  }

  // 6. CAMPAIGN_ROI_STRONG: ROAS >= 3x
  if (metrics.roas >= SCORING_THRESHOLDS.campaign_roi_target) {
    indicators.push(GreenIndicator.CAMPAIGN_ROI_STRONG);
  }

  // 7. PIPELINE_HEALTHY: Booking pipeline covers 30+ days
  const pipelineDaysCover = calculatePipelineVisibility(metrics);
  if (pipelineDaysCover >= SCORING_THRESHOLDS.pipeline_days_cover) {
    indicators.push(GreenIndicator.PIPELINE_HEALTHY);
  }

  return indicators;
}

// ============================================================================
// SCORING CALCULATIONS
// ============================================================================

function calculateCategoryScore(
  indicators: (RedIndicator | AmberIndicator | GreenIndicator)[],
  weights: Record<string, number>,
): number {
  if (indicators.length === 0) return 0;

  return indicators.reduce((sum, indicator) => {
    const weight = weights[indicator] || 0;
    return sum + weight;
  }, 0);
}

function determinePriorityLevel(
  redScore: number,
  amberScore: number,
  greenScore: number,
): PriorityLevel {
  if (redScore > amberScore && redScore > greenScore) {
    return PriorityLevel.RED;
  }
  if (amberScore > greenScore) {
    return PriorityLevel.AMBER;
  }
  return PriorityLevel.GREEN;
}

function calculateOverallScore(
  level: PriorityLevel,
  redScore: number,
  amberScore: number,
  greenScore: number,
): number {
  // Scale scores to 0-100
  const maxScore = 1; // Max weight sum is 1.0
  const levelScores: Record<PriorityLevel, number> = {
    [PriorityLevel.RED]: Math.round((redScore / maxScore) * 100),
    [PriorityLevel.AMBER]: Math.round((amberScore / maxScore) * 100),
    [PriorityLevel.GREEN]: Math.round((greenScore / maxScore) * 100),
  };
  return Math.min(100, Math.max(0, levelScores[level]));
}

function calculateConfidence(indicatorCount: number, metrics: LENSMetrics): number {
  // Confidence based on data richness and indicator agreement
  const dataRichness = Math.min(indicatorCount / 6, 1.0); // 0-1
  const dataCompleteness =
    (metrics.leads.total > 0 ? 0.25 : 0) +
    (metrics.sales.bookings > 0 ? 0.25 : 0) +
    (metrics.roas > 0 ? 0.25 : 0) +
    (metrics.cpl > 0 ? 0.25 : 0);
  return (dataRichness + dataCompleteness) / 2;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateLeadFollowUpRate(metrics: LENSMetrics): number {
  if (metrics.leads.total === 0) return 0;
  return metrics.leads.followedUp / metrics.leads.total;
}

function calculateBookingsVsTarget(metrics: LENSMetrics, businessGoals: any): number {
  // Find goal for this category with this period
  const goal = businessGoals?.goals?.find((g: any) => g.period === 'monthly');
  if (!goal) return 1; // No goal = assume on track
  return metrics.sales.bookings / goal.target;
}

function calculateCampaignPerformanceChange(
  current: LENSMetrics,
  previous: LENSMetrics | null,
): number {
  if (!previous) return 0;
  return (current.roas - previous.roas) / previous.roas;
}

function hasUnnurturedHistoricLeads(metrics: LENSMetrics): boolean {
  // In real implementation, query CRM for leads >30 days old, never sent email
  // Placeholder: check if engagement rate suggests uncontacted leads
  return metrics.enquiry.engagementRate < 0.5 && metrics.leads.total > metrics.nurture.leadsInSequence;
}

function checkSeasonalOpportunitySoon(category: PhotographyCategory): boolean {
  // Seasonal windows by category
  const seasonalWindows: Record<PhotographyCategory, { start: number; end: number }> = {
    weddings: { start: 4, end: 10 }, // April-October
    engagements: { start: 11, end: 2 }, // November-February
    family: { start: 5, end: 9 }, // May-September
    newborns: { start: 0, end: 11 }, // Year-round but peaks around holidays
    portraits: { start: 0, end: 11 }, // Year-round
    pets: { start: 3, end: 10 }, // Spring-Fall
    boudoir: { start: 0, end: 11 }, // Year-round
    headshots: { start: 0, end: 11 }, // Year-round
    commercial: { start: 0, end: 11 }, // Year-round
    schools: { start: 7, end: 9 }, // August-September (back to school)
    sports: { start: 0, end: 11 }, // Year-round
    events: { start: 5, end: 10 }, // May-October
    property: { start: 2, end: 8 }, // March-August
    albums_upsell: { start: 0, end: 11 }, // Year-round
  };

  const now = new Date();
  const currentMonth = now.getMonth();
  const window = seasonalWindows[category];
  const weeksUntilWindow = window && currentMonth < window.start ? window.start - currentMonth : 0;

  // Return true if seasonal window starts within 4 weeks
  return weeksUntilWindow > 0 && weeksUntilWindow <= 4;
}

function checkSEOOpportunitySoon(metrics: LENSMetrics): boolean {
  // Check if any keywords are in top 15-20 (approaching first page)
  return metrics.seoRanking.topKeywords.some((kw) => kw.position >= 11 && kw.position <= 20);
}

function hasPastClientsEligibleForReactivation(): boolean {
  // In real implementation, query CRM for clients with no booking in >12 months
  // Placeholder: return true if data suggests reactivation opportunity
  return true;
}

function daysSinceLastSeqEntry(metrics: LENSMetrics): number {
  // Placeholder: in real implementation, track date of last organic enquiry
  return 7;
}

function calculatePipelineVisibility(metrics: LENSMetrics): number {
  // Sum pipeline value and estimate days of bookings at current rate
  const totalPipelineValue = metrics.sales.pipeline.reduce((sum, stage) => sum + stage.value, 0);
  const avgBookingValue = metrics.sales.avgBookingValue || 1;
  const estimatedBookings = totalPipelineValue / avgBookingValue;
  const dailyBookingRate = metrics.sales.bookings / 30; // Monthly metrics assume 30 days
  return estimatedBookings / dailyBookingRate;
}

// ============================================================================
// ACTION GENERATION
// ============================================================================

function generateRecommendedActions(
  level: PriorityLevel,
  redIndicators: RedIndicator[],
  amberIndicators: AmberIndicator[],
  greenIndicators: GreenIndicator[],
): string[] {
  const actions: string[] = [];

  if (level === PriorityLevel.RED) {
    if (redIndicators.includes(RedIndicator.CPL_RISEN)) {
      actions.push('Audit ad targeting and creative performance; pause underperforming audiences');
    }
    if (redIndicators.includes(RedIndicator.CONVERSION_DROPPED)) {
      actions.push('Review landing page and form conversion funnels; test new offers/copy');
    }
    if (redIndicators.includes(RedIndicator.LEADS_NOT_FOLLOWED)) {
      actions.push('Implement lead response automation; set up Slack/SMS alerts for new enquiries');
    }
    if (redIndicators.includes(RedIndicator.BOOKINGS_BEHIND_TARGET)) {
      actions.push('Activate follow-up sequences on warm leads; increase nurture email frequency');
    }
    if (redIndicators.includes(RedIndicator.CAMPAIGN_PERFORMANCE_DROPPED)) {
      actions.push('Pause current campaigns; review creative, audience, and offer; restart with learnings');
    }
    if (redIndicators.includes(RedIndicator.FUNNEL_LEAKING)) {
      actions.push('Analyze where leads drop in funnel (form? nurture? consultation?); plug leaks');
    }
  }

  if (level === PriorityLevel.AMBER) {
    if (amberIndicators.includes(AmberIndicator.HISTORIC_LEADS_UNNURTURED)) {
      actions.push('Launch win-back campaign targeting 30-90 day old unnurtured leads');
    }
    if (amberIndicators.includes(AmberIndicator.SEASONAL_OPPORTUNITY)) {
      actions.push('Prepare seasonal campaign 4 weeks before peak season; front-load ads and content');
    }
    if (amberIndicators.includes(AmberIndicator.SEO_OPPORTUNITY_WINDOW)) {
      actions.push('Publish high-intent content targeting keywords in positions 11-20; build backlinks');
    }
    if (amberIndicators.includes(AmberIndicator.PAST_CLIENT_REACTIVATION)) {
      actions.push('Email past clients with limited-time offer or new service showcase');
    }
    if (amberIndicators.includes(AmberIndicator.LEAD_QUALITY_DECLINING)) {
      actions.push('Tighten audience targeting; increase landing page qualification; improve form UX');
    }
    if (amberIndicators.includes(AmberIndicator.AD_SPEND_EFFICIENCY_DROP)) {
      actions.push('Test new audiences or placements; review competitor spending and positioning');
    }
  }

  if (level === PriorityLevel.GREEN) {
    if (greenIndicators.includes(GreenIndicator.SEO_GENERATING)) {
      actions.push('Continue SEO content strategy; monitor rankings and expand successful topics');
    }
    if (greenIndicators.includes(GreenIndicator.CPL_IMPROVING)) {
      actions.push('Maintain current ad strategy; slowly scale budget on high-performers');
    }
    if (greenIndicators.includes(GreenIndicator.CONVERSION_HEALTHY)) {
      actions.push('A/B test offer variants; incrementally increase ad spend on existing campaigns');
    }
    if (greenIndicators.includes(GreenIndicator.NURTURE_CONVERTING)) {
      actions.push('Document nurture sequence; replicate for other categories; share learnings');
    }
    if (greenIndicators.includes(GreenIndicator.BOOKING_VALUE_RISING)) {
      actions.push('Test higher-tier packages; bundle services; emphasize premium offerings');
    }
    if (greenIndicators.includes(GreenIndicator.CAMPAIGN_ROI_STRONG)) {
      actions.push('Scale winning campaigns; consider expanding to similar audiences/placements');
    }
    if (greenIndicators.includes(GreenIndicator.PIPELINE_HEALTHY)) {
      actions.push('Maintain current lead flow; focus on maximizing booking value and customer satisfaction');
    }
  }

  return actions.slice(0, 3); // Return top 3 actions
}
