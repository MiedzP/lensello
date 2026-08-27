'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { calculateLENSScores, getLENSSummary } from '@/lib/lens/scoring'

interface MonthlyReviewViewProps {
  enquiries: any[]
  bookings: any[]
  campaigns: any[]
  businessProfile: any
  goals: any[]
  totalRevenue: number
  month: string
}

export default function MonthlyReviewView({
  enquiries,
  bookings,
  campaigns,
  businessProfile,
  goals,
  totalRevenue,
  month,
}: MonthlyReviewViewProps) {
  // Calculate LENS scores from this month's data
  const lensScores = calculateLENSScores({
    monthlyEnquiries: enquiries.length,
    monthlyBookings: bookings.length,
    conversionRate: enquiries.length > 0 ? (bookings.length / enquiries.length) * 100 : 0,
    response_time_hours: businessProfile?.nurture_response_time_hours || 4,
    average_booking_value: businessProfile?.average_booking_value_cents || 0 / 100,
    monthly_capacity: businessProfile?.desired_monthly_bookings || 10,
    website_traffic_trend: 'stable',
    review_count: businessProfile?.elevate_review_count || 0,
    profit_margin: businessProfile?.scale_profit_margin_pct || 40,
  })

  const summary = getLENSSummary(lensScores)

  const LENS_PILLARS = [
    { key: 'lead', title: 'LEAD', color: 'blue', icon: '📩' },
    { key: 'elevate', title: 'ELEVATE', color: 'purple', icon: '⭐' },
    { key: 'nurture', title: 'NURTURE', color: 'green', icon: '🤝' },
    { key: 'scale', title: 'SCALE', color: 'orange', icon: '📈' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Monthly Growth Review</h1>
        <p className="text-slate-600 mt-2">{month}</p>
      </div>

      {/* Summary Card */}
      <Card className="p-8 bg-gradient-to-br from-blue-50 to-blue-50 border-blue-200">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">THIS MONTH'S PERFORMANCE</p>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{summary.headline}</h2>
            <p className="text-slate-700 text-lg mb-4">
              Overall LENS Score: <span className="font-bold text-blue-600">{lensScores.overall}/100</span>
            </p>
            <p className="text-slate-600">Next: {summary.nextAction}</p>
          </div>
          <div className="text-6xl">
            {summary.status === 'strong'
              ? '🚀'
              : summary.status === 'growth'
                ? '📈'
                : '⚠️'}
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="text-sm text-slate-600 mb-2">Enquiries</div>
          <div className="text-3xl font-bold text-slate-900">{enquiries.length}</div>
          <div className="text-xs text-slate-600 mt-2">new this month</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-slate-600 mb-2">Bookings</div>
          <div className="text-3xl font-bold text-slate-900">{bookings.length}</div>
          <div className="text-xs text-slate-600 mt-2">confirmed shoots</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-slate-600 mb-2">Conversion</div>
          <div className="text-3xl font-bold text-slate-900">
            {enquiries.length > 0 ? Math.round((bookings.length / enquiries.length) * 100) : 0}%
          </div>
          <div className="text-xs text-slate-600 mt-2">of enquiries</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-slate-600 mb-2">Revenue</div>
          <div className="text-3xl font-bold text-slate-900">£{(totalRevenue / 100).toLocaleString()}</div>
          <div className="text-xs text-slate-600 mt-2">total</div>
        </Card>
      </div>

      {/* LENS Breakdown */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Your LENS Scores</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {LENS_PILLARS.map((pillar) => {
            const score = (lensScores as any)[pillar.key as keyof typeof lensScores]
            const scoreValue = score.value || 0

            return (
              <Card key={pillar.key} className="p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-2xl">{pillar.icon}</div>
                    <span className="text-3xl font-bold text-slate-900">{scoreValue}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">{pillar.title}</p>

                  {/* Score bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all`}
                      style={{
                        width: `${scoreValue}%`,
                        backgroundColor:
                          pillar.key === 'lead'
                            ? '#3b82f6'
                            : pillar.key === 'elevate'
                              ? '#a855f7'
                              : pillar.key === 'nurture'
                                ? '#22c55e'
                                : '#f97316',
                      }}
                    />
                  </div>
                </div>

                <p className="text-xs text-slate-600">{score.insight}</p>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Campaign Performance */}
      <Card className="p-6">
        <h3 className="text-xl font-bold text-slate-900 mb-4">Active Campaigns</h3>
        {campaigns.length > 0 ? (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="p-4 rounded-lg bg-slate-50 flex justify-between items-center">
                <div>
                  <p className="font-medium text-slate-900">{campaign.name}</p>
                  <p className="text-sm text-slate-600">{campaign.objective}</p>
                </div>
                <Link href={`/campaigns/${campaign.id}`}>
                  <Button variant="ghost" size="sm">
                    View →
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-600">No active campaigns. Ready to start one?</p>
        )}
      </Card>

      {/* Recommendations */}
      <Card className="p-6 bg-green-50 border-green-200">
        <h3 className="text-xl font-bold text-slate-900 mb-4">📋 Recommended Actions</h3>
        <ol className="space-y-2 text-slate-700">
          {lensScores.lead.value < 50 && (
            <li className="flex gap-2">
              <span className="font-bold text-red-600">1.</span>
              <span>Increase visibility - focus on your lowest-scoring channel</span>
            </li>
          )}
          {lensScores.nurture.value < 50 && (
            <li className="flex gap-2">
              <span className="font-bold text-red-600">2.</span>
              <span>Improve conversion - review your follow-up process</span>
            </li>
          )}
          {lensScores.scale.value < 50 && (
            <li className="flex gap-2">
              <span className="font-bold text-red-600">3.</span>
              <span>Increase capacity or revenue - adjust pricing or packages</span>
            </li>
          )}
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">Continue:</span>
            <span>What worked this month - scale it next month</span>
          </li>
        </ol>
      </Card>

      {/* Next Steps */}
      <div className="flex gap-3">
        <Link href="/rhythm">
          <Button variant="ghost">View Operating Rhythm</Button>
        </Link>
        <Link href="/dashboard">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
