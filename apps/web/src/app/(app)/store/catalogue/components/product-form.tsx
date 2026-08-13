'use client';

import { useActionState, useId } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import type { Route } from 'next';
import { Button, Card, CardBody, CardHeader, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui';
import { CATEGORY_LABELS, PRINT_CATEGORIES } from '@/lib/prints/labels';
import { saveProduct } from '../actions';
import { PRODUCT_ACTION_IDLE } from '../product-state';

export interface LabSkuOption {
  labSku: string;
  name: string;
  costCents: number;
  currency: string;
}

export interface EditableProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string | null;
  size_label: string | null;
  width_mm: number | null;
  height_mm: number | null;
  lab_sku: string | null;
  unit_cost: number;
  price: number;
  is_digital: boolean;
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function SaveButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add product'}
    </Button>
  );
}

/** Create or edit a catalogue product. In edit mode, `product` pre-fills every field including the hidden id the action keys its upsert on. */
export function ProductForm({
  product,
  labCatalogue,
  cancelHref,
}: {
  product?: EditableProduct;
  labCatalogue: LabSkuOption[];
  cancelHref?: Route<'/store/catalogue'>;
}) {
  const [state, formAction] = useActionState(saveProduct, PRODUCT_ACTION_IDLE);
  const formId = useId();
  const isEdit = Boolean(product);

  return (
    <Card>
      <CardHeader
        title={isEdit ? `Edit ${product?.name}` : 'Add a product'}
        description={
          isEdit
            ? 'Changes apply from now on. Orders already placed keep the price they paid.'
            : 'Add a size, framing option, canvas, album or digital download to the catalogue.'
        }
      />
      <CardBody>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          {product ? <input type="hidden" name="productId" value={product.id} /> : null}

          {state.error ? (
            <div className="sm:col-span-2">
              <ErrorNote>{state.error}</ErrorNote>
            </div>
          ) : null}

          <Field label="SKU" htmlFor={`${formId}-sku`} required hint="The studio's own code, shown on invoices.">
            <Input id={`${formId}-sku`} name="sku" defaultValue={product?.sku} required maxLength={64} />
          </Field>

          <Field label="Name" htmlFor={`${formId}-name`} required>
            <Input id={`${formId}-name`} name="name" defaultValue={product?.name} required maxLength={200} />
          </Field>

          <Field label="Category" htmlFor={`${formId}-category`} required>
            <Select id={`${formId}-category`} name="category" defaultValue={product?.category ?? 'print'} required>
              {PRINT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Size label" htmlFor={`${formId}-size`} hint='What the client sees, e.g. 10x8".'>
            <Input id={`${formId}-size`} name="sizeLabel" defaultValue={product?.size_label ?? ''} maxLength={40} />
          </Field>

          <Field label="Width (mm)" htmlFor={`${formId}-width`}>
            <Input
              id={`${formId}-width`}
              name="widthMm"
              type="number"
              min={1}
              step={1}
              defaultValue={product?.width_mm ?? ''}
            />
          </Field>

          <Field label="Height (mm)" htmlFor={`${formId}-height`}>
            <Input
              id={`${formId}-height`}
              name="heightMm"
              type="number"
              min={1}
              step={1}
              defaultValue={product?.height_mm ?? ''}
            />
          </Field>

          <Field
            label="Lab SKU"
            htmlFor={`${formId}-lab-sku`}
            hint="What the lab calls this product. Leave blank for a digital download."
          >
            <Input
              id={`${formId}-lab-sku`}
              name="labSku"
              list={`${formId}-lab-skus`}
              defaultValue={product?.lab_sku ?? ''}
              maxLength={64}
            />
            <datalist id={`${formId}-lab-skus`}>
              {labCatalogue.map((option) => (
                <option key={option.labSku} value={option.labSku}>
                  {option.name} — lab charges {centsToInput(option.costCents)} {option.currency}
                </option>
              ))}
            </datalist>
          </Field>

          <Field label="Lab cost" htmlFor={`${formId}-cost`} required hint="What the lab charges. Used to show margin.">
            <Input
              id={`${formId}-cost`}
              name="unitCost"
              inputMode="decimal"
              defaultValue={product ? centsToInput(product.unit_cost) : ''}
              placeholder="0.00"
              required
            />
          </Field>

          <Field label="Retail price" htmlFor={`${formId}-price`} required hint="What the client pays, tax inclusive.">
            <Input
              id={`${formId}-price`}
              name="price"
              inputMode="decimal"
              defaultValue={product ? centsToInput(product.price) : ''}
              placeholder="0.00"
              required
            />
          </Field>

          <Field label="Description" htmlFor={`${formId}-description`} className="sm:col-span-2">
            <Textarea id={`${formId}-description`} name="description" defaultValue={product?.description ?? ''} maxLength={2000} />
          </Field>

          <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
            <input type="checkbox" name="isDigital" defaultChecked={product?.is_digital ?? false} className="size-4" />
            This is a digital download — no lab order, no shipping.
          </label>

          <div className="flex items-center gap-2 sm:col-span-2">
            <SaveButton isEdit={isEdit} />
            {cancelHref ? (
              <Link
                href={cancelHref}
                className="inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-muted hover:bg-surface-hover hover:text-foreground"
              >
                Cancel
              </Link>
            ) : null}
            {state.message ? <span className="text-sm text-success">{state.message}</span> : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
