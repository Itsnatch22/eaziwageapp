import { NextRequest } from 'next/server';
import { handleMfaGet, handleMfaPost } from '@/lib/mfa-handler';

export const runtime = 'nodejs';

export function GET(req: NextRequest) {
  return handleMfaGet(req, '-employer');
}

export function POST(req: NextRequest) {
  return handleMfaPost(
    req,
    '-employer',
    'EaziWage Employer Authenticator',
    `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.eaziwage.com'}/dashboards/employer-dashboard/settings?tab=security`,
  );
}
