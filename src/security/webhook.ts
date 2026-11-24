import crypto from 'crypto';

/**
 * Result of webhook signature validation
 */
export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Cryptographically verifies XenPay webhook HMAC-SHA256 signature
 * 
 * Rules enforced:
 * 1. Must be computed on raw byte/string payload (never after JSON.parse)
 * 2. Uses crypto.timingSafeEqual to prevent side-channel timing attacks
 * 3. Compares hex buffers with strict length match validation
 */
export function verifyXenPayWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  apiSecret: string
): WebhookValidationResult {
  if (!signatureHeader || signatureHeader.trim() === '') {
    return {
      isValid: false,
      error: 'Missing X-Signature header in webhook request',
    };
  }

  if (!apiSecret || apiSecret.trim() === '') {
    throw new Error('SECURITY CONFIGURATION ERROR: XenPay API Secret is missing on the server.');
  }

  try {
    // 1. Calculate HMAC-SHA256
    const calculatedHashHex = crypto
      .createHmac('sha256', apiSecret)
      .update(rawBody)
      .digest('hex');

    // 2. Parse buffers
    const receivedBuffer = Buffer.from(signatureHeader.trim().toLowerCase(), 'hex');
    const calculatedBuffer = Buffer.from(calculatedHashHex.toLowerCase(), 'hex');

    // 3. Prevent RangeError on mismatched buffer lengths and reject mismatch
    if (receivedBuffer.length !== calculatedBuffer.length) {
      return {
        isValid: false,
        error: 'Signature length mismatch (potential tampering or wrong secret)',
      };
    }

    // 4. Timing-safe constant time comparison
    const isMatch = crypto.timingSafeEqual(receivedBuffer, calculatedBuffer);

    return {
      isValid: isMatch,
      error: isMatch ? undefined : 'HMAC signature does not match payload',
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: `Signature verification exception: ${err.message}`,
    };
  }
}
