'use server'

import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

type OnboardingStep = 'categories' | 'location' | 'pricing' | 'goals' | 'connect' | 'complete'

export async function saveOnboardingProgress(
  currentStep: OnboardingStep,
  formData: Record<string, any>,
  nextStep: OnboardingStep
) {
  const supabase = await createClient()
  const session = await requireUser()

  if (!session) {
    throw new Error('Not authenticated')
  }

  try {
    // Save to business_profile
    if (formData.photography_categories) {
      await supabase
        .from('business_profile')
        .update({ photography_categories: formData.photography_categories })
        .eq('id', true)
    }

    if (formData.location_country) {
      await supabase
        .from('business_profile')
        .update({
          location_country: formData.location_country,
          location_region: formData.location_region,
          geographic_service_area: formData.geographic_service_area,
        })
        .eq('id', true)
    }

    if (formData.average_booking_value_cents) {
      await supabase
        .from('business_profile')
        .update({
          average_booking_value_cents: formData.average_booking_value_cents,
          desired_monthly_bookings: formData.desired_monthly_bookings,
          annual_revenue_target_cents: formData.annual_revenue_target_cents,
          current_booking_rate: formData.current_booking_rate,
        })
        .eq('id', true)
    }

    if (formData.meta_account_linked !== undefined) {
      await supabase
        .from('business_profile')
        .update({
          meta_account_linked: formData.meta_account_linked,
          google_business_linked: formData.google_business_linked,
          google_analytics_linked: formData.google_analytics_linked,
          email_crm_linked: formData.email_crm_linked,
        })
        .eq('id', true)
    }

    // Create business goals if provided
    if (formData.marketing_priorities && formData.primary_priority) {
      for (const priority of formData.marketing_priorities) {
        await supabase
          .from('business_goals')
          .upsert({
            photography_type: 'primary',
            priority,
            is_active: priority === formData.primary_priority,
            status: 'planning',
          }, {
            onConflict: 'photography_type'
          })
          .select()
      }
    }

    // Update profile onboarding status
    const completed = nextStep === 'complete'
    await supabase
      .from('profiles')
      .update({
        onboarding_step: completed ? 'complete' : nextStep,
        onboarding_completed: completed,
      })
      .eq('id', session.user.id)

    return { success: true, nextStep }
  } catch (error) {
    console.error('Error saving onboarding progress:', error)
    throw new Error('Failed to save progress')
  }
}
