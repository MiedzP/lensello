'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { setProductActive } from '../actions';
import { PRODUCT_ACTION_IDLE } from '../product-state';

function ToggleButton({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs font-medium text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
    >
      {isActive ? 'Hide' : 'Show'}
    </button>
  );
}

/** Flips `is_active`. Never a delete — see the module comment in actions.ts. */
export function ActiveToggle({ productId, isActive }: { productId: string; isActive: boolean }) {
  const [, formAction] = useActionState(setProductActive, PRODUCT_ACTION_IDLE);

  return (
    <form action={formAction}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <ToggleButton isActive={isActive} />
    </form>
  );
}
