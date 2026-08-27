'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface StepPriorityProps {
  onNext: (data: Record<string, any>) => void
  onBack: () => void
  whatYouWant: string
}

const PRIORITY_OPTIONS: Record<string, { label: string; description: string; icon: string }[]> = {
  default: [
    { label: 'More enquiries', description: 'Increase visibility and lead volume', icon: '📩' },
    { label: 'Higher-value bookings', description: 'Attract clients who pay more', icon: '💰' },
    { label: 'Fill remaining dates', description: 'Maximize capacity this season', icon: '📅' },
    { label: 'Build next year\'s diary', description: 'Book ahead for peak season', icon: '🎯' },
    { label: 'Increase average sale', description: 'Upsell add-ons and packages', icon: '📈' },
    { label: 'Past client sales', description: 'Albums, prints, digital downloads', icon: '🎁' },
  ],
}

export default function StepPriority({ onNext, onBack, whatYouWant }: StepPriorityProps) {
  const [selected, setSelected] = useState('')

  const options = PRIORITY_OPTIONS.default

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">What's your priority?</h2>
      <p className="text-slate-600 mb-8">
        For <span className="font-semibold">{whatYouWant}</span>, which outcome matters most?
      </p>

      <div className="space-y-3">
        {options.map((option) => (
          <button
            key={option.label}
            onClick={() => setSelected(option.label)}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              selected === option.label
                ? 'border-blue-600 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{option.icon}</span>
              <div>
                <p className="font-semibold text-slate-900">{option.label}</p>
                <p className="text-sm text-slate-600">{option.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3 mt-8">
        <Button onClick={onBack} variant="ghost" className="flex-1">
          Back
        </Button>
        <Button
          onClick={() => onNext({ priority: selected })}
          disabled={!selected}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
