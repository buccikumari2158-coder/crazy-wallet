-- Crazy Wallet PostgreSQL Schema
-- Designed for Neon PostgreSQL (Free Tier) / Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Creators table
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  upi_id VARCHAR(100),
  role VARCHAR(20) NOT NULL DEFAULT 'CREATOR', -- 'CREATOR' or 'ADMIN'
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wallets table with Strict Non-Negative Constraints
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL UNIQUE REFERENCES creators(id) ON DELETE CASCADE,
  balance_paise BIGINT NOT NULL DEFAULT 0,
  pending_withdrawal_paise BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_wallet_balance_positive CHECK (balance_paise >= 0),
  CONSTRAINT chk_wallet_pending_positive CHECK (pending_withdrawal_paise >= 0)
);

-- Deposit Orders table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(80) PRIMARY KEY, -- Merchant Order ID e.g. CW-ORD-1732439120-ABC
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL,
  admin_fee_paise BIGINT NOT NULL,
  gateway_fee_paise BIGINT NOT NULL,
  creator_credit_paise BIGINT NOT NULL,
  admin_profit_paise BIGINT NOT NULL,
  gateway_order_id VARCHAR(128),
  payment_url TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'EXPIRED', 'SUCCESS', 'PAID_POST_EXPIRY', 'FAILED'
  expires_at TIMESTAMPTZ NOT NULL, -- Created time + 5 minutes
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_creator_id ON orders(creator_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Withdrawal Requests table with Idempotency Key
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL,
  admin_fee_paise BIGINT NOT NULL DEFAULT 0,
  net_payout_paise BIGINT NOT NULL DEFAULT 0,
  upi_id VARCHAR(100) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING_ADMIN_APPROVAL', -- 'PENDING_ADMIN_APPROVAL', 'APPROVED', 'PAID', 'REJECTED'
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  admin_notes TEXT,
  approved_by UUID REFERENCES creators(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_creator_id ON withdrawal_requests(creator_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawal_requests(status);

-- Double-Entry Wallet Ledger Table
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  transaction_type VARCHAR(40) NOT NULL, -- 'DEPOSIT_CREDIT', 'WITHDRAWAL_RESERVE', 'WITHDRAWAL_PAID', 'WITHDRAWAL_REJECTED_REFUND'
  amount_paise BIGINT NOT NULL, -- Positive for credits, negative for debits
  running_balance_paise BIGINT NOT NULL,
  reference_order_id VARCHAR(80),
  reference_withdrawal_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_wallet_id ON wallet_ledger(wallet_id);

-- Webhook Delivery Logs for Deduplication
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway VARCHAR(32) NOT NULL DEFAULT 'xenpay',
  gateway_order_id VARCHAR(128) NOT NULL,
  merchant_order_id VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL,
  is_valid_signature BOOLEAN NOT NULL,
  secondary_verified BOOLEAN NOT NULL,
  status VARCHAR(32) NOT NULL, -- 'SUCCESS', 'IGNORED_DUPLICATE', 'REJECTED_SIGNATURE', 'REJECTED_STATUS'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_webhook_delivery UNIQUE (gateway, gateway_order_id)
);

-- Security Audit Logs
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'INFO',
  creator_id UUID,
  reference_id VARCHAR(128),
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
