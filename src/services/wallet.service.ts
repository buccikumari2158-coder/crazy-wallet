import crypto from 'crypto';
import { db, User, Transaction, WithdrawalRequest, AdminLedgerEntry } from '../database/crazy-wallet.db.js';
import { XenPayClient } from '../client/xenpay.client.js';
import { generateQrCodeDataUrl } from '../utils/qrcode.js';

export interface DepositFeeBreakdown {
  grossAmount: number;
  adminFee: number;
  xenpayFee: number;
  netCredited: number;
  adminNetProfit: number;
}

export interface WithdrawalFeeBreakdown {
  requestedAmount: number;
  adminFee: number;
  xenpayFee: number;
  netPayout: number;
  adminNetProfit: number;
}

export class WalletService {
  private xenpayClient: XenPayClient;

  constructor() {
    this.xenpayClient = new XenPayClient();
  }

  /**
   * Exact Mathematical Fee Calculation for Deposits
   * Admin: 20% + ₹15
   * XenPay: 14% + ₹10
   * Admin Margin: 6% + ₹5
   */
  public calculateDepositFees(amount: number): DepositFeeBreakdown {
    if (amount < 50) {
      throw new Error('Minimum deposit amount is ₹50 to cover transaction fees.');
    }
    const adminFee = Math.round((amount * 0.20 + 15) * 100) / 100;
    const xenpayFee = Math.round((amount * 0.14 + 10) * 100) / 100;
    const netCredited = Math.round((amount - adminFee) * 100) / 100;
    const adminNetProfit = Math.round((adminFee - xenpayFee) * 100) / 100;

    return {
      grossAmount: amount,
      adminFee,
      xenpayFee,
      netCredited,
      adminNetProfit,
    };
  }

  /**
   * Exact Mathematical Fee Calculation for Withdrawals
   * Admin: 20% + ₹15
   * XenPay: 14% + ₹10
   * Admin Margin: 6% + ₹5
   */
  public calculateWithdrawalFees(amount: number): WithdrawalFeeBreakdown {
    if (amount < 100) {
      throw new Error('Minimum withdrawal amount is ₹100.');
    }
    const adminFee = Math.round((amount * 0.20 + 15) * 100) / 100;
    const xenpayFee = Math.round((amount * 0.14 + 10) * 100) / 100;
    const netPayout = Math.round((amount - adminFee) * 100) / 100;
    const adminNetProfit = Math.round((adminFee - xenpayFee) * 100) / 100;

    return {
      requestedAmount: amount,
      adminFee,
      xenpayFee,
      netPayout,
      adminNetProfit,
    };
  }

  /**
   * Create a dynamic deposit order with 5-minute QR code
   */
  public async createDepositOrder(params: {
    userId: string;
    amount: number;
    redirectUrl?: string;
  }): Promise<{
    merchantOrderId: string;
    gatewayOrderId: string;
    paymentUrl: string;
    qrCodeDataUrl: string;
    expiresInSeconds: number;
    expiresAt: Date;
    breakdown: DepositFeeBreakdown;
  }> {
    const user = db.findUserById(params.userId);
    if (!user) throw new Error('User not found');

    const breakdown = this.calculateDepositFees(params.amount);
    const merchantOrderId = `CW_DEP_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 1. Call XenPay Create Order
    let gatewayOrder;
    try {
      gatewayOrder = await this.xenpayClient.createOrder({
        amount: params.amount,
        merchant_order_id: merchantOrderId,
        redirect_url: params.redirectUrl || 'http://localhost:3000',
        customer_name: user.name,
        customer_email: user.email,
        customer_phone: '9876543210',
      });
    } catch (err: any) {
      console.warn(`[XenPay Gateway Call] Falling back to simulated payment URL for testing: ${err.message}`);
      // Fallback for offline/local simulation
      gatewayOrder = {
        order_id: `ORD_${Date.now().toString(36).toUpperCase()}`,
        payment_url: `https://xen-pays.space/pay/?id=ORD_${merchantOrderId}`,
      };
    }

    // 2. Generate 5-minute QR code Data URL
    const qrCodeDataUrl = await generateQrCodeDataUrl(gatewayOrder.payment_url);
    const expiresInSeconds = 300; // 5 minutes exactly
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // 3. Persist Transaction
    const tx: Transaction = {
      id: `tx_${crypto.randomUUID().substring(0, 8)}`,
      userId: user.id,
      userName: user.name,
      type: 'DEPOSIT',
      grossAmount: breakdown.grossAmount,
      adminFee: breakdown.adminFee,
      xenpayFee: breakdown.xenpayFee,
      netAmount: breakdown.netCredited,
      adminProfit: breakdown.adminNetProfit,
      status: 'PENDING',
      merchantOrderId,
      gatewayOrderId: gatewayOrder.order_id,
      paymentUrl: gatewayOrder.payment_url,
      qrCodeDataUrl,
      qrExpiresAt: expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    db.transactions.set(merchantOrderId, tx);

    return {
      merchantOrderId,
      gatewayOrderId: gatewayOrder.order_id,
      paymentUrl: gatewayOrder.payment_url,
      qrCodeDataUrl,
      expiresInSeconds,
      expiresAt,
      breakdown,
    };
  }

  /**
   * Complete deposit payment (called by webhook or status polling)
   */
  public async completeDeposit(params: {
    merchantOrderId: string;
    utr?: string;
    gatewayOrderId?: string;
  }): Promise<{ success: boolean; alreadyProcessed: boolean; transaction: Transaction }> {
    const tx = db.transactions.get(params.merchantOrderId);
    if (!tx) throw new Error(`Deposit order ${params.merchantOrderId} not found`);

    if (tx.status === 'SUCCESS') {
      return { success: true, alreadyProcessed: true, transaction: tx };
    }

    const user = db.findUserById(tx.userId);
    if (!user) throw new Error('User associated with order not found');

    // Atomic update
    tx.status = 'SUCCESS';
    tx.utr = params.utr || `UTR${Date.now()}`;
    if (params.gatewayOrderId) tx.gatewayOrderId = params.gatewayOrderId;
    tx.updatedAt = new Date();

    // Credit user's wallet
    user.depositBalance += tx.grossAmount;
    user.withdrawableBalance += tx.netAmount; // Ready to withdraw

    // Record in Admin Ledger
    db.adminLedger.push({
      id: `led_${crypto.randomUUID().substring(0, 8)}`,
      type: 'DEPOSIT_PROFIT',
      referenceId: tx.merchantOrderId,
      grossAmount: tx.grossAmount,
      adminFeeCollected: tx.adminFee,
      xenpayFeeCost: tx.xenpayFee,
      netAdminProfit: tx.adminProfit,
      createdAt: new Date(),
    });

    return { success: true, alreadyProcessed: false, transaction: tx };
  }

  /**
   * Check deposit status and enforce 5-minute expiry
   */
  public async checkDepositStatus(merchantOrderId: string): Promise<Transaction> {
    const tx = db.transactions.get(merchantOrderId);
    if (!tx) throw new Error(`Transaction ${merchantOrderId} not found`);

    if (tx.status === 'SUCCESS') return tx;

    // Check if 5 minutes expired
    if (tx.status === 'PENDING' && tx.qrExpiresAt && new Date() > tx.qrExpiresAt) {
      // Check live gateway status before marking expired
      try {
        const live = await this.xenpayClient.getStatus({ merchant_order_id: merchantOrderId });
        if (live.status === 'SUCCESS') {
          await this.completeDeposit({
            merchantOrderId,
            utr: live.utr,
            gatewayOrderId: live.order_id,
          });
          return db.transactions.get(merchantOrderId)!;
        }
      } catch (e) {
        // gateway not reached
      }

      tx.status = 'EXPIRED';
      tx.updatedAt = new Date();
    }

    return tx;
  }

  /**
   * Creator applies for a withdrawal
   */
  public async requestWithdrawal(params: {
    userId: string;
    amount: number;
    payoutMethod: 'UPI' | 'BANK';
    payoutDetails: {
      upiId?: string;
      accountNumber?: string;
      ifsc?: string;
      beneficiaryName?: string;
    };
  }): Promise<WithdrawalRequest> {
    const user = db.findUserById(params.userId);
    if (!user) throw new Error('User not found');

    if (params.amount < 100) {
      throw new Error('Minimum withdrawal is ₹100.');
    }

    if (user.withdrawableBalance < params.amount) {
      throw new Error(`Insufficient ready-to-withdraw balance. Available: ₹${user.withdrawableBalance.toFixed(2)}`);
    }

    const breakdown = this.calculateWithdrawalFees(params.amount);

    // ATOMIC BALANCE LOCK:
    // Move from ready-to-withdraw into locked pending-withdrawal balance
    user.withdrawableBalance -= params.amount;
    user.pendingWithdrawalBalance += params.amount;

    const withdrawalId = `WTH_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const withdrawal: WithdrawalRequest = {
      id: withdrawalId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      amount: breakdown.requestedAmount,
      adminFee: breakdown.adminFee,
      xenpayFee: breakdown.xenpayFee,
      netPayout: breakdown.netPayout,
      adminProfit: breakdown.adminNetProfit,
      status: 'PENDING_APPROVAL',
      payoutMethod: params.payoutMethod,
      payoutDetails: params.payoutDetails,
      createdAt: new Date(),
    };

    db.withdrawals.set(withdrawalId, withdrawal);

    // Also record transaction entry
    db.transactions.set(withdrawalId, {
      id: `tx_${crypto.randomUUID().substring(0, 8)}`,
      userId: user.id,
      userName: user.name,
      type: 'WITHDRAWAL',
      grossAmount: breakdown.requestedAmount,
      adminFee: breakdown.adminFee,
      xenpayFee: breakdown.xenpayFee,
      netAmount: breakdown.netPayout,
      adminProfit: breakdown.adminNetProfit,
      status: 'PENDING',
      merchantOrderId: withdrawalId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return withdrawal;
  }

  /**
   * Admin approves withdrawal -> settles to creator & books Admin profit
   */
  public async approveWithdrawal(params: {
    withdrawalId: string;
    payoutUtr?: string;
  }): Promise<WithdrawalRequest> {
    const req = db.withdrawals.get(params.withdrawalId);
    if (!req) throw new Error('Withdrawal request not found');

    if (req.status !== 'PENDING_APPROVAL') {
      throw new Error(`Withdrawal cannot be approved. Current status: ${req.status}`);
    }

    const user = db.findUserById(req.userId);
    if (!user) throw new Error('User not found');

    // Deduct from pending locked balance
    user.pendingWithdrawalBalance = Math.max(0, user.pendingWithdrawalBalance - req.amount);

    req.status = 'APPROVED';
    req.payoutUtr = params.payoutUtr || `PAY_UTR_${Date.now()}`;
    req.resolvedAt = new Date();

    // Update associated transaction
    const tx = db.transactions.get(req.id);
    if (tx) {
      tx.status = 'SUCCESS';
      tx.utr = req.payoutUtr;
      tx.updatedAt = new Date();
    }

    // Record in Admin Ledger
    db.adminLedger.push({
      id: `led_${crypto.randomUUID().substring(0, 8)}`,
      type: 'WITHDRAWAL_PROFIT',
      referenceId: req.id,
      grossAmount: req.amount,
      adminFeeCollected: req.adminFee,
      xenpayFeeCost: req.xenpayFee,
      netAdminProfit: req.adminProfit,
      createdAt: new Date(),
    });

    return req;
  }

  /**
   * Admin rejects withdrawal -> refunds locked balance back to Creator's ready-to-withdraw wallet
   */
  public async rejectWithdrawal(params: {
    withdrawalId: string;
    reason: string;
  }): Promise<WithdrawalRequest> {
    const req = db.withdrawals.get(params.withdrawalId);
    if (!req) throw new Error('Withdrawal request not found');

    if (req.status !== 'PENDING_APPROVAL') {
      throw new Error(`Withdrawal cannot be rejected. Current status: ${req.status}`);
    }

    const user = db.findUserById(req.userId);
    if (!user) throw new Error('User not found');

    // UNLOCK AND REFUND:
    user.pendingWithdrawalBalance = Math.max(0, user.pendingWithdrawalBalance - req.amount);
    user.withdrawableBalance += req.amount; // Refunded immediately

    req.status = 'REJECTED';
    req.rejectionReason = params.reason || 'Rejected by Admin';
    req.resolvedAt = new Date();

    // Update transaction
    const tx = db.transactions.get(req.id);
    if (tx) {
      tx.status = 'FAILED';
      tx.updatedAt = new Date();
    }

    return req;
  }

  /**
   * Admin metrics & treasury report
   */
  public async getAdminDashboardMetrics() {
    let xenpayLiveBalance: any = { balance: 0, pending_withdrawals: 0 };
    try {
      xenpayLiveBalance = await this.xenpayClient.getBalance();
    } catch (e: any) {
      xenpayLiveBalance = { balance: 12500.5, pending_withdrawals: 2000, offline: true };
    }

    let totalCreatorDeposits = 0;
    let totalCreatorWithdrawable = 0;
    let totalCreatorPending = 0;

    for (const u of db.users.values()) {
      if (u.role === 'CREATOR') {
        totalCreatorDeposits += u.depositBalance;
        totalCreatorWithdrawable += u.withdrawableBalance;
        totalCreatorPending += u.pendingWithdrawalBalance;
      }
    }

    let totalAdminProfit = 0;
    let totalFeesCollected = 0;
    let totalXenpayFeesPaid = 0;

    for (const entry of db.adminLedger) {
      totalAdminProfit += entry.netAdminProfit;
      totalFeesCollected += entry.adminFeeCollected;
      totalXenpayFeesPaid += entry.xenpayFeeCost;
    }

    const pendingWithdrawalsCount = Array.from(db.withdrawals.values()).filter(
      (w) => w.status === 'PENDING_APPROVAL'
    ).length;

    return {
      xenpayLiveBalance,
      creatorsSummary: {
        totalDeposited: totalCreatorDeposits,
        totalWithdrawableLiability: totalCreatorWithdrawable,
        totalPendingWithdrawalLiability: totalCreatorPending,
      },
      adminProfitSummary: {
        totalAdminProfit: Math.round(totalAdminProfit * 100) / 100,
        totalFeesCollected: Math.round(totalFeesCollected * 100) / 100,
        totalXenpayFeesPaid: Math.round(totalXenpayFeesPaid * 100) / 100,
        feeFormula: {
          adminFee: '20% + ₹15',
          xenpayFee: '14% + ₹10',
          adminNetMargin: '6% + ₹5',
        },
      },
      pendingWithdrawalsCount,
    };
  }
}

export const walletService = new WalletService();
