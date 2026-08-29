/**
 * Gather business metrics for the Weekly Priorities dashboard.
 *
 * Pulls data from multiple sources and computes the metrics the priority
 * engine needs to generate Red/Amber/Green alerts.
 */

import type { Session } from '@/lib/auth';
import { countStaleUnbooked, countUnhandled } from '@/lib/clients/queries';
import { getLatestShootDate } from '@/lib/library/queries';
import type { BusinessMetrics } from './priority-engine';

type Supabase = Session['supabase'];

interface BusinessProfileRow {
  nurture_response_time_hours?: number | null;
  [key: string]: unknown;
}

/**
 * Compute the metrics the priority engine needs to evaluate business health.
 *
 * Enquiries and bookings are passed in (already fetched by the dashboard page).
 * Other metrics are queried here.
 */
export async function getWeeklyBusinessMetrics(
  supabase: Supabase,
  profile: BusinessProfileRow,
  enquiries: number,
  bookings: number,
): Promise<BusinessMetrics> {
  const conversionRate = enquiries > 0 ? (bookings / enquiries) * 100 : 0;

  // Fetch queries in parallel
  const [warmUnhandled, staleCount, latestShootDate] = await Promise.all([
    countUnhandled(supabase),
    countStaleUnbooked(supabase, 14), // 14+ days without contact
    getLatestShootDate(supabase),
  ]);

  // Portfolio freshness: days since last shoot
  let portfolioFreshnessDays: number | undefined;
  if (latestShootDate) {
    const lastShootMs = new Date(latestShootDate).getTime();
    const nowMs = Date.now();
    portfolioFreshnessDays = Math.floor((nowMs - lastShootMs) / (24 * 60 * 60 * 1000));
  }

  return {
    monthlyEnquiries: enquiries,
    monthlyBookings: bookings,
    conversionRate,
    warm_enquiries_unanswered: warmUnhandled,
    past_enquiries_unanswered: staleCount,
    response_time_hours: profile.nurture_response_time_hours ?? undefined,
    portfolio_freshness_days: portfolioFreshnessDays,
    // TODO(phase 2): Add metric sources
    // meta_cpl: from ad_metrics week-over-week spend/leads
    // meta_cpl_trend: 'up'|'down'|'stable' comparing this week to last week
    // website_conversion: from business_profile.lead_website_conversion_pct or instrumented data
    // website_conversion_trend: similar week-over-week analysis
    // booking_rate: coalesce(business_profile.current_booking_rate, monthly bookings)
    // target_booking_rate: business_profile.desired_monthly_bookings (unit reconciliation needed)
  };
}
