'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ProfileSettingsViewProps {
  businessProfile: any
}

export default function ProfileSettingsView({ businessProfile }: ProfileSettingsViewProps) {
  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Business Profile</h1>
        <p className="text-slate-600 mt-2">Manage your photography business information</p>
      </div>

      {/* Business Basics */}
      <Card className="p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Business Information</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Business Name</label>
            <input
              type="text"
              defaultValue={businessProfile?.business_name || ''}
              className="w-full px-4 py-2 rounded-lg border border-slate-200"
              disabled
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Country</label>
              <input
                type="text"
                defaultValue={businessProfile?.location_country || ''}
                className="w-full px-4 py-2 rounded-lg border border-slate-200"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Region</label>
              <input
                type="text"
                defaultValue={businessProfile?.location_region || ''}
                className="w-full px-4 py-2 rounded-lg border border-slate-200"
                disabled
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Service Area</label>
            <textarea
              defaultValue={businessProfile?.geographic_service_area || ''}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 h-20"
              disabled
            />
          </div>
        </div>
      </Card>

      {/* Photography Categories */}
      <Card className="p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Photography Types You Offer</h2>
        <div className="flex flex-wrap gap-2">
          {businessProfile?.photography_categories?.map((cat: string) => (
            <span key={cat} className="px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-sm font-medium">
              {cat}
            </span>
          ))}
        </div>
      </Card>

      {/* Financial Targets */}
      <Card className="p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Financial Targets</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Average Booking Value</label>
            <div className="text-2xl font-bold text-slate-900">
              £{(businessProfile?.average_booking_value_cents || 0) / 100}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Target Monthly Bookings</label>
            <div className="text-2xl font-bold text-slate-900">{businessProfile?.desired_monthly_bookings}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Annual Revenue Target</label>
            <div className="text-2xl font-bold text-slate-900">
              £{(businessProfile?.annual_revenue_target_cents || 0) / 100}
            </div>
          </div>
        </div>
      </Card>

      {/* Integrations Status */}
      <Card className="p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Connected Accounts</h2>
        <div className="space-y-3">
          {[
            { name: 'Meta (Instagram/Facebook)', key: 'meta_account_linked', icon: '📱' },
            { name: 'Google Business Profile', key: 'google_business_linked', icon: '🔍' },
            { name: 'Google Analytics', key: 'google_analytics_linked', icon: '📊' },
            { name: 'Email/CRM', key: 'email_crm_linked', icon: '📧' },
          ].map((integration) => (
            <div key={integration.key} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="text-xl">{integration.icon}</span>
                <p className="font-medium text-slate-900">{integration.name}</p>
              </div>
              <span
                className={`text-sm font-medium px-2 py-1 rounded ${
                  businessProfile?.[integration.key]
                    ? 'bg-green-100 text-green-900'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {businessProfile?.[integration.key] ? '✓ Connected' : 'Not connected'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* LENS Baseline */}
      <Card className="p-8 bg-blue-50 border-blue-200">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">LENS Baseline (Current Month)</h2>
        <p className="text-slate-600 mb-4">
          These metrics are calculated from your activity this month and updated monthly
        </p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-600 mb-1">Monthly Enquiries</p>
            <p className="font-bold text-slate-900">{businessProfile?.lead_monthly_enquiries || '—'}</p>
          </div>
          <div>
            <p className="text-slate-600 mb-1">Conversion Rate</p>
            <p className="font-bold text-slate-900">{businessProfile?.nurture_conversion_pct || '—'}%</p>
          </div>
          <div>
            <p className="text-slate-600 mb-1">Response Time</p>
            <p className="font-bold text-slate-900">{businessProfile?.nurture_response_time_hours || '—'} hrs</p>
          </div>
          <div>
            <p className="text-slate-600 mb-1">Profit Margin</p>
            <p className="font-bold text-slate-900">{businessProfile?.scale_profit_margin_pct || '—'}%</p>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <a href="/dashboard">
          <Button variant="ghost">Back to Dashboard</Button>
        </a>
        <a href="/onboarding">
          <Button>Update Profile</Button>
        </a>
      </div>
    </div>
  )
}
