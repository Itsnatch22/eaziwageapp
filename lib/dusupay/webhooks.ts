import { createHmac, timingSafeEqual } from 'crypto';

export class DusupayWebhookHandler {
  private signingKey: string;
  private allowedIps: string[];

  constructor() {
    this.signingKey = process.env.DUSUPAY_ENVIRONMENT === 'production'
      ? (process.env.DUSUPAY_PRODUCTION_SIGNING_KEY || '')
      : (process.env.DUSUPAY_SANDBOX_SIGNING_KEY || '');

    this.allowedIps = process.env.DUSUPAY_ENVIRONMENT === 'production'
      ? ['161.35.164.139']
      : ['165.227.128.244'];
  }

  /**
   * Validates if the request comes from DusuPay's IP address
   */
  validateIp(ip: string): boolean {
    return this.allowedIps.includes(ip);
  }

  /**
   * Verifies the HMAC signature provided in the webhook header
   * Format: t=timestamp,s=hash
   */
  verifyHmac(payload: string, header: string): boolean {
    if (!header || !this.signingKey) return false;

    const parts = header.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
    const signature = parts.find(p => p.startsWith('s='))?.split('=')[1];

    if (!timestamp || !signature) return false;

    const expected = createHmac('sha256', this.signingKey)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  /**
   * Verifies the payload signature using the legacy method
   * Payload Format: event:merchant_reference:internal_reference:transaction_type:transaction_status
   */
  verifyPayloadSignature(payload: string, signature: string): boolean {
    if (!signature || !this.signingKey) return false;

    const expected = createHmac('sha256', this.signingKey)
      .update(payload)
      .digest('hex');

    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}

export const dusupayWebhook = new DusupayWebhookHandler();
