import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import DiagnosticView from './components/diagnostic-view'

export const metadata = {
  title: 'Marketing Diagnostic - Lensello',
}

export default async function DiagnosticPage() {
  const session = await requireUser()
  if (!session) {
    redirect('/auth/signin' as any)
  }

  const supabase = await createClient()

  // Fetch business profile with diagnostic data
  const { data: profile, error } = await supabase
    .from('business_profile')
    .select('*')
    .single()

  if (error || !profile) {
    redirect('/onboarding' as any)
  }

  // Calculate current diagnostic status if not already assessed
  // For now, we'll pass empty - the component will handle initialization
  const diagnosticData = {
    position: {
      status: ((profile as any).diagnostic_position_status || 'amber') as 'red' | 'amber' | 'green',
      insight: (profile as any).diagnostic_position_insight || 'Brand positioning needs assessment.',
    },
    product: {
      status: ((profile as any).diagnostic_product_status || 'amber') as 'red' | 'amber' | 'green',
      insight: (profile as any).diagnostic_product_insight || 'Pricing and packages need review.',
    },
    visibility: {
      status: ((profile as any).diagnostic_visibility_status || 'amber') as 'red' | 'amber' | 'green',
      insight: (profile as any).diagnostic_visibility_insight || 'Online visibility needs improvement.',
    },
    conversion: {
      status: ((profile as any).diagnostic_conversion_status || 'amber') as 'red' | 'amber' | 'green',
      insight: (profile as any).diagnostic_conversion_insight || 'Enquiry-to-consultation conversion needs optimization.',
    },
    nurture: {
      status: ((profile as any).diagnostic_nurture_status || 'red') as 'red' | 'amber' | 'green',
      insight: (profile as any).diagnostic_nurture_insight || 'Follow-up and nurture sequences need implementation.',
    },
    performance: {
      status: ((profile as any).diagnostic_performance_status || 'amber') as 'red' | 'amber' | 'green',
      insight: (profile as any).diagnostic_performance_insight || 'Revenue and booking targets need review.',
    },
    lastAssessed: (profile as any).diagnostic_last_assessed ? new Date((profile as any).diagnostic_last_assessed) : null,
  }

  return <DiagnosticView diagnostic={diagnosticData} />
}
