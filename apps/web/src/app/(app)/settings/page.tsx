'use server';

import { redirect } from 'next/navigation';

/**
 * Settings index page - redirects to profile settings
 * This allows /settings to work as a valid route
 */
export default async function SettingsPage() {
  redirect('/settings/profile');
}
