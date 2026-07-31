import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A navigation control that reads as a button.
 *
 * `Button` from `@/components/ui` renders a `<button>`; nesting one inside an
 * anchor is invalid markup and confuses screen readers. This is a link wearing
 * the same visual language, which keeps the shared primitive untouched.
 */
export function LinkButton({
  href,
  variant = 'secondary',
  size = 'md',
  className,
  children,
}: {
  href: ComponentProps<typeof Link>['href'];
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm',
        variant === 'primary'
          ? 'bg-accent text-accent-foreground hover:bg-accent-hover'
          : 'border border-strong bg-surface text-foreground hover:bg-surface-hover',
        className,
      )}
    >
      {children}
    </Link>
  );
}
