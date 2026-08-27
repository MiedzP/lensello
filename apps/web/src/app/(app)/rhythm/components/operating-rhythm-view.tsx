'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type RhythmPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly'

interface OperatingRhythmViewProps {
  campaigns: any[]
  goals: any[]
  enquiries: any[]
  gigs: any[]
}

export default function OperatingRhythmView({
  campaigns,
  goals,
  enquiries,
  gigs,
}: OperatingRhythmViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<RhythmPeriod>('weekly')

  const RHYTHM_ITEMS: Record<
    RhythmPeriod,
    { title: string; purpose: string; tasks: { title: string; action: string; link: string }[] }
  > = {
    daily: {
      title: 'Daily Operations',
      purpose: 'Operate & protect',
      tasks: [
        {
          title: `Check new enquiries (${enquiries.length} waiting)`,
          action: 'Review',
          link: '/clients?filter=inquiry',
        },
        {
          title: 'Send follow-ups to unanswered leads',
          action: 'Send',
          link: '/clients?filter=unanswered',
        },
        {
          title: 'Monitor campaign alerts and exceptions',
          action: 'View',
          link: '/campaigns',
        },
        {
          title: 'Track new bookings and pipeline',
          action: 'Update',
          link: '/gigs',
        },
      ],
    },
    weekly: {
      title: 'Weekly Planning',
      purpose: 'Prioritise & Execute',
      tasks: [
        {
          title: 'Review last 7 days performance metrics',
          action: 'Analyse',
          link: '/dashboard?tab=weekly',
        },
        {
          title: 'Review 1-3 Red/Amber/Green priorities',
          action: 'Review',
          link: '/dashboard',
        },
        {
          title: `Follow up on ${Math.max(0, enquiries.length - 2)} warm enquiries`,
          action: 'Follow up',
          link: '/clients?filter=warm',
        },
        {
          title: 'Plan this week\'s content calendar',
          action: 'Plan',
          link: '/campaigns',
        },
        {
          title: 'Publish weekly content (social/blog)',
          action: 'Publish',
          link: '/library',
        },
      ],
    },
    monthly: {
      title: 'Monthly Growth Review',
      purpose: 'Analyse & Adjust',
      tasks: [
        {
          title: 'Calculate LENS baseline scores',
          action: 'Score',
          link: '/dashboard?tab=lens',
        },
        {
          title: `Enquiries: ${enquiries.length} | Bookings: ${gigs.length}`,
          action: 'Review',
          link: '/dashboard',
        },
        {
          title: 'Campaign performance analysis',
          action: 'Analyse',
          link: '/campaigns',
        },
        {
          title: 'Meta CPL and channel efficiency review',
          action: 'Review',
          link: '/ads',
        },
        {
          title: 'Content performance (SEO, social reach)',
          action: 'Analyse',
          link: '/library',
        },
        {
          title: 'Update business_profile with new baseline',
          action: 'Update',
          link: '/settings/profile',
        },
      ],
    },
    quarterly: {
      title: 'Quarterly Business Review',
      purpose: 'Plan Ahead',
      tasks: [
        {
          title: 'Compare against goals and targets',
          action: 'Review',
          link: '/dashboard',
        },
        {
          title: 'Identify biggest constraint (lead gen, conversion, capacity)',
          action: 'Diagnose',
          link: '/dashboard',
        },
        {
          title: 'Plan next-quarter campaigns by season',
          action: 'Plan',
          link: '/campaigns',
        },
        {
          title: 'Set new quarterly targets and priorities',
          action: 'Set',
          link: '/settings/goals',
        },
        {
          title: 'Review pricing and package strategy',
          action: 'Review',
          link: '/settings/profile',
        },
        {
          title: 'Plan team/systems upgrades for capacity',
          action: 'Plan',
          link: '/automations',
        },
      ],
    },
  }

  const currentRhythm = RHYTHM_ITEMS[selectedPeriod]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Operating Rhythm</h1>
        <p className="text-slate-600 mt-2">
          Your marketing operating cadence: Daily execution → Weekly priorities → Monthly analysis →
          Quarterly planning
        </p>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 bg-white p-2 rounded-lg border border-slate-200">
        {(['daily', 'weekly', 'monthly', 'quarterly'] as RhythmPeriod[]).map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`flex-1 px-4 py-2 rounded font-medium transition-all capitalize ${
              selectedPeriod === period
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {period}
          </button>
        ))}
      </div>

      {/* Current Period */}
      <Card className="p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">{currentRhythm.title}</h2>
          <p className="text-slate-600 text-lg">
            Purpose: <span className="font-medium text-slate-900">{currentRhythm.purpose}</span>
          </p>
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {currentRhythm.tasks.map((task, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-start gap-3 flex-1">
                <div className="w-6 h-6 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {index + 1}
                </div>
                <p className="text-slate-900 font-medium">{task.title}</p>
              </div>
              <Link href={task.link as any}>
                <Button variant="ghost" size="sm">
                  {task.action} →
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </Card>

      {/* Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-bold text-slate-900 mb-3">📊 Why This Matters</h3>
          <p className="text-slate-700 text-sm leading-relaxed">
            Photographers grow fastest when they operate on a cadence. Daily execution prevents leads
            falling through cracks. Weekly reviews keep you focused on what actually moves the needle.
            Monthly analysis reveals what's working. Quarterly planning ensures you stay ahead of
            seasonality.
          </p>
        </Card>

        <Card className="p-6 bg-green-50 border-green-200">
          <h3 className="font-bold text-slate-900 mb-3">✓ You're On Track</h3>
          <p className="text-slate-700 text-sm leading-relaxed">
            Stick to this rhythm and you'll notice patterns. When a month underperforms, you'll know
            which lever to pull. When something works, you can scale it faster. This is how you move
            from reactive (firefighting) to strategic (growth).
          </p>
        </Card>
      </div>

      {/* Next Actions */}
      <Card className="p-6">
        <h3 className="font-bold text-slate-900 mb-4">What to do now</h3>
        <ol className="space-y-2 text-slate-700">
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">1.</span>
            <span>Block time on your calendar for each rhythm (30 min daily, 60 min weekly, 90 min monthly, 2h quarterly)</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">2.</span>
            <span>Set calendar reminders or use Lensello's automation to alert you at the right time</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">3.</span>
            <span>After each rhythm, record what you did and what changed (Lensello tracks this)</span>
          </li>
        </ol>
      </Card>
    </div>
  )
}
