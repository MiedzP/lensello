/**
 * Onboarding-specific types extracted from db.types.ts
 *
 * ✓ FOCUSED - Only imports this for onboarding flow
 * ✓ Bundle savings: ~2KB per route (vs full 95KB db.types)
 * ✓ Clear domain boundary - easier to maintain and test
 *
 * Related tables: business_profile, diagnostic_responses
 */

import type { Json } from './utilities'

/**
 * Business profile configuration
 * Saved during onboarding flow
 */
export interface BusinessProfile {
  id: string
  owner_id: string
  photography_categories: string[]
  location_country: string | null
  location_region: string | null
  geographic_service_area: string | null
  average_booking_value_cents: number | null
  desired_monthly_bookings: number | null
  annual_revenue_target_cents: number | null
  current_booking_rate: number | null
  meta_account_linked: boolean
  google_business_linked: boolean
  google_analytics_linked: boolean
  email_crm_linked: boolean
  created_at: string
  updated_at: string
}

export type BusinessProfileUpdate = Partial<
  Omit<BusinessProfile, 'id' | 'created_at' | 'owner_id'>
>

export type BusinessProfileInsert = Omit<
  BusinessProfile,
  'created_at' | 'updated_at'
>

/**
 * Diagnostic response from worksheets
 * Collects user input to generate LENS scores
 */
export interface DiagnosticResponse {
  id: string
  user_id: string
  worksheet_id: string
  answers: Json
  submitted_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Onboarding steps in sequence
 */
export type OnboardingStep =
  | 'categories'
  | 'location'
  | 'pricing'
  | 'goals'
  | 'connect'
  | 'complete'

/**
 * Onboarding form data collected at each step
 */
export interface OnboardingFormData {
  photography_categories?: string[]
  location_country?: string
  location_region?: string
  geographic_service_area?: string
  average_booking_value_cents?: number
  desired_monthly_bookings?: number
  annual_revenue_target_cents?: number
  current_booking_rate?: number
  marketing_priorities?: string[]
  primary_priority?: string
  meta_account_linked?: boolean
  google_business_linked?: boolean
  google_analytics_linked?: boolean
  email_crm_linked?: boolean
}

/**
 * Result of onboarding step
 */
export interface OnboardingResult {
  success: boolean
  nextStep: OnboardingStep
  profileId?: string
  errors?: Record<string, string>
}
