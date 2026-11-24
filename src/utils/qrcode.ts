import QRCode from 'qrcode';

export interface QrCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

const DEFAULT_OPTIONS: QrCodeOptions = {
  width: 300,
  margin: 2,
  color: {
    dark: '#0f172a', // Slate 900
    light: '#ffffff', // Clean white background
  },
  errorCorrectionLevel: 'M',
};

/**
 * Generate Base64 Data URL (PNG) for instant inline <img> rendering
 * @param text - The XenPay payment_url (e.g. https://xen-pays.space/pay/?id=ORDA1B2C3D4E5F6)
 */
export async function generateQrCodeDataUrl(
  text: string,
  options?: Partial<QrCodeOptions>
): Promise<string> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
    margin: mergedOptions.margin,
    width: mergedOptions.width,
    color: mergedOptions.color,
  });
}

/**
 * Generate SVG string for crisp, responsive vector display
 * @param text - The XenPay payment_url
 */
export async function generateQrCodeSvg(
  text: string,
  options?: Partial<QrCodeOptions>
): Promise<string> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
    margin: mergedOptions.margin,
    width: mergedOptions.width,
    color: mergedOptions.color,
  });
}
