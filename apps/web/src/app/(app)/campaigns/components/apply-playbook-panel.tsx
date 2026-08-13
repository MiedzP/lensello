'use client';

import { useActionState, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, ErrorNote, Select } from '@/components/ui';
import { IDLE } from '@/lib/campaigns/action-state';
import type { CampaignPlaybookRow } from '@/lib/planner/types';
import { SEASON_LABELS, sortSeasons } from '@/lib/planner/display';
import { applyPlaybook } from '../planner-actions';

/**
 * "Planner templates for the different things" — applied to a campaign that
 * already exists, not just at creation. Lets a campaign pick up a plan later,
 * or run the same plan a second time to pick up any tasks a person added to
 * the template since (skipping whatever was already copied in).
 */
export function ApplyPlaybookPanel({
  campaignId,
  playbooks,
  hasStartDate,
  currentPlaybookName,
}: {
  campaignId: string;
  playbooks: CampaignPlaybookRow[];
  hasStartDate: boolean;
  currentPlaybookName: string | null;
}) {
  const [state, action, pending] = useActionState(applyPlaybook, IDLE);
  const [playbookId, setPlaybookId] = useState(playbooks[0]?.id ?? '');
  const seasons = sortSeasons([...new Set(playbooks.map((p) => p.season))]);

  if (playbooks.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Apply a plan"
        description={
          currentPlaybookName
            ? `Currently running “${currentPlaybookName}”. Applying again only adds tasks that were not copied in yet.`
            : 'Copies a plan’s tasks onto this campaign’s checklist, dated from its start date.'
        }
      />
      <form action={action}>
        <input type="hidden" name="campaignId" value={campaignId} />
        <CardBody className="space-y-3">
          {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}
          {state.message ? (
            <p role="status" className="text-sm text-success">
              {state.message}
            </p>
          ) : null}

          {!hasStartDate ? (
            <p className="text-xs text-warning">
              Set a start date on this campaign first — a plan’s tasks are dated
              from it.
            </p>
          ) : null}

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem]">
              <Select
                name="playbookId"
                value={playbookId}
                onChange={(event) => setPlaybookId(event.target.value)}
                aria-label="Choose a plan"
              >
                {seasons.map((season) => (
                  <optgroup key={season} label={SEASON_LABELS[season]}>
                    {playbooks
                      .filter((playbook) => playbook.season === season)
                      .map((playbook) => (
                        <option key={playbook.id} value={playbook.id}>
                          {playbook.cover_emoji ? `${playbook.cover_emoji} ` : ''}
                          {playbook.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
            </div>

            <Button type="submit" variant="primary" size="sm" disabled={pending || !hasStartDate}>
              <ClipboardList size={14} aria-hidden="true" />
              {pending ? 'Applying…' : 'Apply plan'}
            </Button>
          </div>
        </CardBody>
      </form>
    </Card>
  );
}
