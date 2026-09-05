/**
 * Execution Routing Module
 *
 * Phase 3: Route work to the appropriate execution layer
 */

// Types
export type {
  Action,
  ActionExecutionLog,
  DashboardState,
  Priority,
  RecommendedAction,
  RoutingDecision,
  EscalationRule,
} from './types';

export {
  EXECUTION_LAYERS,
  ACTION_TYPE_META,
  DEFAULT_ESCALATION_RULES,
} from './types';

export type {
  ActionType,
  ExecutionLayer,
  PriorityLevel,
  ActionStatus,
} from './types';

// Routing engine
export {
  routeAction,
  getAssignmentFor,
  getLayerInfo,
  getActionMeta,
  shouldEscalate,
  getEscalationReason,
  calculateSLA,
  prioritizeQueue,
  getRecommendedActions,
} from './routing-engine';
