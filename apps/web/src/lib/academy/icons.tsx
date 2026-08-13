/**
 * Renders the `icon` column (a lucide-react icon name, per the migration's
 * comment) as an actual icon. A fixed map rather than a dynamic `require` —
 * lucide-react has hundreds of icons and importing an arbitrary name at
 * runtime is both slow and a foot-gun if a bad string ever lands in the
 * column. `GraduationCap` is the fallback for a name outside this list.
 *
 * Exported as a component, not a function that hands back a component
 * reference — the icon it resolves to is always one of the fixed, pre-defined
 * icons below, but a picker function returning a component reference reads
 * (to some lint rules, and to a reviewer) like it might be creating one, so
 * the selection is done here, once, and every caller just renders `<ModuleIcon />`.
 */

import type { ComponentProps } from 'react';
import {
  BookOpen,
  FileText,
  GraduationCap,
  Grid2x2,
  HeartHandshake,
  LayoutGrid,
  LayoutTemplate,
  Route,
  Search,
  Sparkles,
  Target,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Search,
  Sparkles,
  Grid2x2,
  LayoutGrid,
  Target,
  HeartHandshake,
  Workflow,
  LayoutTemplate,
  Route,
  FileText,
  Users,
  BookOpen,
  GraduationCap,
};

export function ModuleIcon({
  iconName,
  ...props
}: { iconName: string | null } & ComponentProps<LucideIcon>) {
  const Icon = (iconName && ICONS[iconName]) || GraduationCap;
  return <Icon {...props} />;
}
