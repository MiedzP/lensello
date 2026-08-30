import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DiagnosticView from './components/diagnostic-view';
import type { DiagnosticAssessment } from '@/lib/lens/diagnostic';

export const dynamic = 'force-dynamic'; // Always dynamic - requires auth session
export const metadata = {
  title: 'Marketing Diagnostic - Lensello',
};

export default async function DiagnosticPage() {
  const session = await requireUser();
  if (!session) {
    return redirect('/auth/signin' as any);
  }

  const supabase = await createClient();

  // Fetch business profile with diagnostic data
  const { data: profile, error } = await supabase
    .from('business_profile')
    .select('*')
    .single();

  if (error || !profile) {
    return redirect('/onboarding' as any);
  }

  // Build diagnostic data from profile with type-safe access
  const diagnostic: DiagnosticAssessment = {
    position: {
      status: (profile.diagnostic_position_status || 'amber') as 'red' | 'amber' | 'green',
      insight: profile.diagnostic_position_insight || 'Position assessment needed.',
    },
    product: {
      status: (profile.diagnostic_product_status || 'amber') as 'red' | 'amber' | 'green',
      insight: profile.diagnostic_product_insight || 'Product assessment needed.',
    },
    visibility: {
      status: (profile.diagnostic_visibility_status || 'amber') as 'red' | 'amber' | 'green',
      insight: profile.diagnostic_visibility_insight || 'Visibility assessment needed.',
    },
    conversion: {
      status: (profile.diagnostic_conversion_status || 'amber') as 'red' | 'amber' | 'green',
      insight: profile.diagnostic_conversion_insight || 'Conversion assessment needed.',
    },
    nurture: {
      status: (profile.diagnostic_nurture_status || 'amber') as 'red' | 'amber' | 'green',
      insight: profile.diagnostic_nurture_insight || 'Nurture assessment needed.',
    },
    performance: {
      status: (profile.diagnostic_performance_status || 'amber') as 'red' | 'amber' | 'green',
      insight: profile.diagnostic_performance_insight || 'Performance assessment needed.',
    },
    lastAssessed: profile.diagnostic_last_assessed
      ? new Date(profile.diagnostic_last_assessed)
      : null,
  };

  return <DiagnosticView diagnostic={diagnostic} />;
}
