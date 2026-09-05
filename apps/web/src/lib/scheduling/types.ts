/**
 * Timeline Engine Types
 *
 * Core TypeScript types for the automated scheduling system.
 */

import type { Database } from '@/lib/db.types';

// Database-generated types
export type TemplateCategory = Database['public']['Enums']['template_category'];
export type DayCalcMode = Database['public']['Enums']['day_calc_mode'];
export type TimelineStatus = Database['public']['Enums']['timeline_status'];
export type TriggerType = Database['public']['Enums']['trigger_type'];
export type ActionType = Database['public']['Enums']['action_type'];
export type PriorityLevel = Database['public']['Enums']['priority_level'];
export type ActionStatus = Database['public']['Enums']['action_status'];

// ============================================================================
// TIMELINE TEMPLATE
// ============================================================================

export interface TimelineTemplate {
  id: string;
  photographer_id: string;

  slug: string;
  name: string;
  description?: string;
  category: TemplateCategory;

  is_active: boolean;
  is_default: boolean;
  duration_days: number;

  auto_trigger_on?: TriggerType[];
  timezone: string;

  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TIMELINE MILESTONE
// ============================================================================

export interface TimelineMilestone {
  id: string;
  template_id: string;

  position: number;
  title: string;
  description?: string;

  day_number: number;
  day_calc_mode: DayCalcMode;

  repeat_every_days?: number;
  repeat_end_day?: number;

  preferred_time?: string;  // "HH:MM:SS"
  timezone?: string;

  metadata?: Record<string, any>;
  created_at: string;
}

// ============================================================================
// MILESTONE ACTION
// ============================================================================

export interface MilestoneAction {
  id: string;
  milestone_id: string;

  action_type: ActionType;
  priority_level: PriorityLevel;

  title: string;
  description?: string;
  template_content?: string;  // Email body, SMS text, etc.

  template_variables?: string[];
  action_config?: Record<string, any>;

  position: number;

  metadata?: Record<string, any>;
  created_at: string;
}

// ============================================================================
// SCHEDULED TIMELINE
// ============================================================================

export interface ScheduledTimeline {
  id: string;
  photographer_id: string;
  template_id: string;

  trigger_type: TriggerType;
  trigger_context?: Record<string, any>;

  status: TimelineStatus;
  started_at: string;
  paused_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancelled_reason?: string;

  timezone: string;
  start_date: string;  // YYYY-MM-DD

  context?: Record<string, any>;  // client_name, project_type, etc.
  metadata?: Record<string, any>;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// SCHEDULED ACTION
// ============================================================================

export interface ScheduledAction {
  id: string;
  photographer_id: string;
  scheduled_timeline_id: string;
  milestone_id: string;
  milestone_action_id: string;

  action_queue_id?: string;

  scheduled_date: string;  // YYYY-MM-DD
  scheduled_time?: string;  // HH:MM:SS
  scheduled_at?: string;  // ISO timestamp

  is_prepared: boolean;
  prepared_at?: string;
  prepared_content?: Record<string, any>;

  is_queued: boolean;
  queued_at?: string;
  executed_at?: string;

  status: ActionStatus;

  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ACTION TRIGGER
// ============================================================================

export interface ActionTrigger {
  id: string;
  photographer_id: string;
  template_id: string;

  trigger_type: TriggerType;
  trigger_table: string;

  trigger_conditions?: Record<string, any>;

  auto_activate: boolean;
  requires_approval: boolean;

  metadata?: Record<string, any>;
  created_at: string;
}

// ============================================================================
// TEMPLATE LIBRARY (Pre-built templates)
// ============================================================================

export interface TemplateLibraryItem {
  slug: string;
  name: string;
  description: string;
  category: TemplateCategory;
  duration_days: number;
  milestones: TemplateLibraryMilestone[];
}

export interface TemplateLibraryMilestone {
  day_number: number;
  title: string;
  description: string;
  day_calc_mode: DayCalcMode;
  repeat_every_days?: number;
  repeat_end_day?: number;
  actions: TemplateLibraryAction[];
}

export interface TemplateLibraryAction {
  action_type: ActionType;
  priority_level: PriorityLevel;
  title: string;
  description: string;
  template_content: string;
  template_variables: string[];
  action_config?: Record<string, any>;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateTimelineTemplateRequest {
  slug: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  duration_days: number;
  auto_trigger_on?: TriggerType[];
  timezone?: string;
  metadata?: Record<string, any>;
}

export interface AddMilestoneRequest {
  template_id: string;
  position: number;
  title: string;
  description?: string;
  day_number: number;
  day_calc_mode?: DayCalcMode;
  repeat_every_days?: number;
  repeat_end_day?: number;
  preferred_time?: string;
  timezone?: string;
  metadata?: Record<string, any>;
}

export interface AddActionRequest {
  milestone_id: string;
  action_type: ActionType;
  priority_level?: PriorityLevel;
  title: string;
  description?: string;
  template_content?: string;
  template_variables?: string[];
  action_config?: Record<string, any>;
  position?: number;
  metadata?: Record<string, any>;
}

export interface StartTimelineRequest {
  template_id: string;
  trigger_type: TriggerType;
  trigger_context: Record<string, any>;
  start_date?: string;  // YYYY-MM-DD, defaults to today
  timezone?: string;
  context?: Record<string, any>;  // client_name, event_date, etc.
  metadata?: Record<string, any>;
}

export interface CalculateMilestoneDateRequest {
  start_date: string;
  day_number: number;
  day_calc_mode: DayCalcMode;
  timezone: string;
  preferred_time?: string;
}

export interface CalculateMilestoneDateResponse {
  date: string;  // YYYY-MM-DD
  time?: string;  // HH:MM:SS
  timestamp: string;  // ISO timestamp
  timezone: string;
}

export interface GetScheduledActionsRequest {
  photographer_id: string;
  status?: ActionStatus[];
  is_queued?: boolean;
  is_prepared?: boolean;
  scheduled_before?: string;
  scheduled_after?: string;
  limit?: number;
  offset?: number;
}

export interface GetScheduledActionsResponse {
  actions: (ScheduledAction & {
    template_name: string;
    milestone_title: string;
    action_title: string;
    prepared_content?: Record<string, any>;
  })[];
  total: number;
}

export interface ExecuteScheduledActionRequest {
  scheduled_action_id: string;
  photographer_id: string;
  execution_result?: Record<string, any>;
}

// ============================================================================
// STATISTICS AND MONITORING
// ============================================================================

export interface TimelineEngineStats {
  total_templates: number;
  active_templates: number;
  total_timelines: number;
  active_timelines: number;
  completed_timelines: number;
  scheduled_actions_pending: number;
  scheduled_actions_prepared: number;
  scheduled_actions_due_today: number;
  scheduled_actions_overdue: number;
}

export interface TimelineMetrics {
  timeline_id: string;
  template_name: string;
  status: TimelineStatus;
  progress_percent: number;
  milestones_completed: number;
  milestones_total: number;
  actions_completed: number;
  actions_total: number;
  next_milestone_due?: string;
  last_action_executed?: string;
}

// ============================================================================
// PRE-BUILT TEMPLATES
// ============================================================================

export const BUILT_IN_TEMPLATES: Record<string, TemplateLibraryItem> = {
  'wedding-timeline': {
    slug: 'wedding-timeline',
    name: 'Wedding Photography Timeline',
    description: 'Complete workflow from engagement to album delivery',
    category: 'photography_workflow',
    duration_days: 60,
    milestones: [
      {
        day_number: 0,
        title: 'Engagement Session Confirmation',
        description: 'Confirm engagement shoot details and send prep guide',
        day_calc_mode: 'calendar_days',
        actions: [
          {
            action_type: 'auto_follow_up_email',
            priority_level: 'red',
            title: 'Send Engagement Shoot Details',
            description: 'Confirm shoot location, time, and attire recommendations',
            template_content: 'Hi {{client_name}},\n\nWe\'re excited for your engagement session on {{session_date}}!...',
            template_variables: ['client_name', 'session_date', 'location'],
            action_config: { email: { subject: 'Engagement Session Details - {{event_date}}' } },
          },
        ],
      },
      {
        day_number: 3,
        title: 'Engagement Photos Preview',
        description: 'Share sneak peek of engagement photos',
        day_calc_mode: 'calendar_days',
        actions: [
          {
            action_type: 'auto_follow_up_email',
            priority_level: 'amber',
            title: 'Engagement Preview Email',
            description: 'Send preview of best engagement photos',
            template_content: 'Hi {{client_name}},\n\nCheck out these previews from your engagement session!...',
            template_variables: ['client_name'],
            action_config: { email: { subject: 'Your Engagement Photo Previews' } },
          },
        ],
      },
      {
        day_number: 14,
        title: 'Wedding Day Details',
        description: 'Confirm wedding day timeline and details',
        day_calc_mode: 'calendar_days',
        actions: [
          {
            action_type: 'auto_follow_up_email',
            priority_level: 'red',
            title: 'Wedding Day Confirmation',
            description: 'Final confirmation of wedding day logistics',
            template_content: 'Hi {{client_name}},\n\nWe\'re two weeks away! Here\'s your wedding day timeline...',
            template_variables: ['client_name', 'wedding_date', 'ceremony_time'],
            action_config: { email: { subject: 'Wedding Day Timeline - {{wedding_date}}' } },
          },
        ],
      },
      {
        day_number: 30,
        title: 'Engagement Album Delivery',
        description: 'Deliver full engagement photo gallery',
        day_calc_mode: 'calendar_days',
        actions: [
          {
            action_type: 'auto_follow_up_email',
            priority_level: 'amber',
            title: 'Full Gallery Delivery',
            description: 'Share complete engagement photo gallery',
            template_content: 'Hi {{client_name}},\n\nYour full engagement gallery is ready to view!...',
            template_variables: ['client_name', 'gallery_link'],
            action_config: { email: { subject: 'Your Engagement Photo Gallery is Ready' } },
          },
        ],
      },
      {
        day_number: 60,
        title: 'Wedding Album Delivery',
        description: 'Deliver wedding day photos and album',
        day_calc_mode: 'calendar_days',
        actions: [
          {
            action_type: 'auto_follow_up_email',
            priority_level: 'red',
            title: 'Wedding Photos Delivered',
            description: 'Share complete wedding day gallery',
            template_content: 'Hi {{client_name}},\n\nYour wedding day photos are ready!...',
            template_variables: ['client_name', 'wedding_date'],
            action_config: { email: { subject: 'Your Wedding Photos are Ready' } },
          },
        ],
      },
    ],
  },

  'new-lead-nurture': {
    slug: 'new-lead-nurture',
    name: 'New Lead Nurture Sequence',
    description: '30-day nurture sequence for new inquiries',
    category: 'client_journey',
    duration_days: 30,
    milestones: [
      {
        day_number: 0,
        title: 'Initial Welcome',
        description: 'Welcome new lead and send portfolio',
        day_calc_mode: 'calendar_days',
        actions: [
          {
            action_type: 'auto_follow_up_email',
            priority_level: 'red',
            title: 'Welcome Email with Portfolio',
            description: 'Introduce studio and share portfolio link',
            template_content: 'Hi {{client_name}},\n\nThank you for your inquiry! We\'re excited to help with your {{project_type}}...',
            template_variables: ['client_name', 'project_type'],
            action_config: { email: { subject: 'Welcome to {{studio_name}} - Your {{project_type}} Photography' } },
          },
          {
            action_type: 'auto_crm_update',
            priority_level: 'green',
            title: 'Tag as New Lead',
            description: 'Add to CRM and tag as new lead',
            template_content: '',
            template_variables: [],
            action_config: { crm: { tag: 'new_lead_day0' } },
          },
        ],
      },
      {
        day_number: 3,
        title: 'Follow-Up with Services',
        description: 'Send detailed service information',
        day_calc_mode: 'calendar_days',
        actions: [
          {
            action_type: 'auto_follow_up_email',
            priority_level: 'amber',
            title: 'Detailed Services Email',
            description: 'Share service packages and pricing guide',
            template_content: 'Hi {{client_name}},\n\nHere are our {{project_type}} packages...',
            template_variables: ['client_name', 'project_type'],
            action_config: { email: { subject: 'Our {{project_type}} Packages & Pricing' } },
          },
        ],
      },
      {
        day_number: 7,
        title: 'Personal Outreach Call',
        description: 'Initiate personal call with potential client',
        day_calc_mode: 'calendar_days',
        actions: [
          {
            action_type: 'auto_schedule_reminder',
            priority_level: 'red',
            title: 'Call {{client_name}} Today',
            description: 'Personal outreach call to discuss project',
            template_content: '',
            template_variables: ['client_name', 'client_phone'],
            action_config: { reminder: { type: 'call', phone: '{{client_phone}}' } },
          },
        ],
      },
      {
        day_number: 14,
        title: 'Proposal Follow-Up',
        description: 'Follow up on proposal or sent materials',
        day_calc_mode: 'calendar_days',
        actions: [
          {
            action_type: 'auto_follow_up_email',
            priority_level: 'amber',
            title: 'Proposal Check-In',
            description: 'Follow up on proposal and answer questions',
            template_content: 'Hi {{client_name}},\n\nJust checking in on your {{project_type}} project...',
            template_variables: ['client_name', 'project_type'],
            action_config: { email: { subject: 'Checking In - {{project_type}} Project' } },
          },
        ],
      },
      {
        day_number: 30,
        title: 'Re-engagement Final Push',
        description: 'Final attempt to engage unresponsive lead',
        day_calc_mode: 'calendar_days',
        actions: [
          {
            action_type: 'auto_follow_up_email',
            priority_level: 'green',
            title: 'Final Outreach',
            description: 'Last touch before marking as inactive',
            template_content: 'Hi {{client_name}},\n\nWe\'d love to help with your {{project_type}}...',
            template_variables: ['client_name', 'project_type'],
            action_config: { email: { subject: 'Last Chance - {{project_type}} Inquiry' } },
          },
        ],
      },
    ],
  },

  'post-shoot-delivery': {
    slug: 'post-shoot-delivery',
    name: 'Post-Shoot Delivery Workflow',
    description: '21-day workflow from shoot to final delivery',
    category: 'photography_workflow',
    duration_days: 21,
    milestones: [
      {
        day_number: 0,
        title: 'Thank You & Next Steps',
        description: 'Send thank you and set expectations',
        day_calc_mode: 'calendar_days',
        actions: [
          {
            action_type: 'auto_follow_up_email',
            priority_level: 'amber',
            title: 'Thank You Email',
            description: 'Thank client and set delivery expectations',
            template_content: 'Hi {{client_name}},\n\nThank you for choosing us for your {{project_type}}!...',
            template_variables: ['client_name', 'project_type'],
            action_config: { email: { subject: 'Thank You - {{project_type}} Session Complete' } },
          },
        ],
      },
      {
        day_number: 7,
        title: 'Photo Proofs & Preview',
        description: 'Share proofs and get feedback',
        day_calc_mode: 'calendar_days',
        actions: [
          {
            action_type: 'auto_follow_up_email',
            priority_level: 'red',
            title: 'Proofs Available for Review',
            description: 'Share proof gallery link and request feedback',
            template_content: 'Hi {{client_name}},\n\nYour {{project_type}} proofs are ready! Review and let us know your favorites...',
            template_variables: ['client_name', 'project_type', 'proof_link'],
            action_config: { email: { subject: 'Your {{project_type}} Proofs are Ready' } },
          },
        ],
      },
      {
        day_number: 14,
        title: 'Final Selections & Ordering',
        description: 'Receive final selections and share ordering options',
        day_calc_mode: 'calendar_days',
        actions: [
          {
            action_type: 'auto_follow_up_email',
            priority_level: 'amber',
            title: 'Ordering Options Available',
            description: 'Share finalized images and print/product options',
            template_content: 'Hi {{client_name}},\n\nThank you for your selections! Here are your print and product options...',
            template_variables: ['client_name'],
            action_config: { email: { subject: 'Your Photos Ready to Order' } },
          },
        ],
      },
      {
        day_number: 21,
        title: 'Final Delivery',
        description: 'Deliver final edited gallery and products',
        day_calc_mode: 'calendar_days',
        actions: [
          {
            action_type: 'auto_follow_up_email',
            priority_level: 'red',
            title: 'Final Delivery Complete',
            description: 'Deliver final gallery and thank you message',
            template_content: 'Hi {{client_name}},\n\nYour complete photo gallery and products are ready!...',
            template_variables: ['client_name', 'gallery_link'],
            action_config: { email: { subject: 'Your {{project_type}} Gallery is Complete' } },
          },
          {
            action_type: 'auto_crm_update',
            priority_level: 'green',
            title: 'Mark Booking as Completed',
            description: 'Close booking in CRM',
            template_content: '',
            template_variables: [],
            action_config: { crm: { status: 'completed' } },
          },
        ],
      },
    ],
  },
};
