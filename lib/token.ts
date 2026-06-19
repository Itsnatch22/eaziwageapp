/**
 * Token generation and management utilities (Edge Runtime compatible)
 * Uses the Web Crypto API available in Edge runtime instead of Node's 'crypto' module.
 */

/** Helper: convert ArrayBuffer to hex string */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates cryptographically secure random bytes and returns a hex string
 * @param length number of bytes (default 32)
 */
function randomHex(length = 32): string {
  const arr = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates a new secure token and its hash
 * @returns Promise resolving to object containing the raw token (to send to user) and tokenHash (to store in DB)
 */
export async function createToken(): Promise<{ token: string; tokenHash: string }> {
  const token = randomHex(32);
  const tokenHash = await hashToken(token);
  return { token, tokenHash };
}

/**
 * Hashes a token for comparison with stored hash using SHA-256 (Web Crypto)
 * @param token - The raw token to hash
 * @returns Promise resolving to the hashed token as hex
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(digest);
}

import { createClient } from "@supabase/supabase-js";

/**
 * Cleans up expired email verification tokens
 * Should be run periodically (e.g., daily cron job)
 * @param supabase - Supabase client with service role key
 * @returns Number of expired tokens deleted
 */
export async function cleanupExpiredTokens(
  supabase: ReturnType<typeof createClient>
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("email_verifications")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select();

    if (error) {
      console.error("Error cleaning up expired tokens:", error);
      return 0;
    }

    const deletedCount = data?.length || 0;
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} expired verification token(s)`);
    }

    return deletedCount;
  } catch (err) {
    console.error("Unexpected error during token cleanup:", err);
    return 0;
  }
}

/**
 * Validates token format before attempting to hash/compare
 * @param token - Token to validate
 * @returns true if token format is valid
 */
export function isValidTokenFormat(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token);
}

/**
 * Checks if a token has expired
 * @param expiresAt - ISO date string or Date object
 * @returns true if token is expired
 */
export function isTokenExpired(expiresAt: string | Date): boolean {
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return expiry < new Date();
}