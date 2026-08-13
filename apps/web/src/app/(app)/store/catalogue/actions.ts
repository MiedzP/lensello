'use server';

/**
 * Catalogue management.
 *
 * A product is never hard-deleted: `print_order_items.product_id` is
 * `on delete restrict` precisely so a catalogue edit can never quietly empty
 * a historical order. Retiring a product means `is_active = false`, which
 * hides it from the buying page while every past order still resolves.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { currencyCode } from '@lensello/core';
import { friendlyDbError } from '@/lib/schema-errors';
import { PRINT_CATEGORIES } from '@/lib/prints/labels';
import { parseMinorUnitsInput } from '@/lib/prints/money';
import type { ProductActionState } from './product-state';
import { PRODUCT_ACTION_IDLE } from './product-state';

const moneyField = (label: string) =>
  z
    .string()
    .transform((value) => parseMinorUnitsInput(value))
    .refine((value) => value !== null, `${label} must be a number with at most two decimal places.`)
    .transform((value) => value as number);

const productSchema = z.object({
  productId: z.string().uuid().optional(),
  sku: z.string().trim().min(1, 'A SKU is required.').max(64),
  name: z.string().trim().min(1, 'A name is required.').max(200),
  category: z.enum(PRINT_CATEGORIES),
  description: z.string().trim().max(2000).optional(),
  sizeLabel: z.string().trim().max(40).optional(),
  widthMm: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || (Number.isInteger(value) && value > 0), 'Width must be a positive whole number of millimetres.'),
  heightMm: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || (Number.isInteger(value) && value > 0), 'Height must be a positive whole number of millimetres.'),
  labSku: z.string().trim().max(64).optional(),
  unitCost: moneyField('Lab cost'),
  price: moneyField('Retail price'),
  isDigital: z.boolean(),
});

function fieldFrom(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Creates a product when `productId` is absent, otherwise updates it in place. */
export async function saveProduct(
  _previous: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { supabase } = await requireUser();

  const parsed = productSchema.safeParse({
    productId: fieldFrom(formData, 'productId'),
    sku: formData.get('sku'),
    name: formData.get('name'),
    category: formData.get('category'),
    description: fieldFrom(formData, 'description'),
    sizeLabel: fieldFrom(formData, 'sizeLabel'),
    widthMm: fieldFrom(formData, 'widthMm'),
    heightMm: fieldFrom(formData, 'heightMm'),
    labSku: fieldFrom(formData, 'labSku'),
    unitCost: formData.get('unitCost') ?? '',
    price: formData.get('price') ?? '',
    isDigital: formData.get('isDigital') === 'on',
  });

  if (!parsed.success) {
    return { ...PRODUCT_ACTION_IDLE, error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  }

  const input = parsed.data;

  const row = {
    sku: input.sku,
    name: input.name,
    category: input.category,
    description: input.description ?? null,
    size_label: input.sizeLabel ?? null,
    width_mm: input.widthMm,
    height_mm: input.heightMm,
    lab_sku: input.labSku ?? null,
    unit_cost: input.unitCost,
    price: input.price,
    is_digital: input.isDigital,
  };

  const { error } = input.productId
    ? await supabase.from('print_products').update(row).eq('id', input.productId)
    : await supabase.from('print_products').insert({ ...row, currency: currencyCode() });

  if (error) {
    return {
      ...PRODUCT_ACTION_IDLE,
      error: friendlyDbError(
        error,
        error.message.includes('unique') ? 'That SKU is already in use.' : 'Could not save the product.',
      ),
    };
  }

  revalidatePath('/store/catalogue');
  return { ...PRODUCT_ACTION_IDLE, message: input.productId ? 'Product updated.' : 'Product added.' };
}

const toggleSchema = z.object({
  productId: z.string().uuid(),
  isActive: z.enum(['true', 'false']).transform((value) => value === 'true'),
});

export async function setProductActive(
  _previous: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { supabase } = await requireUser();

  const parsed = toggleSchema.safeParse({
    productId: formData.get('productId'),
    isActive: formData.get('isActive'),
  });
  if (!parsed.success) return { ...PRODUCT_ACTION_IDLE, error: 'Unknown product.' };

  const { error } = await supabase
    .from('print_products')
    .update({ is_active: parsed.data.isActive })
    .eq('id', parsed.data.productId);

  if (error) {
    return { ...PRODUCT_ACTION_IDLE, error: friendlyDbError(error, 'Could not update the product.') };
  }

  revalidatePath('/store/catalogue');
  return {
    ...PRODUCT_ACTION_IDLE,
    message: parsed.data.isActive ? 'Product is visible on the buying page again.' : 'Product hidden from the buying page.',
  };
}
