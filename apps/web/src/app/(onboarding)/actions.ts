'use server';

/**
 * Photographer onboarding flow: category selection, business info, and diagnostic questionnaire.
 *
 * Server actions for Phase 1 (Foundation):
 * - Creating/updating business profile
 * - Saving diagnostic responses
 * - Initializing LENS scores
 *
 * Each action starts with `await requireUser()` to ensure the caller is authenticated.
 * The returned `supabase` carries the caller's RLS context, enforcing per-photographer access.
 */

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import type { TablesInsert, TablesUpdate } from '@/lib/db.types';
import type {
  BusinessProfile,
  DiagnosticResponse,
  LensScore,
  PhotographyCategorySlug,
} from '@lensello/core';

const UNIQUE_VIOLATION = '23505';

/**
 * Get or create a photographer's business profile.
 * Called on first onboarding visit.
 */
export async function getOrCreateBusinessProfile(): Promise<{
  profile: BusinessProfile | null;
  error?: string;
}> {
  const { supabase, user } = await requireUser();

  try {
    // Check if profile exists
    const { data: existing, error: fetchError } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('photographer_id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows, which is expected
      throw fetchError;
    }

    if (existing) {
      return { profile: existing as BusinessProfile };
    }

    // Create new profile
    const { data: created, error: createError } = await supabase
      .from('business_profiles')
      .insert({
        photographer_id: user.id,
        business_name: '',
        onboarding_step: 'category_select',
      } as TablesInsert<'business_profiles'>)
      .select()
      .single();

    if (createError) throw createError;

    return { profile: created as BusinessProfile };
  } catch (error) {
    console.error('[getOrCreateBusinessProfile]', error);
    return {
      profile: null,
      error: error instanceof Error ? error.message : 'Failed to get or create profile',
    };
  }
}

/**
 * Update business profile with photography categories and move to next step.
 */
export async function updateProfileCategories(input: {
  categories: PhotographyCategorySlug[];
  nextStep: string;
}): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await requireUser();

  try {
    const { error } = await supabase
      .from('business_profiles')
      .update({
        photography_categories: input.categories,
        onboarding_step: input.nextStep,
        updated_at: new Date().toISOString(),
      })
      .eq('photographer_id', user.id);

    if (error) throw error;

    revalidatePath('/onboarding');
    return { success: true };
  } catch (error) {
    console.error('[updateProfileCategories]', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update categories',
    };
  }
}

/**
 * Update business profile with business information.
 */
export async function updateProfileBusinessInfo(input: {
  businessName: string;
  photographerFullName?: string;
  email?: string;
  phone?: string;
  primaryLocation?: string;
  serviceAreas?: string;
  travelWilling?: boolean;
  avgBookingValueCents?: number;
  priceLowCents?: number;
  priceHighCents?: number;
  websiteUrl?: string;
  instagramHandle?: string;
  nextStep: string;
}): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await requireUser();

  try {
    const updateData: TablesUpdate<'business_profiles'> = {
      business_name: input.businessName,
      onboarding_step: input.nextStep,
      updated_at: new Date().toISOString(),
    };

    if (input.photographerFullName !== undefined) {
      updateData.photographer_full_name = input.photographerFullName;
    }
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.primaryLocation !== undefined) updateData.primary_location = input.primaryLocation;
    if (input.serviceAreas !== undefined) updateData.service_areas = input.serviceAreas;
    if (input.travelWilling !== undefined) updateData.travel_willing = input.travelWilling;
    if (input.avgBookingValueCents !== undefined)
      updateData.avg_booking_value_cents = input.avgBookingValueCents;
    if (input.priceLowCents !== undefined) updateData.price_low_cents = input.priceLowCents;
    if (input.priceHighCents !== undefined) updateData.price_high_cents = input.priceHighCents;
    if (input.websiteUrl !== undefined) updateData.website_url = input.websiteUrl;
    if (input.instagramHandle !== undefined) updateData.instagram_handle = input.instagramHandle;

    const { error } = await supabase
      .from('business_profiles')
      .update(updateData)
      .eq('photographer_id', user.id);

    if (error) throw error;

    revalidatePath('/onboarding');
    return { success: true };
  } catch (error) {
    console.error('[updateProfileBusinessInfo]', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update business info',
    };
  }
}

/**
 * Save diagnostic questionnaire responses.
 * Typically called at the end of onboarding, before calculating initial LENS scores.
 */
export async function saveDiagnosticResponses(input: {
  businessProfileId: string;
  currentLeadVolume?: string;
  desiredMonthlyBookings?: number;
  idealClientDescription?: string;
  portfolioQuality?: string;
  responseTimeHours?: number;
  consultationProcessDescription?: string;
  crmToolUsed?: string;
  emailOrSmsSystem?: string;
  annualRevenueTargetCents?: number;
  currentAnnualRevenueCents?: number;
  seasonalQuietPeriods?: string;
  profitMarginPercent?: number;
  hasWebsite?: boolean;
  hasActiveGoogleBusiness?: boolean;
  activeMarketingChannels?: string;
  currentInstagramFollowers?: number;
  hasMetaBusinessAccount?: boolean;
  hasGoogleAds?: boolean;
  hasStripeConnected?: boolean;
  biggestCurrentChallenge?: string;
  successStoryOrProudMoment?: string;
}): Promise<{ success: boolean; diagnosticId?: string; error?: string }> {
  const { supabase, user } = await requireUser();

  try {
    // Verify this profile belongs to the photographer
    const { data: profile, error: profileError } = await supabase
      .from('business_profiles')
      .select('id')
      .eq('id', input.businessProfileId)
      .eq('photographer_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found or access denied');
    }

    const diagnosticData: TablesInsert<'diagnostic_responses'> = {
      business_profile_id: input.businessProfileId,
      current_lead_volume: (input.currentLeadVolume as any) || null,
      desired_monthly_bookings: input.desiredMonthlyBookings || null,
      ideal_client_description: input.idealClientDescription || null,
      portfolio_quality: (input.portfolioQuality as any) || null,
      response_time_hours: input.responseTimeHours || null,
      consultation_process_description: input.consultationProcessDescription || null,
      crm_tool_used: input.crmToolUsed || null,
      email_or_sms_system: input.emailOrSmsSystem || null,
      annual_revenue_target_cents: input.annualRevenueTargetCents || null,
      current_annual_revenue_cents: input.currentAnnualRevenueCents || null,
      seasonal_quiet_periods: input.seasonalQuietPeriods || null,
      profit_margin_percent: input.profitMarginPercent || null,
      has_website: input.hasWebsite || null,
      has_active_google_business: input.hasActiveGoogleBusiness || null,
      active_marketing_channels: input.activeMarketingChannels || null,
      current_instagram_followers: input.currentInstagramFollowers || null,
      has_meta_business_account: input.hasMetaBusinessAccount || null,
      has_google_ads: input.hasGoogleAds || null,
      has_stripe_connected: input.hasStripeConnected || null,
      biggest_current_challenge: input.biggestCurrentChallenge || null,
      success_story_or_proud_moment: input.successStoryOrProudMoment || null,
    };

    // Upsert: if diagnostic exists for this profile, update it; otherwise insert
    const { data: existing } = await supabase
      .from('diagnostic_responses')
      .select('id')
      .eq('business_profile_id', input.businessProfileId)
      .single();

    let result;
    if (existing) {
      // Update existing
      result = await supabase
        .from('diagnostic_responses')
        .update(diagnosticData)
        .eq('business_profile_id', input.businessProfileId)
        .select()
        .single();
    } else {
      // Insert new
      result = await supabase
        .from('diagnostic_responses')
        .insert(diagnosticData)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    // Mark onboarding as complete
    await supabase
      .from('business_profiles')
      .update({
        onboarding_step: 'complete',
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', input.businessProfileId);

    revalidatePath('/onboarding');
    revalidatePath('/dashboard');

    return {
      success: true,
      diagnosticId: result.data?.id,
    };
  } catch (error) {
    console.error('[saveDiagnosticResponses]', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save diagnostic responses',
    };
  }
}

/**
 * Initialize LENS scores from diagnostic responses.
 * Called after completing the diagnostic questionnaire.
 * This is a simple baseline calculation; the actual scores will be refined
 * by integration metrics and manual reviews over time.
 */
export async function initializeLensScores(input: {
  businessProfileId: string;
}): Promise<{ success: boolean; scoreId?: string; error?: string }> {
  const { supabase, user } = await requireUser();

  try {
    // Verify profile belongs to photographer
    const { data: profile, error: profileError } = await supabase
      .from('business_profiles')
      .select('id')
      .eq('id', input.businessProfileId)
      .eq('photographer_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found or access denied');
    }

    // Get diagnostic responses
    const { data: diagnostic, error: diagnosticError } = await supabase
      .from('diagnostic_responses')
      .select('*')
      .eq('business_profile_id', input.businessProfileId)
      .single();

    if (diagnosticError || !diagnostic) {
      throw new Error('Diagnostic responses not found');
    }

    // Calculate baseline scores from diagnostic
    // These are simplified heuristics; production would use more sophisticated logic
    const scores = calculateBaselineScores(diagnostic);

    const scoreData: TablesInsert<'lens_scores'> = {
      business_profile_id: input.businessProfileId,
      lead_score: scores.leadScore,
      lead_details: scores.leadDetails,
      elevate_score: scores.elevateScore,
      elevate_details: scores.elevateDetails,
      nurture_score: scores.nurtureScore,
      nurture_details: scores.nurtureDetails,
      scale_score: scores.scaleScore,
      scale_details: scores.scaleDetails,
      overall_score: scores.overallScore,
      source: 'diagnostic',
      note: 'Baseline from onboarding diagnostic questionnaire',
    };

    const { data: created, error: createError } = await supabase
      .from('lens_scores')
      .insert(scoreData)
      .select()
      .single();

    if (createError) throw createError;

    revalidatePath('/dashboard');

    return {
      success: true,
      scoreId: created?.id,
    };
  } catch (error) {
    console.error('[initializeLensScores]', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize LENS scores',
    };
  }
}

/**
 * Calculate baseline LENS scores from diagnostic responses.
 * Simplified heuristic logic suitable for MVP.
 *
 * LEAD: Based on current lead volume, website presence, social media activity
 * ELEVATE: Based on portfolio quality, website existence, review count
 * NURTURE: Based on response time, CRM setup, consultation process clarity
 * SCALE: Based on pricing strategy, revenue targets, profit margins
 */
function calculateBaselineScores(diagnostic: any): {
  leadScore: number;
  leadDetails: Record<string, any>;
  elevateScore: number;
  elevateDetails: Record<string, any>;
  nurtureScore: number;
  nurtureDetails: Record<string, any>;
  scaleScore: number;
  scaleDetails: Record<string, any>;
  overallScore: number;
} {
  let leadScore = 30; // baseline
  const leadDetails: Record<string, any> = {};

  // LEAD scoring
  if (diagnostic.current_instagram_followers && diagnostic.current_instagram_followers > 1000) {
    leadScore += 15;
    leadDetails.instagramFollowers = diagnostic.current_instagram_followers;
  }
  if (diagnostic.has_website) {
    leadScore += 10;
    leadDetails.hasWebsite = true;
  }
  if (diagnostic.active_marketing_channels && diagnostic.active_marketing_channels.length > 0) {
    leadScore += 10;
    leadDetails.activeChannels = diagnostic.active_marketing_channels;
  }
  if (diagnostic.has_google_ads) {
    leadScore += 10;
    leadDetails.hasGoogleAds = true;
  }
  if (diagnostic.current_lead_volume === 'many' || diagnostic.current_lead_volume === 'very_many') {
    leadScore += 15;
    leadDetails.currentLeadVolume = diagnostic.current_lead_volume;
  }
  leadScore = Math.min(leadScore, 100);

  // ELEVATE scoring
  let elevateScore = 35;
  const elevateDetails: Record<string, any> = {};

  if (diagnostic.portfolio_quality === 'strong') {
    elevateScore += 15;
    elevateDetails.portfolioQuality = 'strong';
  } else if (diagnostic.portfolio_quality === 'exceptional') {
    elevateScore += 25;
    elevateDetails.portfolioQuality = 'exceptional';
  }
  if (diagnostic.has_website) {
    elevateScore += 10;
    elevateDetails.hasWebsite = true;
  }
  if (diagnostic.ideal_client_description && diagnostic.ideal_client_description.length > 20) {
    elevateScore += 10;
    elevateDetails.clearPositioning = true;
  }
  elevateScore = Math.min(elevateScore, 100);

  // NURTURE scoring
  let nurtureScore = 30;
  const nurtureDetails: Record<string, any> = {};

  if (diagnostic.response_time_hours && diagnostic.response_time_hours <= 4) {
    nurtureScore += 15;
    nurtureDetails.responsiveToInquiries = true;
  }
  if (diagnostic.crm_tool_used) {
    nurtureScore += 15;
    nurtureDetails.crmInPlace = diagnostic.crm_tool_used;
  }
  if (diagnostic.email_or_sms_system) {
    nurtureScore += 10;
    nurtureDetails.hasEmailSms = true;
  }
  if (
    diagnostic.consultation_process_description &&
    diagnostic.consultation_process_description.length > 20
  ) {
    nurtureScore += 10;
    nurtureDetails.documentedProcess = true;
  }
  nurtureScore = Math.min(nurtureScore, 100);

  // SCALE scoring
  let scaleScore = 35;
  const scaleDetails: Record<string, any> = {};

  if (diagnostic.current_annual_revenue_cents && diagnostic.current_annual_revenue_cents > 0) {
    scaleDetails.currentAnnualRevenue = diagnostic.current_annual_revenue_cents;
    if (diagnostic.current_annual_revenue_cents > 5000000) {
      // > £50k
      scaleScore += 15;
    }
  }
  if (diagnostic.profit_margin_percent && diagnostic.profit_margin_percent > 40) {
    scaleScore += 10;
    scaleDetails.healthyMargin = diagnostic.profit_margin_percent;
  }
  if (diagnostic.desired_monthly_bookings && diagnostic.desired_monthly_bookings > 0) {
    scaleScore += 10;
    scaleDetails.hasGrowthTarget = diagnostic.desired_monthly_bookings;
  }
  if (diagnostic.has_stripe_connected) {
    scaleScore += 10;
    scaleDetails.stripeConnected = true;
  }
  scaleScore = Math.min(scaleScore, 100);

  const overallScore = Math.round((leadScore + elevateScore + nurtureScore + scaleScore) / 4);

  return {
    leadScore,
    leadDetails,
    elevateScore,
    elevateDetails,
    nurtureScore,
    nurtureDetails,
    scaleScore,
    scaleDetails,
    overallScore,
  };
}
