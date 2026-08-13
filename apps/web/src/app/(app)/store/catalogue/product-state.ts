export interface ProductActionState {
  error: string | null;
  message: string | null;
}

export const PRODUCT_ACTION_IDLE: ProductActionState = { error: null, message: null };
