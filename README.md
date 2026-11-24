# ⚡ Crazy Wallet — Creator Wallet & Admin Treasury Platform

A high-performance, secure fintech web application built to connect creators to the **XenPay Payment Gateway**, featuring a 5-minute dynamic UPI QR code flow, middleman fee arbitrage, and an Admin approval workflow for creator payouts.

---

## 🚀 Key Features

1. **Creator Wallet Portal**
   - **Real-Time Balances:** Displays **Total Deposited**, **Ready to Withdraw** (available balance), and **Pending Withdrawal** (locked in admin review).
   - **5-Minute Dynamic UPI QR:** Generates a unique XenPay QR code with a live `05:00` countdown timer.
   - **Auto-Detecting Poller:** Continuously checks gateway payment status every 2.5s; updates balances instantly upon payment without refreshing the page.
   - **Late Payment Grace:** If a creator pays at minute 4:58 and the webhook arrives after expiry, the system automatically honors the bank UTR and credits the wallet.
   - **Withdrawal Requests:** Creators submit payout requests to their UPI ID or Bank Account (IFSC + Account Number).

2. **Admin Panel (Middleman Between XenPay & Creators)**
   - **Transparent Fee Arbitrage:**
     - **XenPay Gateway Fee:** 14% + ₹10
     - **Admin Platform Fee:** 20% + ₹15
     - **Admin Net Profit Margin:** **6% + ₹5 per transaction**
   - **Live XenPay Gateway Balance:** Polled live from `https://xen-pays.space/api/balance.php`.
   - **Pending Withdrawals Queue:** Review creator payout requests with one-click **[Approve & Settle]** or **[Reject & Refund]** (which immediately returns locked funds back to the creator's wallet).
   - **Deposit Audit Ledger:** Granular breakdown of every deposit comparing XenPay cost vs Admin fee vs Net platform profit.

3. **Production Security Architecture**
   - **Timing-Safe HMAC-SHA256:** Webhook verification using `crypto.timingSafeEqual` over unmutated raw request bodies.
   - **Integer Paisa Math:** Eliminates IEEE 754 floating-point rounding errors (`₹1 = 100 paise`).
   - **Atomic Concurrency Locks:** Prevents double-withdrawal race conditions.
   - **Credential Isolation:** Gateway API Key and API Secret are stored strictly on the backend.

---

## 🧮 Financial Mathematics Breakdown

$$\text{Admin Fee} = 20\% + ₹15.00$$
$$\text{XenPay Fee} = 14\% + ₹10.00$$
$$\text{Admin Net Profit} = (0.20 \times \text{Amount} + 15) - (0.14 \times \text{Amount} + 10) = 0.06 \times \text{Amount} + ₹5.00$$

### Deposit Example:
| Gross Deposit | Admin Fee (20% + ₹15) | Net Credited to Creator | XenPay Cost (14% + ₹10) | Admin Net Profit (6% + ₹5) |
| :---: | :---: | :---: | :---: | :---: |
| **₹100.00** | ₹35.00 | ₹65.00 | ₹24.00 | **₹11.00** |
| **₹500.00** | ₹115.00 | ₹385.00 | ₹80.00 | **₹35.00** |
| **₹1,000.00** | ₹215.00 | ₹785.00 | ₹150.00 | **₹65.00** |
| **₹5,000.00** | ₹1,015.00 | ₹3,985.00 | ₹710.00 | **₹305.00** |

*Note: Deposits under ₹50 are rejected to prevent negative net credit.*

---

## 💻 Local Quick Start

### 1. Install & Build
```bash
npm install
npm run build
```

### 2. Run Test Suite
```bash
npm test
```
*(All 16 unit, cryptographic, and financial integration tests will execute).*

### 3. Start Server
```bash
npm start
```
Open **`http://localhost:3000`** in your browser.

- **Admin Account:** `admin@crazywallet.com` / `admin123`
- **Demo Creator:** `rahul@creator.com` / `creator123` (Preloaded with ₹3,985 ready to test withdraw)

---

## 🌐 100% Free & Secure Deployment Guide

You can host Crazy Wallet **100% free forever** with automatic SSL:

### Option A: Vercel (Recommended for 24/7 Fast Webhooks) + Neon Postgres
1. Push this project to your GitHub account:
   ```bash
   git add .
   git commit -m "Crazy Wallet initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/crazy-wallet.git
   git push -u origin main
   ```
2. Create a free account at [neon.tech](https://neon.tech) and copy your PostgreSQL connection string.
3. Go to [vercel.com](https://vercel.com) -> **Add New Project** -> Select your GitHub repository.
4. Set Environment Variables:
   - `XENPAY_API_KEY`: `pk_fd1be9df17b3c1e99c91faaa`
   - `XENPAY_API_SECRET`: `sk_47908aa255f60d039201ff0045663e1c7a7c7262167d1c46`
   - `DATABASE_URL`: Your Neon Postgres connection string
5. Click **Deploy**. Vercel provisions free HTTPS (`https://crazy-wallet.vercel.app`).
6. In XenPay Dashboard -> **Settings**, set Webhook URL to:
   `https://crazy-wallet.vercel.app/api/webhook/xenpay`

---

## 📂 Project Structure

```
crazy-wallet/
├── public/
│   ├── index.html              # Full Creator & Admin Web Application UI
│   └── deposit-modal.html       # Standalone component
├── src/
│   ├── client/
│   │   └── xenpay.client.ts     # Production XenPay API integration
│   ├── controllers/
│   │   └── wallet.controller.ts # Deposit, withdraw, and admin endpoints
│   ├── database/
│   │   ├── crazy-wallet.db.ts   # In-memory / SQL data models
│   │   └── order.repository.ts  # Idempotent order repository
│   ├── routes/
│   │   └── payment.routes.ts    # Express route mappings
│   ├── security/
│   │   ├── fee-calculator.ts    # Exact financial formulas
│   │   ├── wallet-concurrency.ts# Atomic row locking
│   │   └── webhook.ts           # Timing-safe HMAC-SHA256 verifier
│   ├── services/
│   │   └── wallet.service.ts    # 5-min QR expiry & admin approval workflow
│   ├── server.ts                # Express HTTP server with raw-body preservation
│   └── index.ts                 # Package entry point
├── test/
│   ├── crazy_wallet.test.ts     # Business logic & workflow tests
│   └── xenpay.test.ts           # Gateway & cryptographic tests
├── ARCHITECTURE_FINANCIAL_SPEC.md
├── FRONTEND_UI_UX_SPEC.md
├── package.json
└── tsconfig.json
```
