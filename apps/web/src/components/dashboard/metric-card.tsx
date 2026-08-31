'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/ui';
import type { Tone } from '@/components/ui/badge';
import { Badge } from '@/components/ui/badge';

/**
 * Reusable metric widget for dashboard statistics.
 * Displays a label, value, optional icon/color, and hint.
 */
export function MetricCard({
  label,
  value,
  icon,
  color,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: Tone;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              {label}
            </p>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
              {value}
            </div>
            {hint && (
              <p className="mt-1 text-xs text-muted">
                {hint}
              </p>
            )}
          </div>
          {icon && (
            <div className="ml-3 shrink-0">
              {color ? (
                <Badge tone={color} className="text-base">
                  {icon}
                </Badge>
              ) : (
                <div className="text-2xl text-muted">
                  {icon}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
