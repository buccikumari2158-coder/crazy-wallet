import dotenv from 'dotenv';
dotenv.config();

export interface XenPayConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  timeoutMs: number;
  retry: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffFactor: number;
  };
  endpoints: {
    createOrder: string;
    getStatus: string;
    getBalance: string;
    getAdvisedAmounts: string;
  };
}

export const xenPayConfig: XenPayConfig = {
  baseUrl: (process.env.XENPAY_BASE_URL || 'https://xen-pays.space/api').replace(/\/+$/, ''),
  apiKey: process.env.XENPAY_API_KEY || 'pk_fd1be9df17b3c1e99c91faaa',
  apiSecret: process.env.XENPAY_API_SECRET || 'sk_47908aa255f60d039201ff0045663e1c7a7c7262167d1c46',
  timeoutMs: 15000,
  retry: {
    maxAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
    initialDelayMs: parseInt(process.env.RETRY_INITIAL_DELAY_MS || '1000', 10),
    maxDelayMs: 8000,
    backoffFactor: 2,
  },
  endpoints: {
    createOrder: '/order/create',
    getStatus: '/order/status',
    getBalance: '/balance',
    getAdvisedAmounts: '/advised-amounts',
  },
};
