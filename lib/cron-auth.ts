// Shared by every /api/cron/* and /api/internal/* route (plus the admin
// check-api-health cron fallback). If CRON_SECRET is unset, comparing against
// `Bearer ${process.env.CRON_SECRET}` degrades to comparing against the literal
// string "Bearer undefined" — guessable by an attacker with no real secret at all.
// Requiring CRON_SECRET to be set closes that off.
export function isValidCronAuth(authHeader: string | null | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}
