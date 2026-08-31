/**
 * Payment Framework Types
 * Complete type definitions for the payment system abstraction
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Invoice status workflow:
 * draft -> sent -> viewed -> (partial/paid) or (overdue/cancelled)
 */
export enum InvoiceStatus {
  DRAFT = 'draft', // Not sent to client
  SENT = 'sent', // Sent but not viewed
  VIEWED = 'viewed', // Client has seen it
  PARTIAL = 'partial', // Partial payment received
  PAID = 'paid', // Fully paid
  OVERDUE = 'overdue', // Past due date
  CANCELLED = 'cancelled' // Voided invoice
}

/**
 * Payment status tracks the financial state of an invoice
 */
export enum PaymentStatus {
  UNPAID = 'unpaid',
  PARTIAL = 'partial',
  PAID = 'paid',
  REFUNDED = 'refunded'
}

/**
 * Individual payment state within the payment processing pipeline
 */
export enum PaymentTransactionStatus {
  PENDING = 'pending', // Awaiting processing
  PROCESSING = 'processing', // In progress with provider
  COMPLETED = 'completed', // Successfully processed
  FAILED = 'failed', // Transaction failed
  REFUNDED = 'refunded' // Refund issued
}

/**
 * Payment methods supported
 */
export enum PaymentMethod {
  STRIPE = 'stripe',
  PADDLE = 'paddle',
  BANK_TRANSFER = 'bank_transfer',
  CREDIT_CARD = 'credit_card',
  CASH = 'cash',
  CHECK = 'check'
}

/**
 * Payment providers available
 */
export enum PaymentProvider {
  STRIPE = 'stripe',
  PADDLE = 'paddle',
  MANUAL = 'manual'
}

/**
 * Refund reasons
 */
export enum RefundReason {
  CUSTOMER_REQUEST = 'customer_request',
  DUPLICATE = 'duplicate',
  FRAUDULENT = 'fraudulent',
  PRODUCT_UNDELIVERABLE = 'product_undeliverable'
}

/**
 * Webhook event types from payment providers
 */
export enum WebhookEventType {
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed',
  INVOICE_CREATED = 'invoice.created',
  INVOICE_SENT = 'invoice.sent',
  PAYMENT_REFUNDED = 'payment.refunded',
  DISPUTE_OPENED = 'dispute.opened'
}

// ============================================================================
// CORE DOMAIN TYPES
// ============================================================================

/**
 * Invoice line item
 * Represents a single line on an invoice
 */
export interface LineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercentage?: number;
  taxPercentage?: number;
  category?: string; // 'service', 'product', 'fee', etc.
  referenceId?: string; // Link to deliverables, products, etc.
  metadata?: Record<string, unknown>;
  sortOrder?: number;

  // Computed/stored fields
  subtotal: number; // quantity * unitPrice
  taxAmount: number; // (quantity * unitPrice * taxPercentage) / 100
  total: number; // subtotal - discount + tax

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Invoice document
 * Represents a complete invoice with all line items and payments
 */
export interface Invoice {
  id: string;
  organizationId: string;
  projectId: string;
  clientId?: string;

  // Invoice identification
  invoiceNumber: string; // Unique within organization
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;

  // Monetary fields
  currencyCode: string; // 'USD', 'EUR', etc.
  subtotal: number;
  taxAmount: number;
  taxRate?: number;
  discountAmount?: number;
  discountPercentage?: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;

  // Dates
  issueDate: Date;
  dueDate: Date;
  sentDate?: Date;
  viewedDate?: Date;
  paidDate?: Date;

  // Content
  notes?: string;
  terms?: string;
  paymentInstructions?: Record<string, unknown>; // Bank details, payment links, etc.

  // Provider integration
  provider?: PaymentProvider;
  providerInvoiceId?: string; // External invoice ID

  // Relations
  lineItems?: LineItem[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Single payment transaction against an invoice
 */
export interface Payment {
  id: string;
  organizationId: string;
  invoiceId: string;

  status: PaymentTransactionStatus;
  paymentMethod: PaymentMethod;

  amount: number;
  currencyCode: string;

  // Provider transaction details
  provider?: PaymentProvider;
  providerTransactionId?: string; // External transaction ID
  providerPaymentId?: string; // External payment ID
  providerResponse?: Record<string, unknown>; // Raw response

  // Dates
  paymentDate?: Date;
  processedDate?: Date;
  receiptUrl?: string;

  // Refund tracking
  refundId?: string;
  refundAmount?: number;
  refundReason?: string;
  refundDate?: Date;

  // Error handling
  errorMessage?: string;
  errorCode?: string;
  retryCount?: number;
  nextRetryAt?: Date;

  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * Payment refund tracking
 */
export interface PaymentRefund {
  id: string;
  paymentId: string;
  invoiceId: string;

  amount: number;
  reason: RefundReason;
  description?: string;

  status: PaymentTransactionStatus;

  provider?: PaymentProvider;
  providerRefundId?: string;
  providerResponse?: Record<string, unknown>;

  processedDate?: Date;

  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * Organization payment configuration
 * Stores encrypted credentials and settings for payment providers
 */
export interface PaymentSettings {
  id: string;
  organizationId: string;

  provider: PaymentProvider;
  enabled: boolean;

  // Encrypted credentials stored as binary data
  credentialsEncrypted?: Buffer;
  webhookSecretEncrypted?: Buffer;

  // Provider-specific settings
  settings?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * Decrypted payment credentials (in memory only)
 * Never store these persistently
 */
export interface PaymentCredentials {
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  publicKey?: string;
  [key: string]: string | undefined;
}

/**
 * Webhook event from payment provider
 */
export interface PaymentWebhookEvent {
  id: string;
  organizationId: string;
  provider: PaymentProvider;
  eventType: WebhookEventType;
  eventId?: string;
  payload: Record<string, unknown>;
  signature?: string;
  signatureValid?: boolean;
  processed?: boolean;
  processedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

// ============================================================================
// PAYMENT PROVIDER INTERFACE & IMPLEMENTATIONS
// ============================================================================

/**
 * Request object for creating a payment intent/session
 */
export interface CreatePaymentRequest {
  invoiceId: string;
  amount: number;
  currencyCode: string;
  metadata?: Record<string, unknown>;
  returnUrl?: string;
  webhookUrl?: string;
}

/**
 * Response from payment provider after initiating payment
 */
export interface PaymentSessionResponse {
  sessionId: string;
  paymentUrl: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Refund request to payment provider
 */
export interface CreateRefundRequest {
  paymentId: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Abstract payment provider interface
 * All payment providers must implement this
 */
export interface IPaymentProvider {
  /**
   * Provider name
   */
  name: PaymentProvider;

  /**
   * Verify that credentials are valid and provider is accessible
   */
  validateCredentials(credentials: PaymentCredentials): Promise<boolean>;

  /**
   * Create a payment session/intent
   * Returns URL and session ID for client to complete payment
   */
  createPaymentSession(
    request: CreatePaymentRequest,
    credentials: PaymentCredentials
  ): Promise<PaymentSessionResponse>;

  /**
   * Retrieve payment details from provider
   */
  getPaymentStatus(
    providerPaymentId: string,
    credentials: PaymentCredentials
  ): Promise<{
    status: PaymentTransactionStatus;
    amount: number;
    transactionId: string;
    metadata?: Record<string, unknown>;
  }>;

  /**
   * Issue a refund to customer
   */
  createRefund(
    request: CreateRefundRequest,
    credentials: PaymentCredentials
  ): Promise<{
    refundId: string;
    status: PaymentTransactionStatus;
    amount: number;
  }>;

  /**
   * Verify webhook signature from provider
   * Ensures webhook came from legitimate payment provider
   */
  verifyWebhookSignature(
    payload: Buffer,
    signature: string,
    webhookSecret: string
  ): boolean;

  /**
   * Parse webhook event payload
   * Returns standardized event information
   */
  parseWebhookEvent(
    payload: Record<string, unknown>
  ): PaymentWebhookEvent | null;
}

/**
 * Factory for creating payment provider instances
 * Handles provider selection and initialization
 */
export interface PaymentProviderFactory {
  /**
   * Create a provider instance with encrypted credentials
   */
  createProvider(
    provider: PaymentProvider,
    credentialsEncrypted: Buffer
  ): IPaymentProvider;

  /**
   * Create a provider instance with decrypted credentials (careful!)
   */
  createProviderWithCredentials(
    provider: PaymentProvider,
    credentials: PaymentCredentials
  ): IPaymentProvider;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request to create a new invoice
 */
export interface CreateInvoiceRequest {
  projectId: string;
  clientId?: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  lineItems: Omit<LineItem, 'id' | 'invoiceId' | 'createdAt' | 'updatedAt'>[];
  notes?: string;
  terms?: string;
  taxRate?: number;
  discountPercentage?: number;
}

/**
 * Request to update an invoice
 */
export interface UpdateInvoiceRequest {
  status?: InvoiceStatus;
  dueDate?: Date;
  notes?: string;
  terms?: string;
  taxRate?: number;
  discountPercentage?: number;
}

/**
 * Request to record a payment
 */
export interface RecordPaymentRequest {
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  reference?: string;
  notes?: string;
}

/**
 * Response for payment endpoints
 */
export interface PaymentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  errorCode?: string;
}
