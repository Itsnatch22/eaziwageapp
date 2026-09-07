import { getEnv } from "../env";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

// Lazy-initialize environment variables
let _env: ReturnType<typeof getEnv> | null = null;
const getEnvOnce = () => {
  if (_env === null) {
    _env = getEnv();
  }
  return _env;
};

// Lazy-initialize Redis client
let _redis: Redis | undefined = undefined;
const getRedisInstance = () => {
  if (_redis !== undefined) {
    return _redis;
  }
  
  if (process.env.PLAYWRIGHT_TEST === "1" && process.env.NODE_ENV !== "production") {
    return undefined;
  }
  
  const env = getEnvOnce();
  _redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  
  return _redis;
};

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

/**
 * Lazy-initializing Ratelimit wrapper that mimics the Ratelimit interface
 * but delays initialization until first use.
 */
class LazyRatelimit {
  private _instance: Ratelimit | null = null;
  private readonly prefix: string;
  private readonly tokens: number;
  private readonly window: `${number} ${"ms" | "s" | "m" | "h" | "d"}`;
  
  constructor(prefix: string, tokens = 7, window: `${number} ${"ms" | "s" | "m" | "h" | "d"}` = "1 h") {
    this.prefix = prefix;
    this.tokens = tokens;
    this.window = window as `${number} ${"ms" | "s" | "m" | "h" | "d"}`;
  }
  
  async limit(identifier: string): Promise<Awaited<ReturnType<Ratelimit["limit"]>>> {
    // Initialize the real instance on first use
    if (this._instance === null) {
      if (process.env.PLAYWRIGHT_TEST === "1" && process.env.NODE_ENV !== "production") {
        this._instance = new NoopLimiter() as unknown as Ratelimit;
      } else {
        const redis = getRedisInstance();
        if (redis === undefined) {
          throw new Error("Failed to initialize Redis connection");
        }
        this._instance = new Ratelimit({
          redis: redis,
          limiter: Ratelimit.slidingWindow(this.tokens, this.window),
          analytics: true,
          prefix: this.prefix,
        });
      }
    }
    
    return this._instance.limit(identifier);
  }
}

/**
 * Rate limiter for registration endpoint
 * Limits to 7 registration attempts per hour per IP
 */
export const rateLimiter = new LazyRatelimit("ratelimit:register");

/**
 * Rate limiter for login attempts — split out from `rateLimiter` (which
 * register/forgot-password/reset-password still use). 7/hour is right for
 * those rare, deliberate actions but was far too tight for login, a routine
 * action that legitimately happens many times an hour when testing multiple
 * roles from one IP.
 */
export const loginLimiter = new LazyRatelimit("ratelimit:login", 25, "1 h");

/**
 * Rate limiter for payment-method OTP confirmation attempts. Previously
 * reused advanceLimiter's 5-per-6-hours ceiling (meant for advance-request
 * creation, a rare cooldown-governed action) as a generic hard cap — a
 * handful of mistyped or expired OTP codes could lock a user out of
 * verifying a payment method for 6 hours. Deliberately mirrors
 * mfaVerifyLimiter's shape (also a short-code verification attempt counter).
 */
export const otpConfirmLimiter = new LazyRatelimit("ratelimit:otp_confirm", 8, "15 m");

/**
 * Rate limiter for email verification resend
 * Limits to 3 resend attempts per hour per email
 */
export const resendLimiter = new LazyRatelimit("ratelimit:resend");

/**
 * Rate limiter for contact form submissions
 * Limits to 5 contact attempts per hour per IP
 */
export const contactLimiter = new LazyRatelimit("ratelimit:contact");

/**
 * Rate limiter for general API endpoints
 * Limits to 100 requests per minute per IP
 */
export const apiLimiter = new LazyRatelimit("ratelimit:api");

/**
 * MFA action limiter (enroll / disable / generate codes)
 * Raised from 10 to 30 actions per 10 minutes per user/IP — the old ceiling
 * was tripping during normal admin testing sessions well before anything
 * resembling abuse.
 */
export const mfaActionLimiter = new LazyRatelimit("ratelimit:mfa_action", 30, "10 m");

/**
 * MFA verify limiter (TOTP verification attempts)
 * Limits to 6 verification attempts per 15 minutes per user/IP
 */
export const mfaVerifyLimiter = new LazyRatelimit("ratelimit:mfa_verify");

/**
 * Advance request limiter — 5 requests per 6 hours per user.
 * Complements the DB-level cooldown period by blocking burst attempts
 * before they hit business logic.
 */
export const advanceLimiter = new LazyRatelimit("ratelimit:advance");

/**
 * Admin API limiter — shared bucket across all admin routes that don't have
 * their own per-resource limiter. Raised from 300 to 900 req/min per IP:
 * dashboard pages routinely fire a dozen+ parallel calls per navigation, and
 * a single admin clicking through several data-heavy phrases in a short window
 * was tripping the old ceiling (observed as 429s across Employees, KYC,
 * Risk scoring, Topups, and Fraud rules).
 */
export const adminApiLimiter = new LazyRatelimit("ratelimit:admin_api", 900, "1 m");
/**
 * Beta onboarding limiter — limits to 5 requests per hour per user.
 */
export const betaOnboardingLimiter = new LazyRatelimit("ratelimit:beta_onboarding", 5, "1 h");

/**
 * Beta disbursement limiter — limits to 5 requests per hour per user.
 */
export const betaDisbursementLimiter = new LazyRatelimit("ratelimit:beta_disbursement", 5, "1 h");

/**
 * Rate limiter for admin feedback query from Supabase
 * Limits to 10 feedback attempts per hour per IP
 */
export const adminFeedbackLimiter = new LazyRatelimit("ratelimit:admin_feedback", 10, "1 h");

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
  limiter: { limit: (identifier: string) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }> },
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