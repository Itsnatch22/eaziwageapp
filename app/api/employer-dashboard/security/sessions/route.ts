import { NextRequest } from 'next/server';
import {
  handleSecuritySessionsDelete,
  handleSecuritySessionsGet,
  handleSecuritySessionsPost,
} from '@/lib/security-sessions';

export const runtime = 'nodejs';

export async function GET() {
  return handleSecuritySessionsGet();
}

export async function DELETE(req: NextRequest) {
  return handleSecuritySessionsDelete(req);
}

export async function POST() {
  return handleSecuritySessionsPost();
}
