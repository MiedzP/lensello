'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Priority } from '@/lib/lens/priority-engine'

interface DashboardContentProps {
  businessProfile: any
  enquiries: number
  bookings: number
  pipelineValue: number
  priorities: Priority[]
  recommendedAction: Priority | null
}

export default function DashboardContent({
  businessProfile,
  enquiries,
  bookings,
  pipelineValue,
  priorities,
  recommendedAction,
}: DashboardContentProps) {

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
        <Link href="/diagnostic" className="block">
          <Button size="sm">
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

        {priorities.length === 0 ? (
          <div className="p-6 bg-slate-50 rounded-lg text-center text-slate-600">
            <p className="font-medium">Nothing urgent this week</p>
            <p className="text-sm mt-1">Keep up the great work!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {priorities.map((item) => (
              <div
                key={item.actionLink}
                className={`p-4 rounded-lg border-l-4 flex items-start justify-between ${
                  item.level === 'red'
                    ? 'bg-red-50 border-l-red-600'
                    : item.level === 'amber'
                      ? 'bg-amber-50 border-l-amber-600'
                      : 'bg-green-50 border-l-green-600'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        item.level === 'red'
                          ? 'bg-red-600'
                          : item.level === 'amber'
                            ? 'bg-amber-600'
                            : 'bg-green-600'
                      }`}
                    />
                    <p
                      className={`font-semibold ${
                        item.level === 'red'
                          ? 'text-red-900'
                          : item.level === 'amber'
                            ? 'text-amber-900'
                            : 'text-green-900'
                      }`}
                    >
                      {item.level === 'red'
                        ? 'ACTION NEEDED'
                        : item.level === 'amber'
                          ? 'OPPORTUNITY'
                          : 'WORKING WELL'}
                    </p>
                  </div>
                  <p
                    className={`font-medium ${
                      item.level === 'red'
                        ? 'text-red-900'
                        : item.level === 'amber'
                          ? 'text-amber-900'
                          : 'text-green-900'
                    }`}
                  >
                    {item.title}
                  </p>
                  <p
                    className={`text-sm mt-1 ${
                      item.level === 'red'
                        ? 'text-red-700'
                        : item.level === 'amber'
                          ? 'text-amber-700'
                          : 'text-green-700'
                    }`}
                  >
                    {item.description}
                  </p>
                </div>
                <Link href={item.actionLink}>
                  <Button variant="ghost" size="sm">
                    {item.action} →
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommended Next Action */}
      {recommendedAction && (
        <Card className="p-6 bg-slate-50">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Recommended Next Action</h2>
          <p className="text-slate-700 mb-6">
            Based on your business metrics, focus on this:
          </p>
          <div className={`p-4 rounded-lg border-l-4 ${
            recommendedAction.level === 'red'
              ? 'bg-red-50 border-l-red-600'
              : recommendedAction.level === 'amber'
                ? 'bg-amber-50 border-l-amber-600'
                : 'bg-green-50 border-l-green-600'
          }`}>
            <h3 className={`font-bold text-lg ${
              recommendedAction.level === 'red'
                ? 'text-red-900'
                : recommendedAction.level === 'amber'
                  ? 'text-amber-900'
                  : 'text-green-900'
            }`}>
              {recommendedAction.title}
            </h3>
            <p className={`text-sm mt-2 ${
              recommendedAction.level === 'red'
                ? 'text-red-700'
                : recommendedAction.level === 'amber'
                  ? 'text-amber-700'
                  : 'text-green-700'
            }`}>
              {recommendedAction.description}
            </p>
            <Link href={recommendedAction.actionLink}>
              <Button className="mt-4">{recommendedAction.action} →</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}
