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

/**
 * Sends an arbitrary SMS via Africa's Talking — shared by OTP delivery
 * (sendOtpSms above) and admin alert SMS (lib/notifications.ts's notifyAdmin,
 * gated by the Notifications tab's sms_* toggles).
 */
export async function sendSms(phoneNumber: string, message: string, countryCode = 'KE'): Promise<void> {
  const to = normalizeToE164(phoneNumber, countryCode);

  const options: { to: string; message: string; from?: string } = { to, message };

  if (process.env.AT_SENDER_ID) {
    options.from = process.env.AT_SENDER_ID;
  }

  const response = await getSmsClient().send(options);

  const recipients = response?.SMSMessageData?.Recipients ?? [];
  const failed = recipients.find((r: { status: string }) => r.status !== 'Success');

  if (failed) {
    throw new Error(`Africa's Talking SMS failed: ${failed.status}`);
  }
}