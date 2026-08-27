'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface StepReviewProps {
  onBack: () => void
  onLaunch: () => Promise<void>
  campaignData: Record<string, any>
  isLoading: boolean
}

export default function StepReview({
  onBack,
  onLaunch,
  campaignData,
  isLoading,
}: StepReviewProps) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Review Your Campaign</h2>
      <p className="text-slate-600 mb-8">
        Here's what Lensello will build for you. You can edit any details after launch.
      </p>

      {/* Campaign Summary */}
      <div className="space-y-4 mb-8">
        <Card className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-600 font-medium mb-1">What</p>
              <p className="text-lg font-semibold text-slate-900">{campaignData.photographyType}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium mb-1">Priority</p>
              <p className="text-lg font-semibold text-slate-900">{campaignData.priority}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium mb-1">Channels</p>
              <p className="text-lg font-semibold text-slate-900">
                {campaignData.channels?.join(', ') || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium mb-1">Starts</p>
              <p className="text-lg font-semibold text-slate-900">
                {campaignData.startDate ? new Date(campaignData.startDate).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium mb-1">Ends</p>
              <p className="text-lg font-semibold text-slate-900">
                {campaignData.endDate ? new Date(campaignData.endDate).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium mb-1">Status</p>
              <p className="text-lg font-semibold text-slate-900">Ready to launch</p>
            </div>
          </div>
        </Card>
      </div>

      {/* What Will Be Created */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-4">What Lensello Will Build</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
            <span className="text-xl">📧</span>
            <div>
              <p className="font-medium text-slate-900">Email Sequence</p>
              <p className="text-sm text-slate-600">3-email nurture sequence for leads</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
            <span className="text-xl">📄</span>
            <div>
              <p className="font-medium text-slate-900">Landing Page</p>
              <p className="text-sm text-slate-600">Custom page tailored to this goal</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
            <span className="text-xl">📊</span>
            <div>
              <p className="font-medium text-slate-900">Campaign Brief</p>
              <p className="text-sm text-slate-600">Messaging, audience, timing framework</p>
            </div>
          </div>
          {campaignData.channels?.includes('meta') && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
              <span className="text-xl">📱</span>
              <div>
                <p className="font-medium text-slate-900">Meta Ad Creative</p>
                <p className="text-sm text-slate-600">Recommended visuals and copy variations</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Next Steps */}
      <div className="mt-8 p-4 rounded-lg bg-green-50 border border-green-200">
        <p className="text-sm text-green-900">
          <span className="font-medium">✓ After launch:</span> You'll edit copy, upload photos, and
          customize the landing page. Lensello guides you step-by-step.
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mt-8">
        <Button onClick={onBack} variant="ghost" className="flex-1">
          Back
        </Button>
        <Button
          onClick={onLaunch}
          disabled={isLoading}
          className="flex-1"
          size="lg"
        >
          {isLoading ? 'Creating...' : 'Launch Campaign'}
        </Button>
      </div>
    </div>
  )
}
