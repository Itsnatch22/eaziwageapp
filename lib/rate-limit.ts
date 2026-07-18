import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "../env";

const env = getEnv();
// Requiring NODE_ENV !== 'production' alongside the test flag means a leaked/
// copy-pasted PLAYWRIGHT_TEST=1 in a production environment can no longer
// disable rate limiting platform-wide on its own — both conditions must hold.
const isPlaywrightTest = process.env.PLAYWRIGHT_TEST === "1" && process.env.NODE_ENV !== "production";

class NoopLimiter {
  async limit() {
    return {
      success: true,
      limit: 1000,
      remaining: 1000,
      reset: Date.now() + 60_000,
    };
  }
}

const redis = isPlaywrightTest
  ? undefined
  : new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });

function createLimiter(prefix: string, tokens = 7, window: `${number} ${"ms" | "s" | "m" | "h" | "d"}` = "1 h") {
  if (isPlaywrightTest) {
    return new NoopLimiter() as unknown as Ratelimit;
  }

  return new Ratelimit({
    redis: redis!,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix,
  });
}

/**
 * Rate limiter for registration endpoint
 * Limits to 7 registration attempts per hour per IP
 */
export const rateLimiter = createLimiter("ratelimit:register");

/**
 * Rate limiter for login attempts — split out from `rateLimiter` (which
 * register/forgot-password/reset-password still use). 7/hour is right for
 * those rare, deliberate actions but was far too tight for login, a routine
 * action that legitimately happens many times an hour when testing multiple
 * roles from one IP.
 */
export const loginLimiter = createLimiter("ratelimit:login", 25, "1 h");

/**
 * Rate limiter for payment-method OTP confirmation attempts. Previously
 * reused advanceLimiter's 5-per-6-hours ceiling (meant for advance-request
 * creation, a rare cooldown-governed action) as a generic hard cap — a
 * handful of mistyped or expired OTP codes could lock a user out of
 * verifying a payment method for 6 hours. Deliberately mirrors
 * mfaVerifyLimiter's shape (also a short-code verification attempt counter).
 */
export const otpConfirmLimiter = createLimiter("ratelimit:otp_confirm", 8, "15 m");

/**
 * Rate limiter for email verification resend
 * Limits to 3 resend attempts per hour per email
 */
export const resendLimiter = createLimiter("ratelimit:resend");

/**
 * Rate limiter for contact form submissions
 * Limits to 5 contact attempts per hour per IP
 */
export const contactLimiter = createLimiter("ratelimit:contact");

/**
 * Rate limiter for general API endpoints
 * Limits to 100 requests per minute per IP
 */
export const apiLimiter = createLimiter("ratelimit:api");

/**
 * MFA action limiter (enroll / disable / generate codes)
 * Raised from 10 to 30 actions per 10 minutes per user/IP — the old ceiling
 * was tripping during normal admin testing sessions well before anything
 * resembling abuse.
 */
export const mfaActionLimiter = createLimiter("ratelimit:mfa_action", 30, "10 m");

/**
 * MFA verify limiter (TOTP verification attempts)
 * Limits to 6 verification attempts per 15 minutes per user/IP
 */
export const mfaVerifyLimiter = createLimiter("ratelimit:mfa_verify");

/**
 * Advance request limiter — 5 requests per 6 hours per user.
 * Complements the DB-level cooldown period by blocking burst attempts
 * before they hit business logic.
 */
export const advanceLimiter = createLimiter("ratelimit:advance");

/**
 * Admin API limiter — shared bucket across all admin routes that don't have
 * their own per-resource limiter. Raised from 300 to 900 req/min per IP:
 * dashboard pages routinely fire a dozen+ parallel calls per navigation, and
 * a single admin clicking through several data-heavy pages in a short window
 * was tripping the old ceiling (observed as 429s across Employees, KYC,
 * Notifications, Risk scoring, Topups, and Fraud rules in the same session).
 */
export const adminApiLimiter = createLimiter("ratelimit:admin_api", 900, "1 m");

/**
 * Helper to format rate limit response headers
 */
export function getRateLimitHeaders(
  limit: number,
  remaining: number,
  reset: number
): Record<string, string> {
  return {
    "X-RateLimit-Limit": limit.toString(),
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset": new Date(reset).toISOString(),
  };
}

/**
 * Type for rate limit result
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  headers: Record<string, string>;
}

/**
 * Wrapper to check rate limit and return formatted result
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<RateLimitResult> {
  const result = await limiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    headers: getRateLimitHeaders(result.limit, result.remaining, result.reset),
  };
}

/**
 * Apply adminApiLimiter to an incoming request. Returns a 429 NextResponse
 * if the limit is exceeded, or null if the request should proceed.
 */
export async function checkAdminRateLimit(req: NextRequest): Promise<NextResponse<{ error: string; code: string }> | null> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const result = await checkRateLimit(adminApiLimiter, `admin:${ip}`);
  if (!result.success) {
    return NextResponse.json(
      { error: "Too many requests.", code: "RATE_LIMITED" },
      { status: 429, headers: result.headers }
    );
  }
  return null;
}