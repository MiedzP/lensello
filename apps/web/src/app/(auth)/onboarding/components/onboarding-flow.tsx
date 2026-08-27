'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CategoriesStep from './steps/categories-step'
import LocationStep from './steps/location-step'
import PricingStep from './steps/pricing-step'
import GoalsStep from './steps/goals-step'
import IntegrationsStep from './steps/integrations-step'
import { saveOnboardingProgress } from '../actions'

type OnboardingStep = 'categories' | 'location' | 'pricing' | 'goals' | 'connect' | 'complete'

interface OnboardingFlowProps {
  initialStep?: OnboardingStep | null
}

const STEPS: { id: OnboardingStep; title: string; subtitle: string }[] = [
  { id: 'categories', title: 'Photography Types', subtitle: 'What do you offer?' },
  { id: 'location', title: 'Service Area', subtitle: 'Where do you operate?' },
  { id: 'pricing', title: 'Pricing & Goals', subtitle: 'Your business targets' },
  { id: 'goals', title: 'Marketing Priorities', subtitle: 'What matters most?' },
  { id: 'connect', title: 'Integrations', subtitle: 'Connect your accounts' },
]

export default function OnboardingFlow({ initialStep }: OnboardingFlowProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(
    (initialStep as OnboardingStep) || 'categories'
  )
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep)
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100

  const handleNext = async (data: Record<string, any>) => {
    setIsLoading(true)
    try {
      setFormData({ ...formData, ...data })

      // Save progress
      const nextIndex = currentStepIndex + 1
      const nextStep: OnboardingStep = nextIndex < STEPS.length ? STEPS[nextIndex].id : 'complete'

      await saveOnboardingProgress(currentStep, { ...formData, ...data }, nextStep)

      if (nextStep === 'complete') {
        // Redirect to dashboard
        router.push('/dashboard')
      } else {
        setCurrentStep(nextStep)
      }
    } catch (error) {
      console.error('Onboarding error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-slate-900">Welcome to Lensello</h1>
          <p className="text-slate-600 mt-2">
            Let's set up your studio so we can help you grow
          </p>

          {/* Progress bar */}
          <div className="mt-8">
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
          </div>

          {/* Step indicator */}
          <div className="flex gap-2 mt-6">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    index < currentStepIndex
                      ? 'bg-green-500 text-white'
                      : index === currentStepIndex
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-300 text-slate-600'
                  }`}
                >
                  {index < currentStepIndex ? '✓' : index + 1}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-1 ${
                      index < currentStepIndex ? 'bg-green-500' : 'bg-slate-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          {currentStep === 'categories' && (
            <CategoriesStep onNext={handleNext} isLoading={isLoading} />
          )}
          {currentStep === 'location' && (
            <LocationStep onNext={handleNext} onBack={handleBack} isLoading={isLoading} />
          )}
          {currentStep === 'pricing' && (
            <PricingStep onNext={handleNext} onBack={handleBack} isLoading={isLoading} />
          )}
          {currentStep === 'goals' && (
            <GoalsStep onNext={handleNext} onBack={handleBack} isLoading={isLoading} />
          )}
          {currentStep === 'connect' && (
            <IntegrationsStep onNext={handleNext} onBack={handleBack} isLoading={isLoading} />
          )}
        </div>

        {/* Help text */}
        <div className="text-center mt-8 text-sm text-slate-600">
          You can update this information anytime in your business profile
        </div>
      </div>
    </div>
  )
}
