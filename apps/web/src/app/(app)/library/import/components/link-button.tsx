import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A link that reads as a button. Copied from the `ads` module's component of
 * the same name rather than promoted to `@/components/ui`: two modules
 * needing the same twenty lines is not yet a reason to widen the shared
 * primitive set, per AGENTS.md's UI conventions.
 */
export function LinkButton({
  href,
  variant = 'secondary',
  children,
  className,
  ...props
}: {
  href: ComponentProps<typeof Link>['href'];
  variant?: 'primary' | 'secondary';
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<typeof Link>, 'href' | 'className' | 'children'>) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap transition-colors',
        variant === 'primary'
          ? 'bg-accent text-accent-foreground hover:bg-accent-hover'
          : 'border border-strong bg-surface text-foreground hover:bg-surface-hover',
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
