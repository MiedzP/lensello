'use server';

import { requireUserOrRedirect } from '@/lib/auth';
import type { ActionType, ExecutionLayer, PriorityLevel } from '@/lib/execution-routing/types';

/**
 * Execute recommended action
 *
 * Creates an action in the action_queue and routes it to the appropriate execution layer
 */
export async function executeAction({
  title,
  action_type,
  execution_layer,
  description,
  priority_level = 'amber',
}: {
  title: string;
  action_type: ActionType;
  execution_layer: ExecutionLayer;
  description?: string;
  priority_level?: PriorityLevel;
}) {
  const { supabase, profile } = await requireUserOrRedirect();

  try {
    // Create action in queue
    const { data, error } = await supabase
      .from('action_queue')
      .insert([
        {
          photographer_id: profile.id,
          action_type,
          execution_layer,
          title,
          description,
          priority_level,
          status: 'pending',
          assigned_to: getAssignedTo(execution_layer),
          created_by: profile.full_name,
          context: {},
          ai_draft_metadata: {},
          escalation_threshold_days: 7,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Failed to create action:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      action_id: data.id,
      message: `Action created and routed to ${getLayerDisplayName(execution_layer)}`,
    };
  } catch (error) {
    console.error('Error executing action:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Route action: determine who should handle it
 *
 * Based on execution_layer, assign to the right queue/person
 */
function getAssignedTo(
  execution_layer: ExecutionLayer
): string | null {
  switch (execution_layer) {
    case 'lensello_automation':
      return 'lensello'; // Automation queue
    case 'ai_intelligence':
      return 'ai'; // AI agent queue
    case 'team_execution':
      return null; // Unassigned, waiting for team to pick up
    case 'senior_strategist':
      return 'strategist'; // Goes to Fiona
  }
}

/**
 * Get human-readable layer name
 */
function getLayerDisplayName(layer: ExecutionLayer): string {
  const names: Record<ExecutionLayer, string> = {
    lensello_automation: 'Lensello (Automation)',
    ai_intelligence: 'AI (Intelligence)',
    team_execution: 'Team (Execution)',
    senior_strategist: 'Senior Strategist',
  };
  return names[layer];
}

/**
 * Check escalation: actions that are pending too long should be escalated
 *
 * Called by a cron job periodically to detect stuck actions
 */
export async function checkEscalations() {
  const { supabase } = await requireUserOrRedirect();

  try {
    const now = new Date();

    // Find all pending actions that exceed their escalation threshold
    const { data: stuckActions, error } = await supabase
      .from('action_queue')
      .select('*')
      .eq('status', 'pending')
      .not('escalation_triggered_at', 'is', null);

    if (error) throw error;

    if (!stuckActions || stuckActions.length === 0) {
      return { escalated_count: 0 };
    }

    let escalatedCount = 0;

    for (const action of stuckActions) {
      const createdAt = new Date(action.created_at);
      const daysPending = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysPending > action.escalation_threshold_days) {
        // Escalate to next layer
        const nextLayer = getNextEscalationLayer(action.execution_layer);

        const { error: updateError } = await supabase
          .from('action_queue')
          .update({
            execution_layer: nextLayer,
            assigned_to: getAssignedTo(nextLayer),
            escalation_triggered_at: now.toISOString(),
            escalation_reason: `Pending for ${daysPending} days (threshold: ${action.escalation_threshold_days})`,
            status: 'escalated',
          })
          .eq('id', action.id);

        if (!updateError) {
          escalatedCount++;

          // Log the escalation
          await supabase
            .from('action_execution_log')
            .insert({
              action_id: action.id,
              status: 'escalated',
              executed_by: 'system',
              result: {
                escalated_from: action.execution_layer,
                escalated_to: nextLayer,
                reason: `Pending for ${daysPending} days`,
              },
            });
        }
      }
    }

    return { escalated_count: escalatedCount };
  } catch (error) {
    console.error('Error checking escalations:', error);
    throw error;
  }
}

/**
 * Determine next escalation layer
 */
function getNextEscalationLayer(currentLayer: ExecutionLayer): ExecutionLayer {
  switch (currentLayer) {
    case 'lensello_automation':
      return 'ai_intelligence';
    case 'ai_intelligence':
      return 'team_execution';
    case 'team_execution':
      return 'senior_strategist';
    case 'senior_strategist':
      // Already at top; stay here but mark as urgent
      return 'senior_strategist';
  }
}

/**
 * Refresh dashboard state
 *
 * Called by hourly cron job to update dashboard metrics and priorities
 */
export async function refreshDashboardState(photographer_id: string) {
  const { supabase } = await requireUserOrRedirect();

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString();

    // Query this month's stats
    const [
      enquiries,
      consultations,
      bookings,
    ] = await Promise.all([
      // New enquiries this month
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('stage', 'inquiry')
        .gte('created_at', monthStart),

      // Consultations booked this month (gigs with confirmed status)
      supabase
        .from('gigs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .gte('created_at', monthStart),

      // Weddings booked (subset of gigs with wedding type)
      supabase
        .from('gigs')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'wedding')
        .eq('status', 'confirmed')
        .gte('created_at', monthStart),
    ]);

    // Calculate pipeline value (sum of prices for pending gigs)
    const { data: pendingGigs } = await supabase
      .from('gigs')
      .select('price_cents')
      .in('status', ['inquiry', 'hold']);

    const pipelineValue = pendingGigs?.reduce(
      (sum, gig) => sum + (gig.price_cents || 0),
      0
    ) || 0;

    // Mock priorities (in real implementation, these come from Phase 2 diagnostic)
    const mockPriorities = [
      {
        area: 'nurture',
        status: 'red',
        insight: `Follow up ${Math.max(5, (enquiries.count || 0) - 2)} warm enquiries who haven't booked yet`,
        recommended_action: {
          title: 'Create nurture campaign',
          action_type: 'auto_follow_up_email',
        },
      },
      {
        area: 'visibility',
        status: 'red',
        insight: 'Your Meta creative needs refresh for better engagement',
        recommended_action: {
          title: 'Refresh Meta creative',
          action_type: 'ai_generate_variants',
        },
      },
      {
        area: 'conversion',
        status: 'amber',
        insight: 'Blog content about venue partnerships could drive bookings',
        recommended_action: {
          title: 'Publish venue article',
          action_type: 'team_content_schedule',
        },
      },
    ];

    // Upsert dashboard_state
    const { error } = await supabase.from('dashboard_state').upsert(
      {
        photographer_id,
        new_enquiries_this_month: enquiries.count || 0,
        consultations_booked_this_month: consultations.count || 0,
        bookings_this_month: bookings.count || 0,
        pipeline_value_cents: pipelineValue,
        top_3_priorities: mockPriorities,
        recommended_action: {
          title: 'Create nurture campaign for warm enquiries',
          description: `You have ${Math.max(5, (enquiries.count || 0) - 2)} past enquiries who haven't booked.`,
          impact: 'Could convert 5+ warm enquiries into bookings',
          estimated_time_minutes: 15,
          execution_layer: 'team_execution',
        },
        generated_at: now.toISOString(),
        refreshed_at: now.toISOString(),
      },
      { onConflict: 'photographer_id' }
    );

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error refreshing dashboard state:', error);
    throw error;
  }
}
