/**
 * Fee Calculation Engine for Crazy Wallet
 * 
 * Rules:
 * - XenPay Gateway Fee: 14% + ₹10
 * - Admin Charge: 20% + ₹15
 * - Admin Spread Profit: 6% + ₹5 per transaction
 * 
 * ALL CALCULATIONS USE INTEGER ARITHMETIC IN PAISE (1 INR = 100 Paise)
 * NEVER USE FLOATING POINT MATH FOR FINANCIAL BALANCES.
 */

export interface FeeBreakdown {
  grossPaise: bigint;
  adminChargePaise: bigint;
  xenpayFeePaise: bigint;
  netCreatorCreditPaise: bigint;
  netAdminProfitPaise: bigint;
  // Display numbers in rupees for UI presentation
  grossRupees: number;
  adminChargeRupees: number;
  xenpayFeeRupees: number;
  netCreatorCreditRupees: number;
  netAdminProfitRupees: number;
}

export class FeeCalculator {
  // Constants in basis points (1% = 100 bps) and paise
  private static readonly XENPAY_PERCENT_BPS = 1400n; // 14.00%
  private static readonly XENPAY_FIXED_PAISE = 1000n; // ₹10.00 = 1000 paise

  private static readonly ADMIN_PERCENT_BPS = 2000n;  // 20.00%
  private static readonly ADMIN_FIXED_PAISE = 1500n;  // ₹15.00 = 1500 paise

  private static readonly BPS_DIVISOR = 10000n;

  /**
   * Calculate fees for a Deposit
   * Customer pays grossAmountRupees.
   * Admin deducts 20% + ₹15 before crediting Creator's wallet.
   * XenPay deducts 14% + ₹10 from Merchant gateway balance.
   */
  public static calculateDeposit(grossAmountRupees: number): FeeBreakdown {
    if (grossAmountRupees <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    const grossPaise = BigInt(Math.round(grossAmountRupees * 100));

    // Admin charge: 20% + ₹15
    const adminChargePaise = (grossPaise * this.ADMIN_PERCENT_BPS) / this.BPS_DIVISOR + this.ADMIN_FIXED_PAISE;

    if (adminChargePaise >= grossPaise) {
      throw new Error(`Deposit amount (₹${grossAmountRupees}) is too small to cover administrative fees (₹${Number(adminChargePaise) / 100})`);
    }

    // XenPay fee: 14% + ₹10
    const xenpayFeePaise = (grossPaise * this.XENPAY_PERCENT_BPS) / this.BPS_DIVISOR + this.XENPAY_FIXED_PAISE;

    // What creator receives in their wallet balance
    const netCreatorCreditPaise = grossPaise - adminChargePaise;

    // Platform gross margin (Spread profit)
    const netAdminProfitPaise = adminChargePaise - xenpayFeePaise;

    return {
      grossPaise,
      adminChargePaise,
      xenpayFeePaise,
      netCreatorCreditPaise,
      netAdminProfitPaise,
      grossRupees: Number(grossPaise) / 100,
      adminChargeRupees: Number(adminChargePaise) / 100,
      xenpayFeeRupees: Number(xenpayFeePaise) / 100,
      netCreatorCreditRupees: Number(netCreatorCreditPaise) / 100,
      netAdminProfitRupees: Number(netAdminProfitPaise) / 100,
    };
  }

  /**
   * Calculate fees for a Creator Withdrawal
   * Creator asks to withdraw grossWithdrawalRupees from their available wallet.
   * Admin fee (20% + ₹15) is deducted from the payout, or creator receives net.
   * Gateway payout cost (14% + ₹10) is settled by XenPay.
   */
  public static calculateWithdrawal(requestedWithdrawalRupees: number): {
    walletDeductionPaise: bigint;
    adminFeePaise: bigint;
    payoutToCreatorPaise: bigint;
    estimatedGatewayCostPaise: bigint;
    adminNetMarginPaise: bigint;
    payoutToCreatorRupees: number;
  } {
    const requestedPaise = BigInt(Math.round(requestedWithdrawalRupees * 100));

    // Admin fee: 20% + ₹15
    const adminFeePaise = (requestedPaise * this.ADMIN_PERCENT_BPS) / this.BPS_DIVISOR + this.ADMIN_FIXED_PAISE;

    if (adminFeePaise >= requestedPaise) {
      throw new Error(`Requested withdrawal (₹${requestedWithdrawalRupees}) is too low to cover withdrawal fees.`);
    }

    const payoutToCreatorPaise = requestedPaise - adminFeePaise;
    const estimatedGatewayCostPaise = (requestedPaise * this.XENPAY_PERCENT_BPS) / this.BPS_DIVISOR + this.XENPAY_FIXED_PAISE;
    const adminNetMarginPaise = adminFeePaise - estimatedGatewayCostPaise;

    return {
      walletDeductionPaise: requestedPaise,
      adminFeePaise,
      payoutToCreatorPaise,
      estimatedGatewayCostPaise,
      adminNetMarginPaise,
      payoutToCreatorRupees: Number(payoutToCreatorPaise) / 100,
    };
  }
}
