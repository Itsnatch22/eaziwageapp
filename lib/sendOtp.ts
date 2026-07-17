import AfricasTalking from 'africastalking';

// Constructed lazily (not at module scope) because the SDK's constructor
// synchronously validates credentials and throws if they're missing —
// eager construction would crash every route that imports this module
// (transitively, via lib/notifications.ts) on load, including the DusuPay
// webhook handler, whenever AT_API_KEY/AT_USERNAME is unset or misconfigured.
let smsClient: ReturnType<typeof AfricasTalking>['SMS'] | null = null;

function getSmsClient() {
  if (!smsClient) {
    const at = AfricasTalking({
      apiKey: process.env.AT_API_KEY!,
      username: process.env.AT_USERNAME!,
    });
    smsClient = at.SMS;
  }
  return smsClient;
}

/**
 * Country dial code map for EaziWage's supported markets.
 * Covers Kenya, Uganda, Tanzania, Rwanda.
 */
const COUNTRY_DIAL_CODES: Record<string, { dialCode: string; localLength: number }> = {
  KE: { dialCode: '254', localLength: 9 },
  UG: { dialCode: '256', localLength: 9 },
  TZ: { dialCode: '255', localLength: 9 },
  RW: { dialCode: '250', localLength: 9 },
};

/**
 * Normalizes a phone number to E.164 format.
 * Handles local formats (07XX, 7XX) and already-prefixed numbers (+254XX, 254XX).
 * Falls back to KE if no country code is provided.
 */
export function normalizeToE164(phone: string, countryCode = 'KE'): string {
  const digits = phone.replace(/\D/g, '');
  const country = COUNTRY_DIAL_CODES[countryCode.toUpperCase()] ?? COUNTRY_DIAL_CODES['KE'];
  const { dialCode, localLength } = country;

  // Already fully-qualified E.164, possibly for a different one of EaziWage's
  // supported countries than `countryCode` (e.g. admin-entered SMS numbers
  // aren't tied to a single employee's country) — accept as-is rather than
  // forcing a match against this specific country's dial code.
  if (phone.startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  if (digits.startsWith(dialCode) && digits.length === dialCode.length + localLength) {
    return `+${digits}`;
  }

  if (digits.startsWith('0') && digits.length === localLength + 1) {
    return `+${dialCode}${digits.slice(1)}`;
  }

  if (digits.length === localLength) {
    return `+${dialCode}${digits}`;
  }

  throw new Error(`Cannot normalize phone number "${phone}" for country "${countryCode}"`);
}

/**
 * Sends an OTP SMS via Africa's Talking.
 * Accepts local or E.164 phone numbers — normalization is handled internally.
 * Pass the employee's country_code (KE, UG, TZ, RW) for correct dial prefix.
 *
 * NOTE: in sandbox mode, delivery only works to numbers registered
 * as test devices in the AT sandbox simulator.
 */
export async function sendOtpSms(phoneNumber: string, otp: string, countryCode = 'KE'): Promise<void> {
  const message = `Your EaziWage verification code is: ${otp}. Valid for 10 minutes. Do not share this code with anyone.`;
  await sendSms(phoneNumber, message, countryCode);
}

// Africa's Talking has known, recurring reliability issues — the admin
// api_health dashboard pulls their own status feed and regularly shows the
// SMS component as degraded. Without a timeout, a slow-but-not-fully-down
// window (exactly what "degraded" means) can leave this call hanging far
// longer than a user will wait. A transient network/timeout failure is
// retried a couple of times with backoff — nothing was definitively sent or
// rejected yet, so it's safe to try again.
const SMS_TIMEOUT_MS = 10_000;
const SMS_MAX_ATTEMPTS = 3;
const SMS_RETRY_DELAYS_MS = [500, 1500];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Africa's Talking request timed out after ${ms}ms`)), ms);
    }),
  ]);
}

/**
 * Sends an arbitrary SMS via Africa's Talking — shared by OTP delivery
 * (sendOtpSms above) and admin alert SMS (lib/notifications.ts's notifyAdmin,
 * gated by the Notifications tab's sms_* toggles).
 *
 * Retries only on a network/timeout failure (Africa's Talking never
 * definitively responded). A response that DID arrive with a non-Success
 * per-recipient status (invalid number, blacklisted, insufficient balance,
 * etc.) is their actual answer for that number — retrying won't change it,
 * so that case fails immediately without a retry.
 */
export async function sendSms(phoneNumber: string, message: string, countryCode = 'KE'): Promise<void> {
  const to = normalizeToE164(phoneNumber, countryCode);

  const options: { to: string; message: string; from?: string } = { to, message };

  if (process.env.AT_SENDER_ID) {
    options.from = process.env.AT_SENDER_ID;
  }

  let lastNetworkError: unknown = null;

  for (let attempt = 0; attempt < SMS_MAX_ATTEMPTS; attempt++) {
    let response;
    try {
      response = await withTimeout(getSmsClient().send(options), SMS_TIMEOUT_MS);
    } catch (err) {
      lastNetworkError = err;
      if (attempt < SMS_MAX_ATTEMPTS - 1) {
        await sleep(SMS_RETRY_DELAYS_MS[attempt] ?? 1500);
        continue;
      }
      throw new Error(
        `Africa's Talking SMS failed after ${SMS_MAX_ATTEMPTS} attempts: ${err instanceof Error ? err.message : 'Network error'}`
      );
    }

    const recipients = response?.SMSMessageData?.Recipients ?? [];
    const failed = recipients.find((r: { status: string }) => r.status !== 'Success');

    if (!failed) return;

    throw new Error(`Africa's Talking SMS failed: ${failed.status}`);
  }

  // Unreachable — the loop above always returns or throws — kept only to
  // satisfy TypeScript's control-flow analysis of a guaranteed return path.
  throw new Error(`Africa's Talking SMS failed: ${lastNetworkError instanceof Error ? lastNetworkError.message : 'Unknown error'}`);
}