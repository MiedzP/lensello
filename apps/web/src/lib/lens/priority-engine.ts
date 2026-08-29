/**
 * Red/Amber/Green Priority Engine
 * Evaluates business performance and surfaces the highest-impact actions
 */

export type PriorityLevel = 'red' | 'amber' | 'green'

export interface Priority {
  level: PriorityLevel
  category: string
  title: string
  description: string
  action: string
  actionLink: string
  severity: number // 0-100 for sorting
}

export interface BusinessMetrics {
  monthlyEnquiries: number
  monthlyBookings: number
  conversionRate: number
  meta_cpl?: number // cost per lead
  meta_cpl_trend?: 'up' | 'down' | 'stable'
  website_conversion?: number
  website_conversion_trend?: 'up' | 'down' | 'stable'
  response_time_hours?: number
  warm_enquiries_unanswered?: number
  past_enquiries_count?: number
  past_enquiries_unanswered?: number
  portfolio_freshness_days?: number
  booking_rate?: number
  target_booking_rate?: number
}

/**
 * Main priority engine: analyzes metrics and returns prioritized actions
 */
export function generatePriorities(metrics: BusinessMetrics): Priority[] {
  const priorities: Priority[] = []

  // RED: Critical issues that cost revenue
  if (metrics.meta_cpl_trend === 'up' && metrics.meta_cpl && metrics.meta_cpl > 50) {
    priorities.push({
      level: 'red',
      category: 'ads',
      title: 'Meta cost per lead has risen materially',
      description: `Your CPL is now £${metrics.meta_cpl.toFixed(2)}, up from previous weeks. This is reducing profitability.`,
      action: 'Refresh creative',
      actionLink: '/ads/creative',
      severity: 95,
    })
  }

  if (
    metrics.website_conversion_trend === 'down' &&
    metrics.website_conversion &&
    metrics.website_conversion < 1.5
  ) {
    priorities.push({
      level: 'red',
      category: 'website',
      title: 'Website conversion has fallen',
      description: `Your conversion rate dropped to ${metrics.website_conversion.toFixed(2)}%. Fewer prospects are becoming consultations.`,
      action: 'Review form',
      actionLink: '/settings/website',
      severity: 90,
    })
  }

  if (metrics.warm_enquiries_unanswered && metrics.warm_enquiries_unanswered > 3) {
    priorities.push({
      level: 'red',
      category: 'follow-up',
      title: `Follow up ${metrics.warm_enquiries_unanswered} unhandled messages`,
      description: 'You have unresponded enquiries in your inbox. Quick replies convert prospects into bookings.',
      action: 'View inbox',
      actionLink: '/conversations',
      severity: 85,
    })
  }

  if (metrics.booking_rate && metrics.target_booking_rate && metrics.booking_rate < metrics.target_booking_rate * 0.75) {
    priorities.push({
      level: 'red',
      category: 'bookings',
      title: 'Bookings are behind target',
      description: `You're at ${metrics.booking_rate} bookings/month but targeting ${metrics.target_booking_rate}. You're 25%+ behind.`,
      action: 'Review strategy',
      actionLink: '/dashboard',
      severity: 88,
    })
  }

  // AMBER: Opportunities to grow or improve
  if (metrics.past_enquiries_unanswered && metrics.past_enquiries_unanswered > 10) {
    priorities.push({
      level: 'amber',
      category: 'nurture',
      title: `${metrics.past_enquiries_unanswered} past enquiries haven't booked yet`,
      description: 'Reconnect with prospects you quoted over 2 weeks ago. A gentle follow-up often closes the deal.',
      action: 'Create campaign',
      actionLink: '/campaigns/new',
      severity: 70,
    })
  }

  if (metrics.portfolio_freshness_days && metrics.portfolio_freshness_days > 90) {
    priorities.push({
      level: 'amber',
      category: 'portfolio',
      title: 'Your portfolio is getting stale',
      description: 'Recent work builds trust. Schedule a shoot or refresh your gallery soon.',
      action: 'View gallery',
      actionLink: '/library',
      severity: 65,
    })
  }

  if (metrics.response_time_hours && metrics.response_time_hours > 4) {
    priorities.push({
      level: 'amber',
      category: 'response',
      title: 'Slow response time may cost bookings',
      description: `Your average response is ${metrics.response_time_hours} hours. Prospects book fast — aim for under 2 hours.`,
      action: 'Improve process',
      actionLink: '/automations',
      severity: 60,
    })
  }

  // GREEN: Things working well (encourage continuation)
  if (metrics.conversionRate > 15 && metrics.monthlyEnquiries > 5) {
    priorities.push({
      level: 'green',
      category: 'conversion',
      title: 'Your conversion is above benchmark',
      description: 'Strong follow-up and positioning is paying off. Keep this momentum.',
      action: 'View stats',
      actionLink: '/dashboard?tab=stats',
      severity: 45,
    })
  }

  if (metrics.website_conversion_trend === 'up') {
    priorities.push({
      level: 'green',
      category: 'website',
      title: 'Website performance is improving',
      description: 'Your conversion rate is trending up. Your messaging is resonating.',
      action: 'Continue',
      actionLink: '/dashboard',
      severity: 40,
    })
  }

  // Sort by severity (highest first)
  return priorities.sort((a, b) => b.severity - a.severity)
}

/**
 * Generate a single recommended action for the dashboard
 * Prioritizes: Red items first, then Amber, then most impactful Green
 */
export function getRecommendedAction(priorities: Priority[]): Priority | null {
  if (priorities.length === 0) return null

  // Red items take absolute priority
  const redActions = priorities.filter((p) => p.level === 'red')
  if (redActions.length > 0) {
    return redActions[0]
  }

  // Amber items next
  const amberActions = priorities.filter((p) => p.level === 'amber')
  if (amberActions.length > 0) {
    return amberActions[0]
  }

  // Green items if nothing else
  return priorities[0] || null
}

/**
 * Count priorities by level for dashboard summary
 */
export function prioritySummary(priorities: Priority[]) {
  return {
    red: priorities.filter((p) => p.level === 'red').length,
    amber: priorities.filter((p) => p.level === 'amber').length,
    green: priorities.filter((p) => p.level === 'green').length,
  }
}
