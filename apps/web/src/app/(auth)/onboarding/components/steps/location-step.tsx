'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Other']

const US_REGIONS = [
  'Northeast', 'Southeast', 'Midwest', 'Southwest', 'West', 'Multiple states'
]

const UK_REGIONS = ['England', 'Scotland', 'Wales', 'Northern Ireland']

const COUNTRY_REGIONS: Record<string, string[]> = {
  'United States': US_REGIONS,
  'United Kingdom': UK_REGIONS,
  Canada: ['Atlantic', 'Quebec', 'Ontario', 'Prairie', 'BC', 'Multiple provinces'],
  Australia: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'Multiple states'],
}

interface LocationStepProps {
  onNext: (data: Record<string, any>) => Promise<void>
  onBack: () => void
  isLoading: boolean
}

export default function LocationStep({ onNext, onBack, isLoading }: LocationStepProps) {
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [serviceArea, setServiceArea] = useState('')

  const regions = country && COUNTRY_REGIONS[country] ? COUNTRY_REGIONS[country] : []

  const handleNext = async () => {
    if (!country || !region || !serviceArea) return
    await onNext({
      location_country: country,
      location_region: region,
      geographic_service_area: serviceArea,
    })
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Where do you operate?</h2>
      <p className="text-slate-600 mb-8">
        This helps us understand your market and give relevant benchmarks.
      </p>

      <div className="space-y-6">
        {/* Country */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            What's your primary country?
          </label>
          <div className="grid grid-cols-2 gap-3">
            {COUNTRIES.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCountry(c)
                  setRegion('')
                }}
                className={`p-3 rounded-lg border-2 transition-all font-medium ${
                  country === c
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Region */}
        {regions.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Your region
            </label>
            <div className="grid grid-cols-2 gap-3">
              {regions.map((r) => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={`p-3 rounded-lg border-2 transition-all font-medium ${
                    region === r
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Service area */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Geographic service area
          </label>
          <textarea
            value={serviceArea}
            onChange={(e) => setServiceArea(e.target.value)}
            placeholder="e.g., 'Greater London', 'Within 2 hours of NYC', 'Destination weddings worldwide'"
            className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-600 focus:outline-none text-slate-900 placeholder-slate-400"
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-between mt-10">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!country || !region || !serviceArea || isLoading}
          size="lg"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
