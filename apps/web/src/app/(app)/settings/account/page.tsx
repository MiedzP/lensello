import { requireUserOrRedirectWithOnboarding } from '@/lib/auth';
import AccountSettingsView from './components/account-settings-view';

export const metadata = {
  title: 'Account Settings - Lensello',
};

export default async function AccountPage() {
  await requireUserOrRedirectWithOnboarding();

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <AccountSettingsView />
      </div>
    </div>
  );
}
