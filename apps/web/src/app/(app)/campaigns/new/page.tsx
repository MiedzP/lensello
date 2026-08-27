import { createClient } from '@/lib/supabase/server'
import { requireUserOrRedirectWithOnboarding } from '@/lib/auth'
import CampaignBuilder from './components/campaign-builder'

export const metadata = {
  title: 'Create Campaign - Lensello',
}

export default async function NewCampaignPage() {
  const supabase = await createClient()
  await requireUserOrRedirectWithOnboarding()

  // Fetch business data needed for campaign builder
  const [businessProfile, businessGoals] = await Promise.all([
    supabase.from('business_profile').select('*').eq('id', true).single(),
    supabase.from('business_goals').select('*').eq('is_active', true),
  ])

  return (
    <CampaignBuilder
      businessProfile={businessProfile.data}
      existingGoals={businessGoals.data || []}
    />
  )
}

