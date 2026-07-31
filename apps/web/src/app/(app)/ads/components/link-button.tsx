import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A link that reads as a button.
 *
 * `Button` from `@/components/ui` renders a real `<button>`, which is right for
 * anything that submits or acts — but navigation must stay an anchor so it
 * middle-clicks, opens in a new tab, and announces as a link. Module-private
 * rather than promoted: it borrows the shared button's token classes without
 * restyling the primitive, and only the ads module needs it so far.
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
