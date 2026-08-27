'use client'

import { useState } from 'react'
import StepWhatYouWant from './steps/step-what-you-want'
import StepPriority from './steps/step-priority'
import StepChannels from './steps/step-channels'
import StepDeadline from './steps/step-deadline'
import StepReview from './steps/step-review'
import { createCampaign } from '../actions'
import { Button } from '@/components/ui/button'

type BuilderStep = 'what' | 'priority' | 'channels' | 'deadline' | 'review'

interface CampaignBuilderProps {
  businessProfile: any
  existingGoals: any[]
}

export default function CampaignBuilder({ businessProfile, existingGoals }: CampaignBuilderProps) {
  const [currentStep, setCurrentStep] = useState<BuilderStep>('what')
  const [isLoading, setIsLoading] = useState(false)
  const [campaignData, setCampaignData] = useState<Record<string, any>>({})
  const [error, setError] = useState<string | null>(null)

  const STEPS: { id: BuilderStep; title: string }[] = [
    { id: 'what', title: 'What do you want more of?' },
    { id: 'priority', title: 'What\'s your priority?' },
    { id: 'channels', title: 'Which channels?' },
    { id: 'deadline', title: 'When will it run?' },
    { id: 'review', title: 'Review & Launch' },
  ]

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep)
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100

  const handleNext = (data: Record<string, any>) => {
    console.log('handleNext called with data from step:', currentStep, data)
    const newCampaignData = { ...campaignData, ...data }
    console.log('Updated campaignData:', newCampaignData)
    setCampaignData(newCampaignData)
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  const handleLaunch = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Debug: log what we're sending
      console.log('Campaign data being sent:', campaignData)

      await createCampaign(campaignData)
      // Redirect to campaigns page on success
      window.location.href = '/campaigns'
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create campaign'
      console.error('Error creating campaign:', errorMessage, err)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Create a Campaign</h1>
        <p className="text-slate-600 mt-2">Tell us your goal. We'll build the marketing framework.</p>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-lg p-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">
            Step {currentStepIndex + 1} of {STEPS.length}
          </span>
          <span className="text-sm text-slate-600">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex gap-3 mt-6">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex-1">
              <div
                className={`text-xs font-medium mb-1 ${
                  index <= currentStepIndex ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {step.title}
              </div>
              <div
                className={`h-1 rounded-full ${
                  index < currentStepIndex
                    ? 'bg-green-500'
                    : index === currentStepIndex
                      ? 'bg-blue-600'
                      : 'bg-slate-200'
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm font-medium text-red-900">Error creating campaign:</p>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-600 hover:text-red-800 mt-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-lg p-8">
        {currentStep === 'what' && (
          <StepWhatYouWant
            onNext={handleNext}
            categories={businessProfile?.photography_categories || []}
          />
        )}
        {currentStep === 'priority' && (
          <StepPriority
            onNext={handleNext}
            onBack={handleBack}
            whatYouWant={campaignData.photographyType}
          />
        )}
        {currentStep === 'channels' && (
          <StepChannels onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === 'deadline' && (
          <StepDeadline
            onNext={handleNext}
            onBack={handleBack}
            initialData={{
              startDate: campaignData.startDate,
              endDate: campaignData.endDate,
            }}
          />
        )}
        {currentStep === 'review' && (
          <StepReview
            onBack={handleBack}
            onLaunch={handleLaunch}
            campaignData={campaignData}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  )
}
