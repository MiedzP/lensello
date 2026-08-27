import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUserOrRedirect } from '@/lib/auth'
import OnboardingFlow from './components/onboarding-flow'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const session = await requireUserOrRedirect()
  const user = session.user

  // Check onboarding status
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, onboarding_step')
    .eq('id', user.id)
    .single()

  // Already completed - redirect to dashboard
  if (profile?.onboarding_completed) {
    redirect('/dashboard')
  }

  return <OnboardingFlow initialStep={profile?.onboarding_step || null} />
}
