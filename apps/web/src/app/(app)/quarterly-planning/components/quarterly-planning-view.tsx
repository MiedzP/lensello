'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface QuarterlyPlanningViewProps {
  businessProfile: any
  goals: any[]
  pastCampaigns: any[]
}

const QUARTERS = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)']

const SEASONAL_OPPORTUNITIES: Record<string, string[]> = {
  'Q1 (Jan-Mar)': ['Engagements (Valentine\'s Day)', 'Spring portraits', 'Renewal season for repeat clients'],
  'Q2 (Apr-Jun)': ['Weddings peak', 'Graduation photos', 'Family portraits'],
  'Q3 (Jul-Sep)': ['Back-to-school', 'Late summer weddings', 'Event photography'],
  'Q4 (Oct-Dec)': ['Holiday photos', 'Christmas mini-sessions', 'End-of-year family shoots'],
}

export default function QuarterlyPlanningView({
  businessProfile,
  goals,
  pastCampaigns,
}: QuarterlyPlanningViewProps) {
  const [selectedQuarter, setSelectedQuarter] = useState('Q1 (Jan-Mar)')
  const [targetBookings, setTargetBookings] = useState(businessProfile?.desired_monthly_bookings * 3 || 30)
  const [targetRevenue, setTargetRevenue] = useState(businessProfile?.annual_revenue_target_cents / 4 / 100 || 50000)

  const opportunities = SEASONAL_OPPORTUNITIES[selectedQuarter] || []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Quarterly Business & Marketing Plan</h1>
        <p className="text-slate-600 mt-2">
          Strategic planning every 90 days. Focus on the constraint and plan channel strategy.
        </p>
      </div>

      {/* Quarter Selector */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Select Quarter</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {QUARTERS.map((quarter) => (
            <button
              key={quarter}
              onClick={() => setSelectedQuarter(quarter)}
              className={`p-4 rounded-lg border-2 transition-all text-center font-medium ${
                selectedQuarter === quarter
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {quarter}
            </button>
          ))}
        </div>
      </div>

      {/* Targets */}
      <Card className="p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">{selectedQuarter} Targets</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Target Bookings (3 months)
            </label>
            <div className="relative">
              <input
                type="number"
                value={targetBookings}
                onChange={(e) => setTargetBookings(parseInt(e.target.value))}
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <p className="text-xs text-slate-600 mt-2">
              That's {Math.round(targetBookings / 3)} per month
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Target Revenue (3 months)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                £
              </span>
              <input
                type="number"
                value={targetRevenue}
                onChange={(e) => setTargetRevenue(parseInt(e.target.value))}
                className="w-full pl-8 pr-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Average booking value: £{businessProfile?.average_booking_value_cents / 100 || 0}
            </p>
          </div>
        </div>
      </Card>

      {/* Seasonal Opportunities */}
      <Card className="p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Seasonal Opportunities</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {opportunities.map((opp, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="font-medium text-green-900">{opp}</p>
              <p className="text-xs text-green-700 mt-2">Plan campaign 4-6 weeks before</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Channel Strategy */}
      <Card className="p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Channel Strategy</h2>
        <div className="space-y-4">
          {[
            {
              name: 'Meta (Instagram/Facebook)',
              strategy: 'Seasonal ads targeting your top 3 photography types',
              investment: 'Medium',
              timeline: 'Week 1-4 setup, Week 5-12 run',
            },
            {
              name: 'Email Nurture',
              strategy: 'Reconnect with past clients, seasonal promotions',
              investment: 'Low',
              timeline: 'Ongoing',
            },
            {
              name: 'SEO / Blog',
              strategy: 'Publish 2-3 posts targeting seasonal searches',
              investment: 'Low',
              timeline: 'Week 1-6',
            },
            {
              name: 'Referral Program',
              strategy: 'Incentivize past clients to refer friends',
              investment: 'Low',
              timeline: 'Ongoing',
            },
          ].map((channel, idx) => (
            <div key={idx} className="p-4 rounded-lg border border-slate-200">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-slate-900">{channel.name}</h3>
                <span className="text-xs font-medium bg-slate-100 px-2 py-1 rounded">
                  {channel.investment} investment
                </span>
              </div>
              <p className="text-sm text-slate-700 mb-2">{channel.strategy}</p>
              <p className="text-xs text-slate-600">Timeline: {channel.timeline}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Key Constraint */}
      <Card className="p-8 bg-orange-50 border-orange-200">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">What's Your Biggest Constraint?</h2>
        <div className="space-y-3">
          {[
            {
              constraint: 'LEAD Generation',
              action: 'Not enough enquiries - focus on visibility',
              next: 'Plan SEO content and ads',
            },
            {
              constraint: 'NURTURE Conversion',
              action: 'Enquiries not converting - fix follow-up process',
              next: 'Review response time and email sequences',
            },
            {
              constraint: 'SCALE Capacity',
              action: 'Too many bookings to handle - raise prices or add capacity',
              next: 'Adjust pricing tiers and package offerings',
            },
            {
              constraint: 'ELEVATE Brand',
              action: 'Not attracting high-value clients - strengthen positioning',
              next: 'Refresh portfolio and testimonials',
            },
          ].map((item, idx) => (
            <div key={idx} className="p-4 rounded-lg bg-white">
              <p className="font-semibold text-slate-900 mb-1">{item.constraint}</p>
              <p className="text-sm text-slate-700 mb-2">{item.action}</p>
              <p className="text-xs text-orange-700 font-medium">Next step: {item.next}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Campaign Calendar */}
      <Card className="p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Campaign Calendar</h2>
        <p className="text-slate-600 mb-4">
          Plan when each campaign launches. Avoid clashes. Each campaign needs 4-6 weeks from concept to live.
        </p>
        <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-slate-50">
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">WEEK 1-2</p>
            <p className="text-sm font-medium text-slate-900">Plan & Design</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">WEEK 3-4</p>
            <p className="text-sm font-medium text-slate-900">Setup & Copy</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">WEEK 5-12</p>
            <p className="text-sm font-medium text-slate-900">Run & Optimize</p>
          </div>
        </div>
      </Card>

      {/* Next Actions */}
      <div className="flex gap-3">
        <Link href="/campaigns/new">
          <Button variant="ghost">Create Campaign</Button>
        </Link>
        <Link href="/dashboard">
          <Button>Save & Return to Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
