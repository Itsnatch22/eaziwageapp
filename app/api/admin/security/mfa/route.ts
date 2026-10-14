import { NextRequest } from 'next/server';
import { handleMfaGet, handleMfaPost } from '@/lib/mfa-handler';

export const runtime = 'nodejs';

export function GET(req: NextRequest) {
  return handleMfaGet(req, '-admin');
}

export function POST(req: NextRequest) {
  return handleMfaPost(
    req,
    '-admin',
    'EaziWage Admin Authenticator',
    `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.eaziwage.com'}/admin/settings?tab=security`,
  );
}
