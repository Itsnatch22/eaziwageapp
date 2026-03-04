import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { isAdminRole, UserRoleEnum } from '@/lib/validations/kyc-validation';
import { createRouteHandlerClient } from '@/utils/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: docId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const notes = searchParams.get('notes') || '';

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-kyc-review:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers }
    );
  }

  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const env = getEnv();
  const adminSupabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify Admin
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !isAdminRole(UserRoleEnum.parse(profile.role.toLowerCase()))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['approved', 'rejected'].includes(status || '')) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // 1. Update the document status
  const { error: updateError } = await adminSupabase
    .from('employee_kyc_documents')
    .update({ 
      status, 
      reviewer_notes: notes,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id
    })
    .eq('id', docId);

  if (updateError) {
    console.error('[KYC Review] Update error:', updateError);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Document reviewed successfully' });
}
