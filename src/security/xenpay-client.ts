/**
 * XenPay Gateway Integration Client
 * Base URL: https://xen-pays.space/api
 * 
 * Enforces strict backend-only API Secret handling and out-of-band secondary verification.
 */

const XENPAY_BASE_URL = process.env.XENPAY_BASE_URL || 'https://xen-pays.space/api';
const XENPAY_API_KEY = process.env.XENPAY_API_KEY || 'pk_fd1be9df17b3c1e99c91faaa';
const XENPAY_API_SECRET = process.env.XENPAY_API_SECRET || 'sk_47908aa255f60d039201ff0045663e1c7a7c7262167d1c46';

export interface XenPayCreateOrderParams {
  amount: number; // in INR
  merchant_order_id: string; // unique ID max 80 chars
  redirect_url?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}

export interface XenPayCreateOrderResponse {
  status: string;
  order_id: string;
  payment_url: string;
  merchant_order_id: string;
  amount: number;
  message?: string;
}

export interface XenPayStatusResponse {
  status: 'pending' | 'success' | 'failed' | string;
  order_id: string;
  merchant_order_id: string;
  amount: number;
  utr?: string;
  payment_time?: string;
  message?: string;
}

export interface XenPayBalanceResponse {
  status: string;
  balance: number;
  pending_withdrawal?: number;
  fees?: number;
}

class XenPayClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = XENPAY_API_KEY;
    this.apiSecret = XENPAY_API_SECRET;
    this.baseUrl = XENPAY_BASE_URL;

    if (!this.apiKey || !this.apiSecret) {
      console.error('[SECURITY WARNING] XenPay credentials are missing from environment!');
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'X-API-KEY': this.apiKey,
      'X-API-SECRET': this.apiSecret,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Create an order on XenPay
   */
  async createOrder(params: XenPayCreateOrderParams): Promise<XenPayCreateOrderResponse> {
    const res = await fetch(`${this.baseUrl}/create_order.php`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`XenPay create_order failed (${res.status}): ${errText}`);
    }

    return (await res.json()) as XenPayCreateOrderResponse;
  }

  /**
   * MANDATORY SECONDARY OUT-OF-BAND STATUS VERIFICATION
   * Call this directly before crediting any wallet on webhook event.
   */
  async verifyOrderStatus(orderId: string): Promise<XenPayStatusResponse> {
    const url = new URL(`${this.baseUrl}/status.php`);
    url.searchParams.append('order_id', orderId);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`XenPay status verification failed (${res.status}): ${errText}`);
    }

    return (await res.json()) as XenPayStatusResponse;
  }

  /**
   * Query gateway merchant balance (Admin only)
   */
  async getMerchantBalance(): Promise<XenPayBalanceResponse> {
    const res = await fetch(`${this.baseUrl}/balance.php`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`XenPay getBalance failed (${res.status}): ${errText}`);
    }

    return (await res.json()) as XenPayBalanceResponse;
  }
}

export const xenPayClient = new XenPayClient();
