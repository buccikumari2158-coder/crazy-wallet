/**
 * XenPay API Types and Interfaces for Crazy Wallet
 */

export interface CreateOrderInput {
  amount: number;
  merchant_order_id: string;
  redirect_url: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  metadata?: Record<string, any>;
}

export interface CreateOrderResponse {
  success: boolean;
  order_id: string;
  merchant_order_id: string;
  amount: number;
  payment_url: string;
  qr_code_data?: string;
  upi_intent?: string;
  expires_at?: string | number;
  created_at?: string;
  raw?: Record<string, any>;
}

export interface GetStatusInput {
  order_id?: string;
  merchant_order_id?: string;
}

export type XenPayOrderStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'PAID'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface OrderStatusResponse {
  success: boolean;
  order_id: string;
  merchant_order_id: string;
  amount: number;
  status: XenPayOrderStatus;
  paid_amount?: number;
  utr?: string;
  transaction_id?: string;
  paid_at?: string;
  created_at?: string;
  raw?: Record<string, any>;
}

export interface BalanceResponse {
  success: boolean;
  balance: number;
  currency: string;
  pending_settlement?: number;
  raw?: Record<string, any>;
}

export interface AdvisedAmountsResponse {
  success: boolean;
  requested_amount: number;
  advised_amounts: number[];
  discounts_or_bonuses?: Record<number, number>;
  raw?: Record<string, any>;
}

export interface XenPayWebhookPayload {
  event?: string;
  order_id: string;
  merchant_order_id: string;
  amount: number;
  status: string;
  paid_amount?: number;
  utr?: string;
  payment_method?: string;
  timestamp?: number | string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  [key: string]: any;
}

export type OrderInternalStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';

export interface WalletOrderRecord {
  id: string;
  userId: string;
  merchantOrderId: string;
  gatewayOrderId: string | null;
  amount: number;
  creditedAmount: number | null;
  currency: string;
  status: OrderInternalStatus;
  paymentUrl: string | null;
  qrCodeDataUrl?: string | null;
  qrCodeSvg?: string | null;
  utr: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  verifiedViaGateway: boolean;
  webhookReceivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
