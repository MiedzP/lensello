/**
 * Execution Routing Engine
 *
 * Core logic for routing actions to execution layers
 */

import type {
  ActionType,
  ExecutionLayer,
  PriorityLevel,
  RoutingDecision,
} from './types';
import { ACTION_TYPE_META, EXECUTION_LAYERS } from './types';

/**
 * Main routing decision function
 *
 * Given an action type and priority, determine which layer should handle it
 */
export function routeAction(
  actionType: ActionType,
  priorityLevel: PriorityLevel
): RoutingDecision {
  const meta = ACTION_TYPE_META[actionType];

  return {
    action_type: actionType,
    execution_layer: meta.execution_layer,
    assigned_to: getAssignmentFor(meta.execution_layer),
    priority_level: priorityLevel,
    reasoning: `Routed to ${meta.display_name} (${meta.execution_layer})`,
  };
}

/**
 * Determine who is assigned to a given layer
 */
export function getAssignmentFor(layer: ExecutionLayer): string | null {
  switch (layer) {
    case 'lensello_automation':
      return 'lensello'; // Automation queue
    case 'ai_intelligence':
      return 'ai'; // AI agents
    case 'team_execution':
      return null; // Unassigned; team picks it up
    case 'senior_strategist':
      return 'strategist'; // Fiona or senior team member
  }
}

/**
 * Get display information for a layer
 */
export function getLayerInfo(layer: ExecutionLayer) {
  return EXECUTION_LAYERS[layer];
}

/**
 * Get action type metadata
 */
export function getActionMeta(type: ActionType) {
  return ACTION_TYPE_META[type];
}

/**
 * Determine if an action should be escalated
 *
 * Returns the next layer to escalate to, or null if not ready to escalate
 */
export function shouldEscalate(
  currentLayer: ExecutionLayer,
  daysPending: number,
  failureCount: number = 0,
  aiConfidence?: number
): ExecutionLayer | null {
  // Rule 1: Time-based escalation
  switch (currentLayer) {
    case 'lensello_automation':
      if (daysPending > 30) return 'ai_intelligence';
      break;

    case 'ai_intelligence':
      // Escalate if too old OR low confidence
      if (daysPending > 14) return 'team_execution';
      if (aiConfidence !== undefined && aiConfidence < 0.6) {
        return 'team_execution';
      }
      break;

    case 'team_execution':
      if (daysPending > 7) return 'senior_strategist';
      if (failureCount >= 3) return 'senior_strategist';
      break;

    case 'senior_strategist':
      // Already at top; no escalation
      return null;
  }

  return null;
}

/**
 * Get escalation reason in human-readable form
 */
export function getEscalationReason(
  layer: ExecutionLayer,
  daysPending: number,
  failureCount: number = 0,
  aiConfidence?: number
): string {
  const nextLayer = shouldEscalate(layer, daysPending, failureCount, aiConfidence);

  if (!nextLayer) return '';

  if (layer === 'lensello_automation' && daysPending > 30) {
    return `Pending for ${daysPending} days (threshold: 30 days) - escalating to AI`;
  }

  if (layer === 'ai_intelligence') {
    if (daysPending > 14) {
      return `Draft pending ${daysPending} days (threshold: 14 days) - escalating to Team`;
    }
    if (aiConfidence !== undefined && aiConfidence < 0.6) {
      return `Low confidence (${Math.round(aiConfidence * 100)}%) - escalating to Team`;
    }
  }

  if (layer === 'team_execution') {
    if (daysPending > 7) {
      return `Task blocked for ${daysPending} days (threshold: 7 days) - escalating to Strategist`;
    }
    if (failureCount >= 3) {
      return `Failed ${failureCount} times (threshold: 3) - escalating to Strategist`;
    }
  }

  return '';
}

/**
 * Calculate SLA status for an action
 *
 * Returns the time until escalation and percentage of time used
 */
export function calculateSLA(
  layer: ExecutionLayer,
  createdAt: Date,
  now: Date = new Date()
): {
  threshold_days: number;
  days_elapsed: number;
  days_remaining: number;
  percentage_used: number;
  status: 'ok' | 'warning' | 'critical';
} {
  const info = getLayerInfo(layer);
  const threshold = info.escalation_threshold_days;

  const daysElapsed = Math.floor(
    (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysRemaining = Math.max(0, threshold - daysElapsed);
  const percentageUsed = threshold > 0 ? (daysElapsed / threshold) * 100 : 100;

  let status: 'ok' | 'warning' | 'critical';
  if (percentageUsed >= 100) {
    status = 'critical';
  } else if (percentageUsed >= 75) {
    status = 'warning';
  } else {
    status = 'ok';
  }

  return {
    threshold_days: threshold,
    days_elapsed: daysElapsed,
    days_remaining: daysRemaining,
    percentage_used: Math.round(percentageUsed),
    status,
  };
}

/**
 * Prioritize a queue of actions
 *
 * Returns actions sorted by urgency:
 * 1. RED priority + nearing escalation
 * 2. RED priority
 * 3. AMBER priority + nearing escalation
 * 4. AMBER priority
 * 5. GREEN priority
 */
export function prioritizeQueue(
  actions: Array<{
    id: string;
    priority_level: PriorityLevel;
    status: string;
    created_at: string;
    execution_layer: ExecutionLayer;
  }>,
  now: Date = new Date()
) {
  const scored = actions.map((action) => {
    const createdAt = new Date(action.created_at);
    const sla = calculateSLA(action.execution_layer, createdAt, now);

    const priorityScore = {
      red: 300,
      amber: 200,
      green: 100,
    }[action.priority_level];

    const urgencyScore = sla.status === 'critical' ? 100 : sla.status === 'warning' ? 50 : 0;

    return {
      ...action,
      score: priorityScore + urgencyScore + (100 - sla.percentage_used),
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Get recommended actions for a queue
 *
 * Returns the N most important actions that need attention
 */
export function getRecommendedActions(
  actions: Array<{
    id: string;
    title: string;
    priority_level: PriorityLevel;
    status: string;
    created_at: string;
    execution_layer: ExecutionLayer;
  }>,
  limit: number = 3,
  now: Date = new Date()
) {
  const active = actions.filter((a) => a.status === 'pending');
  const prioritized = prioritizeQueue(active, now);
  return prioritized.slice(0, limit);
}
