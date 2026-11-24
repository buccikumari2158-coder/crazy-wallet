import { describe, it } from 'node:test';
import assert from 'node:assert';
import { walletService } from '../src/services/wallet.service.js';
import { db } from '../src/database/crazy-wallet.db.js';

describe('Crazy Wallet — Financial Mathematics & Middleman Workflow', () => {

  it('calculates deposit fees accurately with 20% + ₹15 vs 14% + ₹10', () => {
    // Deposit of ₹1,000
    const d1000 = walletService.calculateDepositFees(1000);
    assert.strictEqual(d1000.grossAmount, 1000);
    assert.strictEqual(d1000.adminFee, 215); // 20% of 1000 = 200 + 15 = 215
    assert.strictEqual(d1000.xenpayFee, 150); // 14% of 1000 = 140 + 10 = 150
    assert.strictEqual(d1000.netCredited, 785); // 1000 - 215 = 785
    assert.strictEqual(d1000.adminNetProfit, 65); // 215 - 150 = 65 (6% + 5 = 60 + 5 = 65)

    // Deposit of ₹500
    const d500 = walletService.calculateDepositFees(500);
    assert.strictEqual(d500.adminFee, 115); // 100 + 15
    assert.strictEqual(d500.xenpayFee, 80); // 70 + 10
    assert.strictEqual(d500.netCredited, 385);
    assert.strictEqual(d500.adminNetProfit, 35); // 30 + 5
  });

  it('rejects micro-deposits < ₹50 to prevent negative net credit', () => {
    assert.throws(() => {
      walletService.calculateDepositFees(20);
    }, /Minimum deposit amount is ₹50/);
  });

  it('creates a dynamic 5-minute QR code deposit and credits creator wallet upon payment', async () => {
    const creator = db.createUser('Pooja Creator', 'pooja@test.com', 'pass123', 'CREATOR');

    const order = await walletService.createDepositOrder({
      userId: creator.id,
      amount: 500,
    });

    assert.strictEqual(order.expiresInSeconds, 300); // 5 minutes exactly
    assert.ok(order.qrCodeDataUrl.startsWith('data:image/png;base64,'));
    assert.strictEqual(order.breakdown.grossAmount, 500);
    assert.strictEqual(order.breakdown.adminFee, 115);
    assert.strictEqual(order.breakdown.netCredited, 385);

    // Initial creator balance is 0
    assert.strictEqual(creator.depositBalance, 0);
    assert.strictEqual(creator.withdrawableBalance, 0);

    // Simulate Payment confirmation (e.g. from Webhook)
    const result = await walletService.completeDeposit({
      merchantOrderId: order.merchantOrderId,
      utr: 'UTR_TEST_12345678',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.alreadyProcessed, false);

    // Creator wallet balances updated
    assert.strictEqual(creator.depositBalance, 500);
    assert.strictEqual(creator.withdrawableBalance, 385);

    // Duplicate webhook execution is idempotent
    const dupResult = await walletService.completeDeposit({
      merchantOrderId: order.merchantOrderId,
      utr: 'UTR_TEST_12345678',
    });
    assert.strictEqual(dupResult.alreadyProcessed, true);
    assert.strictEqual(creator.withdrawableBalance, 385); // Unchanged
  });

  it('locks balance on withdrawal request and routes to Admin Panel for approval', async () => {
    const creator = db.createUser('Karan Sharma', 'karan@test.com', 'pass123', 'CREATOR');
    creator.depositBalance = 2000;
    creator.withdrawableBalance = 1585; // Available

    // Creator requests ₹1,000 withdrawal
    const wth = await walletService.requestWithdrawal({
      userId: creator.id,
      amount: 1000,
      payoutMethod: 'UPI',
      payoutDetails: { upiId: 'karan@okaxis' },
    });

    assert.strictEqual(wth.status, 'PENDING_APPROVAL');
    assert.strictEqual(wth.amount, 1000);
    assert.strictEqual(wth.adminFee, 215); // 20% + 15
    assert.strictEqual(wth.netPayout, 785);

    // Balance locked: available reduced by ₹1000, locked increased by ₹1000
    assert.strictEqual(creator.withdrawableBalance, 585);
    assert.strictEqual(creator.pendingWithdrawalBalance, 1000);

    // Admin approves payout
    const approved = await walletService.approveWithdrawal({
      withdrawalId: wth.id,
      payoutUtr: 'UTR_BANK_DISPATCH_999',
    });

    assert.strictEqual(approved.status, 'APPROVED');
    assert.strictEqual(approved.payoutUtr, 'UTR_BANK_DISPATCH_999');

    // Locked balance cleared
    assert.strictEqual(creator.pendingWithdrawalBalance, 0);
    assert.strictEqual(creator.withdrawableBalance, 585);
  });

  it('refunds locked funds back to Creator when Admin rejects a withdrawal', async () => {
    const creator = db.createUser('Vikas', 'vikas@test.com', 'pass123', 'CREATOR');
    creator.depositBalance = 1000;
    creator.withdrawableBalance = 785;

    // Creator requests ₹500
    const wth = await walletService.requestWithdrawal({
      userId: creator.id,
      amount: 500,
      payoutMethod: 'UPI',
      payoutDetails: { upiId: 'invalid_upi' },
    });

    assert.strictEqual(creator.withdrawableBalance, 285);
    assert.strictEqual(creator.pendingWithdrawalBalance, 500);

    // Admin rejects due to invalid UPI
    const rejected = await walletService.rejectWithdrawal({
      withdrawalId: wth.id,
      reason: 'Invalid UPI handle format',
    });

    assert.strictEqual(rejected.status, 'REJECTED');
    assert.strictEqual(rejected.rejectionReason, 'Invalid UPI handle format');

    // Immediate refund to withdrawable balance
    assert.strictEqual(creator.pendingWithdrawalBalance, 0);
    assert.strictEqual(creator.withdrawableBalance, 785);
  });

});
