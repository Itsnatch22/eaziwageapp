import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "../env";

const env = getEnv();

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Rate limiter for registration endpoint
 * Limits to 7 registration attempts per hour per IP
 */
export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(7, "1 h"),
  analytics: true,
  prefix: "ratelimit:register",
});

/**
 * Rate limiter for email verification resend
 * Limits to 3 resend attempts per hour per email
 */
export const resendLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  analytics: true,
  prefix: "ratelimit:resend",
});

/**
 * Rate limiter for contact form submissions
 * Limits to 5 contact attempts per hour per IP
 */
export const contactLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  analytics: true,
  prefix: "ratelimit:contact",
});

/**
 * Rate limiter for general API endpoints
 * Limits to 100 requests per minute per IP
 */
export const apiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
  prefix: "ratelimit:api",
});

/**
 * MFA action limiter (enroll / disable / generate codes)
 * Limits to 10 actions per 10 minutes per user/IP
 */
export const mfaActionLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 m"),
  analytics: true,
  prefix: "ratelimit:mfa_action",
});

/**
 * MFA verify limiter (TOTP verification attempts)
 * Limits to 6 verification attempts per 15 minutes per user/IP
 */
export const mfaVerifyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(6, "15 m"),
  analytics: true,
  prefix: "ratelimit:mfa_verify",
});

/**
 * Admin API limiter — shared bucket across all admin routes that don't have
 * their own per-resource limiter. 300 req/min per IP provides abuse protection
 * while being generous enough for normal admin dashboard usage.
 */
export const adminApiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(300, "1 m"),
  analytics: true,
  prefix: "ratelimit:admin_api",
});

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