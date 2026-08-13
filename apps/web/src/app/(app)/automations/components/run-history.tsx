import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { runStatusTone } from '@/lib/automations/display';
import { SKIP_REASON_LABELS, type AutomationRun, type AutomationRunStep, type SkipReason } from '@/lib/automations/types';

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

/**
 * Every run, newest first, expandable to the step that actually failed —
 * "why did this client get three messages" and "why did this never fire"
 * both have to be answerable from this one table, per the brief.
 */
export function RunHistory({
  runs,
  stepsByRun,
}: {
  runs: AutomationRun[];
  stepsByRun: Map<string, AutomationRunStep[]>;
}) {
  if (runs.length === 0) {
    return (
      <Card>
        <CardHeader title="Run history" />
        <EmptyState title="No runs yet" description="Once this fires — or you run it by hand — every attempt shows up here, including skipped ones." />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Run history" description="Newest first. Open a run to see each step." />
      <div className="divide-y divide-subtle">
        {runs.map((run) => {
          const steps = stepsByRun.get(run.id) ?? [];
          return (
            <details key={run.id} className="group px-5 py-3">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <Badge tone={runStatusTone(run.status)}>{run.status}</Badge>
                  <span className="text-foreground">{formatTimestamp(run.started_at)}</span>
                </span>
                {run.skip_reason ? (
                  <span className="text-xs text-muted">
                    {SKIP_REASON_LABELS[run.skip_reason as SkipReason] ?? run.skip_reason}
                  </span>
                ) : (
                  <span className="text-xs text-muted">{steps.length} step(s)</span>
                )}
              </summary>

              <div className="mt-3 space-y-2 pl-2">
                {run.error ? <p className="text-xs text-danger">{run.error}</p> : null}
                {steps.length === 0 ? (
                  <p className="text-xs text-faint">No steps recorded for this run.</p>
                ) : (
                  steps.map((step) => (
                    <div key={step.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-surface-raised px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge tone={runStatusTone(step.status)}>{step.status}</Badge>
                        <span className="text-foreground">{step.action_kind}</span>
                      </div>
                      <div className="max-w-md text-right text-muted">
                        {step.error ??
                          (step.output && typeof step.output === 'object' && 'reason' in step.output
                            ? String((step.output as { reason?: unknown }).reason)
                            : null)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </details>
          );
        })}
      </div>
    </Card>
  );
}
