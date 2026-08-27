'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const CATEGORIES = {
  consumer: [
    'Wedding',
    'Engagement',
    'Portrait',
    'Newborn',
    'Family',
    'Pet',
    'Boudoir',
  ],
  commercial: ['Headshot', 'Commercial', 'Property'],
  volume: ['School', 'Sports', 'Event'],
}

interface CategoriesStepProps {
  onNext: (data: Record<string, any>) => Promise<void>
  isLoading: boolean
}

export default function CategoriesStep({ onNext, isLoading }: CategoriesStepProps) {
  const [selected, setSelected] = useState<string[]>([])

  const toggleCategory = (category: string) => {
    setSelected((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    )
  }

  const handleNext = async () => {
    if (selected.length === 0) return
    await onNext({ photography_categories: selected })
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">What types of photography do you offer?</h2>
      <p className="text-slate-600 mb-8">
        Select all that apply. We'll personalize Lensello to your business model.
      </p>

      <div className="space-y-6">
        {Object.entries(CATEGORIES).map(([type, items]) => (
          <div key={type}>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
              {type === 'consumer'
                ? 'Consumer / Lifestyle'
                : type === 'commercial'
                  ? 'Business / Commercial'
                  : 'Volume / Event'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {items.map((category) => (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`p-4 rounded-lg border-2 transition-all text-left font-medium ${
                    selected.includes(category)
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-10">
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
