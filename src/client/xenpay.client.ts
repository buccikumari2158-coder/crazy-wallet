import { xenPayConfig, XenPayConfig } from '../config/xenpay.config.js';
import {
  CreateOrderInput,
  CreateOrderResponse,
  GetStatusInput,
  OrderStatusResponse,
  BalanceResponse,
  AdvisedAmountsResponse,
  XenPayOrderStatus,
} from '../types/xenpay.types.js';
import {
  XenPayApiError,
  XenPayNetworkError,
  XenPayValidationError,
  mapHttpError,
} from '../errors/xenpay.errors.js';

export interface XenPayClientOptions {
  config?: XenPayConfig;
  logger?: {
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
    debug?: (msg: string, ...args: any[]) => void;
  };
}

export class XenPayClient {
  private readonly config: XenPayConfig;
  private readonly logger: XenPayClientOptions['logger'];

  constructor(options: XenPayClientOptions = {}) {
    this.config = options.config || xenPayConfig;
    this.logger = options.logger || console;

    if (!this.config.apiKey) {
      throw new XenPayValidationError('XenPay API Key (apiKey) is required');
    }
    if (!this.config.apiSecret) {
      throw new XenPayValidationError('XenPay API Secret (apiSecret) is required');
    }
  }

  /**
   * Helper sleep function for exponential backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(attempt: number): number {
    const { initialDelayMs, maxDelayMs, backoffFactor } = this.config.retry;
    const exponentialDelay = initialDelayMs * Math.pow(backoffFactor, attempt);
    // Add full jitter (0 to 500ms random delay) to prevent thundering herd
    const jitter = Math.floor(Math.random() * 500);
    return Math.min(exponentialDelay + jitter, maxDelayMs);
  }

  /**
   * Core HTTP request handler with automatic retry and exponential backoff
   */
  private async executeWithRetry<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any,
    queryParams?: Record<string, string | number | undefined>
  ): Promise<T> {
    let url = `${this.config.baseUrl}${endpoint}`;

    if (queryParams) {
      const searchParams = new URLSearchParams();
      for (const [key, val] of Object.entries(queryParams)) {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    let attempt = 0;
    const maxAttempts = this.config.retry.maxAttempts;

    while (attempt < maxAttempts) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'CrazyWallet-XenPayClient/1.0',
          'x-api-key': this.config.apiKey,
          'Authorization': `Bearer ${this.config.apiKey}`,
        };

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        let responseData: any = null;
        const responseText = await response.text();
        try {
          responseData = responseText ? JSON.parse(responseText) : {};
        } catch {
          responseData = { raw: responseText };
        }

        // Successful response (2xx)
        if (response.ok) {
          return responseData as T;
        }

        // Map HTTP error code to typed error
        const apiError = mapHttpError(response.status, responseData, endpoint);

        // Check if error is retryable (5xx, 429, 408)
        if (apiError.isRetryable && attempt + 1 < maxAttempts) {
          attempt++;
          const delay = this.calculateBackoffDelay(attempt);
          this.logger?.warn(
            `[XenPayClient] ${method} ${endpoint} failed with HTTP ${response.status}. Retrying attempt ${attempt}/${maxAttempts} in ${delay}ms...`
          );
          await this.sleep(delay);
          continue;
        }

        throw apiError;
      } catch (err: any) {
        clearTimeout(timeoutId);

        // If it's already a mapped XenPayApiError and not retryable, rethrow immediately
        if (err instanceof XenPayApiError) {
          throw err;
        }

        // Check for Abort / Timeout or Network error
        const isAbort = err.name === 'AbortError' || err.code === 'ABORT_ERR';
        const networkError = new XenPayNetworkError(
          isAbort
            ? `Request to XenPay timed out after ${this.config.timeoutMs}ms on ${method} ${endpoint}`
            : `Network error connecting to XenPay: ${err.message}`,
          err
        );

        if (attempt + 1 < maxAttempts) {
          attempt++;
          const delay = this.calculateBackoffDelay(attempt);
          this.logger?.warn(
            `[XenPayClient] Network failure on ${method} ${endpoint} (${err.message}). Retrying attempt ${attempt}/${maxAttempts} in ${delay}ms...`
          );
          await this.sleep(delay);
          continue;
        }

        throw networkError;
      }
    }

    throw new XenPayNetworkError(`Maximum retry attempts (${maxAttempts}) exceeded for ${method} ${endpoint}`);
  }

  /**
   * 1. Create Order
   * @param input - Order creation details
   * @returns CreateOrderResponse with payment_url and order_id
   */
  public async createOrder(input: CreateOrderInput): Promise<CreateOrderResponse> {
    // Client-side validation
    if (!input.amount || Number(input.amount) <= 0) {
      throw new XenPayValidationError('Amount must be a positive number greater than 0');
    }
    if (!input.merchant_order_id || !input.merchant_order_id.trim()) {
      throw new XenPayValidationError('merchant_order_id is required and cannot be empty');
    }
    if (!input.redirect_url || !input.redirect_url.startsWith('http')) {
      throw new XenPayValidationError('redirect_url must be a valid HTTP/HTTPS URL');
    }
    if (!input.customer_email || !input.customer_email.includes('@')) {
      throw new XenPayValidationError('customer_email must be a valid email address');
    }
    if (!input.customer_phone || input.customer_phone.trim().length < 8) {
      throw new XenPayValidationError('customer_phone must be a valid phone number');
    }

    const payload = {
      amount: Number(input.amount),
      merchant_order_id: input.merchant_order_id.trim(),
      redirect_url: input.redirect_url.trim(),
      customer_name: (input.customer_name || 'Guest User').trim(),
      customer_phone: input.customer_phone.trim(),
      customer_email: input.customer_email.trim().toLowerCase(),
      metadata: input.metadata || {},
    };

    const response = await this.executeWithRetry<any>(
      this.config.endpoints.createOrder,
      'POST',
      payload
    );

    // Normalize response structure
    const data = response?.data || response;
    const orderId = data?.order_id || data?.id || '';
    const paymentUrl = data?.payment_url || data?.paymentUrl || data?.url || '';

    if (!paymentUrl && !orderId) {
      throw new XenPayApiError(
        502,
        'Invalid response from XenPay: missing order_id and payment_url',
        response,
        this.config.endpoints.createOrder
      );
    }

    return {
      success: response?.status === 'success' || response?.success === true || !!paymentUrl,
      order_id: orderId,
      merchant_order_id: data?.merchant_order_id || input.merchant_order_id,
      amount: Number(data?.amount || input.amount),
      payment_url: paymentUrl,
      qr_code_data: data?.qr_code_data || data?.qr_code || undefined,
      upi_intent: data?.upi_intent || undefined,
      expires_at: data?.expires_at,
      created_at: data?.created_at,
      raw: response,
    };
  }

  /**
   * 2. Get Order Status
   * @param input - { order_id, merchant_order_id }
   * @returns OrderStatusResponse
   */
  public async getStatus(input: GetStatusInput): Promise<OrderStatusResponse> {
    if (!input.order_id && !input.merchant_order_id) {
      throw new XenPayValidationError('Either order_id or merchant_order_id must be provided to get status');
    }

    const queryParams: Record<string, string | undefined> = {};
    if (input.order_id) queryParams.order_id = input.order_id;
    if (input.merchant_order_id) queryParams.merchant_order_id = input.merchant_order_id;

    const response = await this.executeWithRetry<any>(
      this.config.endpoints.getStatus,
      'GET',
      undefined,
      queryParams
    );

    const data = response?.data || response;
    const rawStatus = (data?.status || 'PENDING').toString().toUpperCase();

    // Map gateway status to standard XenPayOrderStatus
    let normalizedStatus: XenPayOrderStatus = 'PENDING';
    if (['SUCCESS', 'PAID', 'COMPLETED', 'SETTLED'].includes(rawStatus)) {
      normalizedStatus = 'SUCCESS';
    } else if (['FAILED', 'REJECTED', 'DECLINED'].includes(rawStatus)) {
      normalizedStatus = 'FAILED';
    } else if (['EXPIRED', 'TIMED_OUT'].includes(rawStatus)) {
      normalizedStatus = 'EXPIRED';
    } else if (['CANCELLED', 'CANCELED'].includes(rawStatus)) {
      normalizedStatus = 'CANCELLED';
    }

    return {
      success: true,
      order_id: data?.order_id || data?.id || input.order_id || '',
      merchant_order_id: data?.merchant_order_id || input.merchant_order_id || '',
      amount: Number(data?.amount || 0),
      status: normalizedStatus,
      paid_amount: data?.paid_amount ? Number(data.paid_amount) : undefined,
      utr: data?.utr || data?.rrn || data?.bank_ref_num || undefined,
      transaction_id: data?.transaction_id || undefined,
      paid_at: data?.paid_at || undefined,
      created_at: data?.created_at || undefined,
      raw: response,
    };
  }

  /**
   * 3. Get Merchant Balance
   * @returns BalanceResponse
   */
  public async getBalance(): Promise<BalanceResponse> {
    const response = await this.executeWithRetry<any>(
      this.config.endpoints.getBalance,
      'GET'
    );

    const data = response?.data || response;

    return {
      success: true,
      balance: Number(data?.balance ?? data?.available_balance ?? 0),
      currency: data?.currency || 'INR',
      pending_settlement: data?.pending_settlement ? Number(data.pending_settlement) : undefined,
      raw: response,
    };
  }

  /**
   * 4. Get Advised Amounts
   * Recommended deposit tiers or optimal amounts suggested by gateway
   * @param amount - Optional baseline amount
   */
  public async getAdvisedAmounts(amount?: number): Promise<AdvisedAmountsResponse> {
    const queryParams: Record<string, number | undefined> = {};
    if (amount !== undefined) {
      queryParams.amount = amount;
    }

    const response = await this.executeWithRetry<any>(
      this.config.endpoints.getAdvisedAmounts,
      'GET',
      undefined,
      queryParams
    );

    const data = response?.data || response;
    const list = Array.isArray(data) ? data : data?.amounts || [100, 300, 500, 1000, 2000, 5000];

    return {
      success: true,
      requested_amount: amount || 0,
      advised_amounts: list.map((a: any) => Number(a)),
      discounts_or_bonuses: data?.bonuses || undefined,
      raw: response,
    };
  }
}
