'use client';

import { formatDate } from 'date-fns';
import { Card } from '@/components/ui';

export interface TimelineMilestone {
  id: string;
  title: string;
  days_offset?: number;
  scheduled_date?: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  actionCount?: number;
}

interface TimelinePreviewProps {
  milestones: TimelineMilestone[];
  startDate?: Date;
  compact?: boolean;
}

/**
 * Visual timeline preview showing milestones in chronological order
 * Shows both day offset and calculated dates if startDate provided
 */
export function TimelinePreview({
  milestones,
  startDate,
  compact = false,
}: TimelinePreviewProps) {
  if (milestones.length === 0) {
    return (
      <Card>
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-muted">
            No milestones added yet. Add your first milestone to get started.
          </p>
        </div>
      </Card>
    );
  }

  const statusColors = {
    pending: 'bg-slate-200 dark:bg-slate-700',
    in_progress: 'bg-blue-200 dark:bg-blue-900',
    completed: 'bg-green-200 dark:bg-green-900',
  };

  const statusBgColors = {
    pending: 'bg-slate-100 dark:bg-slate-800',
    in_progress: 'bg-blue-50 dark:bg-blue-950',
    completed: 'bg-green-50 dark:bg-green-950',
  };

  const sortedMilestones = [...milestones].sort((a, b) => {
    const aOffset = a.days_offset ?? 0;
    const bOffset = b.days_offset ?? 0;
    return aOffset - bOffset;
  });

  if (compact) {
    return (
      <div className="flex gap-2 overflow-x-auto py-2">
        {sortedMilestones.map((milestone) => (
          <div
            key={milestone.id}
            className={`flex-shrink-0 w-20 rounded-md p-2 text-center ${
              statusBgColors[milestone.status || 'pending']
            }`}
          >
            <div className="text-xs font-semibold text-foreground line-clamp-1">
              {milestone.title}
            </div>
            {milestone.days_offset !== undefined && (
              <div className="text-xs text-muted mt-1">
                Day {milestone.days_offset}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <div className="px-5 py-4">
        <div className="space-y-4">
          {sortedMilestones.map((milestone, index) => (
            <div key={milestone.id}>
              {/* Timeline dot and connector */}
              <div className="flex gap-4">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      statusColors[milestone.status || 'pending']
                    }`}
                  />
                  {index < sortedMilestones.length - 1 && (
                    <div className="w-0.5 h-12 bg-subtle mt-1 mb-1" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-0.5">
                  <h4 className="text-sm font-semibold text-foreground">
                    {milestone.title}
                  </h4>
                  {milestone.description && (
                    <p className="text-xs text-muted mt-1">
                      {milestone.description}
                    </p>
                  )}

                  {/* Dates */}
                  <div className="flex gap-4 mt-2 text-xs">
                    {milestone.days_offset !== undefined && (
                      <span className="text-muted">
                        Day {milestone.days_offset}
                      </span>
                    )}
                    {milestone.scheduled_date && (
                      <span className="text-muted">
                        {formatDate(
                          new Date(milestone.scheduled_date),
                          'MMM d, yyyy'
                        )}
                      </span>
                    )}
                  </div>

                  {/* Action count badge */}
                  {milestone.actionCount !== undefined && milestone.actionCount > 0 && (
                    <div className="mt-2">
                      <span className="inline-block px-2 py-1 bg-subtle rounded text-xs text-muted">
                        {milestone.actionCount} action{milestone.actionCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}

                  {/* Status indicator */}
                  {milestone.status && (
                    <div className="mt-2">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          milestone.status === 'completed'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                            : milestone.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {milestone.status.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
