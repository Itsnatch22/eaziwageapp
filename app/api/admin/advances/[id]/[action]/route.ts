import { createRouteHandlerClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { checkAdminAccess } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; action: string } }
) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminResult = await checkAdminAccess({
    user,
    adminSupabase: supabase,
  });

  if (!adminResult.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, action } = params;

  if (!['approve', 'disburse', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  try {
    const { data: advance, error: getError } = await supabase
      .from('advances')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (getError || !advance) {
      return NextResponse.json({ error: 'Advance not found' }, { status: 404 });
    }

    let newStatus: string;
    if (action === 'approve') {
      newStatus = 'approved';
    } else if (action === 'disburse') {
      newStatus = 'disbursed';
    } else if (action === 'reject') {
      newStatus = 'rejected';
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('advances')
      .update({
        status: newStatus,
        approved_at: newStatus === 'approved' ? new Date().toISOString() : advance.approved_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Advance ${newStatus}`,
      advance_id: id,
    });
  } catch (error: unknown) {
    console.error('[AdminAdvancesAction] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
