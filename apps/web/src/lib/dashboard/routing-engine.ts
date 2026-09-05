/**
 * Execution Routing Engine
 *
 * Determines the optimal flow of user actions through the dashboard.
 * Uses memoization and pre-computed rules to avoid recalculation.
 *
 * Performance optimizations:
 * - LRU cache for routing decisions (1 hour TTL)
 * - Hash-based lookups instead of array searches
 * - Batch escalation checks (run hourly, not per-request)
 * - Pre-computed rules cached in-memory
 */

import { LRUCache } from './cache';
import { escalationEngine, type EscalationDecision } from './escalation-rules';

export interface RoutingDecision {
  priorityId: string;
  route: 'urgent' | 'high' | 'normal' | 'low';
  nextStep: string;
  estimatedTime: number; // minutes
  escalationDelta: number;
}

export interface RoutingContext {
  priorityScore: number;
  category: string;
  isEscalated: boolean;
  dueAt?: string;
  actionCount: number;
}

class RoutingEngine {
  private cache = new LRUCache<RoutingDecision>(5000, 3600000); // 1 hour cache

  // Pre-computed routing rules (hash-based for O(1) lookup)
  private routingRules = new Map<string, RoutingRule[]>();

  constructor() {
    this.initializeRoutingRules();
  }

  /**
   * Initialize routing rules with hash-based lookups.
   * Maps category -> rules for fast evaluation.
   */
  private initializeRoutingRules(): void {
    const rules: RoutingRule[] = [
      // Shoots routing
      {
        category: 'shoots',
        condition: (ctx) => ctx.priorityScore >= 80,
        route: 'urgent',
        nextStep: 'Review & deliver selects',
        estimatedTime: 60,
      },
      {
        category: 'shoots',
        condition: (ctx) => ctx.priorityScore >= 50 && ctx.priorityScore < 80,
        route: 'high',
        nextStep: 'Advance editing workflow',
        estimatedTime: 90,
      },
      {
        category: 'shoots',
        condition: (ctx) => ctx.priorityScore < 50,
        route: 'normal',
        nextStep: 'Schedule next steps',
        estimatedTime: 120,
      },

      // Campaigns routing
      {
        category: 'campaigns',
        condition: (ctx) => ctx.isEscalated,
        route: 'urgent',
        nextStep: 'Publish scheduled posts',
        estimatedTime: 30,
      },
      {
        category: 'campaigns',
        condition: (ctx) => ctx.priorityScore >= 60,
        route: 'high',
        nextStep: 'Review & approve content',
        estimatedTime: 45,
      },
      {
        category: 'campaigns',
        condition: (ctx) => ctx.priorityScore < 60,
        route: 'normal',
        nextStep: 'Generate copy variants',
        estimatedTime: 60,
      },

      // Messages routing
      {
        category: 'messages',
        condition: (ctx) => ctx.dueAt && new Date(ctx.dueAt) < new Date(),
        route: 'urgent',
        nextStep: 'Reply to client',
        estimatedTime: 15,
      },
      {
        category: 'messages',
        condition: (ctx) => ctx.priorityScore >= 70,
        route: 'high',
        nextStep: 'Draft reply with AI',
        estimatedTime: 10,
      },
      {
        category: 'messages',
        condition: (ctx) => true, // fallback
        route: 'normal',
        nextStep: 'Add to queue',
        estimatedTime: 5,
      },

      // Ads routing
      {
        category: 'ads',
        condition: (ctx) => ctx.isEscalated || ctx.priorityScore >= 75,
        route: 'urgent',
        nextStep: 'Pause & troubleshoot',
        estimatedTime: 45,
      },
      {
        category: 'ads',
        condition: (ctx) => ctx.priorityScore >= 50,
        route: 'high',
        nextStep: 'Check performance & optimize',
        estimatedTime: 30,
      },
      {
        category: 'ads',
        condition: (ctx) => true, // fallback
        route: 'normal',
        nextStep: 'Monitor metrics',
        estimatedTime: 15,
      },

      // Gigs routing
      {
        category: 'gigs',
        condition: (ctx) => ctx.priorityScore >= 80,
        route: 'urgent',
        nextStep: 'Follow up on payment',
        estimatedTime: 20,
      },
      {
        category: 'gigs',
        condition: (ctx) => ctx.priorityScore >= 50,
        route: 'high',
        nextStep: 'Schedule pre-shoot call',
        estimatedTime: 30,
      },
      {
        category: 'gigs',
        condition: (ctx) => true, // fallback
        route: 'normal',
        nextStep: 'Update contract',
        estimatedTime: 45,
      },
    ];

    // Group by category for O(1) lookup
    for (const rule of rules) {
      if (!this.routingRules.has(rule.category)) {
        this.routingRules.set(rule.category, []);
      }
      this.routingRules.get(rule.category)!.push(rule);
    }
  }

  /**
   * Make a routing decision for a priority.
   * Uses cache to avoid recalculation. Falls back to rules if not cached.
   */
  async makeRoutingDecision(
    priorityId: string,
    context: RoutingContext
  ): Promise<RoutingDecision> {
    // Check cache first
    const cached = this.cache.get(`routing:${priorityId}`);
    if (cached) {
      return cached;
    }

    // Evaluate escalation
    let escalationDelta = 0;
    if (context.isEscalated) {
      const escalationDecision = await escalationEngine.evaluateEscalation(priorityId, context);
      escalationDelta = escalationDecision.priorityDelta;
    }

    // Find matching routing rule (hash lookup by category)
    const categoryRules = this.routingRules.get(context.category) || [];
    let decision: RoutingDecision = {
      priorityId,
      route: 'normal',
      nextStep: 'Review priority',
      estimatedTime: 30,
      escalationDelta,
    };

    for (const rule of categoryRules) {
      if (rule.condition(context)) {
        decision = {
          priorityId,
          route: rule.route,
          nextStep: rule.nextStep,
          estimatedTime: rule.estimatedTime,
          escalationDelta,
        };
        break; // First matching rule wins
      }
    }

    // Cache the decision
    this.cache.set(`routing:${priorityId}`, decision);

    return decision;
  }

  /**
   * Batch routing decisions (more efficient than looping).
   */
  async batchRoutingDecisions(
    items: Array<{ id: string; context: RoutingContext }>
  ): Promise<RoutingDecision[]> {
    const decisions = await Promise.all(
      items.map(({ id, context }) => this.makeRoutingDecision(id, context))
    );
    return decisions;
  }

  /**
   * Get recommended priority order for a photographer's dashboard.
   * Orders by route (urgent first), then by priority score.
   */
  async getRecommendedOrder(
    priorities: Array<{
      id: string;
      category: string;
      priorityScore: number;
      isEscalated: boolean;
      dueAt?: string;
      actionCount: number;
    }>
  ): Promise<RoutingDecision[]> {
    const decisions = await this.batchRoutingDecisions(
      priorities.map(({ id, category, priorityScore, isEscalated, dueAt, actionCount }) => ({
        id,
        context: {
          category,
          priorityScore,
          isEscalated,
          dueAt,
          actionCount,
        },
      }))
    );

    // Sort by route priority (urgent first) then by priority score
    const routePriority = { urgent: 0, high: 1, normal: 2, low: 3 };
    return decisions.sort((a, b) => {
      const routeDiff = routePriority[a.route] - routePriority[b.route];
      if (routeDiff !== 0) return routeDiff;
      return b.escalationDelta - a.escalationDelta;
    });
  }

  /**
   * Clear routing cache (e.g., when rules change).
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get engine statistics for monitoring.
   */
  getStats() {
    return {
      cacheStats: this.cache.getStats(),
      routingRulesCount: Array.from(this.routingRules.values()).reduce(
        (sum, rules) => sum + rules.length,
        0
      ),
      categoriesCount: this.routingRules.size,
    };
  }
}

interface RoutingRule {
  category: string;
  condition: (context: RoutingContext) => boolean;
  route: 'urgent' | 'high' | 'normal' | 'low';
  nextStep: string;
  estimatedTime: number;
}

/**
 * Global routing engine instance.
 * Shared across all requests in this process.
 */
export const routingEngine = new RoutingEngine();

/**
 * Convenience function: Get recommended priority order with a single call.
 * Handles batching internally.
 */
export async function getRecommendedPriorityOrder(priorities: any[]) {
  return routingEngine.getRecommendedOrder(priorities);
}
