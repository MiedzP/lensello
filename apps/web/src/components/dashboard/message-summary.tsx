'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

interface MessageData {
  id: string;
  from: string;
  subject: string;
  preview: string;
  timestamp: string;
  is_unread?: boolean;
  is_handled?: boolean;
  href?: string;
}

/**
 * Message summary component for displaying recent client messages.
 * Shows sender, subject, preview text, and timestamp.
 * Clickable to navigate to full message.
 */
export function MessageSummary({
  message,
  children,
}: {
  message: MessageData;
  children?: ReactNode;
}) {
  const router = useRouter();

  const handleClick = () => {
    if (message.href) {
      router.push(message.href);
    }
  };

  const timeAgo = getTimeAgo(new Date(message.timestamp));

  return (
    <div
      onClick={handleClick}
      className="rounded-lg border border-subtle bg-surface p-4 transition-colors hover:bg-surface-hover cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground truncate">
              {message.from}
            </h4>
            {message.is_unread && (
              <div className="h-2 w-2 rounded-full bg-accent shrink-0" />
            )}
          </div>
          <h5 className="text-sm text-foreground mt-0.5 truncate font-medium">
            {message.subject}
          </h5>
          <p className="text-xs text-muted mt-1 line-clamp-2">
            {message.preview}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted">
            {timeAgo}
          </p>
          {message.is_handled === false && (
            <Badge tone="warning" className="text-xs mt-1">
              Needs reply
            </Badge>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Format timestamp relative to now.
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (secondsAgo < 60) {
    return 'now';
  }

  const minutesAgo = Math.floor(secondsAgo / 60);
  if (minutesAgo < 60) {
    return `${minutesAgo}m ago`;
  }

  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) {
    return `${hoursAgo}h ago`;
  }

  const daysAgo = Math.floor(hoursAgo / 24);
  if (daysAgo < 7) {
    return `${daysAgo}d ago`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
