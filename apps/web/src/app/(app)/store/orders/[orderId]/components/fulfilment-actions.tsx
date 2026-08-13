'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Download, PackageCheck, RefreshCw, XCircle } from 'lucide-react';
import { Button, ErrorNote } from '@/components/ui';
import { cancelOrder, markRefunded, refreshLabStatus, submitOrderToLab } from '../../../actions';
import { ORDER_ACTION_IDLE } from '../../../order-state';

function ActionButton({
  children,
  icon,
  variant = 'secondary',
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  variant?: 'secondary' | 'danger' | 'primary';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {icon}
      {pending ? 'Working…' : children}
    </Button>
  );
}

export function FulfilmentActions({
  orderId,
  status,
  labOrderRef,
  paidAt,
  exportHref,
}: {
  orderId: string;
  status: string;
  labOrderRef: string | null;
  paidAt: string | null;
  exportHref: string;
}) {
  const [submitState, submitAction] = useActionState(submitOrderToLab, ORDER_ACTION_IDLE);
  const [refreshState, refreshAction] = useActionState(refreshLabStatus, ORDER_ACTION_IDLE);
  const [cancelState, cancelAction] = useActionState(cancelOrder, ORDER_ACTION_IDLE);
  const [refundState, refundAction] = useActionState(markRefunded, ORDER_ACTION_IDLE);

  const canSubmitToLab = status === 'paid';
  const canRefresh = Boolean(labOrderRef) && ['submitted_to_lab', 'in_production', 'shipped'].includes(status);
  const canCancel = ['awaiting_payment', 'paid', 'submitted_to_lab'].includes(status);
  const canRefund = Boolean(paidAt) && status !== 'refunded';

  const anyMessage = submitState.message || refreshState.message || cancelState.message || refundState.message;
  const anyError = submitState.error || refreshState.error || cancelState.error || refundState.error;

  return (
    <div className="space-y-3">
      {anyError ? <ErrorNote>{anyError}</ErrorNote> : null}
      {anyMessage ? (
        <p className="rounded-md border border-success/30 bg-success-subtle px-3 py-2 text-sm text-success">
          {anyMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canSubmitToLab ? (
          <form action={submitAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <ActionButton icon={<PackageCheck size={14} aria-hidden="true" />} variant="primary">
              Submit to lab
            </ActionButton>
          </form>
        ) : null}

        {canRefresh ? (
          <form action={refreshAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <ActionButton icon={<RefreshCw size={14} aria-hidden="true" />}>Check lab status</ActionButton>
          </form>
        ) : null}

        <a
          href={exportHref}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-strong bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-hover"
        >
          <Download size={14} aria-hidden="true" />
          Download CSV
        </a>

        {canCancel ? (
          <form action={cancelAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <ActionButton icon={<XCircle size={14} aria-hidden="true" />} variant="danger">
              Cancel order
            </ActionButton>
          </form>
        ) : null}

        {canRefund ? (
          <form action={refundAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <ActionButton icon={<XCircle size={14} aria-hidden="true" />}>Mark refunded</ActionButton>
          </form>
        ) : null}
      </div>
    </div>
  );
}
