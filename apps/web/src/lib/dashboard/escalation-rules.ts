/**
 * Escalation Rules Engine
 * Pre-computes escalation decisions hourly and caches them.
 * This prevents N+1 queries and expensive rule evaluation on every request.
 */

import { createClient } from '@/lib/supabase/server';
import { LRUCache } from './cache';

export interface EscalationRule {
  id: string;
  ruleName: string;
  condition: string;
  priorityDelta: number;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationDecision {
  priorityId: string;
  shouldEscalate: boolean;
  priorityDelta: number;
  reason: string;
}

class EscalationRulesEngine {
  private rules: EscalationRule[] = [];
  private lastComputed = 0;
  private computeInterval = 3600000; // 1 hour in milliseconds
  private cache = new LRUCache<EscalationDecision>(5000, 3600000);

  /**
   * Get escalation rules, fetching from DB if stale (older than 1 hour).
   * Cached in-memory to avoid repeated DB queries.
   */
  async getEscalationRules(): Promise<EscalationRule[]> {
    const now = Date.now();

    // Check if cached rules are still fresh (< 1 hour old)
    if (this.rules.length > 0 && now - this.lastComputed < this.computeInterval) {
      return this.rules;
    }

    // Rules are stale or empty, fetch from database
    this.rules = await this.fetchRulesFromDB();
    this.lastComputed = now;

    return this.rules;
  }

  /**
   * Fetch escalation rules from database.
   * Only fetches active rules, ordered by priority.
   */
  private async fetchRulesFromDB(): Promise<EscalationRule[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('escalation_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority_delta', { ascending: false });

    if (error) {
      console.error('[Escalation Rules] DB fetch error:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      ruleName: row.rule_name,
      condition: row.condition,
      priorityDelta: row.priority_delta,
      category: row.category,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Evaluate if a priority should be escalated based on its data.
   * Uses rule conditions to determine escalation and priority adjustment.
   *
   * This is a simplified example. Real implementation would parse conditions
   * and match against priority data (e.g., "shoot_status = delivered AND pending_selects > 0").
   */
  async evaluateEscalation(
    priorityId: string,
    priorityData: Record<string, any>
  ): Promise<EscalationDecision> {
    // Check cache first
    const cached = this.cache.get(`escalation:${priorityId}`);
    if (cached) {
      return cached;
    }

    const rules = await this.getEscalationRules();
    const category = priorityData.category;
    const relevantRules = rules.filter((r) => r.category === category || r.category === '*');

    let shouldEscalate = false;
    let maxDelta = 0;
    let reason = 'no escalation rules matched';

    // Evaluate each rule
    for (const rule of relevantRules) {
      if (this.matchesCondition(rule.condition, priorityData)) {
        shouldEscalate = true;
        if (rule.priorityDelta > maxDelta) {
          maxDelta = rule.priorityDelta;
          reason = rule.ruleName;
        }
      }
    }

    const decision: EscalationDecision = {
      priorityId,
      shouldEscalate,
      priorityDelta: maxDelta,
      reason,
    };

    // Cache the decision
    this.cache.set(`escalation:${priorityId}`, decision);

    return decision;
  }

  /**
   * Match a condition string against priority data.
   * Simple string matching for common cases. Could be extended with a real parser.
   *
   * Examples:
   * - "status = delivered AND pending_count = 0"
   * - "due_at < now() AND status != completed"
   * - "category = shoots"
   */
  private matchesCondition(condition: string, data: Record<string, any>): boolean {
    // This is a simplified matcher. A production system might use a library
    // like json-logic-js or a custom expression parser.

    const conditions = condition.split(' AND ');

    for (const cond of conditions) {
      const trimmed = cond.trim();

      // Simple equality check
      if (trimmed.includes('=')) {
        const [key, value] = trimmed.split('=').map((s) => s.trim());
        const dataValue = data[key];

        if (value === 'null' && dataValue !== null) return false;
        if (value === 'true' && dataValue !== true) return false;
        if (value === 'false' && dataValue !== false) return false;
        if (!['null', 'true', 'false'].includes(value) && dataValue !== value) {
          return false;
        }
      }

      // Greater than
      if (trimmed.includes('>')) {
        const [key, value] = trimmed.split('>').map((s) => s.trim());
        if (data[key] <= Number(value)) return false;
      }

      // Less than
      if (trimmed.includes('<')) {
        const [key, value] = trimmed.split('<').map((s) => s.trim());
        if (data[key] >= Number(value)) return false;
      }
    }

    return true;
  }

  /**
   * Invalidate the rules cache (e.g., when rules are updated).
   * Call this after updating escalation rules in the database.
   */
  invalidateRules(): void {
    this.rules = [];
    this.lastComputed = 0;
    this.cache.clear();
  }

  /**
   * Get cache statistics for monitoring.
   */
  getStats() {
    return {
      rulesCount: this.rules.length,
      rulesCacheAge: Date.now() - this.lastComputed,
      cacheStats: this.cache.getStats(),
    };
  }
}

/**
 * Global escalation engine instance.
 * Shared across all requests in this process.
 */
export const escalationEngine = new EscalationRulesEngine();

/**
 * Batch evaluate escalation for multiple priorities.
 * More efficient than calling evaluateEscalation in a loop.
 */
export async function batchEvaluateEscalations(
  priorityDataArray: Array<{ id: string; data: Record<string, any> }>
): Promise<EscalationDecision[]> {
  const decisions = await Promise.all(
    priorityDataArray.map(({ id, data }) => escalationEngine.evaluateEscalation(id, data))
  );

  return decisions;
}

/**
 * Refresh escalation rules cache.
 * Call periodically (e.g., via cron job) to pull latest rules from database.
 */
export async function refreshEscalationRules() {
  escalationEngine.invalidateRules();
  const rules = await escalationEngine.getEscalationRules();
  console.log(`[Escalation Rules] Refreshed ${rules.length} rules`);
  return { rulesCount: rules.length };
}
