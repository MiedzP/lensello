import { createClient } from '@/lib/supabase/server'
import { requireUserOrRedirectWithOnboarding } from '@/lib/auth'
import QuarterlyPlanningView from './components/quarterly-planning-view'

export const metadata = {
  title: 'Quarterly Planning - Lensello',
}

export default async function QuarterlyPlanningPage() {
  const supabase = await createClient()
  await requireUserOrRedirectWithOnboarding()

  // Fetch business data
  const [businessProfile, businessGoals, campaigns] = await Promise.all([
    supabase.from('business_profile').select('*').eq('id', true).single(),
    supabase.from('business_goals').select('*'),
    supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return (
    <QuarterlyPlanningView
      businessProfile={businessProfile.data}
      goals={businessGoals.data || []}
      pastCampaigns={campaigns.data || []}
    />
  )
}

