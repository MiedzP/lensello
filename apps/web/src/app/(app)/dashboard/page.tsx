import { createClient } from '@/lib/supabase/server'
import { requireUserOrRedirectWithOnboarding } from '@/lib/auth'
import DashboardContent from './components/dashboard-content'

export const metadata = {
  title: 'Dashboard - Lensello',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const session = await requireUserOrRedirectWithOnboarding()
  const user = session.user

  // Fetch business data
  const [businessProfile, enquiries, bookings, pipeline, priorities] = await Promise.all([
    supabase.from('business_profile').select('*').eq('id', true).single(),
    supabase
      .from('clients')
      .select('id')
      .eq('stage', 'inquiry')
      .eq('created_at', `>=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`)
      .then((r) => ({ data: r.data?.length || 0, error: r.error })),
    supabase
      .from('gigs')
      .select('id')
      .eq('status', 'confirmed')
      .eq('created_at', `>=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`)
      .then((r) => ({ data: r.data?.length || 0, error: r.error })),
    supabase
      .from('gigs')
      .select('price_cents')
      .eq('status', 'inquiry')
      .then((r) => ({
        data: r.data?.reduce((sum, g) => sum + (g.price_cents || 0), 0) || 0,
        error: r.error,
      })),
    supabase.from('business_goals').select('*').eq('is_active', true),
  ])

  return (
    <DashboardContent
      businessProfile={businessProfile.data}
      enquiries={enquiries.data}
      bookings={bookings.data}
      pipelineValue={pipeline.data}
      priorities={priorities.data || []}
    />
  )
}

