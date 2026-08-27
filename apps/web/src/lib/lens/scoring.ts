/**
 * LENS Framework Scoring
 * Calculates baseline metrics for LEAD, ELEVATE, NURTURE, SCALE
 */

export interface LENSScores {
  lead: LeadScore
  elevate: ElevateScore
  nurture: NurtureScore
  scale: ScaleScore
  overall: number // 0-100
}

export interface LeadScore {
  value: number // 0-100
  enquiries_per_month: number
  traffic_trend: 'up' | 'down' | 'stable'
  top_source: string
  insight: string
}

export interface ElevateScore {
  value: number // 0-100
  average_rating: number
  review_count: number
  positioning_strength: 'weak' | 'moderate' | 'strong'
  insight: string
}

export interface NurtureScore {
  value: number // 0-100
  conversion_rate: number // %
  response_time_hours: number
  consultation_rate: number // %
  insight: string
}

export interface ScaleScore {
  value: number // 0-100
  average_booking_value: number
  profit_margin: number // %
  capacity_utilization: number // %
  automation_level: 'minimal' | 'partial' | 'advanced'
  insight: string
}

/**
 * Calculate LENS scores from business metrics
 */
export function calculateLENSScores(metrics: {
  monthlyEnquiries: number
  monthlyBookings: number
  conversionRate: number
  response_time_hours: number
  average_booking_value: number
  monthly_capacity: number
  website_traffic_trend?: 'up' | 'down' | 'stable'
  top_lead_source?: string
  review_count?: number
  average_rating?: number
  positioning?: string
  profit_margin?: number
}): LENSScores {
  // LEAD: Are enough suitable clients discovering the photographer?
  const leadScore = calculateLeadScore({
    enquiries_per_month: metrics.monthlyEnquiries,
    traffic_trend: metrics.website_traffic_trend || 'stable',
    top_source: metrics.top_lead_source || 'organic',
  })

  // ELEVATE: Does the brand justify the desired price?
  const elevateScore = calculateElevateScore({
    review_count: metrics.review_count || 0,
    average_rating: metrics.average_rating || 4.5,
    positioning: metrics.positioning || 'moderate',
  })

  // NURTURE: Are enquiries becoming clients?
  const nurtureScore = calculateNurtureScore({
    conversion_rate: metrics.conversionRate,
    response_time_hours: metrics.response_time_hours,
    monthly_enquiries: metrics.monthlyEnquiries,
    monthly_bookings: metrics.monthlyBookings,
  })

  // SCALE: Is the business profitable and capable of growing?
  const scaleScore = calculateScaleScore({
    average_booking_value: metrics.average_booking_value,
    monthly_bookings: metrics.monthlyBookings,
    monthly_capacity: metrics.monthly_capacity,
    profit_margin: metrics.profit_margin || 40,
  })

  // Overall score is average of the four pillars
  const overall = Math.round(
    (leadScore.value + elevateScore.value + nurtureScore.value + scaleScore.value) / 4
  )

  return { lead: leadScore, elevate: elevateScore, nurture: nurtureScore, scale: scaleScore, overall }
}

/**
 * LEAD: Discovery and lead generation
 */
function calculateLeadScore(metrics: {
  enquiries_per_month: number
  traffic_trend: 'up' | 'down' | 'stable'
  top_source: string
}): LeadScore {
  // Benchmark: 5-10 enquiries/month is healthy for most photographers
  let score = Math.min(100, (metrics.enquiries_per_month / 10) * 100)

  // Boost if traffic is trending up
  if (metrics.traffic_trend === 'up') score = Math.min(100, score + 10)
  // Penalty if trending down
  if (metrics.traffic_trend === 'down') score = Math.max(0, score - 15)

  return {
    value: Math.round(score),
    enquiries_per_month: metrics.enquiries_per_month,
    traffic_trend: metrics.traffic_trend,
    top_source: metrics.top_source,
    insight:
      metrics.enquiries_per_month < 3
        ? 'You need more visibility. Focus on SEO and social proof.'
        : metrics.enquiries_per_month > 8
          ? 'Your visibility is strong. Now focus on conversion.'
          : 'Steady lead flow. Look for growth opportunities.',
  }
}

/**
 * ELEVATE: Brand positioning and perceived value
 */
function calculateElevateScore(metrics: {
  review_count: number
  average_rating: number
  positioning: string
}): ElevateScore {
  // 20+ reviews is strong
  let score = Math.min(100, (metrics.review_count / 20) * 50)
  // Rating matters (4.5+ is excellent)
  score += (metrics.average_rating / 5) * 50

  return {
    value: Math.round(score),
    average_rating: metrics.average_rating,
    review_count: metrics.review_count,
    positioning_strength: metrics.positioning === 'strong' ? 'strong' : 'moderate',
    insight:
      metrics.review_count < 10
        ? 'Build social proof. Ask clients for reviews.'
        : metrics.average_rating < 4.5
          ? 'Your rating is good, but aim for 4.8+. Perfect delivery matters.'
          : 'Strong brand positioning. Leads trust you.',
  }
}

/**
 * NURTURE: Conversion from enquiry to booking
 */
function calculateNurtureScore(metrics: {
  conversion_rate: number
  response_time_hours: number
  monthly_enquiries: number
  monthly_bookings: number
}): NurtureScore {
  // Benchmark: 15% conversion is healthy, 20%+ is excellent
  let score = Math.min(100, (metrics.conversion_rate / 20) * 100)

  // Response time penalty (should be <4 hours)
  if (metrics.response_time_hours > 4) score = Math.max(0, score - (metrics.response_time_hours - 4) * 5)

  return {
    value: Math.round(score),
    conversion_rate: metrics.conversion_rate,
    response_time_hours: metrics.response_time_hours,
    consultation_rate: metrics.monthly_bookings > 0 ? (metrics.monthly_bookings / metrics.monthly_enquiries) * 100 : 0,
    insight:
      metrics.conversion_rate < 10
        ? 'Low conversion. Review your follow-up process and pricing.'
        : metrics.response_time_hours > 8
          ? 'Slow response is losing deals. Automate initial contact.'
          : 'You\'re converting well. Keep the momentum.',
  }
}

/**
 * SCALE: Profitability and growth capacity
 */
function calculateScaleScore(metrics: {
  average_booking_value: number
  monthly_bookings: number
  monthly_capacity: number
  profit_margin: number
}): ScaleScore {
  // Revenue score: monthly revenue vs capacity
  const monthly_revenue = metrics.average_booking_value * metrics.monthly_bookings
  const capacity_utilization = (metrics.monthly_bookings / metrics.monthly_capacity) * 100

  let score = (capacity_utilization / 100) * 50 // Up to 50 points for capacity
  score += (metrics.profit_margin / 50) * 50 // Up to 50 points for profitability

  return {
    value: Math.round(Math.min(100, score)),
    average_booking_value: metrics.average_booking_value,
    profit_margin: metrics.profit_margin,
    capacity_utilization: Math.min(100, capacity_utilization),
    automation_level: 'minimal',
    insight:
      capacity_utilization > 90
        ? 'You\'re at capacity. Raise prices or add capacity.'
        : capacity_utilization < 50
          ? 'Plenty of capacity. Focus on filling dates.'
          : 'Healthy utilization. Optimize profitability.',
  }
}

/**
 * Generate LENS summary for dashboard
 */
export function getLENSSummary(scores: LENSScores): {
  headline: string
  status: 'strong' | 'growth' | 'attention_needed'
  nextAction: string
} {
  if (scores.overall >= 70) {
    return {
      headline: 'Your business is growing strong',
      status: 'strong',
      nextAction: 'Focus on scaling what works best',
    }
  } else if (scores.overall >= 50) {
    return {
      headline: 'You have a solid foundation',
      status: 'growth',
      nextAction: 'Identify your weakest pillar and strengthen it',
    }
  } else {
    return {
      headline: 'Your business needs attention',
      status: 'attention_needed',
      nextAction: 'Start with the lowest LENS score pillar',
    }
  }
}
