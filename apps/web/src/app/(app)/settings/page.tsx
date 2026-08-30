'use server';

import Link from 'next/link';
import { Card } from '@/components/ui/card';

/**
 * Settings index page - shows navigation between settings sections
 */
export default async function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-2">Manage your account and business information</p>
        </div>

        {/* Settings Navigation */}
        <div className="grid grid-cols-1 gap-4">
          <Link href="/settings/profile">
            <Card className="p-6 cursor-pointer hover:shadow-lg transition">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Business Profile</h2>
              <p className="text-slate-600 text-sm">
                Manage your photography business information, categories, and financial targets
              </p>
            </Card>
          </Link>

          <Link href="/settings/account">
            <Card className="p-6 cursor-pointer hover:shadow-lg transition">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Account Security</h2>
              <p className="text-slate-600 text-sm">
                Change your password and manage your account security
              </p>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
