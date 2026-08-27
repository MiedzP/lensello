import { createClient } from '@/lib/supabase/server'
import { requireUserOrRedirectWithOnboarding } from '@/lib/auth'
import OperatingRhythmView from './components/operating-rhythm-view'

export const metadata = {
  title: 'Operating Rhythm - Lensello',
}

export default async function OperatingRhythmPage() {
  const supabase = await createClient()
  await requireUserOrRedirectWithOnboarding()

  // Fetch business data
  const [campaigns, goals, clients, gigs] = await Promise.all([
    supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .limit(5),
    supabase.from('business_goals').select('*').eq('is_active', true),
    supabase
      .from('clients')
      .select('*')
      .eq('stage', 'inquiry')
      .limit(5),
    supabase
      .from('gigs')
      .select('*')
      .eq('status', 'confirmed')
      .order('starts_at', { ascending: true })
      .limit(5),
  ])

  return (
    <OperatingRhythmView
      campaigns={campaigns.data || []}
      goals={goals.data || []}
      enquiries={clients.data || []}
      gigs={gigs.data || []}
    />
  )
}

