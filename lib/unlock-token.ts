import { getEnv } from '@/env';

export interface UnlockTokenPayload {
  email: string;
  userId: string;
  isAdmin: boolean;
  exp: number;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLen);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getSigningKey(): Promise<CryptoKey> {
  const keyMaterial = new TextEncoder().encode(getEnv().PII_ENCRYPTION_KEY);
  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function createUnlockToken(
  email: string,
  userId: string,
  isAdmin: boolean,
  ttlMinutes: number,
): Promise<string> {
  const payload: UnlockTokenPayload = {
    email: email.toLowerCase(),
    userId,
    isAdmin,
    exp: Date.now() + ttlMinutes * 60 * 1000,
  };

  const payloadB64 = btoa(JSON.stringify(payload));
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payloadB64),
  );

  return `${payloadB64}.${bufferToBase64Url(signature)}`;
}

export async function verifyUnlockToken(token: string): Promise<UnlockTokenPayload | null> {
  const [payloadB64, signatureB64] = token.split('.');
  if (!payloadB64 || !signatureB64) return null;

  try {
    const key = await getSigningKey();
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBuffer(signatureB64),
      new TextEncoder().encode(payloadB64),
    );
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64)) as UnlockTokenPayload;
    if (
      typeof payload.email !== 'string' ||
      typeof payload.userId !== 'string' ||
      typeof payload.isAdmin !== 'boolean' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }

    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
