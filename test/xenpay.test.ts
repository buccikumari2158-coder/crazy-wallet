import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeHmacSignature, verifyWebhookSignature } from '../src/utils/crypto.js';
import { InMemoryOrderRepository } from '../src/database/order.repository.js';
import { XenPayClient } from '../src/client/xenpay.client.js';
import { DepositService } from '../src/services/deposit.service.js';
import { generateQrCodeDataUrl, generateQrCodeSvg } from '../src/utils/qrcode.js';
import {
  XenPayAuthError,
  XenPayValidationError,
  mapHttpError,
} from '../src/errors/xenpay.errors.js';

describe('1. Cryptographic HMAC-SHA256 & Signature Verification', () => {
  const secret = 'sk_47908aa255f60d039201ff0045663e1c7a7c7262167d1c46';
  const rawBody = JSON.stringify({
    event: 'order.paid',
    order_id: 'ORDA1B2C3D4E5F6',
    merchant_order_id: 'CW_DEP_TEST_001',
    amount: 500,
    status: 'PAID',
    utr: 'UTR1234567890',
  });

  it('computes correct HMAC-SHA256 signature', () => {
    const signature = computeHmacSignature(rawBody, secret);
    assert.ok(signature);
    assert.equal(typeof signature, 'string');
    assert.equal(signature.length, 64); // 32 bytes hex = 64 chars
  });

  it('verifies authentic signature using timingSafeEqual', () => {
    const signature = computeHmacSignature(rawBody, secret);
    const isValid = verifyWebhookSignature(rawBody, signature, secret);
    assert.equal(isValid, true);
  });

  it('rejects tampered body or forged signature', () => {
    const signature = computeHmacSignature(rawBody, secret);
    const tamperedBody = rawBody.replace('500', '50000'); // Tampering amount!
    const isValid = verifyWebhookSignature(tamperedBody, signature, secret);
    assert.equal(isValid, false);
  });

  it('rejects malformed, empty or mismatched signature lengths safely without crashing', () => {
    assert.equal(verifyWebhookSignature(rawBody, '', secret), false);
    assert.equal(verifyWebhookSignature(rawBody, 'short-sig', secret), false);
    assert.equal(verifyWebhookSignature(rawBody, undefined, secret), false);
    assert.equal(verifyWebhookSignature(rawBody, null, secret), false);
  });
});

describe('2. Idempotent Order Repository & Balance Crediting', () => {
  it('handles concurrent/duplicate success webhooks idempotently without double-crediting', async () => {
    const repo = new InMemoryOrderRepository();
    const userId = 'user_abc123';
    const merchantOrderId = 'CW_DEP_IDEMPOTENT_001';

    // 1. Initial pending order
    await repo.createOrder({
      userId,
      merchantOrderId,
      gatewayOrderId: 'GW_001',
      amount: 1000,
      creditedAmount: null,
      currency: 'INR',
      status: 'PENDING',
      paymentUrl: 'https://xen-pays.space/pay/?id=GW_001',
      customerName: 'Ashish',
      customerPhone: '9876543210',
      customerEmail: 'ashish@example.com',
      verifiedViaGateway: false,
      webhookReceivedAt: null,
      utr: null,
    });

    // Initial user balance is 0
    assert.equal(await repo.getUserBalance(userId), 0);

    // 2. First Webhook arrives -> Marks SUCCESS and credits 1000
    const firstResult = await repo.markSuccess(merchantOrderId, { utr: 'UTR_FIRST_111' });
    assert.equal(firstResult.alreadyProcessed, false);
    assert.equal(firstResult.order.status, 'SUCCESS');
    assert.equal(await repo.getUserBalance(userId), 1000);

    // 3. Duplicate Webhook arrives -> Must detect already processed and NOT double-credit!
    const duplicateResult = await repo.markSuccess(merchantOrderId, { utr: 'UTR_FIRST_111' });
    assert.equal(duplicateResult.alreadyProcessed, true);
    assert.equal(duplicateResult.order.status, 'SUCCESS');

    // Crucial check: User balance must remain 1000, NOT 2000!
    assert.equal(await repo.getUserBalance(userId), 1000);
  });
});

describe('3. QR Code Generation', () => {
  const paymentUrl = 'https://xen-pays.space/pay/?id=ORDA1B2C3D4E5F6';

  it('generates a valid Base64 PNG Data URL', async () => {
    const dataUrl = await generateQrCodeDataUrl(paymentUrl);
    assert.ok(dataUrl.startsWith('data:image/png;base64,'));
  });

  it('generates an SVG string representation', async () => {
    const svg = await generateQrCodeSvg(paymentUrl);
    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('</svg>'));
  });
});

describe('4. Error Mapping & Client Input Validation', () => {
  it('correctly maps HTTP status codes to typed error classes', () => {
    const err401 = mapHttpError(401, { message: 'Invalid API Key' }, '/order/create');
    assert.equal(err401.name, 'XenPayAuthError');
    assert.equal(err401.statusCode, 401);
    assert.equal(err401.isRetryable, false);

    const err403 = mapHttpError(403, { message: 'IP restricted' }, '/order/create');
    assert.equal(err403.name, 'XenPayForbiddenError');

    const err404 = mapHttpError(404, { message: 'Order not found' }, '/order/status');
    assert.equal(err404.name, 'XenPayNotFoundError');

    const err409 = mapHttpError(409, { message: 'Duplicate merchant order id' }, '/order/create');
    assert.equal(err409.name, 'XenPayConflictError');

    const err422 = mapHttpError(422, { message: 'Validation failed' }, '/order/create');
    assert.equal(err422.name, 'XenPayValidationError');

    const err502 = mapHttpError(502, { message: 'Bad Gateway' }, '/order/create');
    assert.equal(err502.name, 'XenPayServerError');
    assert.equal(err502.isRetryable, true); // 502 is retryable
  });

  it('validates client inputs before sending request', async () => {
    const client = new XenPayClient();

    // Invalid amount
    await assert.rejects(
      () =>
        client.createOrder({
          amount: 0,
          merchant_order_id: 'CW_123',
          redirect_url: 'https://example.com',
          customer_name: 'Test',
          customer_phone: '9876543210',
          customer_email: 'test@example.com',
        }),
      XenPayValidationError
    );

    // Missing merchant_order_id
    await assert.rejects(
      () =>
        client.createOrder({
          amount: 500,
          merchant_order_id: '',
          redirect_url: 'https://example.com',
          customer_name: 'Test',
          customer_phone: '9876543210',
          customer_email: 'test@example.com',
        }),
      XenPayValidationError
    );
  });
});

describe('5. Webhook Processing & Idempotency Flow', () => {
  const secret = 'sk_47908aa255f60d039201ff0045663e1c7a7c7262167d1c46';

  it('rejects unauthorized webhooks with invalid signatures', async () => {
    const repo = new InMemoryOrderRepository();
    const service = new DepositService(new XenPayClient(), repo);

    const rawBody = JSON.stringify({
      merchant_order_id: 'CW_001',
      status: 'PAID',
    });

    await assert.rejects(
      () => service.processWebhook(rawBody, 'invalid-signature-1234', JSON.parse(rawBody)),
      XenPayAuthError
    );
  });

  it('processes verified webhooks and prevents duplicate balance increments', async () => {
    const repo = new InMemoryOrderRepository();
    const service = new DepositService(new XenPayClient(), repo);

    const merchantOrderId = 'CW_WEBHOOK_002';
    const userId = 'user_999';

    // Seed pending order
    await repo.createOrder({
      userId,
      merchantOrderId,
      gatewayOrderId: 'GW_999',
      amount: 500,
      creditedAmount: null,
      currency: 'INR',
      status: 'PENDING',
      paymentUrl: 'https://xen-pays.space/pay/?id=GW_999',
      customerName: 'Rohan',
      customerPhone: '9876543210',
      customerEmail: 'rohan@example.com',
      verifiedViaGateway: false,
      webhookReceivedAt: null,
      utr: null,
    });

    const payload = {
      event: 'order.paid',
      order_id: 'GW_999',
      merchant_order_id: merchantOrderId,
      amount: 500,
      status: 'PAID',
      utr: 'UTR99887766',
    };
    const rawBody = JSON.stringify(payload);
    const validSignature = computeHmacSignature(rawBody, secret);

    // 1st webhook call
    const res1 = await service.processWebhook(rawBody, validSignature, payload);
    assert.equal(res1.status, 'success');
    assert.equal(res1.alreadyProcessed, false);
    assert.equal(await repo.getUserBalance(userId), 500);

    // 2nd webhook call (idempotent duplicate)
    const res2 = await service.processWebhook(rawBody, validSignature, payload);
    assert.equal(res2.status, 'success');
    assert.equal(res2.alreadyProcessed, true);
    // Balance must not change!
    assert.equal(await repo.getUserBalance(userId), 500);
  });
});
