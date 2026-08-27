'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface DashboardContentProps {
  businessProfile: any
  enquiries: number
  bookings: number
  pipelineValue: number
  priorities: any[]
}

export default function DashboardContent({
  businessProfile,
  enquiries,
  bookings,
  pipelineValue,
  priorities,
}: DashboardContentProps) {
  // Simulated priorities (Red/Amber/Green logic would come from a decision engine)
  const dashboardPriorities = [
    {
      priority: 'red',
      title: 'Follow up 7 warm enquiries',
      description: 'These prospects opened your pricing but haven\'t booked',
      action: 'Follow up',
      link: '/clients?filter=warm',
    },
    {
      priority: 'amber',
      title: 'Refresh your Meta creative',
      description: 'Your ad performance has declined this week',
      action: 'Create new',
      link: '/ads/creative',
    },
    {
      priority: 'green',
      title: 'Publishing performing well',
      description: 'Your venue content generated 8 enquiries this month',
      action: 'View stats',
      link: '/library?stats=true',
    },
  ]

  const opportunityCount = 23 // Placeholder

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">
            Good morning, {businessProfile?.business_name || 'Photographer'}
          </h1>
          <p className="text-slate-600 mt-1">Here's what's happening in your business</p>
        </div>
        <Link href="/diagnostic">
          <Button variant="outline" size="sm">
            View Diagnostic →
          </Button>
        </Link>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="text-sm text-slate-600 font-medium mb-2">This month</div>
          <div className="text-3xl font-bold text-slate-900">{enquiries}</div>
          <div className="text-sm text-slate-600 mt-1">new enquiries</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-slate-600 font-medium mb-2">This month</div>
          <div className="text-3xl font-bold text-slate-900">{bookings}</div>
          <div className="text-sm text-slate-600 mt-1">bookings confirmed</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-slate-600 font-medium mb-2">Pipeline</div>
          <div className="text-3xl font-bold text-slate-900">
            £{(pipelineValue / 100).toLocaleString()}
          </div>
          <div className="text-sm text-slate-600 mt-1">pending value</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-slate-600 font-medium mb-2">Conversion</div>
          <div className="text-3xl font-bold text-slate-900">
            {enquiries > 0 ? Math.round((bookings / enquiries) * 100) : 0}%
          </div>
          <div className="text-sm text-slate-600 mt-1">of enquiries</div>
        </Card>
      </div>

      {/* Your Marketing Priorities */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Your Marketing Priorities</h2>

        <div className="space-y-3">
          {dashboardPriorities.map((item, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-l-4 flex items-start justify-between ${
                item.priority === 'red'
                  ? 'bg-red-50 border-l-red-600'
                  : item.priority === 'amber'
                    ? 'bg-amber-50 border-l-amber-600'
                    : 'bg-green-50 border-l-green-600'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      item.priority === 'red'
                        ? 'bg-red-600'
                        : item.priority === 'amber'
                          ? 'bg-amber-600'
                          : 'bg-green-600'
                    }`}
                  />
                  <p
                    className={`font-semibold ${
                      item.priority === 'red'
                        ? 'text-red-900'
                        : item.priority === 'amber'
                          ? 'text-amber-900'
                          : 'text-green-900'
                    }`}
                  >
                    {item.priority === 'red'
                      ? 'ACTION NEEDED'
                      : item.priority === 'amber'
                        ? 'OPPORTUNITY'
                        : 'WORKING WELL'}
                  </p>
                </div>
                <p
                  className={`font-medium ${
                    item.priority === 'red'
                      ? 'text-red-900'
                      : item.priority === 'amber'
                        ? 'text-amber-900'
                        : 'text-green-900'
                  }`}
                >
                  {item.title}
                </p>
                <p
                  className={`text-sm mt-1 ${
                    item.priority === 'red'
                      ? 'text-red-700'
                      : item.priority === 'amber'
                        ? 'text-amber-700'
                        : 'text-green-700'
                  }`}
                >
                  {item.description}
                </p>
              </div>
              <Link href={item.link}>
                <Button variant="ghost" size="sm">
                  {item.action} →
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Opportunity */}
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-50 border-blue-200">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Untapped Opportunity</h3>
            <p className="text-slate-600 mb-4">
              You have {opportunityCount} past enquiries who haven't booked. They're warm leads
              ready to re-engage.
            </p>
            <Button>
              <Link href="/clients?filter=lost">Create nurture campaign →</Link>
            </Button>
          </div>
          <div className="text-4xl">🎯</div>
        </div>
      </Card>

      {/* Next Actions */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Recommended Next Action</h2>
        <Card className="p-6 bg-slate-50">
          <p className="text-slate-700 mb-4">
            Based on your goals and current performance, here's what to focus on this week:
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <p className="text-slate-900 font-medium">Launch your Autumn 2027 campaign</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <p className="text-slate-600 font-medium">Follow up on warm enquiries</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <p className="text-slate-600 font-medium">Analyze this week's campaign performance</p>
            </div>
          </div>
          <Link href="/campaigns">
            <Button className="mt-6">Start campaign →</Button>
          </Link>
        </Card>
      </div>
    </div>
  )
}
