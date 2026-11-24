import crypto from 'crypto';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'CREATOR' | 'ADMIN';
  depositBalance: number; // In Rupees (e.g. 500.00)
  withdrawableBalance: number; // In Rupees ready to withdraw
  pendingWithdrawalBalance: number; // In Rupees locked in pending withdrawal
  createdAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  grossAmount: number;
  adminFee: number;
  xenpayFee: number;
  netAmount: number;
  adminProfit: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  merchantOrderId: string;
  gatewayOrderId?: string;
  paymentUrl?: string;
  qrCodeDataUrl?: string;
  qrExpiresAt?: Date;
  utr?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  adminFee: number;
  xenpayFee: number;
  netPayout: number;
  adminProfit: number;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  payoutMethod: 'UPI' | 'BANK';
  payoutDetails: {
    upiId?: string;
    accountNumber?: string;
    ifsc?: string;
    beneficiaryName?: string;
  };
  payoutUtr?: string;
  rejectionReason?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface AdminLedgerEntry {
  id: string;
  type: 'DEPOSIT_PROFIT' | 'WITHDRAWAL_PROFIT';
  referenceId: string;
  grossAmount: number;
  adminFeeCollected: number;
  xenpayFeeCost: number;
  netAdminProfit: number;
  createdAt: Date;
}

class CrazyWalletDatabase {
  public users: Map<string, User> = new Map();
  public transactions: Map<string, Transaction> = new Map();
  public withdrawals: Map<string, WithdrawalRequest> = new Map();
  public adminLedger: AdminLedgerEntry[] = [];

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    // 1. Seed Default Admin Account
    const adminId = 'usr_admin_001';
    this.users.set(adminId, {
      id: adminId,
      name: 'Crazy Wallet Admin',
      email: 'admin@crazywallet.com',
      passwordHash: 'admin123', // In demo; bcrypt in prod
      role: 'ADMIN',
      depositBalance: 0,
      withdrawableBalance: 0,
      pendingWithdrawalBalance: 0,
      createdAt: new Date(),
    });

    // 2. Seed Demo Creator with initial ready-to-withdraw balance
    const creatorId = 'usr_creator_001';
    this.users.set(creatorId, {
      id: creatorId,
      name: 'Rahul Sharma (Creator)',
      email: 'rahul@creator.com',
      passwordHash: 'creator123',
      role: 'CREATOR',
      depositBalance: 5000,
      withdrawableBalance: 3985, // Ready to withdraw
      pendingWithdrawalBalance: 0,
      createdAt: new Date(),
    });

    // Seed a sample past deposit for Rahul
    const depTxId = 'tx_seed_001';
    this.transactions.set('CW_DEP_SEED_01', {
      id: depTxId,
      userId: creatorId,
      userName: 'Rahul Sharma (Creator)',
      type: 'DEPOSIT',
      grossAmount: 5000,
      adminFee: 1015, // 20% + 15
      xenpayFee: 710, // 14% + 10
      netAmount: 3985,
      adminProfit: 305,
      status: 'SUCCESS',
      merchantOrderId: 'CW_DEP_SEED_01',
      gatewayOrderId: 'ORD_XEN_SEED_99',
      utr: 'UTR892374619283',
      createdAt: new Date(Date.now() - 3600000 * 24),
      updatedAt: new Date(Date.now() - 3600000 * 24),
    });

    this.adminLedger.push({
      id: 'led_seed_001',
      type: 'DEPOSIT_PROFIT',
      referenceId: 'CW_DEP_SEED_01',
      grossAmount: 5000,
      adminFeeCollected: 1015,
      xenpayFeeCost: 710,
      netAdminProfit: 305,
      createdAt: new Date(Date.now() - 3600000 * 24),
    });
  }

  // User queries
  public findUserByEmail(email: string): User | undefined {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return undefined;
  }

  public findUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  public createUser(name: string, email: string, passwordHash: string, role: 'CREATOR' | 'ADMIN' = 'CREATOR'): User {
    const id = `usr_${crypto.randomUUID().substring(0, 8)}`;
    const user: User = {
      id,
      name,
      email,
      passwordHash,
      role,
      depositBalance: 0,
      withdrawableBalance: 0,
      pendingWithdrawalBalance: 0,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }
}

export const db = new CrazyWalletDatabase();
