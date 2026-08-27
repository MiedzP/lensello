'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface PricingStepProps {
  onNext: (data: Record<string, any>) => Promise<void>
  onBack: () => void
  isLoading: boolean
}

export default function PricingStep({ onNext, onBack, isLoading }: PricingStepProps) {
  const [avgBooking, setAvgBooking] = useState('')
  const [monthlyTarget, setMonthlyTarget] = useState('')
  const [annualTarget, setAnnualTarget] = useState('')
  const [currentRate, setCurrentRate] = useState('')

  const handleNext = async () => {
    if (!avgBooking || !monthlyTarget || !annualTarget) return
    await onNext({
      average_booking_value_cents: Math.round(parseFloat(avgBooking) * 100),
      desired_monthly_bookings: parseInt(monthlyTarget),
      annual_revenue_target_cents: Math.round(parseFloat(annualTarget) * 100),
      current_booking_rate: currentRate ? parseInt(currentRate) : null,
    })
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Pricing & Growth Goals</h2>
      <p className="text-slate-600 mb-8">
        Help us understand your business model so we can recommend the right strategy.
      </p>

      <div className="space-y-6">
        {/* Average booking value */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Average booking value
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
              $
            </span>
            <input
              type="number"
              value={avgBooking}
              onChange={(e) => setAvgBooking(e.target.value)}
              placeholder="2500"
              className="w-full pl-8 pr-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Typical value of a single booking (e.g., wedding, session)
          </p>
        </div>

        {/* Current booking rate */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Current monthly bookings (optional)
          </label>
          <input
            type="number"
            value={currentRate}
            onChange={(e) => setCurrentRate(e.target.value)}
            placeholder="e.g., 5, 10, 15"
            className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-600 focus:outline-none"
          />
          <p className="text-xs text-slate-500 mt-1">
            How many bookings do you typically get per month right now?
          </p>
        </div>

        {/* Monthly target */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Target monthly bookings
          </label>
          <input
            type="number"
            value={monthlyTarget}
            onChange={(e) => setMonthlyTarget(e.target.value)}
            placeholder="e.g., 8, 12, 20"
            className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-600 focus:outline-none"
          />
        </div>

        {/* Annual revenue target */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Annual revenue target
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
              $
            </span>
            <input
              type="number"
              value={annualTarget}
              onChange={(e) => setAnnualTarget(e.target.value)}
              placeholder="300000"
              className="w-full pl-8 pr-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-10">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!avgBooking || !monthlyTarget || !annualTarget || isLoading}
          size="lg"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
