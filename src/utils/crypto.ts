import crypto from 'crypto';

/**
 * Compute HMAC-SHA256 signature for a raw body buffer or string using API Secret
 * @param rawBody - Raw unparsed request body string or Buffer
 * @param secret - XenPay API Secret
 */
export function computeHmacSignature(rawBody: string | Buffer, secret: string): string {
  const content = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  return crypto.createHmac('sha256', secret).update(content).digest('hex');
}

/**
 * Verify webhook signature with timing-attack prevention
 * @param rawBody - Raw webhook request body as received on wire
 * @param receivedSignature - Signature string from X-Signature header
 * @param secret - XenPay API Secret
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  receivedSignature: string | undefined | null,
  secret: string
): boolean {
  if (!receivedSignature || typeof receivedSignature !== 'string') {
    return false;
  }

  // Clean signature (remove potential prefixes like 'sha256=' or whitespace)
  const cleanReceived = receivedSignature.trim().replace(/^sha256=/i, '');
  const expectedSignature = computeHmacSignature(rawBody, secret);

  // Both must be valid hex strings and have equal byte lengths
  const receivedBuffer = Buffer.from(cleanReceived, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (receivedBuffer.length === 0 || receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

/**
 * Generate a unique, traceable merchant order ID for Crazy Wallet deposits
 * Format: CW_DEP_<timestamp>_<randomHex>
 */
export function generateMerchantOrderId(prefix = 'CW_DEP'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}_${timestamp}_${randomSuffix}`;
}
