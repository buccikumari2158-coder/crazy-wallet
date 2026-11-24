import crypto from 'crypto';
import { WalletOrderRecord, OrderInternalStatus } from '../types/xenpay.types.js';

export interface IOrderRepository {
  createOrder(data: Omit<WalletOrderRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<WalletOrderRecord>;
  findByMerchantOrderId(merchantOrderId: string): Promise<WalletOrderRecord | null>;
  findByGatewayOrderId(gatewayOrderId: string): Promise<WalletOrderRecord | null>;
  markSuccess(
    merchantOrderId: string,
    details: { utr?: string; gatewayOrderId?: string; creditedAmount?: number; verifiedViaGateway?: boolean }
  ): Promise<{ alreadyProcessed: boolean; order: WalletOrderRecord }>;
  markFailed(
    merchantOrderId: string,
    reason?: string
  ): Promise<{ alreadyProcessed: boolean; order: WalletOrderRecord }>;
  getUserBalance(userId: string): Promise<number>;
  creditUserBalance(userId: string, amount: number, referenceId: string): Promise<number>;
}

/**
 * Thread-safe In-Memory Order Repository (Mock/Reference implementation for Crazy Wallet)
 * In production, this can be swapped with Prisma, TypeORM, Drizzle, or raw SQL queries with row locking (SELECT ... FOR UPDATE).
 */
export class InMemoryOrderRepository implements IOrderRepository {
  private ordersByMerchantId = new Map<string, WalletOrderRecord>();
  private ordersByGatewayId = new Map<string, string>(); // gatewayOrderId -> merchantOrderId
  private userBalances = new Map<string, number>();

  public async createOrder(
    data: Omit<WalletOrderRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<WalletOrderRecord> {
    const now = new Date();
    const id = `rec_${crypto.randomUUID()}`;

    const record: WalletOrderRecord = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.ordersByMerchantId.set(record.merchantOrderId, record);
    if (record.gatewayOrderId) {
      this.ordersByGatewayId.set(record.gatewayOrderId, record.merchantOrderId);
    }

    return { ...record };
  }

  public async findByMerchantOrderId(merchantOrderId: string): Promise<WalletOrderRecord | null> {
    const order = this.ordersByMerchantId.get(merchantOrderId);
    return order ? { ...order } : null;
  }

  public async findByGatewayOrderId(gatewayOrderId: string): Promise<WalletOrderRecord | null> {
    const merchantOrderId = this.ordersByGatewayId.get(gatewayOrderId);
    if (!merchantOrderId) return null;
    return this.findByMerchantOrderId(merchantOrderId);
  }

  /**
   * Idempotent state transition to SUCCESS
   * Returns { alreadyProcessed: true } if order was already marked SUCCESS
   */
  public async markSuccess(
    merchantOrderId: string,
    details: { utr?: string; gatewayOrderId?: string; creditedAmount?: number; verifiedViaGateway?: boolean }
  ): Promise<{ alreadyProcessed: boolean; order: WalletOrderRecord }> {
    const existing = this.ordersByMerchantId.get(merchantOrderId);
    if (!existing) {
      throw new Error(`Order with merchant_order_id "${merchantOrderId}" not found`);
    }

    // IDEMPOTENCY CHECK:
    // If the order is already SUCCESS, skip crediting and return existing state
    if (existing.status === 'SUCCESS') {
      return { alreadyProcessed: true, order: { ...existing } };
    }

    const now = new Date();
    const finalAmount = details.creditedAmount ?? existing.amount;

    existing.status = 'SUCCESS';
    existing.creditedAmount = finalAmount;
    existing.verifiedViaGateway = details.verifiedViaGateway ?? true;
    existing.webhookReceivedAt = now;
    existing.updatedAt = now;

    if (details.utr) {
      existing.utr = details.utr;
    }
    if (details.gatewayOrderId) {
      existing.gatewayOrderId = details.gatewayOrderId;
      this.ordersByGatewayId.set(details.gatewayOrderId, merchantOrderId);
    }

    // Atomically credit user balance
    await this.creditUserBalance(existing.userId, finalAmount, merchantOrderId);

    return { alreadyProcessed: false, order: { ...existing } };
  }

  public async markFailed(
    merchantOrderId: string,
    reason?: string
  ): Promise<{ alreadyProcessed: boolean; order: WalletOrderRecord }> {
    const existing = this.ordersByMerchantId.get(merchantOrderId);
    if (!existing) {
      throw new Error(`Order with merchant_order_id "${merchantOrderId}" not found`);
    }

    if (existing.status === 'SUCCESS' || existing.status === 'FAILED') {
      return { alreadyProcessed: true, order: { ...existing } };
    }

    existing.status = 'FAILED';
    existing.updatedAt = new Date();

    return { alreadyProcessed: false, order: { ...existing } };
  }

  public async getUserBalance(userId: string): Promise<number> {
    return this.userBalances.get(userId) || 0;
  }

  public async creditUserBalance(userId: string, amount: number, referenceId: string): Promise<number> {
    const current = this.userBalances.get(userId) || 0;
    const updated = current + amount;
    this.userBalances.set(userId, updated);
    return updated;
  }
}

// Default singleton instance
export const orderRepository = new InMemoryOrderRepository();
