'use client';

import { Card, CardBody, Badge } from '@/components/ui';
import { ChevronRight } from 'lucide-react';
import type { Priority } from '@/lib/execution-routing/types';

interface PriorityCardProps {
  priority: Priority;
}

const AREA_LABELS: Record<Priority['area'], string> = {
  position: 'Position',
  product: 'Product',
  visibility: 'Visibility',
  conversion: 'Conversion',
  nurture: 'Nurture',
  performance: 'Performance',
};

const STATUS_TONE: Record<Priority['status'], 'danger' | 'warning' | 'success'> =
{
  red: 'danger',
  amber: 'warning',
  green: 'success',
};

const STATUS_LABELS: Record<Priority['status'], string> = {
  red: 'Urgent',
  amber: 'Important',
  green: 'Monitor',
};

export function PriorityCard({ priority }: PriorityCardProps) {
  const areaLabel = AREA_LABELS[priority.area];
  const statusTone = STATUS_TONE[priority.status];
  const statusLabel = STATUS_LABELS[priority.status];

  return (
    <Card className="group cursor-pointer transition-colors hover:bg-subtle">
      <CardBody className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Badge tone={statusTone}>{statusLabel}</Badge>
            <span className="text-xs font-medium text-muted">
              {areaLabel}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground">
            {priority.insight}
          </p>
          {priority.recommended_action && (
            <p className="mt-2 text-xs text-accent">
              → {priority.recommended_action.title}
            </p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted transition-transform group-hover:translate-x-1" />
      </CardBody>
    </Card>
  );
}
