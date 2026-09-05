/**
 * Timeline Engine Server Actions
 *
 * Core scheduling logic for automated timeline workflows.
 * Handles template creation, milestone management, action queuing, and date calculations.
 */

'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  type TimelineTemplate,
  type TimelineMilestone,
  type MilestoneAction,
  type ScheduledTimeline,
  type ScheduledAction,
  type ActionTrigger,
  type CreateTimelineTemplateRequest,
  type AddMilestoneRequest,
  type AddActionRequest,
  type StartTimelineRequest,
  type CalculateMilestoneDateRequest,
  type CalculateMilestoneDateResponse,
  type GetScheduledActionsRequest,
  type GetScheduledActionsResponse,
  type TimelineEngineStats,
  type TimelineMetrics,
  type DayCalcMode,
} from './types';

// ============================================================================
// TEMPLATE MANAGEMENT
// ============================================================================

/**
 * Create a new reusable timeline template
 */
export async function createTimelineTemplate(
  photographerId: string,
  request: CreateTimelineTemplateRequest
): Promise<TimelineTemplate> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('timeline_templates')
    .insert({
      photographer_id: photographerId,
      slug: request.slug,
      name: request.name,
      description: request.description,
      category: request.category,
      duration_days: request.duration_days,
      auto_trigger_on: request.auto_trigger_on || [],
      timezone: request.timezone || 'UTC',
      metadata: request.metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create template: ${error.message}`);
  }

  return data as TimelineTemplate;
}

/**
 * Get a template by ID
 */
export async function getTimelineTemplate(templateId: string): Promise<TimelineTemplate> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('timeline_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch template: ${error.message}`);
  }

  return data as TimelineTemplate;
}

/**
 * Get all templates for a photographer
 */
export async function getPhotographerTemplates(
  photographerId: string,
  onlyActive: boolean = true
): Promise<TimelineTemplate[]> {
  const admin = createAdminClient();

  let query = admin
    .from('timeline_templates')
    .select('*')
    .eq('photographer_id', photographerId);

  if (onlyActive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.order('name');

  if (error) {
    throw new Error(`Failed to fetch templates: ${error.message}`);
  }

  return (data || []) as TimelineTemplate[];
}

// ============================================================================
// MILESTONE MANAGEMENT
// ============================================================================

/**
 * Add a milestone to a template
 */
export async function addMilestone(request: AddMilestoneRequest): Promise<TimelineMilestone> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('timeline_milestones')
    .insert({
      template_id: request.template_id,
      position: request.position,
      title: request.title,
      description: request.description,
      day_number: request.day_number,
      day_calc_mode: request.day_calc_mode || 'calendar_days',
      repeat_every_days: request.repeat_every_days,
      repeat_end_day: request.repeat_end_day,
      preferred_time: request.preferred_time,
      timezone: request.timezone,
      metadata: request.metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add milestone: ${error.message}`);
  }

  return data as TimelineMilestone;
}

/**
 * Get all milestones for a template
 */
export async function getTemplateMilestones(templateId: string): Promise<TimelineMilestone[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('timeline_milestones')
    .select('*')
    .eq('template_id', templateId)
    .order('position');

  if (error) {
    throw new Error(`Failed to fetch milestones: ${error.message}`);
  }

  return (data || []) as TimelineMilestone[];
}

// ============================================================================
// MILESTONE ACTION MANAGEMENT
// ============================================================================

/**
 * Add an action to a milestone
 */
export async function addAction(request: AddActionRequest): Promise<MilestoneAction> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('milestone_actions')
    .insert({
      milestone_id: request.milestone_id,
      action_type: request.action_type,
      priority_level: request.priority_level || 'green',
      title: request.title,
      description: request.description,
      template_content: request.template_content,
      template_variables: request.template_variables || [],
      action_config: request.action_config || {},
      position: request.position || 0,
      metadata: request.metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add action: ${error.message}`);
  }

  return data as MilestoneAction;
}

/**
 * Get all actions for a milestone
 */
export async function getMilestoneActions(milestoneId: string): Promise<MilestoneAction[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('milestone_actions')
    .select('*')
    .eq('milestone_id', milestoneId)
    .order('position');

  if (error) {
    throw new Error(`Failed to fetch actions: ${error.message}`);
  }

  return (data || []) as MilestoneAction[];
}

// ============================================================================
// TIMELINE ACTIVATION & SCHEDULING
// ============================================================================

/**
 * Calculate milestone date based on start date, day number, and calculation mode
 * Supports calendar days, business days, and timezone awareness
 */
export function calculateMilestoneDate(
  request: CalculateMilestoneDateRequest
): CalculateMilestoneDateResponse {
  const startDate = new Date(request.start_date + 'T00:00:00Z');
  let targetDate = new Date(startDate);

  if (request.day_calc_mode === 'calendar_days') {
    // Simple calendar day offset
    targetDate.setDate(targetDate.getDate() + request.day_number);
  } else if (request.day_calc_mode === 'business_days') {
    // Business days only (Mon-Fri)
    let daysToAdd = request.day_number;
    while (daysToAdd > 0) {
      targetDate.setDate(targetDate.getDate() + 1);
      const dayOfWeek = targetDate.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysToAdd--;
      }
    }
  }

  // Format date as YYYY-MM-DD
  const year = targetDate.getUTCFullYear();
  const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // Build timestamp with preferred time if provided
  let timestamp: Date;
  if (request.preferred_time) {
    const [hours, minutes, seconds] = request.preferred_time.split(':').map(Number);
    timestamp = new Date(targetDate);
    timestamp.setUTCHours(hours || 0, minutes || 0, seconds || 0, 0);
  } else {
    timestamp = new Date(targetDate);
    timestamp.setUTCHours(9, 0, 0, 0);  // Default to 9 AM
  }

  return {
    date: dateStr,
    time: request.preferred_time,
    timestamp: timestamp.toISOString(),
    timezone: request.timezone,
  };
}

/**
 * Start an active timeline for a client/project
 * Creates ScheduledTimeline and ScheduledActions for all milestones
 */
export async function startTimeline(
  photographerId: string,
  request: StartTimelineRequest
): Promise<ScheduledTimeline> {
  const admin = createAdminClient();

  // Get template with all milestones and actions
  const template = await getTimelineTemplate(request.template_id);
  const milestones = await getTemplateMilestones(request.template_id);

  // Create scheduled timeline
  const startDate = request.start_date || new Date().toISOString().split('T')[0];

  const { data: timeline, error: timelineError } = await admin
    .from('scheduled_timelines')
    .insert({
      photographer_id: photographerId,
      template_id: request.template_id,
      trigger_type: request.trigger_type,
      trigger_context: request.trigger_context,
      status: 'active',
      timezone: request.timezone || template.timezone,
      start_date: startDate,
      context: request.context || {},
      metadata: request.metadata || {},
    })
    .select()
    .single();

  if (timelineError) {
    throw new Error(`Failed to create timeline: ${timelineError.message}`);
  }

  const scheduledTimeline = timeline as ScheduledTimeline;

  // Create scheduled actions for each milestone and its actions
  for (const milestone of milestones) {
    const actions = await getMilestoneActions(milestone.id);

    for (const action of actions) {
      // Calculate scheduled date for this milestone
      const dateCalc = calculateMilestoneDate({
        start_date: startDate,
        day_number: milestone.day_number,
        day_calc_mode: milestone.day_calc_mode,
        timezone: request.timezone || template.timezone,
        preferred_time: milestone.preferred_time,
      });

      // Create scheduled action
      const { error: actionError } = await admin.from('scheduled_actions').insert({
        photographer_id: photographerId,
        scheduled_timeline_id: scheduledTimeline.id,
        milestone_id: milestone.id,
        milestone_action_id: action.id,
        scheduled_date: dateCalc.date,
        scheduled_time: dateCalc.time,
        scheduled_at: dateCalc.timestamp,
        status: 'pending',
      });

      if (actionError) {
        console.error(`Failed to create scheduled action: ${actionError.message}`);
      }
    }
  }

  return scheduledTimeline;
}

// ============================================================================
// SCHEDULED ACTIONS RETRIEVAL & EXECUTION
// ============================================================================

/**
 * Get scheduled actions with filtering
 */
export async function getScheduledActions(
  request: GetScheduledActionsRequest
): Promise<GetScheduledActionsResponse> {
  const admin = createAdminClient();

  let query = admin
    .from('scheduled_actions')
    .select(
      `*,
       timeline:scheduled_timelines(template_id),
       milestone:timeline_milestones(title),
       action:milestone_actions(title),
       template:timeline_templates!scheduled_timelines(name)`,
      { count: 'exact' }
    )
    .eq('photographer_id', request.photographer_id);

  // Apply filters
  if (request.status && request.status.length > 0) {
    query = query.in('status', request.status);
  }

  if (request.is_queued !== undefined) {
    query = query.eq('is_queued', request.is_queued);
  }

  if (request.is_prepared !== undefined) {
    query = query.eq('is_prepared', request.is_prepared);
  }

  if (request.scheduled_before) {
    query = query.lte('scheduled_at', request.scheduled_before);
  }

  if (request.scheduled_after) {
    query = query.gte('scheduled_at', request.scheduled_after);
  }

  // Apply limit and offset
  const limit = request.limit || 100;
  const offset = request.offset || 0;
  query = query.order('scheduled_at', { ascending: true }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch scheduled actions: ${error.message}`);
  }

  const actions = (data || []).map((action: any) => ({
    ...action,
    template_name: action.template?.[0]?.name || '',
    milestone_title: action.milestone?.title || '',
    action_title: action.action?.title || '',
  }));

  return {
    actions,
    total: count || 0,
  };
}

/**
 * Get actions due for execution (pending, not queued, scheduled_at <= now)
 */
export async function getDueActions(
  photographerId: string,
  limit: number = 100
): Promise<ScheduledAction[]> {
  const admin = createAdminClient();

  const now = new Date().toISOString();

  const { data, error } = await admin
    .from('scheduled_actions')
    .select('*')
    .eq('photographer_id', photographerId)
    .eq('status', 'pending')
    .eq('is_queued', false)
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch due actions: ${error.message}`);
  }

  return (data || []) as ScheduledAction[];
}

/**
 * Prepare a scheduled action by rendering templates with context
 */
export async function prepareScheduledAction(
  scheduledActionId: string,
  context: Record<string, any>
): Promise<ScheduledAction> {
  const admin = createAdminClient();

  // Get the scheduled action with milestone action details
  const { data: scheduledAction, error: fetchError } = await admin
    .from('scheduled_actions')
    .select(
      `*,
       milestone_action:milestone_actions(template_content, template_variables, action_config)`
    )
    .eq('id', scheduledActionId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch scheduled action: ${fetchError.message}`);
  }

  // Render template with context variables
  let renderedContent = scheduledAction.milestone_action.template_content || '';

  if (renderedContent) {
    // Simple template variable replacement: {{variable_name}} -> context.variable_name
    renderedContent = renderedContent.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return context[variable] || match;
    });
  }

  // Update scheduled action with prepared content
  const { data, error } = await admin
    .from('scheduled_actions')
    .update({
      is_prepared: true,
      prepared_at: new Date().toISOString(),
      prepared_content: {
        content: renderedContent,
        context,
        action_config: scheduledAction.milestone_action.action_config,
      },
    })
    .eq('id', scheduledActionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to prepare action: ${error.message}`);
  }

  return data as ScheduledAction;
}

/**
 * Queue a scheduled action to the execution routing system
 * Creates an entry in action_queue and updates scheduled_actions
 */
export async function queueScheduledAction(
  scheduledActionId: string,
  photographerId: string
): Promise<{ scheduled_action: ScheduledAction; action_queue_id: string }> {
  const admin = createAdminClient();

  // Get scheduled action with all related data
  const { data: scheduledAction, error: fetchError } = await admin
    .from('scheduled_actions')
    .select(
      `*,
       milestone_action:milestone_actions(*),
       milestone:timeline_milestones(title, description),
       timeline:scheduled_timelines(context, metadata)`
    )
    .eq('id', scheduledActionId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch scheduled action: ${fetchError.message}`);
  }

  // Create action queue entry (routes to Phase 3 execution routing)
  const { data: actionQueue, error: queueError } = await admin
    .from('action_queue')
    .insert({
      photographer_id: photographerId,
      action_type: scheduledAction.milestone_action.action_type,
      execution_layer: 'lensello_automation',  // Timeline actions are automation by default
      status: 'pending',
      priority_level: scheduledAction.milestone_action.priority_level || 'green',
      title: scheduledAction.milestone_action.title,
      description: scheduledAction.milestone_action.description,
      context: scheduledAction.prepared_content || {},
      ai_draft: null,
      ai_draft_metadata: {},
      created_at: new Date().toISOString(),
      created_by: 'timeline-engine',
      metadata: {
        scheduled_action_id: scheduledActionId,
        milestone_title: scheduledAction.milestone.title,
        timeline_context: scheduledAction.timeline.context,
      },
    })
    .select()
    .single();

  if (queueError) {
    throw new Error(`Failed to queue action: ${queueError.message}`);
  }

  // Update scheduled action with queue reference
  const { data: updated, error: updateError } = await admin
    .from('scheduled_actions')
    .update({
      is_queued: true,
      queued_at: new Date().toISOString(),
      action_queue_id: actionQueue.id,
    })
    .eq('id', scheduledActionId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update scheduled action: ${updateError.message}`);
  }

  return {
    scheduled_action: updated as ScheduledAction,
    action_queue_id: actionQueue.id,
  };
}

/**
 * Execute a scheduled action (mark as executed and update timeline)
 */
export async function executeScheduledAction(
  scheduledActionId: string,
  executionResult?: Record<string, any>
): Promise<ScheduledAction> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('scheduled_actions')
    .update({
      status: 'completed',
      executed_at: new Date().toISOString(),
      metadata: executionResult || {},
    })
    .eq('id', scheduledActionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to execute action: ${error.message}`);
  }

  return data as ScheduledAction;
}

// ============================================================================
// STATISTICS & MONITORING
// ============================================================================

/**
 * Get timeline engine statistics for dashboard
 */
export async function getTimelineEngineStats(
  photographerId: string
): Promise<TimelineEngineStats> {
  const admin = createAdminClient();

  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];

  // Get template counts
  const { count: totalTemplates } = await admin
    .from('timeline_templates')
    .select('*', { count: 'exact', head: true })
    .eq('photographer_id', photographerId);

  const { count: activeTemplates } = await admin
    .from('timeline_templates')
    .select('*', { count: 'exact', head: true })
    .eq('photographer_id', photographerId)
    .eq('is_active', true);

  // Get timeline counts
  const { count: totalTimelines } = await admin
    .from('scheduled_timelines')
    .select('*', { count: 'exact', head: true })
    .eq('photographer_id', photographerId);

  const { count: activeTimelines } = await admin
    .from('scheduled_timelines')
    .select('*', { count: 'exact', head: true })
    .eq('photographer_id', photographerId)
    .eq('status', 'active');

  const { count: completedTimelines } = await admin
    .from('scheduled_timelines')
    .select('*', { count: 'exact', head: true })
    .eq('photographer_id', photographerId)
    .eq('status', 'completed');

  // Get action counts
  const { count: pendingActions } = await admin
    .from('scheduled_actions')
    .select('*', { count: 'exact', head: true })
    .eq('photographer_id', photographerId)
    .eq('status', 'pending');

  const { count: preparedActions } = await admin
    .from('scheduled_actions')
    .select('*', { count: 'exact', head: true })
    .eq('photographer_id', photographerId)
    .eq('is_prepared', true);

  const { count: dueToday } = await admin
    .from('scheduled_actions')
    .select('*', { count: 'exact', head: true })
    .eq('photographer_id', photographerId)
    .eq('status', 'pending')
    .eq('is_queued', false)
    .eq('scheduled_date', today);

  const { count: overdue } = await admin
    .from('scheduled_actions')
    .select('*', { count: 'exact', head: true })
    .eq('photographer_id', photographerId)
    .eq('status', 'pending')
    .eq('is_queued', false)
    .lt('scheduled_date', today);

  return {
    total_templates: totalTemplates || 0,
    active_templates: activeTemplates || 0,
    total_timelines: totalTimelines || 0,
    active_timelines: activeTimelines || 0,
    completed_timelines: completedTimelines || 0,
    scheduled_actions_pending: pendingActions || 0,
    scheduled_actions_prepared: preparedActions || 0,
    scheduled_actions_due_today: dueToday || 0,
    scheduled_actions_overdue: overdue || 0,
  };
}

/**
 * Get metrics for a specific timeline
 */
export async function getTimelineMetrics(timelineId: string): Promise<TimelineMetrics> {
  const admin = createAdminClient();

  // Get timeline and template info
  const { data: timeline, error: timelineError } = await admin
    .from('scheduled_timelines')
    .select('*, template:timeline_templates(name)')
    .eq('id', timelineId)
    .single();

  if (timelineError) {
    throw new Error(`Failed to fetch timeline: ${timelineError.message}`);
  }

  // Get all actions for this timeline
  const { data: actions, error: actionsError } = await admin
    .from('scheduled_actions')
    .select('*')
    .eq('scheduled_timeline_id', timelineId);

  if (actionsError) {
    throw new Error(`Failed to fetch actions: ${actionsError.message}`);
  }

  const actionsData = actions || [];
  const completed = actionsData.filter((a) => a.status === 'completed').length;
  const total = actionsData.length;

  // Get milestones
  const { data: milestones } = await admin
    .from('timeline_milestones')
    .select('*', { count: 'exact' })
    .eq('template_id', timeline.template_id);

  const nextDueAction = actionsData
    .filter((a) => a.status === 'pending')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];

  const lastExecuted = actionsData
    .filter((a) => a.executed_at)
    .sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime())[0];

  return {
    timeline_id: timelineId,
    template_name: timeline.template?.name || '',
    status: timeline.status,
    progress_percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    milestones_completed: completed,
    milestones_total: milestones?.length || 0,
    actions_completed: completed,
    actions_total: total,
    next_milestone_due: nextDueAction?.scheduled_date,
    last_action_executed: lastExecuted?.executed_at,
  };
}
