'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface StepWhatYouWantProps {
  onNext: (data: Record<string, any>) => void
  categories: string[]
}

export default function StepWhatYouWant({ onNext, categories }: StepWhatYouWantProps) {
  const [selected, setSelected] = useState('')

  const allOptions = [
    'Weddings',
    'Engagement shoots',
    'Family photography',
    'Newborns',
    'Portraits',
    'Pets',
    'Boudoir',
    'Headshots',
    'Commercial work',
    'Schools',
    'Sports',
    'Events',
    'Property work',
    'Albums / past-client sales',
  ]

  // Prioritize what they actually offer
  const prioritized = allOptions.filter((opt) =>
    categories.some((cat) => opt.toLowerCase().includes(cat.toLowerCase()) || cat.toLowerCase().includes(opt.toLowerCase()))
  )

  const recommended = [...new Set([...prioritized, ...allOptions])]

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">What do you want more of?</h2>
      <p className="text-slate-600 mb-8">
        Select the photography type that's your priority for this campaign. We'll build the marketing strategy around this goal.
      </p>

      <div className="space-y-3">
        {recommended.map((option) => (
          <button
            key={option}
            onClick={() => setSelected(option)}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left font-medium ${
              selected === option
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <Button
          onClick={() => onNext({ photographyType: selected })}
          disabled={!selected}
          size="lg"
          className="w-full"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
