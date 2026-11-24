import { Request, Response } from 'express';
import { depositService } from '../services/deposit.service.js';
import { XenPayAuthError, XenPayNotFoundError, XenPayValidationError } from '../errors/xenpay.errors.js';

export interface WebhookRequest extends Request {
  rawBody?: Buffer | string;
}

/**
 * XenPay Webhook Controller
 * Handles POST requests from XenPay gateway with HMAC-SHA256 signature verification and idempotency.
 */
export async function handleXenPayWebhook(req: WebhookRequest, res: Response): Promise<void> {
  const startTime = Date.now();

  try {
    // 1. Extract X-Signature header (case-insensitive in Express)
    const signature =
      (req.headers['x-signature'] as string) ||
      (req.headers['x-xenpay-signature'] as string) ||
      (req.headers['signature'] as string);

    if (!signature) {
      console.warn('[Webhook Error] Missing X-Signature header in webhook request');
      res.status(400).json({
        success: false,
        error: 'Missing X-Signature header',
      });
      return;
    }

    // 2. Get Raw Request Body (ensures HMAC computation matches exact bytes sent over the wire)
    const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    if (!rawBody) {
      res.status(400).json({
        success: false,
        error: 'Empty request body',
      });
      return;
    }

    // 3. Parsed payload
    const payload = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBody.toString());

    // 4. Delegate to deposit service for signature check, idempotency check, and fallback verification
    const result = await depositService.processWebhook(rawBody, signature, payload);

    const duration = Date.now() - startTime;
    console.log(
      `[Webhook Success] Processed order ${payload.merchant_order_id} in ${duration}ms (alreadyProcessed: ${result.alreadyProcessed})`
    );

    // Return 200 OK to acknowledge receipt to XenPay gateway
    res.status(200).json({
      success: true,
      status: result.status,
      message: result.message,
      already_processed: result.alreadyProcessed,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;

    if (error instanceof XenPayAuthError) {
      console.error(`[Webhook Security Alert] Signature verification failed: ${error.message} (${duration}ms)`);
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid webhook signature',
      });
      return;
    }

    if (error instanceof XenPayValidationError) {
      console.warn(`[Webhook Validation Error] ${error.message}`);
      res.status(422).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (error instanceof XenPayNotFoundError) {
      console.warn(`[Webhook Not Found] ${error.message}`);
      res.status(404).json({
        success: false,
        error: error.message,
      });
      return;
    }

    console.error(`[Webhook Internal Error] Unexpected error processing webhook:`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error processing payment webhook',
    });
  }
}
