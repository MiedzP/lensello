import { createClient } from '@/lib/supabase/server'
import { requireUserOrRedirectWithOnboarding } from '@/lib/auth'
import MonthlyReviewView from './components/monthly-review-view'

export const metadata = {
  title: 'Monthly Growth Review - Lensello',
}

export default async function MonthlyReviewPage() {
  const supabase = await createClient()
  await requireUserOrRedirectWithOnboarding()

  // Fetch current month data
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

  const [
    enquiries,
    bookings,
    campaigns,
    businessProfile,
    goals,
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)
      .eq('stage', 'inquiry'),
    supabase
      .from('gigs')
      .select('*')
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)
      .eq('status', 'confirmed'),
    supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .limit(5),
    supabase
      .from('business_profile')
      .select('*')
      .eq('id', true)
      .single(),
    supabase.from('business_goals').select('*').eq('is_active', true),
  ])

  const totalRevenue = bookings.data?.reduce((sum, gig) => sum + (gig.price_cents || 0), 0) || 0

  return (
    <MonthlyReviewView
      enquiries={enquiries.data || []}
      bookings={bookings.data || []}
      campaigns={campaigns.data || []}
      businessProfile={businessProfile.data}
      goals={goals.data || []}
      totalRevenue={totalRevenue}
      month={now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
    />
  )
}

