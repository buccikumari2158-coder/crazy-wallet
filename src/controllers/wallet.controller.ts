import { Request, Response } from 'express';
import { db } from '../database/crazy-wallet.db.js';
import { walletService } from '../services/wallet.service.js';
import { verifyWebhookSignature } from '../utils/crypto.js';
import { xenPayConfig } from '../config/xenpay.config.js';

export async function loginHandler(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const user = db.findUserByEmail(email);
    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        depositBalance: user.depositBalance,
        withdrawableBalance: user.withdrawableBalance,
        pendingWithdrawalBalance: user.pendingWithdrawalBalance,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function registerHandler(req: Request, res: Response) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password required' });
    }

    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const user = db.createUser(name, email, password, 'CREATOR');
    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        depositBalance: user.depositBalance,
        withdrawableBalance: user.withdrawableBalance,
        pendingWithdrawalBalance: user.pendingWithdrawalBalance,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getUserProfileHandler(req: Request, res: Response) {
  try {
    const userId = String(req.params.userId);
    const user = db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        depositBalance: user.depositBalance,
        withdrawableBalance: user.withdrawableBalance,
        pendingWithdrawalBalance: user.pendingWithdrawalBalance,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createDepositHandler(req: Request, res: Response) {
  try {
    const { userId, amount, redirectUrl } = req.body;
    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: 'userId and amount required' });
    }

    const result = await walletService.createDepositOrder({
      userId,
      amount: Number(amount),
      redirectUrl,
    });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

export async function checkDepositStatusHandler(req: Request, res: Response) {
  try {
    const merchantOrderId = String(req.params.merchantOrderId);
    const tx = await walletService.checkDepositStatus(merchantOrderId);
    return res.status(200).json({
      success: true,
      data: tx,
    });
  } catch (err: any) {
    return res.status(404).json({ success: false, message: err.message });
  }
}

export async function requestWithdrawalHandler(req: Request, res: Response) {
  try {
    const { userId, amount, payoutMethod, payoutDetails } = req.body;
    if (!userId || !amount || !payoutMethod || !payoutDetails) {
      return res.status(400).json({
        success: false,
        message: 'userId, amount, payoutMethod, and payoutDetails are required',
      });
    }

    const withdrawal = await walletService.requestWithdrawal({
      userId,
      amount: Number(amount),
      payoutMethod,
      payoutDetails,
    });

    return res.status(201).json({
      success: true,
      data: withdrawal,
      message: 'Withdrawal submitted to Admin for approval',
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

export async function getCreatorTransactionsHandler(req: Request, res: Response) {
  try {
    const userId = String(req.params.userId);
    const list = Array.from(db.transactions.values())
      .filter((t) => t.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return res.status(200).json({
      success: true,
      data: list,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ADMIN CONTROLLERS

export async function getAdminMetricsHandler(_req: Request, res: Response) {
  try {
    const metrics = await walletService.getAdminDashboardMetrics();
    return res.status(200).json({ success: true, data: metrics });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getAdminWithdrawalsHandler(_req: Request, res: Response) {
  try {
    const list = Array.from(db.withdrawals.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    return res.status(200).json({ success: true, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function approveWithdrawalHandler(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const { payoutUtr } = req.body;
    const updated = await walletService.approveWithdrawal({
      withdrawalId: id,
      payoutUtr,
    });

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Withdrawal approved and settled to creator',
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

export async function rejectWithdrawalHandler(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const { reason } = req.body;
    const updated = await walletService.rejectWithdrawal({
      withdrawalId: id,
      reason: reason || 'Rejected by Admin',
    });

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Withdrawal rejected. Funds refunded to creator wallet.',
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

export async function getAdminDepositsHandler(_req: Request, res: Response) {
  try {
    const deposits = Array.from(db.transactions.values())
      .filter((t) => t.type === 'DEPOSIT')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return res.status(200).json({ success: true, data: deposits });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getAdminCreatorsHandler(_req: Request, res: Response) {
  try {
    const creators = Array.from(db.users.values())
      .filter((u) => u.role === 'CREATOR')
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        depositBalance: u.depositBalance,
        withdrawableBalance: u.withdrawableBalance,
        pendingWithdrawalBalance: u.pendingWithdrawalBalance,
        createdAt: u.createdAt,
      }));

    return res.status(200).json({ success: true, data: creators });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// WEBHOOK HANDLER
export async function handleWebhook(req: any, res: Response) {
  try {
    const signature = req.headers['x-signature'] as string | undefined;
    const rawBody = req.rawBody || JSON.stringify(req.body);

    const isValid = verifyWebhookSignature(rawBody, signature, xenPayConfig.apiSecret);
    if (!isValid) {
      console.warn('[Webhook Error] Invalid signature received');
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const payload = req.body;
    const merchantOrderId = payload.merchant_order_id;
    const status = (payload.status || '').toLowerCase();

    if (status === 'success') {
      await walletService.completeDeposit({
        merchantOrderId,
        utr: payload.utr,
        gatewayOrderId: payload.order_id,
      });
    }

    return res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (err: any) {
    console.error('[Webhook Processing Error]:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
