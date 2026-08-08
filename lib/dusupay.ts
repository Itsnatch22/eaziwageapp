import { dusupayClient, verifyWebhookSignature as clientVerifyWebhookSignature, parseWebhook as clientParseWebhook } from './dusupay/client';
export { PayoutMethod, PayoutStatus, Currency } from './dusupay/types';

// KE codes confirmed by hand against /data/payment-providers?currency=KES&transaction_type=payout
// (mpesa was previously mapped to the wrong code, 'safaricom_ke'). TZ/UG/RW are unverified —
// confirm against the same endpoint before relying on them for a real payout.
export const MOBILE_MONEY_PROVIDERS: Record<string, Record<string, string>> = {
  KE: { mpesa: 'mpesa_ke', safaricom: 'mpesa_ke', airtel: 'airtel_ke', airtelmoney: 'airtel_ke' },
  TZ: { mpesa: 'vodacom_tz', vodacom: 'vodacom_tz', airtel: 'airtel_tz', tigo: 'tigo_tz', halopesa: 'halotel_tz' },
  UG: { mtn: 'mtn_ug', airtel: 'airtel_ug' },
  RW: { mtn: 'mtn_rw', airtel: 'airtel_rw' },
};

// Adapter object preserving the legacy `dusupay` export used by webhook and
// reconciliation code. It delegates status checks to the consolidated
// dusupayClient while exposing the webhook helpers as before.
export const dusupay = {
  checkPayoutStatus: (ref: string) => dusupayClient.checkPayoutStatus(ref),
  verifyWebhookSignature: clientVerifyWebhookSignature,
  parseWebhook: clientParseWebhook,
  // expose as a boolean property for existing call sites that read dusupay.isConfigured
  isConfigured: dusupayClient.isConfigured,
  // also provide a function form for callers that expect a callable
  isConfiguredFn: () => dusupayClient.isConfigured,
};
