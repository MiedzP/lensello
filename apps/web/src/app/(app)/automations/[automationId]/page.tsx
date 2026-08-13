import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { z } from 'zod';
import { PageHeader } from '@/components/ui';
import { requireUserOrRedirect } from '@/lib/auth';
import { getAutomationDetail, listRecentRuns, listRunStepsForRuns } from '@/lib/automations/queries';
import { TRIGGER_MECHANISM } from '@/lib/automations/types';
import { AddStepForm } from '../components/add-step-form';
import { AutomationSettingsForm } from '../components/automation-settings-form';
import { DeleteAutomationButton } from '../components/delete-automation-button';
import { EnableToggle } from '../components/enable-toggle';
import { PreviewPanel } from '../components/preview-panel';
import { RunHistory } from '../components/run-history';
import { RunNowForm } from '../components/run-now-form';
import { StepEditor } from '../components/step-editor';
import { TriggerConfigForm } from '../components/trigger-config-form';

export const metadata: Metadata = { title: 'Automation' };

export default async function AutomationDetailPage(props: PageProps<'/automations/[automationId]'>) {
  const { supabase } = await requireUserOrRedirect();
  const { automationId } = await props.params;

  if (!z.uuid().safeParse(automationId).success) notFound();

  const detail = await getAutomationDetail(supabase, automationId);
  if (!detail) notFound();

  const { automation, steps } = detail;
  const runs = await listRecentRuns(supabase, automationId);
  const stepsByRun = await listRunStepsForRuns(supabase, runs.map((run) => run.id));

  return (
    <>
      <Link
        href="/automations"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ChevronLeft size={15} aria-hidden="true" />
        Automations
      </Link>

      <PageHeader
        title={automation.name}
        description={
          TRIGGER_MECHANISM[automation.trigger_kind] === 'polled'
            ? 'Checked once a day by a scheduled job — see the trigger card for details.'
            : 'Fires from the event it is set to, when the event actually calls in — see the report for what is wired up so far.'
        }
        action={
          <div className="flex items-center gap-2">
            <EnableToggle automationId={automation.id} enabled={automation.enabled} />
            <DeleteAutomationButton automationId={automation.id} name={automation.name} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <AutomationSettingsForm automation={automation} />
          <TriggerConfigForm automation={automation} />

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Steps</h2>
            {steps.map((step, index) => (
              <StepEditor
                key={step.id}
                step={step}
                index={index}
                isFirst={index === 0}
                isLast={index === steps.length - 1}
                automationId={automation.id}
              />
            ))}
            <AddStepForm automationId={automation.id} />
          </div>

          <RunHistory runs={runs} stepsByRun={stepsByRun} />
        </div>

        <div className="space-y-5">
          <PreviewPanel automation={automation} steps={steps} />
          <RunNowForm automationId={automation.id} automationName={automation.name} enabled={automation.enabled} />
        </div>
      </div>
    </>
  );
}
