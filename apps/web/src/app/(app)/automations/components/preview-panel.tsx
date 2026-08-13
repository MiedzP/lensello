import { Card, CardBody, CardHeader } from '@/components/ui';
import { buildPreview } from '@/lib/automations/display';
import type { Automation, AutomationStep } from '@/lib/automations/types';

/** The "what will this actually do" summary the brief asks for — plain sentences, no JSON. */
export function PreviewPanel({ automation, steps }: { automation: Automation; steps: AutomationStep[] }) {
  const lines = buildPreview(automation, steps);

  return (
    <Card>
      <CardHeader title="What this actually does" description="In order, exactly as it will run." />
      <CardBody>
        <ol className="space-y-1.5 text-sm text-foreground">
          {lines.map((line, index) => (
            <li key={index} className={index < 3 ? 'text-muted' : undefined}>
              {line}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
