-- Payment Framework Module
-- This migration creates the schema for managing invoices, line items, payments, and payment settings

-- Payment Settings Table
CREATE TABLE payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'stripe', 'paddle', 'manual'
  enabled BOOLEAN DEFAULT false,
  credentials_encrypted BYTEA, -- AES-256 encrypted JSON with API keys
  webhook_secret_encrypted BYTEA, -- Encrypted webhook signing secret
  settings JSONB DEFAULT '{}', -- Provider-specific settings
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  UNIQUE(organization_id, provider)
);

-- Invoices Table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  invoice_number VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, sent, viewed, partial, paid, overdue, cancelled
  payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid', -- unpaid, partial, paid, refunded

  currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
  amount_due DECIMAL(12, 2) NOT NULL DEFAULT 0,

  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  sent_date TIMESTAMP WITH TIME ZONE,
  viewed_date TIMESTAMP WITH TIME ZONE,
  paid_date TIMESTAMP WITH TIME ZONE,

  notes TEXT,
  terms TEXT,
  payment_instructions JSONB DEFAULT '{}', -- Bank details, payment links, etc.

  provider VARCHAR(50), -- Which payment provider processed this (if any)
  provider_invoice_id VARCHAR(255), -- External invoice ID from provider

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  UNIQUE(organization_id, invoice_number)
);

-- Line Items Table
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12, 2) NOT NULL,
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  tax_percentage DECIMAL(5, 2) DEFAULT 0,

  subtotal DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  tax_amount DECIMAL(12, 2) GENERATED ALWAYS AS ((quantity * unit_price * COALESCE(tax_percentage, 0)) / 100) STORED,
  total DECIMAL(12, 2) GENERATED ALWAYS AS ((quantity * unit_price) - ((quantity * unit_price * COALESCE(discount_percentage, 0)) / 100) + ((quantity * unit_price * COALESCE(tax_percentage, 0)) / 100)) STORED,

  category VARCHAR(100), -- 'service', 'product', 'fee', etc.
  reference_id UUID, -- Link to project deliverables, products, etc.
  metadata JSONB DEFAULT '{}',

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payments Table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, refunded
  payment_method VARCHAR(50) NOT NULL, -- 'stripe', 'paddle', 'bank_transfer', 'credit_card', 'cash', 'check'

  amount DECIMAL(12, 2) NOT NULL,
  currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Provider transaction details
  provider VARCHAR(50), -- 'stripe', 'paddle', etc.
  provider_transaction_id VARCHAR(255), -- External transaction ID
  provider_payment_id VARCHAR(255), -- External payment ID
  provider_response JSONB DEFAULT '{}', -- Raw response from provider

  -- Payment details
  payment_date TIMESTAMP WITH TIME ZONE,
  processed_date TIMESTAMP WITH TIME ZONE,
  receipt_url TEXT,

  -- Refund tracking
  refund_id UUID,
  refund_amount DECIMAL(12, 2),
  refund_reason TEXT,
  refund_date TIMESTAMP WITH TIME ZONE,

  -- Error handling
  error_message TEXT,
  error_code VARCHAR(100),
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP WITH TIME ZONE,

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),

  UNIQUE(provider, provider_transaction_id)
);

-- Payment Refunds Table
CREATE TABLE payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  amount DECIMAL(12, 2) NOT NULL,
  reason VARCHAR(100) NOT NULL, -- 'customer_request', 'duplicate', 'fraudulent', 'product_undeliverable'
  description TEXT,

  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed

  provider VARCHAR(50),
  provider_refund_id VARCHAR(255),
  provider_response JSONB DEFAULT '{}',

  processed_date TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

-- Payment Webhooks Log Table (for debugging provider webhooks)
CREATE TABLE payment_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255),

  payload JSONB NOT NULL,
  signature TEXT,
  signature_valid BOOLEAN,

  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for Performance
CREATE INDEX idx_payment_settings_org_provider ON payment_settings(organization_id, provider);
CREATE INDEX idx_invoices_organization ON invoices(organization_id);
CREATE INDEX idx_invoices_project ON invoices(project_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_provider_invoice_id ON invoices(provider, provider_invoice_id);

CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_line_items_category ON invoice_line_items(category);

CREATE INDEX idx_payments_organization ON payments(organization_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_payment_method ON payments(payment_method);
CREATE INDEX idx_payments_provider ON payments(provider, provider_transaction_id);
CREATE INDEX idx_payments_created ON payments(created_at);

CREATE INDEX idx_payment_refunds_payment ON payment_refunds(payment_id);
CREATE INDEX idx_payment_refunds_invoice ON payment_refunds(invoice_id);
CREATE INDEX idx_payment_refunds_status ON payment_refunds(status);

CREATE INDEX idx_webhook_logs_org_provider ON payment_webhook_logs(organization_id, provider);
CREATE INDEX idx_webhook_logs_event ON payment_webhook_logs(provider, event_type);
CREATE INDEX idx_webhook_logs_created ON payment_webhook_logs(created_at);

-- Create Triggers for Updated Timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_settings_timestamp
  BEFORE UPDATE ON payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_invoices_timestamp
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_line_items_timestamp
  BEFORE UPDATE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_payments_timestamp
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_payment_refunds_timestamp
  BEFORE UPDATE ON payment_refunds
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- RLS Policies (Row Level Security)
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Payment Settings RLS
CREATE POLICY "Users can view payment settings for their org"
  ON payment_settings FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organization_roles
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage payment settings"
  ON payment_settings FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM user_organization_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ));

-- Invoices RLS
CREATE POLICY "Users can view invoices from their org"
  ON invoices FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organization_roles
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage invoices in their org"
  ON invoices FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM user_organization_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner', 'editor')
  ));

-- Line Items RLS
CREATE POLICY "Users can view line items for invoices in their org"
  ON invoice_line_items FOR SELECT
  USING (invoice_id IN (
    SELECT id FROM invoices
    WHERE organization_id IN (
      SELECT organization_id FROM user_organization_roles
      WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can manage line items in their org"
  ON invoice_line_items FOR ALL
  USING (invoice_id IN (
    SELECT id FROM invoices
    WHERE organization_id IN (
      SELECT organization_id FROM user_organization_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner', 'editor')
    )
  ));

-- Payments RLS
CREATE POLICY "Users can view payments from their org"
  ON payments FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organization_roles
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage payments in their org"
  ON payments FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM user_organization_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner', 'editor')
  ));

-- Payment Refunds RLS
CREATE POLICY "Users can view refunds from their org"
  ON payment_refunds FOR SELECT
  USING (invoice_id IN (
    SELECT id FROM invoices
    WHERE organization_id IN (
      SELECT organization_id FROM user_organization_roles
      WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can manage refunds in their org"
  ON payment_refunds FOR ALL
  USING (invoice_id IN (
    SELECT id FROM invoices
    WHERE organization_id IN (
      SELECT organization_id FROM user_organization_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  ));

-- Webhook Logs RLS
CREATE POLICY "Admins can view webhook logs"
  ON payment_webhook_logs FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organization_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ));

CREATE POLICY "Admins can manage webhook logs"
  ON payment_webhook_logs FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM user_organization_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ));
