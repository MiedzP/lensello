'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const INTEGRATIONS = [
  {
    id: 'meta',
    name: 'Meta (Instagram, Facebook)',
    description: 'Access your ad campaigns and audience insights',
    icon: '📱',
  },
  {
    id: 'google',
    name: 'Google Business Profile',
    description: 'Track reviews and local visibility',
    icon: '🔍',
  },
  {
    id: 'analytics',
    name: 'Google Analytics',
    description: 'Measure website traffic and conversions',
    icon: '📊',
  },
  {
    id: 'email',
    name: 'Email / CRM',
    description: 'Import your customer data',
    icon: '📧',
  },
]

interface IntegrationsStepProps {
  onNext: (data: Record<string, any>) => Promise<void>
  onBack: () => void
  isLoading: boolean
}

export default function IntegrationsStep({
  onNext,
  onBack,
  isLoading,
}: IntegrationsStepProps) {
  const [linked, setLinked] = useState<string[]>([])

  const toggleIntegration = (id: string) => {
    setLinked((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleNext = async () => {
    await onNext({
      meta_account_linked: linked.includes('meta'),
      google_business_linked: linked.includes('google'),
      google_analytics_linked: linked.includes('analytics'),
      email_crm_linked: linked.includes('email'),
    })
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Connect your accounts</h2>
      <p className="text-slate-600 mb-8">
        You can skip this for now and add integrations later. Lensello works best when it can
        see your full marketing picture.
      </p>

      <div className="space-y-3 mb-8">
        {INTEGRATIONS.map((integration) => (
          <button
            key={integration.id}
            onClick={() => toggleIntegration(integration.id)}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              linked.includes(integration.id)
                ? 'border-blue-600 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl pt-1">{integration.icon}</div>
              <div className="flex-1">
                <h3 className="font-medium text-slate-900">{integration.name}</h3>
                <p className="text-sm text-slate-600">{integration.description}</p>
              </div>
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-all ${
                  linked.includes(integration.id)
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-slate-300'
                }`}
              >
                {linked.includes(integration.id) && (
                  <span className="text-white text-xs">✓</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <p className="text-sm text-blue-900">
          <span className="font-medium">💡 Pro tip:</span> The more data you connect, the better
          Lensello understands your business and the more actionable its recommendations become.
        </p>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext} disabled={isLoading} size="lg">
          {linked.length === 0 ? 'Skip for now' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
