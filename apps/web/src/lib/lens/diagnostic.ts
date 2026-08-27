/**
 * Marketing Diagnostic Framework
 * 6-area assessment to explain platform recommendations
 */

export interface DiagnosticArea {
  id: 'position' | 'product' | 'visibility' | 'conversion' | 'nurture' | 'performance'
  name: string
  description: string
  whatsDiagnosed: string[]
}

export interface DiagnosticStatus {
  status: 'red' | 'amber' | 'green'
  insight: string
  recommendation?: string
}

export interface DiagnosticAssessment {
  position: DiagnosticStatus
  product: DiagnosticStatus
  visibility: DiagnosticStatus
  conversion: DiagnosticStatus
  nurture: DiagnosticStatus
  performance: DiagnosticStatus
  lastAssessed: Date | null
}

export const DIAGNOSTIC_AREAS: DiagnosticArea[] = [
  {
    id: 'position',
    name: 'POSITION',
    description: 'Brand, differentiation, ideal client, authority',
    whatsDiagnosed: [
      'Brand clarity and messaging',
      'Ideal client definition',
      'Competitive differentiation',
      'Authority indicators',
      'Portfolio quality',
      'Brand consistency',
    ],
  },
  {
    id: 'product',
    name: 'PRODUCT',
    description: 'Packages, pricing, profitability',
    whatsDiagnosed: [
      'Package clarity and value',
      'Pricing strategy',
      'Profit margins',
      'Package popularity',
      'Upsell opportunities',
      'Payment terms',
    ],
  },
  {
    id: 'visibility',
    name: 'VISIBILITY',
    description: 'SEO, social, venues, Meta, Google',
    whatsDiagnosed: [
      'Organic search visibility',
      'Social media presence',
      'Venue partnership visibility',
      'Meta ads performance',
      'Google Business profile',
      'Review volume and ratings',
    ],
  },
  {
    id: 'conversion',
    name: 'CONVERSION',
    description: 'Website, enquiry journey, consultations',
    whatsDiagnosed: [
      'Website conversion rate',
      'Enquiry form quality',
      'Enquiry response time',
      'Consultation booking rate',
      'Sales page copy',
      'Call-to-action clarity',
    ],
  },
  {
    id: 'nurture',
    name: 'NURTURE',
    description: 'CRM, follow-up, email, remarketing',
    whatsDiagnosed: [
      'CRM system usage',
      'Follow-up sequence',
      'Email quality and frequency',
      'Remarketing campaigns',
      'Past client reactivation',
      'Referral program',
    ],
  },
  {
    id: 'performance',
    name: 'PERFORMANCE',
    description: 'Leads, bookings, conversion, revenue',
    whatsDiagnosed: [
      'Monthly enquiry volume',
      'Booking close rate',
      'Revenue per booking',
      'Month-over-month trends',
      'Year-over-year growth',
      'Customer lifetime value',
    ],
  },
]

/**
 * Get status color and icon for display
 */
export function getStatusDisplay(status: 'red' | 'amber' | 'green') {
  const display = {
    red: {
      icon: '🔴',
      label: 'Action needed',
      color: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      severity: 'high',
    },
    amber: {
      icon: '🟠',
      label: 'Improvement needed',
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      severity: 'medium',
    },
    green: {
      icon: '🟢',
      label: 'Performing well',
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      severity: 'low',
    },
  }
  return display[status]
}

/**
 * Calculate diagnostic status based on LENS scores and business data
 */
export function calculateDiagnosticStatus(data: {
  // POSITION indicators
  portfolioQuality?: number // 0-100
  reviewCount?: number
  googleRating?: number // 1-5

  // PRODUCT indicators
  hasMultiplePackages?: boolean
  profitMargin?: number // percentage
  packageUtilization?: number // 0-100

  // VISIBILITY indicators
  monthlyEnquiries?: number
  organicPercentage?: number // 0-100
  googleBusinessRating?: number

  // CONVERSION indicators
  conversionRate?: number // 0-100
  responseTime?: number // hours
  consultationBookingRate?: number // 0-100

  // NURTURE indicators
  crmUsage?: number // 0-100
  followUpSequences?: number
  emailEngagement?: number // 0-100

  // PERFORMANCE indicators
  monthlyRevenue?: number
  revenueGrowth?: number // month-over-month percentage
  bookingTrend?: number // -50 to +50 percentage
}): DiagnosticAssessment {
  return {
    position: calculatePositionStatus(data),
    product: calculateProductStatus(data),
    visibility: calculateVisibilityStatus(data),
    conversion: calculateConversionStatus(data),
    nurture: calculateNurtureStatus(data),
    performance: calculatePerformanceStatus(data),
    lastAssessed: new Date(),
  }
}

function calculatePositionStatus(data: any): DiagnosticStatus {
  const scores = [
    data.portfolioQuality || 0,
    data.reviewCount ? Math.min(data.reviewCount / 5, 100) : 0,
    data.googleRating ? (data.googleRating / 5) * 100 : 0,
  ]
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  if (avgScore < 40) {
    return {
      status: 'red',
      insight: 'Your brand positioning needs immediate attention. Portfolio and reviews are limiting growth.',
      recommendation: 'Refresh portfolio with recent work, gather reviews, clarify ideal client.',
    }
  } else if (avgScore < 70) {
    return {
      status: 'amber',
      insight: 'Brand positioning is decent but could be stronger. Review quality and authority indicators need improvement.',
      recommendation: 'Focus on gathering 5+ more reviews and strengthening brand messaging.',
    }
  } else {
    return {
      status: 'green',
      insight: 'Your brand positioning is strong with good portfolio quality and social proof.',
      recommendation: 'Maintain portfolio updates and continue gathering reviews.',
    }
  }
}

function calculateProductStatus(data: any): DiagnosticStatus {
  const scores = [
    data.hasMultiplePackages ? 100 : 50,
    data.profitMargin ? Math.min(data.profitMargin, 100) : 30,
    data.packageUtilization || 0,
  ]
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  if (avgScore < 40) {
    return {
      status: 'red',
      insight: 'Pricing and profitability need urgent review. Margins may be too low.',
      recommendation: 'Audit pricing structure, identify low-margin packages, create tiered offerings.',
    }
  } else if (avgScore < 70) {
    return {
      status: 'amber',
      insight: 'Packages are workable but pricing could be optimized for better profitability.',
      recommendation: 'Review package values, test price increases, create premium tier.',
    }
  } else {
    return {
      status: 'green',
      insight: 'Pricing strategy is strong with good package variety and profitability.',
      recommendation: 'Monitor for upsell opportunities and market changes.',
    }
  }
}

function calculateVisibilityStatus(data: any): DiagnosticStatus {
  const scores = [
    Math.min((data.monthlyEnquiries || 0) / 20 * 100, 100),
    data.organicPercentage || 20,
    data.googleBusinessRating ? (data.googleBusinessRating / 5) * 100 : 50,
  ]
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  if (avgScore < 40) {
    return {
      status: 'red',
      insight: 'Visibility is low. Very few enquiries coming from organic or paid sources.',
      recommendation: 'Launch Meta campaigns, optimize Google Business, create SEO content.',
    }
  } else if (avgScore < 70) {
    return {
      status: 'amber',
      insight: 'Visibility is moderate but should be stronger. Not enough people know about you.',
      recommendation: 'Increase social media presence, run Meta ads, improve Google Business profile.',
    }
  } else {
    return {
      status: 'green',
      insight: 'Good visibility. Strong online presence with healthy enquiry flow.',
      recommendation: 'Maintain consistency, test new marketing channels.',
    }
  }
}

function calculateConversionStatus(data: any): DiagnosticStatus {
  const scores = [
    data.conversionRate || 20,
    Math.min((24 / (data.responseTime || 24)) * 100, 100),
    data.consultationBookingRate || 30,
  ]
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  if (avgScore < 40) {
    return {
      status: 'red',
      insight: 'Conversion is weak. Too many enquiries are not becoming consultations.',
      recommendation: 'Improve response time, optimize website, clarify value proposition.',
    }
  } else if (avgScore < 70) {
    return {
      status: 'amber',
      insight: 'Conversion is okay but leaving money on the table. Response time or messaging needs work.',
      recommendation: 'Speed up response time, A/B test website copy, refine consultations.',
    }
  } else {
    return {
      status: 'green',
      insight: 'Strong conversion. Enquiries are becoming consultations at healthy rate.',
      recommendation: 'Focus on consultation-to-booking rate.',
    }
  }
}

function calculateNurtureStatus(data: any): DiagnosticStatus {
  const scores = [
    data.crmUsage || 20,
    Math.min((data.followUpSequences || 0) * 30, 100),
    data.emailEngagement || 30,
  ]
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  if (avgScore < 40) {
    return {
      status: 'red',
      insight: 'Nurture is almost non-existent. Past enquiries are not being followed up.',
      recommendation: 'Set up CRM, create email sequences, implement follow-up process.',
    }
  } else if (avgScore < 70) {
    return {
      status: 'amber',
      insight: 'Basic nurture exists but could be more systematic. Leaving bookings on the table.',
      recommendation: 'Build automated email sequences, set up follow-up reminders, track engagement.',
    }
  } else {
    return {
      status: 'green',
      insight: 'Strong nurture process. Consistent follow-up and engagement with prospects.',
      recommendation: 'Track which sequences work best, test new messaging.',
    }
  }
}

function calculatePerformanceStatus(data: any): DiagnosticStatus {
  const scores = [
    Math.min((data.monthlyRevenue || 0) / 5000 * 100, 100),
    Math.min(50 + ((data.revenueGrowth || 0) / 10), 100),
    Math.min(50 + ((data.bookingTrend || 0) / 5), 100),
  ]
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  if (avgScore < 40) {
    return {
      status: 'red',
      insight: 'Revenue and bookings are below target. Business growth is stalling.',
      recommendation: 'Fix visibility, conversion, and nurture issues. Review pricing.',
    }
  } else if (avgScore < 70) {
    return {
      status: 'amber',
      insight: 'Performance is decent but not optimal. Growth could be accelerated.',
      recommendation: 'Focus on weak areas identified in other diagnostics.',
    }
  } else {
    return {
      status: 'green',
      insight: 'Strong financial performance. Revenue and bookings on track.',
      recommendation: 'Maintain systems, explore capacity constraints.',
    }
  }
}
