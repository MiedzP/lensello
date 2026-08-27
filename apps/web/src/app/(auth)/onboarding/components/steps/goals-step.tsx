'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const GOAL_OPTIONS = [
  { value: 'more_enquiries', label: 'More enquiries', icon: '📩' },
  { value: 'higher_value', label: 'Higher-value bookings', icon: '💰' },
  { value: 'fill_dates', label: 'Fill remaining dates', icon: '📅' },
  { value: 'build_next_year', label: 'Build next year\'s diary', icon: '🎯' },
  { value: 'increase_average_sale', label: 'Increase average booking value', icon: '📈' },
  { value: 'past_client_sales', label: 'Past client sales (albums, prints)', icon: '🎁' },
  { value: 'reconnect_old_enquiries', label: 'Reconnect with old enquiries', icon: '🔄' },
  { value: 'seasonal_boost', label: 'Seasonal campaign boost', icon: '⛅' },
]

interface GoalsStepProps {
  onNext: (data: Record<string, any>) => Promise<void>
  onBack: () => void
  isLoading: boolean
}

export default function GoalsStep({ onNext, onBack, isLoading }: GoalsStepProps) {
  const [selected, setSelected] = useState<string[]>([])

  const toggleGoal = (goal: string) => {
    setSelected((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    )
  }

  const handleNext = async () => {
    if (selected.length === 0) return
    // Primary priority is the first selected
    await onNext({
      marketing_priorities: selected,
      primary_priority: selected[0],
    })
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">What matters most?</h2>
      <p className="text-slate-600 mb-8">
        Pick your top 1-3 priorities. Lensello will focus on these first.
      </p>

      <div className="grid grid-cols-1 gap-3">
        {GOAL_OPTIONS.map((goal) => (
          <button
            key={goal.value}
            onClick={() => toggleGoal(goal.value)}
            className={`p-4 rounded-lg border-2 transition-all text-left flex items-center gap-3 ${
              selected.includes(goal.value)
                ? 'border-blue-600 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="text-2xl">{goal.icon}</div>
            <div className="flex-1">
              <p className="font-medium text-slate-900">{goal.label}</p>
            </div>
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                selected.includes(goal.value)
                  ? 'border-blue-600 bg-blue-600'
                  : 'border-slate-300'
              }`}
            >
              {selected.includes(goal.value) && (
                <span className="text-white text-xs">✓</span>
              )}
            </div>
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-6">
        You can change these anytime. Lensello adapts its recommendations as you grow.
      </p>

      <div className="flex justify-between mt-10">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={selected.length === 0 || isLoading}
          size="lg"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
