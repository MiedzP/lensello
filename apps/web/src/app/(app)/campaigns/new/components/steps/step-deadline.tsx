'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface StepDeadlineProps {
  onNext: (data: Record<string, any>) => void
  onBack: () => void
  initialData?: {
    startDate?: string
    endDate?: string
  }
}

export default function StepDeadline({ onNext, onBack, initialData }: StepDeadlineProps) {
  const [startDate, setStartDate] = useState(initialData?.startDate || '')
  const [endDate, setEndDate] = useState(initialData?.endDate || '')
  const [error, setError] = useState('')

  const handleNext = () => {
    setError('')

    // Validation
    if (!startDate) {
      setError('Campaign start date is required')
      return
    }

    if (!endDate) {
      setError('Campaign end date is required')
      return
    }

    // Ensure end date is after start date
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (end < start) {
      setError('End date must be after start date')
      return
    }

    // Ensure campaign is not in the past
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (start < today) {
      setError('Start date must be today or in the future')
      return
    }

    // Log what we're about to send
    console.log('StepDeadline calling onNext with:', {
      startDate,
      endDate,
      starts_on: startDate,
      ends_on: endDate,
    })

    onNext({
      startDate: startDate,
      endDate: endDate,
      starts_on: startDate,  // Also pass database column names
      ends_on: endDate,
    })
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Set Campaign Timeline</h2>
        <p className="text-slate-600 mt-2">
          When should this campaign run? Set start and end dates for your marketing push.
        </p>
      </div>

      {/* Date Selection */}
      <div className="space-y-6">
        {/* Start Date */}
        <div>
          <label htmlFor="start-date" className="block text-sm font-semibold text-slate-900 mb-2">
            Campaign Start Date
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            min={today}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">When will you launch this campaign?</p>
        </div>

        {/* End Date */}
        <div>
          <label htmlFor="end-date" className="block text-sm font-semibold text-slate-900 mb-2">
            Campaign End Date
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || today}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1">When should the campaign end?</p>
        </div>

        {/* Duration Display */}
        {startDate && endDate && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-900">Campaign Duration:</span>
              <span className="font-semibold text-blue-900">
                {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
              </span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Quick Options */}
        <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-sm font-medium text-slate-700 mb-3">Quick Options:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                const start = new Date()
                const end = new Date()
                end.setDate(start.getDate() + 6)
                setStartDate(start.toISOString().split('T')[0])
                setEndDate(end.toISOString().split('T')[0])
              }}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              1 Week (7 days)
            </button>
            <button
              onClick={() => {
                const start = new Date()
                const end = new Date()
                end.setDate(start.getDate() + 13)
                setStartDate(start.toISOString().split('T')[0])
                setEndDate(end.toISOString().split('T')[0])
              }}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              2 Weeks (14 days)
            </button>
            <button
              onClick={() => {
                const start = new Date()
                const end = new Date()
                end.setMonth(start.getMonth() + 1)
                setStartDate(start.toISOString().split('T')[0])
                setEndDate(end.toISOString().split('T')[0])
              }}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              1 Month (30 days)
            </button>
            <button
              onClick={() => {
                const start = new Date()
                const end = new Date()
                end.setMonth(start.getMonth() + 3)
                setStartDate(start.toISOString().split('T')[0])
                setEndDate(end.toISOString().split('T')[0])
              }}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              1 Quarter (90 days)
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Back
        </button>
        <Button onClick={handleNext} className="px-6 py-3">
          Continue to Review
        </Button>
      </div>
    </div>
  )
}
