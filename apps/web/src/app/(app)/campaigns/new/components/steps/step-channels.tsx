'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface StepChannelsProps {
  onNext: (data: Record<string, any>) => void
  onBack: () => void
}

const CHANNELS = [
  {
    id: 'meta',
    name: 'Meta (Instagram & Facebook)',
    description: 'Reach people in feed and stories with visual ads',
    icon: '📱',
    reach: 'Broad audience',
  },
  {
    id: 'google',
    name: 'Google Search',
    description: 'Capture intent when people search for your services',
    icon: '🔍',
    reach: 'High intent',
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Nurture existing prospects and past clients',
    icon: '📧',
    reach: 'Warm audience',
  },
  {
    id: 'organic',
    name: 'Organic Social & Blog',
    description: 'Build SEO and share value content',
    icon: '✍️',
    reach: 'Long-term',
  },
  {
    id: 'referral',
    name: 'Referral Program',
    description: 'Incentivize clients to recommend you',
    icon: '👥',
    reach: 'Trusted',
  },
]

export default function StepChannels({ onNext, onBack }: StepChannelsProps) {
  const [selected, setSelected] = useState<string[]>([])

  const toggleChannel = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Which channels?</h2>
      <p className="text-slate-600 mb-8">
        Pick 1-3 channels. We'll build an integrated strategy across them.
      </p>

      <div className="space-y-3">
        {CHANNELS.map((channel) => (
          <button
            key={channel.id}
            onClick={() => toggleChannel(channel.id)}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              selected.includes(channel.id)
                ? 'border-blue-600 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{channel.icon}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{channel.name}</p>
                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">
                    {channel.reach}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{channel.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8 mb-8">
        <p className="text-sm text-blue-900">
          <span className="font-medium">💡 Lensello will:</span> Build a landing page, email sequence, and
          {selected.includes('meta') && ' Meta ads'} follow-up workflow across your chosen channels.
        </p>
      </div>

      <div className="flex gap-3">
        <Button onClick={onBack} variant="ghost" className="flex-1">
          Back
        </Button>
        <Button
          onClick={() => onNext({ channels: selected })}
          disabled={selected.length === 0}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
