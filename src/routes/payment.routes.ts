import { Router } from 'express';
import {
  loginHandler,
  registerHandler,
  getUserProfileHandler,
  createDepositHandler,
  checkDepositStatusHandler,
  requestWithdrawalHandler,
  getCreatorTransactionsHandler,
  getAdminMetricsHandler,
  getAdminWithdrawalsHandler,
  approveWithdrawalHandler,
  rejectWithdrawalHandler,
  getAdminDepositsHandler,
  getAdminCreatorsHandler,
  handleWebhook,
} from '../controllers/wallet.controller.js';

export const paymentRouter = Router();

// Auth routes
paymentRouter.post('/auth/login', loginHandler);
paymentRouter.post('/auth/register', registerHandler);
paymentRouter.get('/user/profile/:userId', getUserProfileHandler);

// Creator Deposit & Withdrawal routes
paymentRouter.post('/creator/deposit', createDepositHandler);
paymentRouter.get('/creator/deposit/status/:merchantOrderId', checkDepositStatusHandler);
paymentRouter.post('/creator/withdraw', requestWithdrawalHandler);
paymentRouter.get('/creator/transactions/:userId', getCreatorTransactionsHandler);

// Admin Middleman routes
paymentRouter.get('/admin/metrics', getAdminMetricsHandler);
paymentRouter.get('/admin/withdrawals', getAdminWithdrawalsHandler);
paymentRouter.post('/admin/withdrawals/:id/approve', approveWithdrawalHandler);
paymentRouter.post('/admin/withdrawals/:id/reject', rejectWithdrawalHandler);
paymentRouter.get('/admin/deposits', getAdminDepositsHandler);
paymentRouter.get('/admin/creators', getAdminCreatorsHandler);

// XenPay Webhook
paymentRouter.post('/webhook/xenpay', handleWebhook);
