import type { Tables } from '@/lib/db.types';

export const PRINT_CATEGORIES = [
  'print',
  'framed',
  'canvas',
  'album',
  'wall_art',
  'digital',
  'package',
  'other',
] as const;

export type PrintCategory = Tables<'print_products'>['category'];

export const CATEGORY_LABELS: Record<PrintCategory, string> = {
  print: 'Print',
  framed: 'Framed',
  canvas: 'Canvas',
  album: 'Album',
  wall_art: 'Wall art',
  digital: 'Digital download',
  package: 'Package',
  other: 'Other',
};

export type PrintOrderStatus = Tables<'print_orders'>['status'];

export const ORDER_STATUS_LABELS: Record<PrintOrderStatus, string> = {
  cart: 'Basket',
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  submitted_to_lab: 'Sent to lab',
  in_production: 'In production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export type OrderStatusTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export const ORDER_STATUS_TONES: Record<PrintOrderStatus, OrderStatusTone> = {
  cart: 'neutral',
  awaiting_payment: 'warning',
  paid: 'accent',
  submitted_to_lab: 'accent',
  in_production: 'accent',
  shipped: 'success',
  delivered: 'success',
  cancelled: 'danger',
  refunded: 'danger',
};
