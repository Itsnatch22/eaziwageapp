import { createClient } from "@supabase/supabase-js";
import { getEnv } from "../env";

const env = getEnv();
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Failed login attempt tracking and account lockout utilities
 */

export interface FailedLoginAttempt {
  id: string;
  email: string;
  ip_address: string;
  user_agent: string | null;
  attempted_at: string;
  reason: 'invalid_password' | 'user_not_found' | 'account_locked' | 'email_not_verified';
}

export interface AccountLockStatus {
  isLocked: boolean;
  failedAttempts: number;
  lockedUntil?: Date;
  remainingTime?: number; // seconds
}


const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const ATTEMPT_WINDOW_MINUTES = 15;

/**
 * Records a failed login attempt
 */
export async function recordFailedLogin(
  email: string,
  ip: string,
  userAgent: string | null,
  reason: FailedLoginAttempt['reason']
): Promise<void> {
  try {
    await supabase.from("failed_login_attempts").insert({
      email: email.toLowerCase(),
      ip_address: ip,
      user_agent: userAgent,
      reason,
      attempted_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to record login attempt:", error);

  }
}

/**
 * Records a successful login
 */
export async function recordSuccessfulLogin(
  userId: string,
  email: string,
  ip: string,
  userAgent: string | null
): Promise<void> {
  try {
    await supabase.from("login_history").insert({
      user_id: userId,
      email: email.toLowerCase(),
      ip_address: ip,
      user_agent: userAgent,
      success: true,
      logged_in_at: new Date().toISOString(),
    });


    await clearFailedAttempts(email);
  } catch (error) {
    console.error("Failed to record successful login:", error);
  }
}

/**
 * Checks if an account is locked due to too many failed attempts
 */
export async function checkAccountLock(email: string): Promise<AccountLockStatus> {
  try {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - ATTEMPT_WINDOW_MINUTES);


    const { data: attempts, error } = await supabase
      .from("failed_login_attempts")
      .select("*")
      .eq("email", email.toLowerCase())
      .gte("attempted_at", windowStart.toISOString())
      .order("attempted_at", { ascending: false });

    if (error) {
      console.error("Error checking account lock:", error);
      return { isLocked: false, failedAttempts: 0 };
    }

    const failedAttempts = attempts?.length || 0;

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {

      const mostRecentAttempt = new Date(attempts[0].attempted_at);
      const lockedUntil = new Date(mostRecentAttempt);
      lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);

      const now = new Date();
      if (now < lockedUntil) {

        const remainingTime = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
        return {
          isLocked: true,
          failedAttempts,
          lockedUntil,
          remainingTime,
        };
      } else {

        await clearFailedAttempts(email);
        return { isLocked: false, failedAttempts: 0 };
      }
    }

    return { isLocked: false, failedAttempts };
  } catch (error) {
    console.error("Error in checkAccountLock:", error);

    return { isLocked: false, failedAttempts: 0 };
  }
}

/**
 * Clears failed login attempts for an email (after successful login)
 */
async function clearFailedAttempts(email: string): Promise<void> {
  try {
    await supabase
      .from("failed_login_attempts")
      .delete()
      .eq("email", email.toLowerCase());
  } catch (error) {
    console.error("Failed to clear login attempts:", error);
  }
}

/**
 * Manually unlock an account (for admin use)
 */
export async function unlockAccount(email: string): Promise<boolean> {
  try {
    await clearFailedAttempts(email);
    return true;
  } catch (error) {
    console.error("Failed to unlock account:", error);
    return false;
  }
}

/**
 * Get recent failed login attempts for monitoring
 */
export async function getRecentFailedAttempts(
  email?: string,
  limit: number = 100
): Promise<FailedLoginAttempt[]> {
  try {
    let query = supabase
      .from("failed_login_attempts")
      .select("*")
      .order("attempted_at", { ascending: false })
      .limit(limit);

    if (email) {
      query = query.eq("email", email.toLowerCase());
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching failed attempts:", error);
      return [];
    }

    return (data || []) as FailedLoginAttempt[];
  } catch (error) {
    console.error("Error in getRecentFailedAttempts:", error);
    return [];
  }
}

/**
 * Cleanup old failed login attempts (run via cron)
 */
export async function cleanupOldFailedAttempts(): Promise<number> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from("failed_login_attempts")
      .delete()
      .lt("attempted_at", thirtyDaysAgo.toISOString())
      .select();

    if (error) {
      console.error("Error cleaning up failed attempts:", error);
      return 0;
    }

    const deletedCount = data?.length || 0;
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old failed login attempt(s)`);
    }

    return deletedCount;
  } catch (error) {
    console.error("Error in cleanupOldFailedAttempts:", error);
    return 0;
  }
}

/**
 * Format remaining lockout time for user display
 */
export function formatLockoutTime(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  if (minutes === 1) return "1 minute";
  return `${minutes} minutes`;
}