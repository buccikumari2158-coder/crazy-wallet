import { XenPayClient } from '../client/xenpay.client.js';
import { IOrderRepository, orderRepository } from '../database/order.repository.js';
import { generateMerchantOrderId, verifyWebhookSignature } from '../utils/crypto.js';
import { generateQrCodeDataUrl, generateQrCodeSvg } from '../utils/qrcode.js';
import { xenPayConfig } from '../config/xenpay.config.js';
import {
  CreateOrderInput,
  WalletOrderRecord,
  XenPayWebhookPayload,
} from '../types/xenpay.types.js';
import {
  XenPayAuthError,
  XenPayValidationError,
  XenPayNotFoundError,
} from '../errors/xenpay.errors.js';

export interface InitiateDepositInput {
  userId: string;
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  redirectUrl?: string;
}

export interface InitiateDepositResult {
  merchantOrderId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  paymentUrl: string;
  qrCodeDataUrl: string;
  qrCodeSvg: string;
  expiresInSeconds: number;
}

export class DepositService {
  private client: XenPayClient;
  private repo: IOrderRepository;

  constructor(client?: XenPayClient, repo?: IOrderRepository) {
    this.client = client || new XenPayClient();
    this.repo = repo || orderRepository;
  }

  /**
   * 1. Initiate Deposit: Call XenPay createOrder, generate QR codes, persist pending order
   */
  public async initiateDeposit(input: InitiateDepositInput): Promise<InitiateDepositResult> {
    if (!input.amount || input.amount <= 0) {
      throw new XenPayValidationError('Deposit amount must be greater than zero');
    }

    const merchantOrderId = generateMerchantOrderId('CW_DEP');
    const redirectUrl =
      input.redirectUrl ||
      process.env.PAYMENT_REDIRECT_URL ||
      'http://localhost:3000/deposit/complete';

    // 1. Call XenPay Gateway
    const gatewayOrder = await this.client.createOrder({
      amount: input.amount,
      merchant_order_id: merchantOrderId,
      redirect_url: redirectUrl,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail,
      metadata: {
        userId: input.userId,
        platform: 'crazy_wallet_web',
      },
    });

    // 2. Generate Inline QR Code (Data URL & SVG) from returned payment_url
    const qrCodeDataUrl = await generateQrCodeDataUrl(gatewayOrder.payment_url);
    const qrCodeSvg = await generateQrCodeSvg(gatewayOrder.payment_url);

    // 3. Persist Pending Order to Database
    await this.repo.createOrder({
      userId: input.userId,
      merchantOrderId,
      gatewayOrderId: gatewayOrder.order_id,
      amount: input.amount,
      creditedAmount: null,
      currency: 'INR',
      status: 'PENDING',
      paymentUrl: gatewayOrder.payment_url,
      qrCodeDataUrl,
      qrCodeSvg,
      utr: null,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      verifiedViaGateway: false,
      webhookReceivedAt: null,
    });

    return {
      merchantOrderId,
      gatewayOrderId: gatewayOrder.order_id,
      amount: input.amount,
      currency: 'INR',
      paymentUrl: gatewayOrder.payment_url,
      qrCodeDataUrl,
      qrCodeSvg,
      expiresInSeconds: 900, // 15 minutes default
    };
  }

  /**
   * 2. Process Webhook from XenPay with HMAC-SHA256 signature verification and idempotency
   */
  public async processWebhook(
    rawBody: string | Buffer,
    signature: string | undefined,
    payload: XenPayWebhookPayload
  ): Promise<{ status: string; message: string; alreadyProcessed: boolean }> {
    // A. Verify HMAC-SHA256 Signature
    const isValid = verifyWebhookSignature(rawBody, signature, xenPayConfig.apiSecret);
    if (!isValid) {
      throw new XenPayAuthError('Invalid webhook signature. Request rejected.');
    }

    const merchantOrderId = payload.merchant_order_id;
    if (!merchantOrderId) {
      throw new XenPayValidationError('Webhook payload missing merchant_order_id');
    }

    // B. Check order in DB
    const existingOrder = await this.repo.findByMerchantOrderId(merchantOrderId);
    if (!existingOrder) {
      throw new XenPayNotFoundError(`Order ${merchantOrderId} not found in Crazy Wallet`);
    }

    // C. Idempotency Check: if already marked SUCCESS, return 200 immediately
    if (existingOrder.status === 'SUCCESS') {
      return {
        status: 'success',
        message: 'Order already processed previously. Skipping duplicate credit.',
        alreadyProcessed: true,
      };
    }

    // D. Fallback verification call to XenPay getStatus to confirm authentic gateway state
    let verifiedViaGateway = false;
    try {
      const liveStatus = await this.client.getStatus({
        merchant_order_id: merchantOrderId,
        order_id: payload.order_id || existingOrder.gatewayOrderId || undefined,
      });

      if (liveStatus.status === 'SUCCESS') {
        verifiedViaGateway = true;
      } else {
        console.warn(
          `[Webhook Warning] Gateway getStatus returned ${liveStatus.status} for ${merchantOrderId}`
        );
      }
    } catch (err: any) {
      console.warn(`[Webhook Fallback Check Warning] getStatus check failed: ${err.message}. Proceeding with verified webhook signature.`);
    }

    // E. Evaluate Webhook Status
    const webhookStatus = (payload.status || '').toUpperCase();
    const isSuccess =
      webhookStatus === 'SUCCESS' ||
      webhookStatus === 'PAID' ||
      webhookStatus === 'COMPLETED' ||
      payload.event === 'order.paid';

    if (isSuccess) {
      const utr = payload.utr || (payload as any).rrn || (payload as any).bank_ref_num;
      const creditedAmount = payload.paid_amount ? Number(payload.paid_amount) : existingOrder.amount;

      const { alreadyProcessed } = await this.repo.markSuccess(merchantOrderId, {
        utr,
        gatewayOrderId: payload.order_id,
        creditedAmount,
        verifiedViaGateway,
      });

      return {
        status: 'success',
        message: alreadyProcessed ? 'Order was already completed' : 'Order successfully completed and wallet credited',
        alreadyProcessed,
      };
    } else if (webhookStatus === 'FAILED' || webhookStatus === 'EXPIRED') {
      await this.repo.markFailed(merchantOrderId, `Gateway reported ${webhookStatus}`);
      return {
        status: 'failed',
        message: `Order marked as ${webhookStatus}`,
        alreadyProcessed: false,
      };
    }

    return {
      status: 'pending',
      message: `Webhook received with status ${webhookStatus}`,
      alreadyProcessed: false,
    };
  }

  /**
   * 3. Active Polling Fallback: Poll status from XenPay and sync database
   */
  public async pollDepositStatus(merchantOrderId: string): Promise<WalletOrderRecord> {
    const existing = await this.repo.findByMerchantOrderId(merchantOrderId);
    if (!existing) {
      throw new XenPayNotFoundError(`Order with ID ${merchantOrderId} not found`);
    }

    // If order already in terminal state, return directly
    if (existing.status === 'SUCCESS' || existing.status === 'FAILED') {
      return existing;
    }

    // Active query to XenPay gateway
    try {
      const gatewayStatus = await this.client.getStatus({
        merchant_order_id: merchantOrderId,
        order_id: existing.gatewayOrderId || undefined,
      });

      if (gatewayStatus.status === 'SUCCESS') {
        const { order } = await this.repo.markSuccess(merchantOrderId, {
          utr: gatewayStatus.utr,
          gatewayOrderId: gatewayStatus.order_id,
          creditedAmount: gatewayStatus.paid_amount || existing.amount,
          verifiedViaGateway: true,
        });
        return order;
      } else if (gatewayStatus.status === 'FAILED' || gatewayStatus.status === 'EXPIRED') {
        const { order } = await this.repo.markFailed(merchantOrderId, `Gateway reported ${gatewayStatus.status}`);
        return order;
      }
    } catch (err: any) {
      console.error(`[Polling Error] Could not fetch gateway status for ${merchantOrderId}:`, err.message);
    }

    return existing;
  }
}

export const depositService = new DepositService();
