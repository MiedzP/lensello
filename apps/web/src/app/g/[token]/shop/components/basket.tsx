'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Button, ErrorNote, Field, Input, Select } from '@/components/ui';
import { formatMinorUnits } from '@/lib/prints/money';
import { computeSubtotalCents } from '@/lib/prints/pricing';
import { removeFromBasket, saveDetailsAndCheckout, updateBasketQuantity } from '../actions';
import { SHOP_IDLE } from '../shop-state';
import type { ShopCartItem } from '../page';

function QuantityForm({ token, item }: { token: string; item: ShopCartItem }) {
  const [, formAction] = useActionState(updateBasketQuantity, SHOP_IDLE);

  return (
    <div className="flex items-center gap-1">
      {[-1, 1].map((delta) => (
        <form key={delta} action={formAction}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="quantity" value={Math.max(1, Math.min(99, item.quantity + delta))} />
          <button
            type="submit"
            disabled={item.quantity + delta < 1}
            className="flex size-6 items-center justify-center rounded-md border border-subtle text-muted hover:bg-surface-hover disabled:opacity-40"
            aria-label={delta > 0 ? 'Increase quantity' : 'Decrease quantity'}
          >
            {delta > 0 ? <Plus size={12} /> : <Minus size={12} />}
          </button>
        </form>
      ))}
    </div>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Remove"
      className="flex size-6 items-center justify-center rounded-md text-faint hover:bg-danger-subtle hover:text-danger disabled:opacity-40"
    >
      <Trash2 size={13} />
    </button>
  );
}

function BasketRow({ token, item }: { token: string; item: ShopCartItem }) {
  const [, removeAction] = useActionState(removeFromBasket, SHOP_IDLE);

  return (
    <div className="flex items-center gap-3 py-2">
      {item.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed preview URL.
        <img src={item.thumbnailUrl} alt="" className="size-12 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="size-12 shrink-0 rounded-md bg-surface-raised" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{item.productName}</div>
        <div className="text-xs text-faint">
          {item.sizeLabel ? `${item.sizeLabel} · ` : ''}
          {formatMinorUnits(item.unitPrice, item.currency)} each
        </div>
      </div>
      <QuantityForm token={token} item={item} />
      <div className="w-16 shrink-0 text-right text-sm tabular-nums text-foreground">
        {formatMinorUnits(item.unitPrice * item.quantity, item.currency)}
      </div>
      <form action={removeAction}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="itemId" value={item.id} />
        <RemoveButton />
      </form>
    </div>
  );
}

function CheckoutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
      {pending ? 'Preparing checkout…' : 'Checkout'}
    </Button>
  );
}

export function Basket({ token, items, currency }: { token: string; items: ShopCartItem[]; currency: string }) {
  const [state, formAction] = useActionState(saveDetailsAndCheckout, SHOP_IDLE);

  useEffect(() => {
    if (state.checkoutUrl) window.location.href = state.checkoutUrl;
  }, [state.checkoutUrl]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-subtle p-6 text-center text-sm text-muted">
        <ShoppingBag size={20} className="mx-auto mb-2 text-faint" aria-hidden="true" />
        Your basket is empty. Choose a photograph to start.
      </div>
    );
  }

  const subtotal = computeSubtotalCents(items.map((item) => ({ unitPrice: item.unitPrice, quantity: item.quantity })));

  return (
    <div className="space-y-4 rounded-xl border border-subtle bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Your basket</h2>

      <div className="divide-y divide-subtle">
        {items.map((item) => (
          <BasketRow key={item.id} token={token} item={item} />
        ))}
      </div>

      <div className="flex justify-between border-t border-subtle pt-3 text-sm font-medium text-foreground">
        <span>Subtotal</span>
        <span className="tabular-nums">{formatMinorUnits(subtotal, currency)}</span>
      </div>
      <p className="text-xs text-faint">Shipping is calculated from your address at checkout.</p>

      <details className="group">
        <summary className="cursor-pointer list-none text-sm font-medium text-accent">
          <span className="group-open:hidden">Enter delivery details to checkout</span>
          <span className="hidden group-open:inline">Delivery details</span>
        </summary>

        <form action={formAction} className="mt-3 space-y-3">
          <input type="hidden" name="token" value={token} />

          {state.error ? <ErrorNote>{state.error}</ErrorNote> : null}

          <Field label="Name" htmlFor="contactName" required>
            <Input id="contactName" name="contactName" required maxLength={120} />
          </Field>
          <Field label="Email" htmlFor="contactEmail" required hint="Your receipt goes here.">
            <Input id="contactEmail" name="contactEmail" type="email" required />
          </Field>
          <Field label="Address" htmlFor="shipLine1" required>
            <Input id="shipLine1" name="shipLine1" required maxLength={200} />
          </Field>
          <Field label="Address line 2" htmlFor="shipLine2">
            <Input id="shipLine2" name="shipLine2" maxLength={200} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Town or city" htmlFor="shipCity" required>
              <Input id="shipCity" name="shipCity" required maxLength={120} />
            </Field>
            <Field label="Postcode" htmlFor="shipPostcode" required>
              <Input id="shipPostcode" name="shipPostcode" required maxLength={20} />
            </Field>
          </div>
          <Field label="Country" htmlFor="shipCountry" required>
            <Select id="shipCountry" name="shipCountry" defaultValue="GB" required>
              <option value="GB">United Kingdom</option>
              <option value="IE">Ireland</option>
              <option value="FR">France</option>
              <option value="DE">Germany</option>
              <option value="US">United States</option>
            </Select>
          </Field>
          <Field label="Notes for the studio" htmlFor="notes">
            <Input id="notes" name="notes" maxLength={1000} />
          </Field>

          <CheckoutButton />
        </form>
      </details>
    </div>
  );
}
