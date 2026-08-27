import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Login - Lensello',
}

export default function LocalLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold text-slate-900">Lensello</h1>
          <p className="text-slate-600 mt-2">Local Development</p>
        </div>

        <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg mb-6">
          <p className="text-sm text-blue-900">
            <strong>Test Credentials:</strong><br/>
            Email: michael.pagano@xerensys.ai<br/>
            Password: Lensello2026
          </p>
        </div>

        <div className="space-y-4">
          <a href="/dashboard" className="block w-full">
            <button className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">
              Go to Dashboard
            </button>
          </a>

          <a href="/onboarding" className="block w-full">
            <button className="w-full px-4 py-2 rounded-lg bg-slate-200 text-slate-900 font-medium hover:bg-slate-300">
              View Onboarding
            </button>
          </a>

          <a href="/monthly-review" className="block w-full">
            <button className="w-full px-4 py-2 rounded-lg bg-slate-200 text-slate-900 font-medium hover:bg-slate-300">
              View Monthly Review
            </button>
          </a>

          <a href="/quarterly-planning" className="block w-full">
            <button className="w-full px-4 py-2 rounded-lg bg-slate-200 text-slate-900 font-medium hover:bg-slate-300">
              View Quarterly Planning
            </button>
          </a>

          <a href="/rhythm" className="block w-full">
            <button className="w-full px-4 py-2 rounded-lg bg-slate-200 text-slate-900 font-medium hover:bg-slate-300">
              View Operating Rhythm
            </button>
          </a>
        </div>

        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-600">
            <strong>Note:</strong> This is local development mode. No Supabase connection needed. All pages load without authentication.
          </p>
        </div>
      </div>
    </div>
  )
}
