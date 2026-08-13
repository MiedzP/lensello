import { Badge } from '@/components/ui';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/lib/prints/labels';
import type { Tables } from '@/lib/db.types';

export function OrderStatusBadge({ status }: { status: Tables<'print_orders'>['status'] }) {
  return <Badge tone={ORDER_STATUS_TONES[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}
