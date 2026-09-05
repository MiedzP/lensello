'use client';

import { formatDate, formatDistanceToNow } from 'date-fns';
import { Card, CardHeader, CardBody, Badge } from '@/components/ui';
import { useState } from 'react';

export interface ScheduledActionItem {
  id: string;
  action_type: 'email' | 'task' | 'sms' | 'call';
  title: string;
  scheduled_date: string;
  status: 'pending' | 'in_progress' | 'completed';
  execution_status?: 'success' | 'failed' | 'skipped';
  execution_error?: string;
  timeline_name?: string;
  milestone_title?: string;
  recipient_email?: string;
  recipient_phone?: string;
}

interface ScheduledActionListProps {
  actions: ScheduledActionItem[];
  onReschedule?: (actionId: string, newDate: string) => void;
  onComplete?: (actionId: string) => void;
  title?: string;
  description?: string;
  emptyMessage?: string;
}

/**
 * List of scheduled actions with status indicators and quick actions
 * Shows upcoming actions with color-coded types
 */
export function ScheduledActionList({
  actions,
  onReschedule,
  onComplete,
  title = 'Scheduled Actions',
  description = 'View and manage upcoming actions',
  emptyMessage = 'No scheduled actions',
}: ScheduledActionListProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const typeColors: Record<string, { bg: string; text: string; icon: string }> = {
    email: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-100', icon: '📧' },
    task: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-100', icon: '✓' },
    sms: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-100', icon: '💬' },
    call: { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-100', icon: '☎️' },
  };

  const statusColors = {
    pending: 'bg-slate-100 dark:bg-slate-800',
    in_progress: 'bg-blue-50 dark:bg-blue-950',
    completed: 'bg-green-50 dark:bg-green-950',
  };

  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader title={title} description={description} />
        <CardBody>
          <p className="text-center text-sm text-muted py-8">
            {emptyMessage}
          </p>
        </CardBody>
      </Card>
    );
  }

  const sortedActions = [...actions].sort(
    (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
  );

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="p-0">
        <div className="divide-y divide-subtle">
          {sortedActions.map((action) => {
            const typeInfo = typeColors[action.action_type];
            const isExpanded = expandedAction === action.id;

            return (
              <div
                key={action.id}
                className={`p-4 hover:bg-subtle transition-colors cursor-pointer ${
                  statusColors[action.status]
                }`}
                onClick={() => setExpandedAction(isExpanded ? null : action.id)}
              >
                {/* Compact view */}
                <div className="flex items-center gap-3">
                  {/* Type icon */}
                  <div className={`p-2 rounded ${typeInfo.bg} text-lg`}>
                    {typeInfo.icon}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-foreground text-sm line-clamp-1">
                        {action.title}
                      </h4>
                      <Badge
                        tone={
                          action.status === 'completed'
                            ? 'success'
                            : action.status === 'in_progress'
                            ? 'info'
                            : 'neutral'
                        }
                        className="text-xs"
                      >
                        {action.status}
                      </Badge>
                    </div>

                    <div className="flex gap-3 text-xs text-muted">
                      <span>
                        {formatDate(new Date(action.scheduled_date), 'MMM d')} at{' '}
                        {formatDate(new Date(action.scheduled_date), 'h:mm a')}
                      </span>
                      {action.timeline_name && (
                        <span>• {action.timeline_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Status indicator */}
                  <div className="flex-shrink-0">
                    {action.execution_status === 'success' && (
                      <span className="text-green-600 dark:text-green-400 text-xl">✓</span>
                    )}
                    {action.execution_status === 'failed' && (
                      <span className="text-red-600 dark:text-red-400 text-xl">✕</span>
                    )}
                    {action.status === 'pending' && (
                      <span className="text-muted">→</span>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-subtle space-y-3">
                    {action.milestone_title && (
                      <div>
                        <p className="text-xs font-medium text-muted uppercase">
                          Milestone
                        </p>
                        <p className="text-sm text-foreground">
                          {action.milestone_title}
                        </p>
                      </div>
                    )}

                    {action.recipient_email && (
                      <div>
                        <p className="text-xs font-medium text-muted uppercase">
                          Recipient
                        </p>
                        <p className="text-sm text-foreground break-all">
                          {action.recipient_email}
                        </p>
                      </div>
                    )}

                    {action.recipient_phone && (
                      <div>
                        <p className="text-xs font-medium text-muted uppercase">
                          Phone
                        </p>
                        <p className="text-sm text-foreground">
                          {action.recipient_phone}
                        </p>
                      </div>
                    )}

                    {action.execution_error && (
                      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-2">
                        <p className="text-xs font-medium text-red-800 dark:text-red-100">
                          Error
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-200 mt-1">
                          {action.execution_error}
                        </p>
                      </div>
                    )}

                    {/* Quick actions */}
                    {action.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        {onComplete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onComplete(action.id);
                            }}
                            className="flex-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium transition-colors"
                          >
                            Mark Complete
                          </button>
                        )}
                        {onReschedule && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Would open a date picker in real implementation
                              alert('Reschedule feature to be implemented');
                            }}
                            className="flex-1 px-3 py-1 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500 text-foreground rounded text-xs font-medium transition-colors"
                          >
                            Reschedule
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
