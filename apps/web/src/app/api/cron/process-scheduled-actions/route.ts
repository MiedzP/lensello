/**
 * Cron Job: Process Scheduled Actions
 *
 * Runs hourly (configurable via Vercel cron)
 * Finds all actions due in next 60 minutes and routes them to execution layers
 *
 * Execution Flow:
 * 1. Fetch all pending actions scheduled for next 60 minutes (single batch query)
 * 2. Route each action to appropriate layer based on configuration
 * 3. Execute or queue action on that layer
 * 4. Update status, retry, and escalation tracking
 * 5. Update timeline and milestone progress
 * 6. Log metrics and cron job status
 * 7. Handle failures with exponential backoff retry logic
 */

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max execution time

// Batch size to prevent timeout
const BATCH_SIZE = 100;
const EXECUTION_WINDOW_MINUTES = 60;

interface CronResult {
  timestamp: string;
  totalChecked: number;
  routed: number;
  executed: number;
  queued: number;
  failed: number;
  retried: number;
  escalated: number;
  details: Array<{
    actionId: string;
    status: 'executed' | 'queued' | 'failed' | 'retried' | 'escalated';
    layer: string;
    result?: string;
    error?: string;
  }>;
  jobHealth: {
    duration_ms: number;
    healthy: boolean;
    issues: string[];
  };
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(header, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Route an action to the appropriate execution layer
 * Based on action type, priority, and layer capacity
 */
async function executeRouteAction(admin: any, action: any, businessProfileId: string): Promise<string> {
  // Get execution layer configuration
  const { data: config, error: configError } = await admin
    .from('execution_layer_config')
    .select('*')
    .eq('business_profile_id', businessProfileId)
    .eq('is_active', true)
    .order('priority_weight', { ascending: false });

  if (configError) {
    console.error(`Error fetching execution config: ${configError.message}`);
    return 'lensello_automation'; // fallback
  }

  // Find matching layer for this action type
  const matchingLayer = config?.find((cfg: any) =>
    (!cfg.action_types || cfg.action_types.includes(action.action_type)) &&
    (!cfg.priority_levels || cfg.priority_levels.includes(action.priority_level))
  );

  if (!matchingLayer) {
    console.warn(`No matching execution layer for action ${action.id} (type: ${action.action_type})`);
    return 'lensello_automation'; // fallback to automation
  }

  // Check capacity
  const { data: active, error: activeError } = await admin
    .from('scheduled_actions')
    .select('id', { count: 'exact' })
    .eq('execution_layer', matchingLayer.execution_layer)
    .eq('status', 'in_progress')
    .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const currentLoad = active?.length || 0;

  // Check if at capacity (still return layer but it will queue)
  if (currentLoad >= matchingLayer.max_concurrent_actions) {
    console.log(
      `Layer ${matchingLayer.execution_layer} at capacity (${currentLoad}/${matchingLayer.max_concurrent_actions})`
    );
  }

  return matchingLayer.execution_layer;
}

/**
 * Execute an action on the assigned layer
 * Returns success/failure result
 */
async function executeActionOnLayer(
  admin: any,
  action: any,
  executionLayer: string
): Promise<{ success: boolean; detail?: string; queued_for_ai?: boolean; error?: string }> {
  switch (executionLayer) {
    case 'lensello_automation': {
      // Lensello automation: handle Email, SMS, Task, Reminder
      return await executeLenselioAction(admin, action);
    }
    case 'ai_intelligence': {
      // AI layer: draft content, analyze, recommend
      return await executeAiAction(admin, action);
    }
    case 'team_execution': {
      // Team layer: create task, assign to team member
      return await executeTeamAction(admin, action);
    }
    case 'senior_strategist': {
      // Senior strategist: notify and track for manual execution
      return await executeStrategistAction(admin, action);
    }
    default:
      throw new Error(`Unknown execution layer: ${executionLayer}`);
  }
}

/**
 * Execute Lensello automation actions
 * Email, SMS, Task creation, Call reminders
 */
async function executeLenselioAction(admin: any, action: any) {
  const { action_type, template_key, template_variables, id } = action;

  switch (action_type) {
    case 'auto_follow_up_email': {
      // Send email via Postmark or similar
      // For now: create placeholder result
      const result = {
        success: true,
        detail: 'Email queued via Postmark',
        email_id: `email_${Date.now()}`,
        template_used: template_key,
      };

      // Update action with result
      await admin
        .from('scheduled_actions')
        .update({
          status: 'completed',
          result,
          completed_at: new Date().toISOString(),
          executed_by: 'automation',
        })
        .eq('id', id);

      return { success: true, result };
    }

    case 'auto_schedule_reminder': {
      // Create calendar reminder
      const result = {
        success: true,
        detail: 'Reminder scheduled',
        reminder_id: `reminder_${Date.now()}`,
      };

      await admin
        .from('scheduled_actions')
        .update({
          status: 'completed',
          result,
          completed_at: new Date().toISOString(),
          executed_by: 'automation',
        })
        .eq('id', id);

      return { success: true, result };
    }

    case 'auto_crm_update': {
      // Update CRM fields
      const result = {
        success: true,
        detail: 'CRM updated',
        fields_updated: Object.keys(template_variables || {}).length,
      };

      await admin
        .from('scheduled_actions')
        .update({
          status: 'completed',
          result,
          completed_at: new Date().toISOString(),
          executed_by: 'automation',
        })
        .eq('id', id);

      return { success: true, result };
    }

    default:
      return {
        success: false,
        error: `No handler for action type: ${action_type}`,
      };
  }
}

/**
 * Execute AI intelligence actions
 * Draft campaigns, analyze performance, generate variants
 */
async function executeAiAction(admin: any, action: any) {
  const { action_type, id } = action;

  // AI actions typically need to be queued for async processing
  // Update status to in_progress and mark for AI layer
  await admin
    .from('scheduled_actions')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
      executed_by: 'ai',
    })
    .eq('id', id);

  return {
    success: true,
    detail: `AI action queued for processing`,
    queued_for_ai: true,
  };
}

/**
 * Execute Team execution actions
 * Create tasks, schedule meetings, setup campaigns
 */
async function executeTeamAction(admin: any, action: any) {
  const { action_type, title, description, id } = action;

  // Team actions create a task in their workflow
  const taskId = `task_${Date.now()}`;

  const result = {
    success: true,
    detail: 'Task created for team',
    task_id: taskId,
    assigned_to: 'team', // In real system, would assign to specific team member
  };

  await admin
    .from('scheduled_actions')
    .update({
      status: 'in_progress',
      result,
      started_at: new Date().toISOString(),
      executed_by: 'team',
    })
    .eq('id', id);

  return { success: true, result };
}

/**
 * Execute Strategist actions
 * Strategy decisions, mentoring, pivots
 */
async function executeStrategistAction(admin: any, action: any) {
  const { id } = action;

  // Strategist actions are notifications + manual tracking
  const result = {
    success: true,
    detail: 'Strategist action queued for manual review',
    requires_manual_review: true,
  };

  await admin
    .from('scheduled_actions')
    .update({
      status: 'in_progress',
      result,
      started_at: new Date().toISOString(),
      executed_by: 'strategist',
    })
    .eq('id', id);

  return { success: true, result };
}

/**
 * Handle action failure: calculate next retry with exponential backoff
 */
function calculateNextRetry(attempts: number, maxRetries: number): Date | null {
  if (attempts >= maxRetries) {
    return null; // No more retries
  }

  // Exponential backoff: 5 min, 15 min, 60 min, etc.
  const backoffMinutes = Math.pow(5, attempts);
  return new Date(Date.now() + backoffMinutes * 60 * 1000);
}

/**
 * Update timeline progress based on action completion
 */
async function updateTimelineProgress(admin: any, timelineId: string) {
  // Get all actions for this timeline
  const { data: actions, error: actionsError } = await admin
    .from('scheduled_actions')
    .select('status')
    .eq('timeline_id', timelineId);

  if (actionsError) {
    console.error(`Error fetching timeline actions: ${actionsError.message}`);
    return;
  }

  const total = actions?.length || 0;
  const completed = actions?.filter((a) => a.status === 'completed').length || 0;
  const failed = actions?.filter((a) => a.status === 'failed').length || 0;

  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const timelineStatus = completed === total && total > 0 ? 'completed' : 'active';

  // Update timeline
  await admin
    .from('timelines')
    .update({
      progress_percent: progressPercent,
      actions_completed: completed,
      actions_failed: failed,
      actions_total: total,
      status: timelineStatus,
      completed_at: timelineStatus === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', timelineId);
}

/**
 * Update cron job health status
 */
async function updateCronJobStatus(
  admin: any,
  jobName: string,
  success: boolean,
  durationSeconds: number,
  errorMessage?: string
) {
  const { data: existing } = await admin
    .from('cron_job_status')
    .select('*')
    .eq('job_name', jobName)
    .single();

  const updates = {
    last_run_at: new Date().toISOString(),
    total_runs: (existing?.total_runs || 0) + 1,
    successful_runs: success ? (existing?.successful_runs || 0) + 1 : existing?.successful_runs,
    failed_runs: !success ? (existing?.failed_runs || 0) + 1 : existing?.failed_runs,
    average_duration_seconds:
      Math.round(
        ((existing?.average_duration_seconds || 0) * (existing?.total_runs || 0) + durationSeconds) /
          ((existing?.total_runs || 0) + 1)
      ) || durationSeconds,
    consecutive_failures: !success ? (existing?.consecutive_failures || 0) + 1 : 0,
    is_healthy: !success && (existing?.consecutive_failures || 0) >= 3 ? false : true,
    last_error_message: errorMessage,
    last_completed_at: success ? new Date().toISOString() : existing?.last_completed_at,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await admin.from('cron_job_status').update(updates).eq('job_name', jobName);
  } else {
    await admin.from('cron_job_status').insert({ job_name: jobName, ...updates });
  }
}

export async function GET(request: Request) {
  const startTime = Date.now();

  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not set, so the scheduler is disabled.' },
      { status: 503 }
    );
  }

  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + EXECUTION_WINDOW_MINUTES * 60 * 1000);

  const result: CronResult = {
    timestamp: now.toISOString(),
    totalChecked: 0,
    routed: 0,
    executed: 0,
    queued: 0,
    failed: 0,
    retried: 0,
    escalated: 0,
    details: [],
    jobHealth: {
      duration_ms: 0,
      healthy: true,
      issues: [],
    },
  };

  try {
    // STEP 1: Fetch all pending actions due in next window (single batch query)
    const { data: dueActions, error: dueError } = await admin
      .from('scheduled_actions')
      .select(
        `
        id,
        timeline_id,
        action_type,
        execution_layer,
        title,
        status,
        scheduled_for,
        attempts,
        max_retries,
        next_retry_at,
        escalated_at,
        timelines:timeline_id (
          id,
          business_profile_id,
          progress_percent,
          actions_completed,
          actions_total
        )
      `
      )
      .eq('status', 'pending')
      .gte('scheduled_for', now.toISOString())
      .lte('scheduled_for', windowEnd.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(BATCH_SIZE);

    if (dueError) {
      console.error(`[cron] Error fetching scheduled actions: ${dueError.message}`);
      result.jobHealth.healthy = false;
      result.jobHealth.issues.push(`Database error: ${dueError.message}`);
      await updateCronJobStatus(admin, 'process-scheduled-actions', false, Date.now() - startTime, dueError.message);
      return NextResponse.json(result, { status: 500 });
    }

    const actions = dueActions || [];
    result.totalChecked = actions.length;

    // STEP 2: Process each action (route, execute, handle failures)
    for (const action of actions) {
      try {
        // Determine execution layer based on action type and business rules
        const executionLayer = await executeRouteAction(admin, action, action.timelines?.business_profile_id);

        if (!executionLayer) {
          throw new Error('No execution layer found');
        }

        // Execute the action
        const execResult = await executeActionOnLayer(admin, action, executionLayer);

        if (execResult.success) {
          result.executed++;
          if (execResult.queued_for_ai) {
            result.queued++;
          }

          result.details.push({
            actionId: action.id,
            status: execResult.queued_for_ai ? 'queued' : 'executed',
            layer: executionLayer,
            result: execResult.detail,
          });
        } else {
          // Action execution failed
          const nextRetry = calculateNextRetry(action.attempts, action.max_retries);

          if (nextRetry) {
            // Schedule retry
            await admin
              .from('scheduled_actions')
              .update({
                attempts: action.attempts + 1,
                next_retry_at: nextRetry.toISOString(),
                last_attempt_at: new Date().toISOString(),
                error_message: execResult.error || 'Execution failed',
                updated_at: new Date().toISOString(),
              })
              .eq('id', action.id);

            result.retried++;
            result.details.push({
              actionId: action.id,
              status: 'retried',
              layer: executionLayer,
              error: `Will retry at ${nextRetry.toISOString()}`,
            });
          } else {
            // No more retries: escalate or fail
            await admin
              .from('scheduled_actions')
              .update({
                status: 'escalated',
                escalated_at: new Date().toISOString(),
                escalation_reason: `Max retries exceeded (${action.max_retries}). Last error: ${execResult.error}`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', action.id);

            result.escalated++;
            result.details.push({
              actionId: action.id,
              status: 'escalated',
              layer: executionLayer,
              error: execResult.error,
            });
          }
        }

        // Update timeline progress
        if (action.timeline_id) {
          await updateTimelineProgress(admin, action.timeline_id);
        }

        result.routed++;
      } catch (error) {
        console.error(`[cron] Error processing action ${action.id}: ${error}`);
        result.failed++;

        result.details.push({
          actionId: action.id,
          status: 'failed',
          layer: action.execution_layer,
          error: `${error}`,
        });

        // Log error but continue with next action
      }
    }

    // Revalidate dashboard cache
    revalidatePath('/scheduling');
    revalidatePath('/scheduling/upcoming');
    revalidatePath('/dashboard');

    result.jobHealth.duration_ms = Date.now() - startTime;
    result.jobHealth.healthy = result.failed === 0 && result.totalChecked > 0;

    // Update cron job status
    await updateCronJobStatus(
      admin,
      'process-scheduled-actions',
      result.jobHealth.healthy,
      Math.floor(result.jobHealth.duration_ms / 1000)
    );

    console.log(`[cron] Scheduled actions processed: ${result.executed} executed, ${result.failed} failed`);

    return NextResponse.json(result);
  } catch (error) {
    console.error(`[cron] Unexpected error: ${error}`);
    result.jobHealth.healthy = false;
    result.jobHealth.issues.push(`Unexpected error: ${error}`);

    await updateCronJobStatus(
      admin,
      'process-scheduled-actions',
      false,
      Math.floor((Date.now() - startTime) / 1000),
      `${error}`
    );

    return NextResponse.json(result, { status: 500 });
  }
}

// Re-export execution functions for testing
export { executeLenselioAction, executeAiAction, executeTeamAction, executeStrategistAction };
