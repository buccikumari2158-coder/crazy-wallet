import { Request, Response } from 'express';
import { depositService } from '../services/deposit.service.js';
import { XenPayClient } from '../client/xenpay.client.js';
import { XenPayError, XenPayNotFoundError, XenPayValidationError } from '../errors/xenpay.errors.js';

const xenPayClient = new XenPayClient();

/**
 * Initiate a deposit request
 * POST /api/deposit/create
 */
export async function createDepositHandler(req: Request, res: Response): Promise<void> {
  try {
    const { userId, amount, customerName, customerPhone, customerEmail, redirectUrl } = req.body;

    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ success: false, error: 'A positive amount is required' });
      return;
    }

    const result = await depositService.initiateDeposit({
      userId,
      amount: Number(amount),
      customerName: customerName || 'Crazy Wallet User',
      customerPhone: customerPhone || '9876543210',
      customerEmail: customerEmail || 'user@crazywallet.com',
      redirectUrl,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof XenPayValidationError) {
      res.status(422).json({ success: false, error: err.message, details: err.validationErrors });
      return;
    }
    if (err instanceof XenPayError) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    console.error('[Deposit Controller Error] createDeposit failed:', err);
    res.status(500).json({ success: false, error: 'Internal server error creating deposit order' });
  }
}

/**
 * Active Polling Fallback Endpoint
 * GET /api/deposit/check/:merchantOrderId
 *
 * Polled by client frontend when awaiting payment completion.
 * If local status is PENDING, queries XenPay gateway in real-time,
 * completes state transition and credits balance if payment confirmed.
 */
export async function checkDepositStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const merchantOrderId = req.params.merchantOrderId as string;

    if (!merchantOrderId) {
      res.status(400).json({ success: false, error: 'merchantOrderId parameter is required' });
      return;
    }

    const order = await depositService.pollDepositStatus(merchantOrderId);

    res.status(200).json({
      success: true,
      data: {
        merchantOrderId: order.merchantOrderId,
        gatewayOrderId: order.gatewayOrderId,
        status: order.status, // 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED'
        amount: order.amount,
        creditedAmount: order.creditedAmount,
        currency: order.currency,
        utr: order.utr,
        verifiedViaGateway: order.verifiedViaGateway,
        updatedAt: order.updatedAt,
      },
    });
  } catch (err: any) {
    if (err instanceof XenPayNotFoundError) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    console.error('[Deposit Controller Error] checkDepositStatus failed:', err);
    res.status(500).json({ success: false, error: 'Internal server error checking deposit status' });
  }
}

/**
 * Get advised deposit amounts
 * GET /api/deposit/advised-amounts
 */
export async function getAdvisedAmountsHandler(req: Request, res: Response): Promise<void> {
  try {
    const amount = req.query.amount ? Number(req.query.amount) : undefined;
    const advised = await xenPayClient.getAdvisedAmounts(amount);
    res.status(200).json({ success: true, data: advised });
  } catch (err: any) {
    console.error('[Deposit Controller Error] getAdvisedAmounts failed:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch advised amounts' });
  }
}

/**
 * Get merchant gateway balance (Admin endpoint)
 * GET /api/admin/xenpay/balance
 */
export async function getMerchantBalanceHandler(req: Request, res: Response): Promise<void> {
  try {
    const balance = await xenPayClient.getBalance();
    res.status(200).json({ success: true, data: balance });
  } catch (err: any) {
    console.error('[Deposit Controller Error] getBalance failed:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch merchant balance' });
  }
}
