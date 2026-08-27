'use client'

import { useState } from 'react'
import StepWhatYouWant from './steps/step-what-you-want'
import StepPriority from './steps/step-priority'
import StepChannels from './steps/step-channels'
import StepReview from './steps/step-review'
import { createCampaign } from '../actions'
import { Button } from '@/components/ui/button'

type BuilderStep = 'what' | 'priority' | 'channels' | 'review'

interface CampaignBuilderProps {
  businessProfile: any
  existingGoals: any[]
}

export default function CampaignBuilder({ businessProfile, existingGoals }: CampaignBuilderProps) {
  const [currentStep, setCurrentStep] = useState<BuilderStep>('what')
  const [isLoading, setIsLoading] = useState(false)
  const [campaignData, setCampaignData] = useState<Record<string, any>>({})

  const STEPS: { id: BuilderStep; title: string }[] = [
    { id: 'what', title: 'What do you want more of?' },
    { id: 'priority', title: 'What\'s your priority?' },
    { id: 'channels', title: 'Which channels?' },
    { id: 'review', title: 'Review & Launch' },
  ]

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep)
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100

  const handleNext = (data: Record<string, any>) => {
    setCampaignData({ ...campaignData, ...data })
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
    try {
      await createCampaign(campaignData)
      // Redirect to campaigns page
      window.location.href = '/campaigns'
    } catch (error) {
      console.error('Error creating campaign:', error)
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
