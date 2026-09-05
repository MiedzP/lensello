/**
 * Execution Routing Types
 *
 * Phase 3: Route work to the lowest-cost, most-scalable layer:
 * - LENSELLO: Repeatable tech (automation)
 * - AI: Intelligence without senior judgment
 * - TEAM: Execution without senior strategy
 * - SENIOR STRATEGIST: Judgment calls
 */

import type { Database } from '@/lib/db.types';

// Re-export from database types
export type ActionType = Database['public']['Enums']['action_type'];
export type ExecutionLayer = Database['public']['Enums']['execution_layer'];
export type PriorityLevel = Database['public']['Enums']['priority_level'];
export type ActionStatus = Database['public']['Enums']['action_status'];

// Main domain types
export interface Action {
  id: string;
  photographer_id: string;

  // Classification
  action_type: ActionType;
  execution_layer: ExecutionLayer;

  // Assignment and status
  assigned_to: string | null; // null, 'lensello', 'ai', team-email, 'strategist'
  status: ActionStatus;
  priority_level: PriorityLevel;

  // Content
  title: string;
  description: string | null;
  context: Record<string, any>; // structured data

  // AI draft (if applicable)
  ai_draft: string | null;
  ai_draft_metadata: {
    confidence?: number; // 0-1
    variants?: string[];
    alternatives?: Array<{ title: string; draft: string }>;
    [key: string]: any;
  };

  // Escalation
  escalation_reason: string | null;
  escalation_triggered_at: string | null;
  escalation_threshold_days: number;

  // Execution
  execution_result: Record<string, any> | null;
  executed_by: string | null;
  executed_at: string | null;

  // Timeline
  created_at: string;
  updated_at: string;
  due_at: string | null;
  completed_at: string | null;

  // Audit
  created_by: string | null;
  metadata: Record<string, any>;
}

export interface ActionExecutionLog {
  id: string;
  action_id: string;
  status: ActionStatus;
  executed_by: string | null;
  executed_at: string;
  result: Record<string, any> | null;
  error: string | null;
  metadata: Record<string, any>;
}

/**
 * Dashboard State: memoized metrics and priorities for the dashboard
 * Refreshed hourly by a background job
 */
export interface DashboardState {
  id: string;
  photographer_id: string;

  // Quick stats ("What is happening?")
  new_enquiries_this_month: number | null;
  consultations_booked_this_month: number | null;
  bookings_this_month: number | null;
  pipeline_value_cents: number | null;

  // Priorities ("What needs my attention?")
  top_3_priorities: Priority[];

  // Recommended action ("What should I do next?")
  recommended_action: RecommendedAction | null;

  // Timestamps
  generated_at: string;
  refreshed_at: string | null;
}

/**
 * Priority from Phase 2 diagnostic framework
 * Each of 6 areas: Position, Product, Visibility, Conversion, Nurture, Performance
 */
export interface Priority {
  area: 'position' | 'product' | 'visibility' | 'conversion' | 'nurture' | 'performance';
  status: 'red' | 'amber' | 'green';
  insight: string; // Human-readable insight
  recommended_action?: {
    title: string;
    action_type: ActionType;
    description?: string;
  };
}

/**
 * Recommended next action for the dashboard
 * Links to an action_queue row for execution
 */
export interface RecommendedAction {
  title: string;
  action_type: ActionType;
  description: string;
  impact: string; // e.g., "Could convert 5+ warm enquiries"
  estimated_time_minutes: number;
  execution_layer: ExecutionLayer;
  action_id?: string; // Reference to action_queue if already created
}

/**
 * Routing decision result
 * Used internally when deciding which layer should handle an action
 */
export interface RoutingDecision {
  action_type: ActionType;
  execution_layer: ExecutionLayer;
  assigned_to: string | null;
  reasoning: string;
  priority_level: PriorityLevel;
}

/**
 * Execution layer metadata
 * Describes what each layer is responsible for
 */
export const EXECUTION_LAYERS = {
  lensello_automation: {
    display_name: 'Lensello (Automation)',
    description: 'Repeatable technical tasks handled by the platform',
    examples: [
      'Lead capture forms',
      'Follow-up email sequences',
      'Nurture campaigns',
      'Meeting scheduling',
      'CRM updates',
      'Workflow automation',
      'Report generation',
    ],
    escalation_threshold_days: 30, // Escalate if no progress after 30 days
  },
  ai_intelligence: {
    display_name: 'AI (Intelligence)',
    description: 'Generate drafts and recommendations without senior judgment',
    examples: [
      'Draft campaign copy',
      'Analyze ad performance',
      'Recommend content themes',
      'Suggest follow-up messages',
      'Identify sales opportunities',
      'Generate content variants',
      'Analyze audience data',
    ],
    escalation_threshold_days: 14, // Escalate if no review after 14 days
  },
  team_execution: {
    display_name: 'Team (Execution)',
    description: 'Implementation tasks that don\'t require business strategy',
    examples: [
      'Set up campaigns',
      'Update landing pages',
      'Schedule content',
      'Configure integrations',
      'Implement workflows',
      'Update CRM',
      'Segment audiences',
    ],
    escalation_threshold_days: 7, // Escalate if stuck for 7 days
  },
  senior_strategist: {
    display_name: 'Senior Strategist (Fiona)',
    description: 'Strategic decisions requiring business judgment',
    examples: [
      'Business transformation',
      'Brand positioning',
      'Pricing strategy',
      'Complex diagnosis',
      'Offer development',
      'Pivot decisions',
      'Team mentoring',
    ],
    escalation_threshold_days: 0, // No escalation; direct assignment
  },
} as const;

/**
 * Action type metadata
 * Describes each action type and its layer
 */
export const ACTION_TYPE_META: Record<ActionType, {
  display_name: string;
  execution_layer: ExecutionLayer;
  description: string;
}> = {
  // Lensello automation
  auto_lead_capture: {
    display_name: 'Lead Capture Form',
    execution_layer: 'lensello_automation',
    description: 'Automatically capture leads from inquiry form',
  },
  auto_follow_up_email: {
    display_name: 'Follow-Up Email',
    execution_layer: 'lensello_automation',
    description: 'Send automated follow-up email sequence',
  },
  auto_nurture_campaign: {
    display_name: 'Nurture Campaign',
    execution_layer: 'lensello_automation',
    description: 'Run automated email nurture campaign',
  },
  auto_schedule_reminder: {
    display_name: 'Schedule Reminder',
    execution_layer: 'lensello_automation',
    description: 'Set automated reminder for action',
  },
  auto_crm_update: {
    display_name: 'CRM Update',
    execution_layer: 'lensello_automation',
    description: 'Automatically update CRM fields',
  },
  auto_workflow_trigger: {
    display_name: 'Workflow Trigger',
    execution_layer: 'lensello_automation',
    description: 'Trigger automated workflow',
  },
  auto_report_generate: {
    display_name: 'Generate Report',
    execution_layer: 'lensello_automation',
    description: 'Generate automated report',
  },

  // AI intelligence
  ai_draft_campaign: {
    display_name: 'Draft Campaign',
    execution_layer: 'ai_intelligence',
    description: 'AI-generated campaign copy and strategy',
  },
  ai_analyze_performance: {
    display_name: 'Analyze Performance',
    execution_layer: 'ai_intelligence',
    description: 'AI analysis of marketing performance',
  },
  ai_recommend_content: {
    display_name: 'Recommend Content',
    execution_layer: 'ai_intelligence',
    description: 'AI recommendations for content themes',
  },
  ai_suggest_follow_up: {
    display_name: 'Suggest Follow-Up',
    execution_layer: 'ai_intelligence',
    description: 'AI-suggested follow-up message',
  },
  ai_identify_opportunity: {
    display_name: 'Identify Opportunity',
    execution_layer: 'ai_intelligence',
    description: 'AI-identified sales or marketing opportunity',
  },
  ai_generate_variants: {
    display_name: 'Generate Variants',
    execution_layer: 'ai_intelligence',
    description: 'AI-generated content variants',
  },
  ai_audience_analysis: {
    display_name: 'Audience Analysis',
    execution_layer: 'ai_intelligence',
    description: 'AI analysis of audience and targeting data',
  },

  // Team execution
  team_setup_campaign: {
    display_name: 'Setup Campaign',
    execution_layer: 'team_execution',
    description: 'Configure and launch campaign',
  },
  team_landing_page_change: {
    display_name: 'Landing Page Update',
    execution_layer: 'team_execution',
    description: 'Update landing page content or design',
  },
  team_content_schedule: {
    display_name: 'Schedule Content',
    execution_layer: 'team_execution',
    description: 'Schedule content posts and campaigns',
  },
  team_config_integration: {
    display_name: 'Configure Integration',
    execution_layer: 'team_execution',
    description: 'Configure third-party integration',
  },
  team_implement_workflow: {
    display_name: 'Implement Workflow',
    execution_layer: 'team_execution',
    description: 'Set up and configure automation workflow',
  },
  team_update_crm: {
    display_name: 'Update CRM',
    execution_layer: 'team_execution',
    description: 'Update CRM client records and data',
  },
  team_audience_segment: {
    display_name: 'Segment Audience',
    execution_layer: 'team_execution',
    description: 'Create audience segments for targeting',
  },

  // Senior strategist
  strategy_business_transformation: {
    display_name: 'Business Transformation',
    execution_layer: 'senior_strategist',
    description: 'Strategic business model or positioning changes',
  },
  strategy_brand_positioning: {
    display_name: 'Brand Positioning',
    execution_layer: 'senior_strategist',
    description: 'Define or refine brand positioning strategy',
  },
  strategy_pricing_review: {
    display_name: 'Pricing Review',
    execution_layer: 'senior_strategist',
    description: 'Review and adjust pricing strategy',
  },
  strategy_complex_diagnosis: {
    display_name: 'Complex Diagnosis',
    execution_layer: 'senior_strategist',
    description: 'Deep dive analysis of business challenges',
  },
  strategy_offer_development: {
    display_name: 'Offer Development',
    execution_layer: 'senior_strategist',
    description: 'Develop new service packages or offers',
  },
  strategy_pivot_decision: {
    display_name: 'Pivot Decision',
    execution_layer: 'senior_strategist',
    description: 'Strategic pivot or major direction change',
  },
  strategy_mentoring: {
    display_name: 'Team Mentoring',
    execution_layer: 'senior_strategist',
    description: 'Mentor team member on strategy or execution',
  },
};

/**
 * Escalation rules: when to escalate an action to human review
 */
export interface EscalationRule {
  layer: ExecutionLayer;
  trigger: 'time' | 'failure' | 'low_confidence' | 'manual';
  threshold: number; // days for time, retry count for failure, 0-1 for confidence
  escalate_to: ExecutionLayer;
  reason: string;
}

export const DEFAULT_ESCALATION_RULES: EscalationRule[] = [
  {
    layer: 'lensello_automation',
    trigger: 'time',
    threshold: 30,
    escalate_to: 'ai_intelligence',
    reason: 'Automation pending for 30+ days without progress',
  },
  {
    layer: 'ai_intelligence',
    trigger: 'time',
    threshold: 14,
    escalate_to: 'team_execution',
    reason: 'AI draft pending 14+ days without review/approval',
  },
  {
    layer: 'ai_intelligence',
    trigger: 'low_confidence',
    threshold: 0.6,
    escalate_to: 'team_execution',
    reason: 'AI draft confidence below 60%',
  },
  {
    layer: 'team_execution',
    trigger: 'time',
    threshold: 7,
    escalate_to: 'senior_strategist',
    reason: 'Team task stuck for 7+ days',
  },
  {
    layer: 'team_execution',
    trigger: 'failure',
    threshold: 3,
    escalate_to: 'senior_strategist',
    reason: 'Team task failed 3+ times',
  },
];
