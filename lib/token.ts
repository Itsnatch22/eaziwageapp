import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Token generation and management utilities
 */

/**
 * Creates a new secure token and its hash
 * @returns Object containing the raw token (to send to user) and tokenHash (to store in DB)
 */
export function createToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

/**
 * Hashes a token for comparison with stored hash
 * @param token - The raw token to hash
 * @returns The hashed token
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

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
  // Tokens should be 64 hex characters (32 bytes * 2)
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