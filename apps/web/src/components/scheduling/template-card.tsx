'use client';

import Link from 'next/link';
import { Card, CardBody, Badge } from '@/components/ui';
import type { ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';

export interface TemplateCardProps {
  id: string;
  name: string;
  description?: string;
  type: string;
  category?: string;
  icon_emoji?: string;
  total_days?: number;
  is_public?: boolean;
  created_at: string;
  milestoneCount?: number;
  actionCount?: number;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}

/**
 * Template card for timeline templates library
 * Shows preview with icon, name, description, and quick actions
 */
export function TemplateCard({
  id,
  name,
  description,
  type,
  category,
  icon_emoji,
  total_days,
  is_public,
  created_at,
  milestoneCount = 0,
  actionCount = 0,
  onDuplicate,
  onDelete,
}: TemplateCardProps) {
  const typeColors: Record<string, 'neutral' | 'info' | 'success' | 'warning'> = {
    photography: 'info',
    campaign: 'success',
    client_journey: 'neutral',
    wedding_workflow: 'warning',
    followup_sequence: 'neutral',
    custom: 'neutral',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="p-4">
        {/* Header with icon and badge */}
        <div className="flex items-start gap-3 mb-3">
          <div className="text-3xl">
            {icon_emoji || '📋'}
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={`/scheduling/templates`}
              className="text-sm font-semibold text-foreground hover:text-accent line-clamp-2"
            >
              {name}
            </Link>
            {is_public && (
              <Badge tone="info" className="mt-1">
                Public
              </Badge>
            )}
          </div>
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-muted line-clamp-2 mb-3">
            {description}
          </p>
        )}

        {/* Stats */}
        <div className="flex gap-3 mb-4 text-xs">
          <span className="text-muted">
            {milestoneCount} milestone{milestoneCount !== 1 ? 's' : ''}
          </span>
          {total_days && (
            <span className="text-muted">
              {total_days} day{total_days !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-subtle">
          <div className="flex-1">
            <Badge tone={typeColors[type] || 'neutral'} className="text-xs">
              {type.replace('_', ' ')}
            </Badge>
            <p className="text-xs text-faint mt-1">
              {formatDistanceToNow(new Date(created_at), { addSuffix: true })}
            </p>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 shrink-0">
            {onDuplicate && (
              <button
                onClick={() => onDuplicate(id)}
                className="p-1 hover:bg-subtle rounded transition-colors"
                title="Duplicate template"
              >
                <span className="text-sm">📋</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(id)}
                className="p-1 hover:bg-subtle rounded transition-colors text-muted hover:text-foreground"
                title="Delete template"
              >
                <span className="text-sm">🗑</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
