'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  CalendarDays,
  GraduationCap,
  Images,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Share2,
  ShoppingBag,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Ordered by how often the studio actually opens them, not by module age:
// the calendar and the inbox are daily, the academy is occasional.
const LINKS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/conversations', label: 'Inbox', icon: Inbox },
  { href: '/library', label: 'Library', icon: Images },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/studio', label: 'Studio', icon: Sparkles },
  { href: '/clients', label: 'Clients', icon: MessagesSquare },
  { href: '/gigs', label: 'Gigs', icon: CalendarDays },
  { href: '/store', label: 'Store', icon: ShoppingBag },
  { href: '/ads', label: 'Ads', icon: Target },
  { href: '/automations', label: 'Automations', icon: Bot },
  { href: '/academy', label: 'Academy', icon: GraduationCap },
  { href: '/connections', label: 'Connections', icon: Share2 },
  { href: '/staff', label: 'Staff', icon: Users },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex gap-1 lg:flex-col">
      {LINKS.map(({ href, label, icon: Icon }) => {
        // Exact match for the dashboard; prefix match elsewhere so detail
        // routes keep their section highlighted.
        const isActive =
          href === '/' ? pathname === '/' : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent-subtle text-accent'
                : 'text-muted hover:bg-surface-hover hover:text-foreground',
            )}
          >
            <Icon size={17} strokeWidth={2} aria-hidden="true" />
            <span className="hidden lg:inline">{label}</span>
            <span className="sr-only lg:hidden">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
