# Crazy Wallet — Frontend UI/UX Design & Architecture Specification
**Document Version:** 1.0.0  
**Target Platform:** Web (Desktop & Mobile Responsive PWA / Next.js 14+ App Router)  
**Theme:** High-Trust Fintech Dark Theme (Inspired by Stripe Dashboard, Revolut Pro, Phantom Wallet)  
**Fee Model Standard:** Admin Fee = 20% of Amount + ₹15 Flat  

---

## Table of Contents
1. [Design System & Theme Architecture](#1-design-system--theme-architecture)
2. [Information Architecture & Route Map](#2-information-architecture--route-map)
3. [Creator Experience (User Dashboard)](#3-creator-experience-user-dashboard)
   - [3.1 Executive Metrics Cards](#31-executive-metrics-cards)
   - [3.2 Deposit Modal & 5-Minute Dynamic UPI QR Flow](#32-deposit-modal--5-minute-dynamic-upi-qr-flow)
   - [3.3 Withdrawal Modal & Payout Routing](#33-withdrawal-modal--payout-routing)
   - [3.4 Transaction History & Forensic Details Drawer](#34-transaction-history--forensic-details-drawer)
4. [Admin Panel Experience](#4-admin-panel-experience)
   - [4.1 Executive Treasury Dashboard](#41-executive-treasury-dashboard)
   - [4.2 Withdrawal Management Table & Payout Workflow](#42-withdrawal-management-table--payout-workflow)
   - [4.3 Deposit Audit Ledger & Margin Inspection](#43-deposit-audit-ledger--margin-inspection)
   - [4.4 Creator Management & Wallet Adjustments](#44-creator-management--wallet-adjustments)
5. [State Management & Real-Time Polling Architecture](#5-state-management--real-time-polling-architecture)
6. [Component Blueprints & Reference Implementations](#6-component-blueprints--reference-implementations)
   - [6.1 CountdownTimer Component (SVG Ring)](#61-countdowntimer-component-svg-ring)
   - [6.2 DepositModal Component (Full State Machine)](#62-depositmodal-component-full-state-machine)
   - [6.3 WithdrawalModal Component](#63-withdrawalmodal-component)
   - [6.4 TransactionDrawer Component](#64-transactiondrawer-component)

---

## 1. Design System & Theme Architecture

### 1.1 Color Palette (Fintech Dark System)
The UI employs a deep obsidian foundation with layered slate surfaces, neon emerald trust accents for growth and verification, amber warnings for pending states and timer urgency, and laser rose for failures.

```css
:root {
  /* Surface Layers */
  --bg-primary: #090B0E;        /* Deep Space Obsidian */
  --bg-secondary: #0F1318;      /* Card & Surface Layer 1 */
  --bg-elevated: #161B22;       /* Modals, Dropdowns & Elevated Cards */
  --bg-subtle: #1C232D;         /* Hover fills, subtle chip backgrounds */
  
  /* Borders & Dividers */
  --border-subtle: #232B36;     /* 1px subtle card outlines */
  --border-glow: #2D3748;       /* Interactive card borders */
  --border-focus: #10B981;      /* Emerald focus ring (0 0 0 2px) */

  /* Primary Brand & Accents */
  --brand-primary: #10B981;     /* Emerald 500 - Trust, Growth, Success */
  --brand-glow: rgba(16, 185, 129, 0.15); /* Radial glow behind QR / Cards */
  --brand-hover: #059669;      /* Emerald 600 */

  /* Functional Status Colors */
  --status-success: #10B981;    /* Emerald - Verified, Credited */
  --status-pending: #F59E0B;    /* Amber 500 - In Escrow, Awaiting Bank */
  --status-rejected: #EF4444;   /* Rose 500 - Failed, Rejected */
  --status-expired: #6B7280;    /* Neutral Slate 500 - Expired QR */

  /* Text Hierarchy */
  --text-primary: #F8FAFC;      /* High-contrast pure slate 50 */
  --text-secondary: #94A3B8;    /* Muted Slate 400 for labels & subtitles */
  --text-tertiary: #64748B;     /* Slate 500 for timestamps & metadata */
  --text-code: #38BDF8;         /* Sky 400 for UTR, Wallet IDs & Hashes */
}
```

### 1.2 Typography System
- **Primary Interface Font:** `Inter` or `Plus Jakarta Sans` (`400` Regular, `500` Medium, `600` SemiBold, `700` Bold)
- **Financial & Code Font:** `JetBrains Mono` or `SF Mono` for currency figures (`₹1,250.00`), UTR references, transaction hashes, and countdown digits (`04:59`). Tabular numbers (`font-variant-numeric: tabular-nums`) ensure clean alignment without layout jitter during countdowns.

### 1.3 Micro-Interactions & Sensory Feedback
- **Glassmorphism Backdrop:** `backdrop-filter: blur(12px); background: rgba(15, 19, 24, 0.85);` for modal overlays and sticky headers.
- **Card Glow Shadows:** Ambient box shadows `box-shadow: 0 0 24px -4px rgba(16, 185, 129, 0.08);` on hover.
- **Spring Transitions:** Framer motion presets `stiffness: 350, damping: 25` for modal popups and drawer slide-ins.

---

## 2. Information Architecture & Route Map

```
/
├── /login                         # Creator / Admin Auth (Magic Link or OTP)
├── /creator
│   ├── /dashboard                 # Main Creator Hub (Metrics, Actions, History)
│   ├── /transactions              # Deep Transaction History & Ledger
│   └── /settings                  # Saved Payout UPI / Bank Accounts
└── /admin
    ├── /dashboard                 # Treasury & Live Gateway Metrics
    ├── /withdrawals               # Payout Request Approvals & UTR Stamping
    ├── /deposits                  # Deposit Gateway Reconciliation & Audits
    └── /creators                  # Creator Accounts, Balances & Adjustments
```

---

## 3. Creator Experience (User Dashboard)

### 3.1 Executive Metrics Cards
The creator dashboard header prominently features 4 high-contrast KPI cards arranged in a responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`).

| Metric Card | Value Display | Subtitle / Badge | Visual Indicator |
| :--- | :--- | :--- | :--- |
| **Available Balance** | `₹42,850.00` | *Ready for Instant Payout* | Glowing Emerald Pill, `[Withdraw]` CTA |
| **Total Deposited** | `₹1,18,500.00` | *All-time gross funding* | Indigo arrow diagonal-down |
| **Total Withdrawn** | `₹72,400.00` | *Disbursed to bank/UPI* | Teal arrow diagonal-up |
| **Pending In-Flight** | `₹3,250.00` | *1 deposit, 1 payout pending* | Amber pulsing dot |

#### Quick Action Bar:
Directly above the metrics or embedded in the hero balance card:
- `[+ Add Funds / Deposit]` (Emerald filled button with `+` icon) -> Opens **Deposit Modal**.
- `[↑ Request Payout]` (Subtle dark outline button with arrow icon) -> Opens **Withdrawal Modal**.

---

### 3.2 Deposit Modal & 5-Minute Dynamic UPI QR Flow
The core transaction engine of Crazy Wallet. Designed for maximum payment completion rates, complete fee transparency, and automated status transition.

#### Step 1: Configuration & Instant Fee Preview
- **Amount Input Box:** Clean numerical field with prefix `₹`, auto-focus, large typography (`text-3xl font-mono`).
- **Quick Amount Chips:** `[₹100]`, `[₹500]`, `[₹1,000]`, `[₹2,000]`, `[₹5,000]` (Clicking updates input with active border).
- **Fee Preview Breakdown Card (Live Computed):**
  ```
  ┌─────────────────────────────────────────────────────────────┐
  │ Fee & Credit Breakdown                                      │
  ├──────────────────────────────────┬──────────────────────────┤
  │ Deposit Amount                   │ ₹ 1,000.00               │
  │ Platform Fee (20% + ₹15)         │ - ₹ 215.00               │
  │   • 20% Base Platform Service Fee│   ₹ 200.00               │
  │   • Gateway Processing Fee       │   ₹ 15.00                │
  ├──────────────────────────────────┼──────────────────────────┤
  │ Net Credited to Crazy Wallet     │ ₹ 785.00                 │
  └──────────────────────────────────┴──────────────────────────┘
  ```
- **Validation Rules:** Minimum amount: `₹100`, Maximum amount: `₹1,00,000`.
- **CTA:** `[Generate Deposit QR →]` (Emerald full-width button with loader spinner state).

#### Step 2: Dynamic QR Display & Live 5-Minute Countdown
Upon clicking "Generate Deposit QR", the modal transitions to the active payment screen:

```
┌─────────────────────────────────────────────────────────────┐
│ Deposit ₹1,000.00                          Order #CW-92841  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                [  5:00 Ring Countdown  ]                    │
│                     Expires in 04:42                        │
│                                                             │
│              ┌───────────────────────────┐                  │
│              │                           │                  │
│              │     [ Dynamic UPI QR ]    │                  │
│              │       (High Contrast)     │                  │
│              │                           │                  │
│              └───────────────────────────┘                  │
│                                                             │
│       Scan with GPay, PhonePe, Paytm, or any UPI app        │
│                                                             │
│   [ Copy UPI Intent Link ]       [ Copy UPI ID (VPA) ]      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ⚡ Real-Time Polling Active:                                │
│  (●) Waiting for bank confirmation... (Auto-detecting)      │
│  Do not close or reload this window.                        │
└─────────────────────────────────────────────────────────────┘
```

#### Key Micro-UX Elements:
1. **Prominent 5:00 Circular Countdown:**
   - SVG circular stroke with smooth dash offset transition.
   - **T > 60s:** Crisp emerald circle (`#10B981`).
   - **T <= 60s:** Circle and text animate to Amber (`#F59E0B`) with subtle pulse.
   - **T <= 20s:** Circle and text turn Urgency Red (`#EF4444`) with heartbeat animation.
2. **Dynamic UPI Intent Integration:**
   - Generates both visual QR code and clickable deeplink:
     `upi://pay?pa=crazywallet.pay@icici&pn=CrazyWallet&am=1000.00&tr=CW-92841&tn=CrazyWallet-Deposit-CW-92841&cu=INR`
   - On mobile devices: Display prominent `[Open in GPay / PhonePe]` direct app launcher button.
3. **Real-time Status Polling:**
   - Background worker polls `/api/deposits/CW-92841/status` every **2.5 seconds**.
   - Visual radar pulse indicator with rotating gradient ring.
   - When payment is received from XenPay webhook:
     - Sound effect / haptic feedback.
     - Confetti animation triggered.
     - Modal transitions to **Success State**: "Payment Verified! ₹785.00 credited to Available Balance."
4. **QR Expiration State (Timer hits 0:00):**
   - QR code instantly blurs (`filter: blur(8px)`) with gray overlay.
   - Badge updates: `[QR Expired]` (Gray/Red).
   - Message: *"Payment window expired to prevent double billing."*
   - Primary button switches to: `[🔄 Generate New QR]` (Preserves the ₹1,000 input).

---

### 3.3 Withdrawal Modal & Payout Routing

Creators can withdraw available funds anytime into their verified bank account or UPI ID.

#### User Flow & Step-by-Step UX:
1. **Source Balance Banner:**
   - Shows current `Available Balance: ₹42,850.00`.
   - `[Use Max]` button to autofill maximum eligible balance.
2. **Amount Input & Transparent Payout Breakdown:**
   ```
   Withdrawal Amount:               ₹ 5,000.00
   Platform Fee (20% + ₹15):       - ₹ 1,015.00
   ─────────────────────────────────────────────
   Net Amount Transferred to Bank:  ₹ 3,985.00
   ```
3. **Payout Destination Selector (Tabs):**
   - **Option A: UPI ID (Instant VPA)**
     - Input field: `e.g. yourname@okhdfcbank`
     - Inline regex check: Validates standard UPI suffix (`@okhdfcbank`, `@ybl`, `@paytm`, `@ibl`, etc.).
   - **Option B: Direct Bank Transfer (NEFT / IMPS)**
     - Beneficiary Name (as per Bank Passbook)
     - Account Number
     - Confirm Account Number (with paste-blocking for security)
     - IFSC Code (with auto-lookup of Bank Name & Branch e.g., "HDFC BANK - KORAMANGALA BRANCH")
4. **Safety Confirmation Step:**
   - Clicking `[Continue]` opens a double-check review bottom sheet:
     *"Please verify destination details. Withdrawals to incorrect UPI IDs cannot be recovered."*
   - Checkbox: `[x] I confirm the UPI ID / Account details belong to me.`
   - Final Submit: `[Confirm & Request Payout]` -> Transitions to Pending state with reference ID.

---

### 3.4 Transaction History & Forensic Details Drawer

#### Table View Structure:
- **Filters:** `[All (148)]` | `[Deposits (92)]` | `[Withdrawals (56)]` | `[Pending (2)]`
- **Search:** Search by Order ID, UTR, or Amount.
- **Columns:**
  1. **Type:** Icon + Label (`Deposit` with green arrow, `Withdrawal` with blue arrow).
  2. **Transaction ID:** `CW-DEP-10492` (Clickable monospace link).
  3. **Gross Amount:** `₹1,000.00`
  4. **Fee (20% + ₹15):** `₹215.00`
  5. **Net Wallet / Payout:** `₹785.00` (Emerald for deposit credit, White for payout).
  6. **Destination / Source:** `UPI: rahul@upi` or `XenPay Gateway`.
  7. **Status Badge:**
     - `● Success` (Emerald badge `#10B981`)
     - `● Pending` (Amber badge `#F59E0B`)
     - `● Failed / Rejected` (Rose badge `#EF4444`)
     - `● Expired` (Muted slate badge `#64748B`)
  8. **Date & Time:** `24 Nov 2026, 04:32 PM`
  9. **Action:** `[View Details →]`

#### Slide-Over Details Drawer (Clicking any row):
A slide-over right panel (`w-full max-w-md`) displaying comprehensive transaction audit logs:
- **Header:** Transaction Status Banner with Icon and Timestamp.
- **Financial Breakdown Card:** Gross Amount, Admin Fee (20% itemized + ₹15 gateway fee), Net Disbursed.
- **Gateway Forensic Metadata:**
  - `XenPay Order ID:` `XP_ORD_981240182` (With Copy icon)
  - `Bank UTR / Reference:` `432810938120` (With Copy icon)
  - `Payment Method:` `UPI (Google Pay)`
  - `Initiated At:` `2026-11-24 16:32:10 IST`
  - `Settled At:` `2026-11-24 16:33:04 IST` (Settled in 54s)
- **Support Action:** `[Need Help with this Transaction?]` button opening pre-filled support ticket.

---

## 4. Admin Panel Experience

### 4.1 Executive Treasury Dashboard
Designed for platform owners to maintain real-time visibility over gateway balances, creator liabilities, and accrued profits.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CRAZY WALLET TREASURY & LIQUIDITY MONITOR                         [Live ●]  │
├─────────────────┬─────────────────┬───────────────────┬─────────────────────┤
│ XenPay Balance  │ Creator Balance │ Net Admin Margin  │ Pending Payouts     │
│ (Gateway Live)  │ (Total Liability│ (Gross Profit)    │ (Action Required)   │
│                 │                 │                   │                     │
│  ₹ 1,84,290.00  │  ₹ 1,12,450.00  │   ₹ 71,840.00     │      7 Requests     │
│  ▲ Auto-synced  │  ▲ 142 Creators │   ▲ Margin: ~21.5%│   [Review Payouts →]│
└─────────────────┴─────────────────┴───────────────────┴─────────────────────┘
```

#### Real-Time Treasury Indicators:
- **Solvency Ratio Gauge:** `XenPay Live Balance / Creator Total Liability`. If ratio < 1.0, an alert banner flashes red: *"Gateway Liquidity Below Creator Liability!"*
- **Gateway Heartbeat Widget:** Displays XenPay API latency (`42ms`) and webhook delivery health (99.98% success rate).

---

### 4.2 Withdrawal Management Table & Payout Workflow

The operational heart for admin approvals. Payout requests submitted by creators are queued here.

#### Management Table Schema:
| Creator Name & Email | Request Date | Requested | Fee (20%+15) | Net Disbursed | Method Details | Status | Actions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Aman Verma**<br>`aman@creator.com` | Today, 14:10 | ₹10,000 | ₹2,015 | **₹7,985** | UPI: `aman@okaxis` | `PENDING` | `[Approve]` `[Reject]` |
| **Priya Sharma**<br>`priya@studios.in`| Today, 13:45 | ₹25,000 | ₹5,015 | **₹19,985**| Bank: HDFC *4920 | `PENDING` | `[Approve]` `[Reject]` |

#### Action Modal 1: Approve Payout
When Admin clicks `[Approve Payout]`:
1. Modal displays: Creator Name, Beneficiary Account/UPI, and exact Net Payout amount (`₹7,985.00`).
2. Input Field: **Bank Payout UTR / Transaction ID** (Mandatory, 12-digit reference number).
3. Payout Channel Select: `XenPay Auto-Payout` or `Manual NetBanking Disbursal`.
4. Checkbox: `[x] I have verified the transfer has completed to the beneficiary.`
5. Button: `[Confirm & Mark Disbursed]` -> Updates creator's transaction status to `SUCCESS`, releases locked pending balance.

#### Action Modal 2: Reject & Refund to Wallet
When Admin clicks `[Reject & Refund]`:
1. Warning banner: *"Rejecting will immediately refund ₹10,000.00 back to Aman Verma's Available Balance."*
2. Mandatory Reason Selector:
   - `Invalid / Inactive UPI ID`
   - `Bank Account Name Mismatch`
   - `Suspicious Activity / Verification Required`
   - `Other (Custom Note)`
3. Internal Admin Note (Logged in audit trail).
4. Button: `[Reject & Restore Creator Balance]`.

---

### 4.3 Deposit Audit Ledger & Margin Inspection
Ensures every single rupee collected via XenPay matches internal platform accounting.

- **Columns:**
  - `Deposit ID` | `Creator` | `Gateway Ref (XenPay)` | `Deposit Gross` | `Gateway Surcharge (e.g. 1.8%)` | `Admin Fee Charged (20% + ₹15)` | `Net Platform Margin` | `Status` | `Reconcile`
- **Reconciliation Badge:** Automatically compares XenPay webhook payload with internal ledger. Highlights any discrepancies with an amber tag `[Unreconciled]`.

---

### 4.4 Creator Management & Wallet Adjustments
- **Creator List with Search:** Quick lookup by Creator Name, Email, Wallet ID.
- **Individual Wallet Overview:** Shows Available Balance, Locked Balance, Total Inflow, Total Outflow.
- **Manual Balance Adjustment Modal (Super-Admin only):**
  - Adjustment Type: `[Credit / Add]` or `[Debit / Deduct]`
  - Amount: `₹ ...`
  - Audit Reason: Mandatory text area (e.g., "Reversal of disputed order #CW-8192").
  - Requires double-confirmation with admin security PIN.

---

## 5. State Management & Real-Time Polling Architecture

### 5.1 Architecture Diagram
```
  ┌─────────────────────────────────────────────────────────────┐
  │                    Creator Frontend UI                      │
  └──────────────┬──────────────────────────────▲───────────────┘
                 │ 1. POST /api/deposits        │ 4. Success State Trigger
                 │    { amount: 1000 }          │    Balance Auto-Updated
                 ▼                              │
  ┌──────────────────────────────┐              │
  │     Backend Payment Router   │              │
  └──────────────┬───────────────┘              │
                 │ 2. Create Order in XenPay    │
                 ▼                              │
  ┌──────────────────────────────┐              │
  │        XenPay Gateway        │              │
  │  (Generates UPI Intent & QR) │              │
  └──────────────┬───────────────┘              │
                 │                              │
                 │ 3. User scans & pays on UPI  │
                 ▼                              │
  ┌──────────────────────────────┐              │
  │     Bank / NPCI Settlement   │              │
  └──────────────┬───────────────┘              │
                 │ Webhook: payment.success     │
                 ▼                              │
  ┌──────────────────────────────┐              │
  │   Crazy Wallet Webhook API   │              │
  │ (Credits balance & updates)  │              │
  └──────────────┬───────────────┘              │
                 │                              │
                 ▼                              │
  ┌─────────────────────────────────────────────┴───────────────┐
  │                 Smart Polling Mechanism                     │
  │  TanStack Query `refetchInterval` = 2500ms                  │
  │  - Active only while modal is OPEN & timer > 0              │
  │  - Pauses when browser tab is hidden (visibilityState)      │
  │  - Auto-terminates on SUCCESS or EXPIRED                    │
  └─────────────────────────────────────────────────────────────┘
```

### 5.2 Fee Calculation Formula Engine (TypeScript)
```typescript
export interface FeeCalculation {
  grossAmount: number;
  percentageFee: number;
  flatFee: number;
  totalAdminFee: number;
  netCreditedOrDisbursed: number;
}

export function calculatePlatformFee(
  amount: number,
  type: 'DEPOSIT' | 'WITHDRAWAL'
): FeeCalculation {
  const grossAmount = Math.max(0, amount);
  const percentageFee = Math.round(grossAmount * 0.20 * 100) / 100; // 20%
  const flatFee = 15.0; // ₹15 flat
  const totalAdminFee = Math.round((percentageFee + flatFee) * 100) / 100;
  const netCreditedOrDisbursed = Math.max(0, Math.round((grossAmount - totalAdminFee) * 100) / 100);

  return {
    grossAmount,
    percentageFee,
    flatFee,
    totalAdminFee,
    netCreditedOrDisbursed,
  };
}
```

---

## 6. Component Blueprints & Reference Implementations

### 6.1 CountdownTimer Component (SVG Ring)
A circular countdown ring with color shifting and urgency pulsing under 60 seconds.

```tsx
import React, { useEffect, useState } from 'react';

interface CountdownTimerProps {
  initialSeconds?: number; // 300 for 5 minutes
  onExpire: () => void;
  isPaused?: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  initialSeconds = 300,
  onExpire,
  isPaused = false,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (isPaused || secondsRemaining <= 0) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsRemaining, isPaused, onExpire]);

  const progress = secondsRemaining / initialSeconds;
  const strokeDashoffset = circumference - progress * circumference;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Urgency color logic
  const isUrgent = secondsRemaining <= 60 && secondsRemaining > 0;
  const isCritical = secondsRemaining <= 20 && secondsRemaining > 0;
  const isExpired = secondsRemaining === 0;

  const strokeColor = isExpired
    ? '#4B5563' // Gray 600
    : isCritical
    ? '#EF4444' // Rose 500
    : isUrgent
    ? '#F59E0B' // Amber 500
    : '#10B981'; // Emerald 500

  return (
    <div className="flex flex-col items-center justify-center p-3">
      <div className="relative flex items-center justify-center w-28 h-28">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="#1F2937"
            strokeWidth="6"
            fill="transparent"
          />
          {/* Animated progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={strokeColor}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        {/* Center Timer Text */}
        <div className="absolute flex flex-col items-center">
          <span
            className={`font-mono text-xl font-bold tracking-wider tabular-nums ${
              isCritical
                ? 'text-red-500 animate-pulse'
                : isUrgent
                ? 'text-amber-400'
                : isExpired
                ? 'text-gray-500'
                : 'text-emerald-400'
            }`}
          >
            {formattedTime}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">
            {isExpired ? 'Expired' : 'Time Left'}
          </span>
        </div>
      </div>
      
      {isUrgent && !isExpired && (
        <p className="mt-1 text-xs text-amber-400 font-medium animate-pulse">
          ⚠️ Complete transfer before timer runs out
        </p>
      )}
    </div>
  );
};
```

---

### 6.2 DepositModal Component (Full State Machine)
Includes Amount Configuration, Fee Calculator, QR Display, 5:00 Timer, Smart Polling, Copy Actions, and Expiration State.

```tsx
import React, { useState, useEffect } from 'react';
import { CountdownTimer } from './CountdownTimer';
import { calculatePlatformFee } from '../utils/fees';
import { QRCodeSVG } from 'qrcode.react'; // Standard high-contrast QR
import { CheckCircle2, Copy, AlertTriangle, RefreshCw, X, ShieldCheck } from 'lucide-react';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (netCredited: number) => void;
}

type ModalState = 'AMOUNT_CONFIG' | 'GENERATING' | 'AWAITING_PAYMENT' | 'SUCCESS' | 'EXPIRED';

export const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [amount, setAmount] = useState<number>(1000);
  const [state, setState] = useState<ModalState>('AMOUNT_CONFIG');
  const [orderData, setOrderData] = useState<{
    orderId: string;
    upiString: string;
    upiId: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  const feeDetails = calculatePlatformFee(amount || 0, 'DEPOSIT');
  const quickChips = [100, 500, 1000, 2000, 5000];

  // Handle Order Generation
  const handleGenerateQR = async () => {
    setState('GENERATING');
    try {
      // Simulation of Backend API Call: POST /api/deposits
      // In production: const res = await api.createDeposit({ amount });
      setTimeout(() => {
        const mockOrderId = `CW-DEP-${Math.floor(100000 + Math.random() * 900000)}`;
        const mockUpiId = 'crazywallet.pay@icici';
        const mockUpiString = `upi://pay?pa=${mockUpiId}&pn=CrazyWallet&am=${amount.toFixed(
          2
        )}&tr=${mockOrderId}&tn=Deposit-${mockOrderId}&cu=INR`;

        setOrderData({
          orderId: mockOrderId,
          upiString: mockUpiString,
          upiId: mockUpiId,
        });
        setState('AWAITING_PAYMENT');
      }, 800);
    } catch (err) {
      setState('AMOUNT_CONFIG');
    }
  };

  // Real-Time Polling Hook while Awaiting Payment
  useEffect(() => {
    if (state !== 'AWAITING_PAYMENT' || !orderData) return;

    let pollCount = 0;
    const interval = setInterval(async () => {
      pollCount++;
      // Check deposit status: GET /api/deposits/:orderId/status
      // For UX demonstration, mock success after 18 seconds of polling
      if (pollCount >= 7) {
        clearInterval(interval);
        setState('SUCCESS');
        onSuccess(feeDetails.netCreditedOrDisbursed);
      }
    }, 2500); // Poll every 2.5 seconds

    return () => clearInterval(interval);
  }, [state, orderData, feeDetails.netCreditedOrDisbursed, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md overflow-hidden bg-[#0F1318] border border-[#232B36] rounded-2xl shadow-2xl text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#232B36]">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-100">Add Wallet Balance</h3>
              <p className="text-xs text-slate-400">Instant UPI Deposit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 rounded-lg hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {/* STATE 1: AMOUNT CONFIGURATION */}
          {state === 'AMOUNT_CONFIG' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  ENTER DEPOSIT AMOUNT
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-4 font-mono text-2xl font-semibold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="100"
                    max="100000"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    placeholder="0"
                    className="w-full pl-10 pr-4 py-3 bg-[#161B22] border border-[#232B36] focus:border-emerald-500 rounded-xl font-mono text-3xl font-bold text-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Quick Amount Chips */}
              <div className="flex flex-wrap gap-2">
                {quickChips.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                      amount === val
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-[#161B22] text-slate-300 border border-[#232B36] hover:bg-[#1C232D]'
                    }`}
                  >
                    +₹{val.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>

              {/* Transparent Fee Preview */}
              <div className="p-4 bg-[#161B22] border border-[#232B36] rounded-xl space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Gross Deposit:</span>
                  <span className="font-mono text-slate-200">₹{feeDetails.grossAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Platform Fee (20% + ₹15):</span>
                  <span className="font-mono text-rose-400">-₹{feeDetails.totalAdminFee.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-[#232B36] flex justify-between font-semibold">
                  <span className="text-emerald-400">Net Credited to Wallet:</span>
                  <span className="font-mono text-base text-emerald-400">
                    ₹{feeDetails.netCreditedOrDisbursed.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={amount < 100}
                onClick={handleGenerateQR}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                Generate Deposit QR (5:00) →
              </button>
            </div>
          )}

          {/* STATE 2: GENERATING SPINNER */}
          {state === 'GENERATING' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-sm text-slate-300">Creating dynamic UPI payment order...</p>
            </div>
          )}

          {/* STATE 3: AWAITING PAYMENT (QR + COUNTDOWN + POLLING) */}
          {state === 'AWAITING_PAYMENT' && orderData && (
            <div className="flex flex-col items-center space-y-4">
              {/* Live 5-Minute Ring Timer */}
              <CountdownTimer
                initialSeconds={300}
                onExpire={() => setState('EXPIRED')}
              />

              {/* High Contrast Dynamic QR Box */}
              <div className="relative p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center">
                <QRCodeSVG
                  value={orderData.upiString}
                  size={190}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* Scan Instructions */}
              <p className="text-xs text-center text-slate-400">
                Scan with <strong className="text-slate-200">GPay, PhonePe, Paytm</strong>, or any UPI app
              </p>

              {/* Copy Action Buttons */}
              <div className="grid grid-cols-2 gap-2 w-full pt-1">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(orderData.upiString);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-3 py-2 bg-[#161B22] hover:bg-[#1C232D] border border-[#232B36] rounded-lg text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedLink ? 'Link Copied!' : 'Copy Intent Link'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(orderData.upiId);
                    setCopiedUpi(true);
                    setTimeout(() => setCopiedUpi(false), 2000);
                  }}
                  className="px-3 py-2 bg-[#161B22] hover:bg-[#1C232D] border border-[#232B36] rounded-lg text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedUpi ? 'UPI ID Copied!' : 'Copy UPI ID'}
                </button>
              </div>

              {/* Polling Radar Status Banner */}
              <div className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-medium text-emerald-400">
                  Waiting for bank confirmation... (Auto-detecting)
                </span>
              </div>
            </div>
          )}

          {/* STATE 4: SUCCESS CONFIRMATION */}
          {state === 'SUCCESS' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
              <div className="p-4 bg-emerald-500/20 rounded-full text-emerald-400 animate-bounce">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white">Deposit Successful!</h4>
                <p className="text-sm text-slate-400 mt-1">
                  ₹{feeDetails.netCreditedOrDisbursed.toFixed(2)} has been credited to your ready balance.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full mt-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-xl transition-all"
              >
                Done
              </button>
            </div>
          )}

          {/* STATE 5: EXPIRED STATE */}
          {state === 'EXPIRED' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
              <div className="p-4 bg-rose-500/10 rounded-full text-rose-400">
                <AlertTriangle className="w-12 h-12" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Payment Window Expired</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  The 5-minute UPI session expired to avoid duplicate charges. Please generate a fresh QR.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateQR}
                className="w-full py-3 bg-[#161B22] hover:bg-[#1C232D] border border-slate-700 text-slate-200 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Generate New QR Code
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

---

### 6.3 WithdrawalModal Component
Dual Payout selection (UPI vs Bank Account), instant fee deduction breakdown, and two-step verification dialog.

```tsx
import React, { useState } from 'react';
import { calculatePlatformFee } from '../utils/fees';
import { X, ArrowUpRight, Building2, Smartphone, AlertCircle, Check } from 'lucide-react';

interface WithdrawalModalProps {
  isOpen: boolean;
  availableBalance: number;
  onClose: () => void;
  onSubmit: (data: WithdrawalPayload) => Promise<void>;
}

export interface WithdrawalPayload {
  amount: number;
  payoutMethod: 'UPI' | 'BANK';
  upiId?: string;
  bankDetails?: {
    accountNumber: string;
    ifsc: string;
    beneficiaryName: string;
  };
}

export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  isOpen,
  availableBalance,
  onClose,
  onSubmit,
}) => {
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<'UPI' | 'BANK'>('UPI');
  const [upiId, setUpiId] = useState('');
  
  // Bank inputs
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  
  // Confirmation state
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fee = calculatePlatformFee(amount, 'WITHDRAWAL');
  const isAmountValid = amount >= 100 && amount <= availableBalance;

  const isFormComplete =
    method === 'UPI'
      ? upiId.includes('@') && upiId.length > 5
      : beneficiaryName.length > 2 &&
        accountNumber.length > 8 &&
        accountNumber === confirmAccount &&
        ifsc.length === 11;

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        amount,
        payoutMethod: method,
        upiId: method === 'UPI' ? upiId : undefined,
        bankDetails:
          method === 'BANK'
            ? { accountNumber, ifsc, beneficiaryName }
            : undefined,
      });
      setIsConfirming(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg overflow-hidden bg-[#0F1318] border border-[#232B36] rounded-2xl shadow-2xl text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#232B36]">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-100">Request Payout</h3>
              <p className="text-xs text-slate-400">Transfer funds to Bank or UPI</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Available Balance Ribbon */}
          <div className="flex items-center justify-between p-3.5 bg-[#161B22] border border-[#232B36] rounded-xl">
            <div>
              <p className="text-xs text-slate-400">Available to Withdraw</p>
              <p className="font-mono text-xl font-bold text-white">
                ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAmount(availableBalance)}
              className="px-3 py-1.5 bg-[#1C232D] hover:bg-[#252F3D] border border-slate-700 text-xs font-semibold text-emerald-400 rounded-lg transition-all"
            >
              Use Max
            </button>
          </div>

          {/* Amount Field */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">WITHDRAWAL AMOUNT</label>
            <div className="relative">
              <span className="absolute left-4 top-3 font-mono text-2xl text-slate-400">₹</span>
              <input
                type="number"
                min="100"
                max={availableBalance}
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="0"
                className="w-full pl-10 pr-4 py-3 bg-[#161B22] border border-[#232B36] focus:border-blue-500 rounded-xl font-mono text-2xl font-bold text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Payout Method Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">SELECT PAYOUT DESTINATION</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMethod('UPI')}
                className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
                  method === 'UPI'
                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                    : 'bg-[#161B22] border-[#232B36] text-slate-400 hover:bg-[#1C232D]'
                }`}
              >
                <Smartphone className="w-5 h-5" />
                <div className="text-left">
                  <p className="text-xs font-bold">Instant UPI</p>
                  <p className="text-[10px] opacity-75">VPA transfer</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMethod('BANK')}
                className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
                  method === 'BANK'
                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                    : 'bg-[#161B22] border-[#232B36] text-slate-400 hover:bg-[#1C232D]'
                }`}
              >
                <Building2 className="w-5 h-5" />
                <div className="text-left">
                  <p className="text-xs font-bold">Bank Account</p>
                  <p className="text-[10px] opacity-75">NEFT / IMPS</p>
                </div>
              </button>
            </div>
          </div>

          {/* Form Fields: UPI */}
          {method === 'UPI' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">UPI ID (VPA)</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. name@okhdfcbank"
                className="w-full px-4 py-2.5 bg-[#161B22] border border-[#232B36] focus:border-blue-500 rounded-xl text-sm font-mono text-white focus:outline-none"
              />
            </div>
          )}

          {/* Form Fields: Bank Transfer */}
          {method === 'BANK' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Beneficiary Name</label>
                <input
                  type="text"
                  value={beneficiaryName}
                  onChange={(e) => setBeneficiaryName(e.target.value)}
                  placeholder="Full name as in Bank Records"
                  className="w-full px-3.5 py-2 bg-[#161B22] border border-[#232B36] rounded-xl text-sm text-white focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Account Number</label>
                  <input
                    type="password"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Account Number"
                    className="w-full px-3.5 py-2 bg-[#161B22] border border-[#232B36] rounded-xl text-sm font-mono text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Confirm Account</label>
                  <input
                    type="text"
                    value={confirmAccount}
                    onChange={(e) => setConfirmAccount(e.target.value)}
                    placeholder="Re-enter Account"
                    className="w-full px-3.5 py-2 bg-[#161B22] border border-[#232B36] rounded-xl text-sm font-mono text-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  placeholder="HDFC0001234"
                  maxLength={11}
                  className="w-full px-3.5 py-2 bg-[#161B22] border border-[#232B36] rounded-xl text-sm font-mono uppercase text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Transparent Fee & Net Disbursal Card */}
          <div className="p-4 bg-[#161B22] border border-[#232B36] rounded-xl space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Gross Withdrawal:</span>
              <span className="font-mono text-slate-200">₹{fee.grossAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Admin Fee (20% + ₹15):</span>
              <span className="font-mono text-rose-400">-₹{fee.totalAdminFee.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-[#232B36] flex justify-between font-semibold">
              <span className="text-blue-400">Net Transferred to You:</span>
              <span className="font-mono text-base text-blue-400">
                ₹{fee.netCreditedOrDisbursed.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            disabled={!isAmountValid || !isFormComplete}
            onClick={() => setIsConfirming(true)}
            className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all"
          >
            Review & Confirm Payout →
          </button>
        </div>

        {/* Double-Check Confirmation Overlay Modal */}
        {isConfirming && (
          <div className="absolute inset-0 bg-[#090B0E]/95 p-6 flex flex-col justify-between z-10">
            <div>
              <div className="flex items-center gap-2 text-amber-400 mb-3">
                <AlertCircle className="w-5 h-5" />
                <h4 className="font-semibold text-lg text-white">Confirm Payout Details</h4>
              </div>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Please double-check the recipient details below. Transactions to incorrect accounts cannot be reversed by Crazy Wallet.
              </p>

              <div className="p-4 bg-[#161B22] border border-[#232B36] rounded-xl space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Recipient Method:</span>
                  <span className="font-semibold text-white">{method === 'UPI' ? 'UPI ID' : 'Bank Transfer'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Destination:</span>
                  <span className="font-mono text-sky-400 font-semibold">{method === 'UPI' ? upiId : `${accountNumber} (${ifsc})`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Net Amount to Receive:</span>
                  <span className="font-mono text-emerald-400 font-bold text-sm">
                    ₹{fee.netCreditedOrDisbursed.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="py-3 bg-[#161B22] hover:bg-[#1C232D] border border-slate-700 text-slate-300 font-medium rounded-xl"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Payout'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

---

### 6.4 TransactionDrawer Component
Slide-over forensic details pane showing UTR, XenPay order IDs, breakdown calculations, and copy utilities.

```tsx
import React from 'react';
import { X, Copy, Check, ExternalLink, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export interface TransactionRecord {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  grossAmount: number;
  adminFee: number;
  netAmount: number;
  status: 'SUCCESS' | 'PENDING' | 'REJECTED' | 'EXPIRED';
  timestamp: string;
  utr?: string;
  xenPayOrderId?: string;
  payoutDestination?: string;
}

interface DrawerProps {
  transaction: TransactionRecord | null;
  onClose: () => void;
}

export const TransactionDrawer: React.FC<DrawerProps> = ({ transaction, onClose }) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  if (!transaction) return null;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const statusColors = {
    SUCCESS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    REJECTED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    EXPIRED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md h-full bg-[#0F1318] border-l border-[#232B36] p-6 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#232B36]">
            <div>
              <h3 className="text-base font-bold text-white">Transaction Details</h3>
              <p className="font-mono text-xs text-slate-400">{transaction.id}</p>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Status Badge Hero */}
          <div className="p-4 bg-[#161B22] border border-[#232B36] rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  transaction.type === 'DEPOSIT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                }`}
              >
                {transaction.type === 'DEPOSIT' ? (
                  <ArrowDownLeft className="w-5 h-5" />
                ) : (
                  <ArrowUpRight className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400">{transaction.type}</p>
                <p className="font-mono text-xl font-bold text-white">
                  ₹{transaction.grossAmount.toFixed(2)}
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                statusColors[transaction.status]
              }`}
            >
              {transaction.status}
            </span>
          </div>

          {/* Financial Breakdown */}
          <div className="p-4 bg-[#161B22] border border-[#232B36] rounded-xl space-y-2.5 text-xs">
            <h4 className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
              Platform Accounting
            </h4>
            <div className="flex justify-between text-slate-400">
              <span>Gross Transaction:</span>
              <span className="font-mono text-slate-200">₹{transaction.grossAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Admin Service Fee (20% + ₹15):</span>
              <span className="font-mono text-rose-400">-₹{transaction.adminFee.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-[#232B36] flex justify-between font-semibold">
              <span className="text-white">
                {transaction.type === 'DEPOSIT' ? 'Net Credited to Wallet' : 'Net Disbursed to Bank'}
              </span>
              <span className="font-mono text-emerald-400 text-sm">
                ₹{transaction.netAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Forensic Reference Identifiers */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
              Audit & Gateway References
            </h4>

            {transaction.utr && (
              <div className="p-3 bg-[#161B22] border border-[#232B36] rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Bank UTR Reference</span>
                  <span className="font-mono font-medium text-sky-400">{transaction.utr}</span>
                </div>
                <button
                  onClick={() => handleCopy('utr', transaction.utr!)}
                  className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                >
                  {copiedField === 'utr' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            {transaction.xenPayOrderId && (
              <div className="p-3 bg-[#161B22] border border-[#232B36] rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">XenPay Order ID</span>
                  <span className="font-mono font-medium text-slate-300">{transaction.xenPayOrderId}</span>
                </div>
                <button
                  onClick={() => handleCopy('xenpay', transaction.xenPayOrderId!)}
                  className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                >
                  {copiedField === 'xenpay' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            <div className="p-3 bg-[#161B22] border border-[#232B36] rounded-xl text-xs">
              <span className="text-slate-400 block text-[10px]">Timestamp</span>
              <span className="font-mono text-slate-300">{transaction.timestamp}</span>
            </div>
          </div>
        </div>

        {/* Footer Support CTA */}
        <div className="pt-4 border-t border-[#232B36]">
          <button
            type="button"
            className="w-full py-2.5 bg-[#161B22] hover:bg-[#1C232D] border border-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Inquire with Support
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 7. Implementation Checklist & Verification Matrix

- [x] **Theme & Layout Tokens:** Full obsidian dark mode specification (`#090B0E` / `#0F1318` / `#10B981`).
- [x] **Creator Metrics Cards:** Available Balance, Total Deposited, Total Withdrawn, Pending Escrow.
- [x] **Deposit 5-Minute Flow:** Real-time fee preview (20% + ₹15), Quick Chips, SVG Ring Countdown, Dynamic UPI Intent, Auto-detecting 2.5s Polling, Expired State Reset.
- [x] **Withdrawal Flow:** Dynamic Fee Preview, Dual Payout tabs (UPI vs Bank), Confirmation Bottom Sheet.
- [x] **Transaction History:** Status Badges, Filtering tabs, Forensic Details Drawer with UTR copy.
- [x] **Admin Executive Panel:** XenPay Gateway Live Balance, Liability counter, Gross Profit margin, Approval modals with UTR entry, Rejection with automated refund.
- [x] **Production Components:** Fully typed React TSX templates ready for drop-in implementation.
