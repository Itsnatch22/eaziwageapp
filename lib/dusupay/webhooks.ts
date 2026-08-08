import { createHmac, timingSafeEqual } from 'crypto';
import { verifyWebhookSignature as clientVerify, parseWebhook as clientParse } from './client';

/**
 * Thin compatibility layer that consolidates webhook verification logic.
 *
 * - verifyHmac delegates to the consolidated client verifyWebhookSignature
 * - validateIp uses DUSUPAY_ALLOWED_IPS env var when present; otherwise
 *   falls back to historically used static IPs (sandbox/prod).
 * - verifyPayloadSignature remains available (legacy) and uses DUSUPAY_SIGNING_KEY.
 */
export class DusupayWebhookHandler {
  private signingKey: string | undefined;

  constructor() {
    this.signingKey = process.env.DUSUPAY_SIGNING_KEY || process.env.DUSUPAY_PRODUCTION_SIGNING_KEY || process.env.DUSUPAY_SANDBOX_SIGNING_KEY;
  }

  /**
   * Validates if the request IP is allowed. Uses DUSUPAY_ALLOWED_IPS (comma list) if set.
   */
  validateIp(ip: string): boolean {
    const configured = (process.env.DUSUPAY_ALLOWED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (configured.length > 0) return configured.includes(ip);

    // Fallback static lists (kept for historical parity)
    const fallback = process.env.DUSUPAY_ENVIRONMENT === 'production'
      ? ['161.35.164.139']
      : ['165.227.128.244'];
    return fallback.includes(ip);
  }

  /**
   * Delegates to the consolidated client verifyWebhookSignature implementation.
   * Signature header format supported: 't=...,s=...' or raw hex string.
   */
  verifyHmac(rawBody: string, header: string): boolean {
    return clientVerify(rawBody, header);
  }

  /**
   * Legacy payload-based verification available for older integrations.
   * Payload Format: event:merchant_reference:internal_reference:transaction_type:transaction_status
   */
  verifyPayloadSignature(payload: string, signature: string): boolean {
    const key = this.signingKey;
    if (!signature || !key) return false;

    const expected = createHmac('sha256', key).update(payload).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
      return false;
    }
  }

  parseWebhook(body: unknown) {
    return clientParse(body);
  }
}

export const dusupayWebhook = new DusupayWebhookHandler();
