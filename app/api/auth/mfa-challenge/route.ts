import { NextRequest } from 'next/server';
import { handleMfaGet, handleMfaPost } from '@/lib/mfa-handler';

// Role-agnostic — reachable before the aal2 gate in proxy.ts is satisfied, unlike
// the role-prefixed /api/{admin,employer-dashboard,employee-dashboard}/security/mfa
// routes (which proxy.ts's isProtectedApi check would otherwise block pre-aal2).
export const runtime = 'nodejs';

export function GET(req: NextRequest) {
  return handleMfaGet(req, '-challenge');
}

export function POST(req: NextRequest) {
  return handleMfaPost(req, '-challenge', 'EaziWage Authenticator');
}
