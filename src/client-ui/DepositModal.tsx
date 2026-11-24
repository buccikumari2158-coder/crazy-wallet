import React, { useState, useEffect, useRef } from 'react';

export interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  depositData: {
    merchantOrderId: string;
    gatewayOrderId: string;
    amount: number;
    currency: string;
    paymentUrl: string;
    qrCodeDataUrl?: string; // Pre-generated base64 data URL from backend
    qrCodeSvg?: string;     // SVG markup from backend
    expiresInSeconds?: number;
  };
  onPaymentSuccess: (order: any) => void;
  onPaymentFailure?: (error: any) => void;
}

/**
 * Crazy Wallet Deposit & Payment Modal
 * Features:
 * - High-resolution inline QR Code
 * - Direct "Click to Pay" button (opens payment_url / UPI deep-link)
 * - Copy Payment Link with clipboard confirmation
 * - Real-time countdown timer (15 minutes)
 * - Active Polling Fallback to /api/deposit/check/:merchantOrderId every 3 seconds
 * - Automatic transition to success screen when payment confirms
 */
export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  depositData,
  onPaymentSuccess,
  onPaymentFailure,
}) => {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(depositData.expiresInSeconds || 900);
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED'>('PENDING');
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Countdown Timer
  useEffect(() => {
    if (!isOpen || paymentStatus !== 'PENDING') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPaymentStatus('EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, paymentStatus]);

  // 2. Active Polling Fallback (Polls gateway status every 3 seconds)
  useEffect(() => {
    if (!isOpen || paymentStatus !== 'PENDING' || timeLeft <= 0) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const checkStatus = async () => {
      try {
        setPollingAttempts((prev) => prev + 1);
        const res = await fetch(`/api/deposit/check/${depositData.merchantOrderId}`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.success && data.data) {
          const status = data.data.status;
          if (status === 'SUCCESS') {
            setPaymentStatus('SUCCESS');
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            onPaymentSuccess(data.data);
          } else if (status === 'FAILED') {
            setPaymentStatus('FAILED');
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (onPaymentFailure) onPaymentFailure(data.data);
          }
        }
      } catch (err) {
        console.warn('[DepositModal] Polling error:', err);
      }
    };

    // Initial check after 2 seconds, then poll every 3 seconds
    const timeout = setTimeout(checkStatus, 2000);
    pollIntervalRef.current = setInterval(checkStatus, 3000);

    return () => {
      clearTimeout(timeout);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, paymentStatus, timeLeft, depositData.merchantOrderId, onPaymentSuccess, onPaymentFailure]);

  if (!isOpen) return null;

  // Format MM:SS
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(depositData.paymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClickToPay = () => {
    window.open(depositData.paymentUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modalCard}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitleContainer}>
            <span style={styles.badge}>XenPay Secure</span>
            <h2 style={styles.title}>Deposit to Crazy Wallet</h2>
          </div>
          <button onClick={onClose} style={styles.closeButton} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Content depending on Status */}
        {paymentStatus === 'SUCCESS' ? (
          <div style={styles.successContainer}>
            <div style={styles.successIcon}>✓</div>
            <h3 style={styles.successTitle}>Payment Verified!</h3>
            <p style={styles.successSubtitle}>
              ₹{depositData.amount.toLocaleString()} has been credited to your Crazy Wallet balance.
            </p>
            <div style={styles.orderDetails}>
              <p><strong>Order ID:</strong> {depositData.merchantOrderId}</p>
            </div>
            <button onClick={onClose} style={styles.primaryButton}>
              Done
            </button>
          </div>
        ) : paymentStatus === 'EXPIRED' ? (
          <div style={styles.expiredContainer}>
            <div style={styles.expiredIcon}>⚠️</div>
            <h3 style={styles.expiredTitle}>Payment Window Expired</h3>
            <p style={styles.expiredSubtitle}>
              The 15-minute payment window has elapsed. Please initiate a new deposit.
            </p>
            <button onClick={onClose} style={styles.secondaryButton}>
              Close
            </button>
          </div>
        ) : (
          <div style={styles.body}>
            {/* Amount Banner */}
            <div style={styles.amountBanner}>
              <span style={styles.amountLabel}>Total Payable</span>
              <span style={styles.amountValue}>₹{depositData.amount.toFixed(2)}</span>
            </div>

            {/* Timer Banner */}
            <div style={styles.timerBadge}>
              <span>⏱️ Expires in: </span>
              <strong style={{ color: timeLeft < 120 ? '#ef4444' : '#1e293b' }}>
                {formattedTime}
              </strong>
            </div>

            {/* QR Code Container */}
            <div style={styles.qrWrapper}>
              {depositData.qrCodeDataUrl ? (
                <img
                  src={depositData.qrCodeDataUrl}
                  alt="Scan QR code to pay"
                  style={styles.qrImage}
                />
              ) : depositData.qrCodeSvg ? (
                <div
                  dangerouslySetInnerHTML={{ __html: depositData.qrCodeSvg }}
                  style={styles.qrSvgContainer}
                />
              ) : (
                <div style={styles.qrPlaceholder}>Loading QR Code...</div>
              )}
              <p style={styles.qrInstruction}>
                Scan with PhonePe, Google Pay, Paytm, or any UPI app
              </p>
            </div>

            {/* Actions: Click to Pay & Copy Link */}
            <div style={styles.actionGroup}>
              <button onClick={handleClickToPay} style={styles.payButton}>
                🚀 Click to Pay on Web / App
              </button>

              <button onClick={copyToClipboard} style={styles.copyButton}>
                {copied ? '✓ Link Copied to Clipboard!' : '📋 Copy Payment Link'}
              </button>
            </div>

            {/* Polling Indicator */}
            <div style={styles.statusIndicator}>
              <span style={styles.pulseDot}></span>
              <span style={styles.statusText}>
                Awaiting payment confirmation... (checking live)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Clean, Modern Inline Styles
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
  },
  headerTitleContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  badge: {
    backgroundColor: '#e0e7ff',
    color: '#4338ca',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 10,
    width: 'fit-content',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#0f172a',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    fontSize: 20,
    cursor: 'pointer',
    color: '#64748b',
    padding: 6,
  },
  body: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  amountBanner: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
  },
  amountLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  amountValue: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
  },
  timerBadge: {
    margin: '12px 0 8px',
    fontSize: 13,
    color: '#64748b',
  },
  qrWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: '12px 0',
    padding: 16,
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 8,
  },
  qrSvgContainer: {
    width: 220,
    height: 220,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    color: '#64748b',
  },
  qrInstruction: {
    margin: '12px 0 0',
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  actionGroup: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 8,
  },
  payButton: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  copyButton: {
    width: '100%',
    padding: '10px 16px',
    backgroundColor: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    animation: 'pulse 1.5s infinite',
  },
  statusText: {
    fontSize: 12,
    color: '#64748b',
  },
  successContainer: {
    padding: '36px 24px',
    textAlign: 'center',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 32,
    margin: '0 auto 16px',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 8px',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#475569',
    margin: '0 0 16px',
  },
  orderDetails: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    fontSize: 12,
    color: '#64748b',
    marginBottom: 24,
  },
  primaryButton: {
    padding: '10px 28px',
    backgroundColor: '#16a34a',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  expiredContainer: {
    padding: '36px 24px',
    textAlign: 'center',
  },
  expiredIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  expiredTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#b91c1c',
    margin: '0 0 8px',
  },
  expiredSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  secondaryButton: {
    padding: '10px 24px',
    backgroundColor: '#e2e8f0',
    color: '#334155',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
