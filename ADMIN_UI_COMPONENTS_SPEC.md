# Crazy Wallet — Admin Panel UI/UX Components & Workflow Specification
**Target Platform:** Web (Desktop Admin View / Next.js App Router)  
**Security & Access:** Role-Based Access Control (`ROLE_SUPERADMIN`, `ROLE_FINANCE_ADMIN`)  
**Design Standard:** High-Density Fintech Dark Dashboard (Linear / Stripe Sigma Style)

---

## 1. Admin Panel Information Architecture

```
/admin
├── /dashboard              # Executive Liquidity, Liabilities, Profit, Alert Badges
├── /withdrawals            # Payout Processing, Approval Modal (UTR Stamp), Rejections
├── /deposits               # Gateway Reconciliation & Net Profit Margin Audit
└── /creators               # Creator Accounts, Wallets, Manual Adjustments with Audit Log
```

---

## 2. Component Specifications

### 2.1 Executive Dashboard Header & Treasury Cards (`AdminTreasuryHero.tsx`)

```tsx
import React, { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  Wallet, 
  ExternalLink 
} from 'lucide-react';

interface TreasuryMetrics {
  xenPayLiveBalance: number;
  totalCreatorLiability: number;
  totalAdminGrossProfit: number;
  pendingWithdrawalsCount: number;
  lastSyncedAt: string;
}

export const AdminTreasuryHero: React.FC<{ metrics: TreasuryMetrics; onSyncGateway: () => Promise<void> }> = ({
  metrics,
  onSyncGateway,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await onSyncGateway();
    } finally {
      setIsSyncing(false);
    }
  };

  const solvencyRatio = metrics.xenPayLiveBalance / (metrics.totalCreatorLiability || 1);
  const isSolvent = solvencyRatio >= 1.0;

  return (
    <div className="space-y-6">
      {/* Top Banner with Gateway Sync Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#0F1318] border border-[#232B36] rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Platform Treasury & Liquidity</h2>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                XenPay Gateway Connected
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Last synced: {metrics.lastSyncedAt} • Target Payout Clearing: &lt;15 mins
            </p>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-2 px-4 py-2 bg-[#161B22] hover:bg-[#1C232D] border border-slate-700 text-xs font-semibold text-slate-200 rounded-xl transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Polling Gateway...' : 'Sync Gateway Balance'}
        </button>
      </div>

      {/* 4 Executive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: XenPay Gateway Live Balance */}
        <div className="p-5 bg-[#0F1318] border border-[#232B36] rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>XenPay Live Gateway Balance</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-white">
            ₹{metrics.xenPayLiveBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
            <span className={isSolvent ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
              {solvencyRatio.toFixed(2)}x Solvency Coverage
            </span>
          </div>
        </div>

        {/* Metric 2: Creator Total Liability */}
        <div className="p-5 bg-[#0F1318] border border-[#232B36] rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Creator Balances (Liability)</span>
            <Wallet className="w-4 h-4 text-sky-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-white">
            ₹{metrics.totalCreatorLiability.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-2 text-[11px] text-slate-400">
            Total active wallets in Crazy Wallet system
          </p>
        </div>

        {/* Metric 3: Total Admin Gross Profit */}
        <div className="p-5 bg-[#0F1318] border border-[#232B36] rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Platform Gross Profit</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            ₹{metrics.totalAdminGrossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-2 text-[11px] text-slate-400">
            Retained 20% platform cut + ₹15 fixed fee
          </p>
        </div>

        {/* Metric 4: Pending Withdrawals Alert Card */}
        <div className={`p-5 rounded-2xl border transition-all ${
          metrics.pendingWithdrawalsCount > 0
            ? 'bg-amber-500/5 border-amber-500/30'
            : 'bg-[#0F1318] border-[#232B36]'
        }`}>
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Pending Payout Requests</span>
            {metrics.pendingWithdrawalsCount > 0 ? (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            ) : (
              <AlertCircle className="w-4 h-4 text-slate-500" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-bold font-mono text-white">
              {metrics.pendingWithdrawalsCount}
            </p>
            <span className="text-xs text-amber-400 font-medium">Require Approval</span>
          </div>
          <a
            href="/admin/withdrawals"
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium"
          >
            Review queued payouts <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
```

---

### 2.2 Withdrawal Management & Approval / Rejection Modals (`AdminWithdrawalManagement.tsx`)

```tsx
import React, { useState } from 'react';
import { CheckCircle, XCircle, Copy, AlertTriangle, ArrowUpRight, Search } from 'lucide-react';

export interface AdminWithdrawalRequest {
  id: string;
  creatorName: string;
  creatorEmail: string;
  creatorWalletId: string;
  requestedAmount: number;
  adminFee: number;
  netPayoutAmount: number;
  method: 'UPI' | 'BANK';
  destinationDetail: string; // "user@okaxis" or "HDFC - 0021004128 (IFSC: HDFC0001234)"
  createdAt: string;
}

export const AdminWithdrawalManagement: React.FC<{
  requests: AdminWithdrawalRequest[];
  onApprove: (id: string, utr: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}> = ({ requests, onApprove, onReject }) => {
  const [selectedRequest, setSelectedRequest] = useState<AdminWithdrawalRequest | null>(null);
  const [modalMode, setModalMode] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [utrInput, setUtrInput] = useState('');
  const [rejectReason, setRejectReason] = useState('Invalid / Inactive UPI ID');
  const [customReason, setCustomReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleOpenApprove = (req: AdminWithdrawalRequest) => {
    setSelectedRequest(req);
    setUtrInput('');
    setModalMode('APPROVE');
  };

  const handleOpenReject = (req: AdminWithdrawalRequest) => {
    setSelectedRequest(req);
    setRejectReason('Invalid / Inactive UPI ID');
    setCustomReason('');
    setModalMode('REJECT');
  };

  const handleConfirmApproval = async () => {
    if (!selectedRequest || !utrInput.trim()) return;
    setIsProcessing(true);
    try {
      await onApprove(selectedRequest.id, utrInput.trim());
      setModalMode(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmRejection = async () => {
    if (!selectedRequest) return;
    setIsProcessing(true);
    try {
      const finalReason = rejectReason === 'Other' ? customReason : rejectReason;
      await onReject(selectedRequest.id, finalReason);
      setModalMode(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Table Container */}
      <div className="bg-[#0F1318] border border-[#232B36] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#232B36] flex items-center justify-between">
          <h3 className="font-semibold text-white">Pending Creator Payout Requests</h3>
          <span className="text-xs text-slate-400">{requests.length} Requests awaiting action</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#161B22] text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-[#232B36]">
              <tr>
                <th className="px-4 py-3">Creator</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Platform Fee (20%+15)</th>
                <th className="px-4 py-3">Net Disbursed</th>
                <th className="px-4 py-3">Method & Destination</th>
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232B36] text-slate-200">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-[#161B22]/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{req.creatorName}</div>
                    <div className="text-slate-400 font-mono text-[11px]">{req.creatorEmail}</div>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium">₹{req.requestedAmount.toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-rose-400">-₹{req.adminFee.toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                    ₹{req.netPayoutAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 mr-1.5">
                      {req.method}
                    </span>
                    <span className="font-mono text-slate-300">{req.destinationDetail}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{req.createdAt}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleOpenApprove(req)}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg font-medium transition-all"
                    >
                      Approve Payout
                    </button>
                    <button
                      onClick={() => handleOpenReject(req)}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-lg font-medium transition-all"
                    >
                      Reject & Refund
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* APPROVE PAYOUT MODAL */}
      {modalMode === 'APPROVE' && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0F1318] border border-[#232B36] rounded-2xl p-6 space-y-5 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base">Approve & Stamp Payout UTR</h4>
                <p className="text-xs text-slate-400">Record banking confirmation</p>
              </div>
            </div>

            <div className="p-4 bg-[#161B22] border border-[#232B36] rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Recipient:</span>
                <span className="font-semibold">{selectedRequest.creatorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payout Destination:</span>
                <span className="font-mono text-sky-400">{selectedRequest.destinationDetail}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#232B36]">
                <span className="text-slate-400">Exact Net Disbursed:</span>
                <span className="font-mono text-base font-bold text-emerald-400">
                  ₹{selectedRequest.netPayoutAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                BANK / UPI UTR REFERENCE NUMBER <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={utrInput}
                onChange={(e) => setUtrInput(e.target.value)}
                placeholder="e.g. 432810938120 (12 Digits)"
                className="w-full px-4 py-2.5 bg-[#161B22] border border-[#232B36] focus:border-emerald-500 rounded-xl font-mono text-sm text-white focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                This UTR will be recorded on the creator's ledger and cannot be altered once submitted.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="py-2.5 bg-[#161B22] hover:bg-[#1C232D] border border-slate-700 text-slate-300 font-medium rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!utrInput.trim() || isProcessing}
                onClick={handleConfirmApproval}
                className="py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-semibold rounded-xl text-xs transition-all"
              >
                {isProcessing ? 'Recording...' : 'Confirm & Mark Disbursed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT & REFUND MODAL */}
      {modalMode === 'REJECT' && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0F1318] border border-rose-500/30 rounded-2xl p-6 space-y-5 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-rose-400">Reject & Restore Balance</h4>
                <p className="text-xs text-slate-400">Automatic wallet credit reversal</p>
              </div>
            </div>

            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
              ⚠️ Warning: Rejecting will immediately refund <strong>₹{selectedRequest.requestedAmount.toFixed(2)}</strong> back to {selectedRequest.creatorName}'s available wallet balance.
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                REASON FOR REJECTION
              </label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#161B22] border border-[#232B36] rounded-xl text-xs text-white focus:outline-none"
              >
                <option value="Invalid / Inactive UPI ID">Invalid / Inactive UPI ID</option>
                <option value="Bank Beneficiary Name Mismatch">Bank Beneficiary Name Mismatch</option>
                <option value="Invalid IFSC Code">Invalid IFSC Code</option>
                <option value="Suspicious Activity / Security Hold">Suspicious Activity / Security Hold</option>
                <option value="Other">Other (Specify below)</option>
              </select>
            </div>

            {rejectReason === 'Other' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Custom Note</label>
                <textarea
                  rows={2}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter specific rejection reason for audit..."
                  className="w-full px-3 py-2 bg-[#161B22] border border-[#232B36] rounded-xl text-xs text-white focus:outline-none"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="py-2.5 bg-[#161B22] hover:bg-[#1C232D] border border-slate-700 text-slate-300 font-medium rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmRejection}
                className="py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all"
              >
                {isProcessing ? 'Processing...' : 'Confirm Reject & Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

---

### 2.3 Deposit Audit Table with Margin Breakdown (`AdminDepositAudit.tsx`)

Inspects incoming deposits from XenPay to track gross revenue, gateway cost, platform fee (20% + ₹15), and pure net admin profit.

```tsx
import React from 'react';
import { ExternalLink, CheckCircle2, Clock } from 'lucide-react';

export interface DepositAuditRecord {
  id: string;
  creatorName: string;
  xenPayReference: string;
  grossDeposit: number;
  gatewayFeeCharged: number; // e.g. XenPay 1.8% or flat
  adminFeeCollected: number; // 20% + ₹15
  netAdminProfit: number;    // adminFeeCollected - gatewayFeeCharged
  netCreditedToCreator: number; // grossDeposit - adminFeeCollected
  status: 'SUCCESS' | 'PENDING' | 'DISPUTED';
  settledAt: string;
}

export const AdminDepositAudit: React.FC<{ records: DepositAuditRecord[] }> = ({ records }) => {
  return (
    <div className="bg-[#0F1318] border border-[#232B36] rounded-2xl overflow-hidden shadow-xl">
      <div className="p-4 border-b border-[#232B36] flex items-center justify-between">
        <h3 className="font-semibold text-white">XenPay Deposit Reconciliation & Margin Audit</h3>
        <span className="text-xs text-slate-400">Real-time gateway webhook reconciliation</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#161B22] text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-[#232B36]">
            <tr>
              <th className="px-4 py-3">Order ID / Ref</th>
              <th className="px-4 py-3">Creator</th>
              <th className="px-4 py-3">Gross Deposit</th>
              <th className="px-4 py-3">Admin Fee (20%+15)</th>
              <th className="px-4 py-3">Gateway Cost</th>
              <th className="px-4 py-3">Net Admin Profit</th>
              <th className="px-4 py-3">Credited to Creator</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Settled At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#232B36] text-slate-200">
            {records.map((rec) => (
              <tr key={rec.id} className="hover:bg-[#161B22]/50 transition-colors">
                <td className="px-4 py-3 font-mono">
                  <div className="font-semibold text-white">{rec.id}</div>
                  <div className="text-slate-400 text-[10px]">{rec.xenPayReference}</div>
                </td>
                <td className="px-4 py-3 font-medium text-slate-300">{rec.creatorName}</td>
                <td className="px-4 py-3 font-mono font-medium">₹{rec.grossDeposit.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono text-emerald-400 font-semibold">
                  +₹{rec.adminFeeCollected.toFixed(2)}
                </td>
                <td className="px-4 py-3 font-mono text-rose-400">-₹{rec.gatewayFeeCharged.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono font-bold text-sky-400">
                  ₹{rec.netAdminProfit.toFixed(2)}
                </td>
                <td className="px-4 py-3 font-mono text-slate-200">
                  ₹{rec.netCreditedToCreator.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  {rec.status === 'SUCCESS' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Reconciled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">{rec.settledAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

---

### 2.4 Creator Management & Manual Wallet Adjustment Modal (`AdminCreatorWallets.tsx`)

```tsx
import React, { useState } from 'react';
import { Search, UserCheck, ShieldAlert, PlusCircle, MinusCircle } from 'lucide-react';

export interface CreatorAccount {
  id: string;
  name: string;
  email: string;
  availableBalance: number;
  lockedBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  status: 'ACTIVE' | 'SUSPENDED';
}

export const AdminCreatorWallets: React.FC<{
  creators: CreatorAccount[];
  onAdjustBalance: (creatorId: string, amountDelta: number, reason: string) => Promise<void>;
}> = ({ creators, onAdjustBalance }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCreator, setActiveCreator] = useState<CreatorAccount | null>(null);
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [auditReason, setAuditReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCreators = creators.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConfirmAdjustment = async () => {
    if (!activeCreator || adjustAmount <= 0 || !auditReason.trim()) return;
    setIsSubmitting(true);
    try {
      const delta = adjustType === 'CREDIT' ? adjustAmount : -adjustAmount;
      await onAdjustBalance(activeCreator.id, delta, auditReason);
      setActiveCreator(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="flex items-center justify-between gap-4 p-4 bg-[#0F1318] border border-[#232B36] rounded-2xl">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search creator name or email..."
            className="w-full pl-10 pr-4 py-2 bg-[#161B22] border border-[#232B36] rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="text-xs text-slate-400">
          Showing {filteredCreators.length} of {creators.length} Creators
        </div>
      </div>

      {/* Creator Table */}
      <div className="bg-[#0F1318] border border-[#232B36] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#161B22] text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-[#232B36]">
              <tr>
                <th className="px-4 py-3">Creator Profile</th>
                <th className="px-4 py-3">Available Balance</th>
                <th className="px-4 py-3">Pending/Locked</th>
                <th className="px-4 py-3">All-Time Inflow</th>
                <th className="px-4 py-3">All-Time Outflow</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Adjustment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232B36] text-slate-200">
              {filteredCreators.map((creator) => (
                <tr key={creator.id} className="hover:bg-[#161B22]/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{creator.name}</div>
                    <div className="text-slate-400 font-mono text-[11px]">{creator.email}</div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                    ₹{creator.availableBalance.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-mono text-amber-400">
                    ₹{creator.lockedBalance.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    ₹{creator.totalDeposited.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    ₹{creator.totalWithdrawn.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {creator.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setActiveCreator(creator);
                        setAdjustAmount(0);
                        setAuditReason('');
                      }}
                      className="px-3 py-1.5 bg-[#161B22] hover:bg-[#1C232D] border border-slate-700 text-slate-300 rounded-lg font-medium transition-all"
                    >
                      Adjust Balance
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MANUAL ADJUSTMENT AUDIT MODAL */}
      {activeCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0F1318] border border-amber-500/30 rounded-2xl p-6 space-y-5 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base">Manual Wallet Adjustment</h4>
                <p className="text-xs text-slate-400">{activeCreator.name} ({activeCreator.email})</p>
              </div>
            </div>

            <div className="p-3 bg-[#161B22] border border-[#232B36] rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Current Available Balance:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  ₹{activeCreator.availableBalance.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAdjustType('CREDIT')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold ${
                  adjustType === 'CREDIT'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'bg-[#161B22] border-[#232B36] text-slate-400'
                }`}
              >
                <PlusCircle className="w-4 h-4" /> Credit (Add)
              </button>
              <button
                type="button"
                onClick={() => setAdjustType('DEBIT')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold ${
                  adjustType === 'DEBIT'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                    : 'bg-[#161B22] border-[#232B36] text-slate-400'
                }`}
              >
                <MinusCircle className="w-4 h-4" /> Debit (Deduct)
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                ADJUSTMENT AMOUNT (₹)
              </label>
              <input
                type="number"
                min="1"
                value={adjustAmount || ''}
                onChange={(e) => setAdjustAmount(Number(e.target.value))}
                placeholder="0.00"
                className="w-full px-4 py-2.5 bg-[#161B22] border border-[#232B36] focus:border-amber-500 rounded-xl font-mono text-lg font-bold text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                MANDATORY AUDIT REASON <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={2}
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value)}
                placeholder="e.g., Manual settlement for disputed bank transfer #CW-9921"
                className="w-full px-3 py-2 bg-[#161B22] border border-[#232B36] rounded-xl text-xs text-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveCreator(null)}
                className="py-2.5 bg-[#161B22] hover:bg-[#1C232D] border border-slate-700 text-slate-300 font-medium rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={adjustAmount <= 0 || !auditReason.trim() || isSubmitting}
                onClick={handleConfirmAdjustment}
                className="py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-semibold rounded-xl text-xs transition-all"
              >
                {isSubmitting ? 'Applying...' : 'Apply & Log Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```
