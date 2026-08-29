/**
 * Type definitions for LENS (LEAD, ELEVATE, NURTURE, SCALE) measurement framework
 * Used in diagnostic assessment and business health tracking
 */

export type DiagnosticStatus = 'red' | 'amber' | 'green';

export interface DiagnosticInsight {
  status: DiagnosticStatus;
  insight: string;
  recommendation?: string;
}

/**
 * Six diagnostic areas for assessing photography business health
 * Based on marketing diagnostic framework
 */
export type DiagnosticArea =
  | 'position'
  | 'product'
  | 'visibility'
  | 'conversion'
  | 'nurture'
  | 'performance';

export interface DiagnosticData {
  // Position: Brand clarity and market differentiation
  diagnostic_position_status: DiagnosticStatus;
  diagnostic_position_insight: string;
  diagnostic_position_recommendation?: string;

  // Product: Service offerings and pricing
  diagnostic_product_status: DiagnosticStatus;
  diagnostic_product_insight: string;
  diagnostic_product_recommendation?: string;

  // Visibility: Discovery and reach
  diagnostic_visibility_status: DiagnosticStatus;
  diagnostic_visibility_insight: string;
  diagnostic_visibility_recommendation?: string;

  // Conversion: Lead to booking ratio
  diagnostic_conversion_status: DiagnosticStatus;
  diagnostic_conversion_insight: string;
  diagnostic_conversion_recommendation?: string;

  // Nurture: Client relationships and retention
  diagnostic_nurture_status: DiagnosticStatus;
  diagnostic_nurture_insight: string;
  diagnostic_nurture_recommendation?: string;

  // Performance: Business metrics and growth
  diagnostic_performance_status: DiagnosticStatus;
  diagnostic_performance_insight: string;
  diagnostic_performance_recommendation?: string;

  diagnostic_last_assessed?: string; // ISO timestamp
}

/**
 * Helper type to get a specific diagnostic field
 */
export type DiagnosticField = keyof DiagnosticData;

/**
 * Helper to get status field for a diagnostic area
 */
export function getDiagnosticStatusField(area: DiagnosticArea): DiagnosticField {
  return `diagnostic_${area}_status` as const;
}

/**
 * Helper to get insight field for a diagnostic area
 */
export function getDiagnosticInsightField(area: DiagnosticArea): DiagnosticField {
  return `diagnostic_${area}_insight` as const;
}

/**
 * Helper to get recommendation field for a diagnostic area
 */
export function getDiagnosticRecommendationField(area: DiagnosticArea): DiagnosticField {
  return `diagnostic_${area}_recommendation` as DiagnosticField;
}

/**
 * All diagnostic areas in order
 */
export const DIAGNOSTIC_AREAS: DiagnosticArea[] = [
  'position',
  'product',
  'visibility',
  'conversion',
  'nurture',
  'performance',
];

/**
 * Display labels for diagnostic areas
 */
export const DIAGNOSTIC_AREA_LABELS: Record<DiagnosticArea, string> = {
  position: 'Market Position',
  product: 'Product & Pricing',
  visibility: 'Visibility & Reach',
  conversion: 'Lead Conversion',
  nurture: 'Client Nurture',
  performance: 'Business Performance',
};

/**
 * Status display configuration
 */
export const DIAGNOSTIC_STATUS_CONFIG: Record<DiagnosticStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  red: {
    label: 'Needs Attention',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    icon: '🔴',
  },
  amber: {
    label: 'Review Needed',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    icon: '🟡',
  },
  green: {
    label: 'Healthy',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    icon: '🟢',
  },
};
