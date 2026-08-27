import { createClient } from '@/lib/supabase/server'
import { requireUserOrRedirectWithOnboarding } from '@/lib/auth'
import ProfileSettingsView from './components/profile-settings-view'

export const metadata = {
  title: 'Business Profile - Lensello',
}

export default async function ProfilePage() {
  const supabase = await createClient()
  await requireUserOrRedirectWithOnboarding()

  // Fetch business profile
  const { data: businessProfile } = await supabase
    .from('business_profile')
    .select('*')
    .eq('id', true)
    .single()

  return <ProfileSettingsView businessProfile={businessProfile} />
}

