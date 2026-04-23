import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import pusherServer from '@/lib/pusher-server';

function createAdminClient() {
  const env = getEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function isSystemAdmin(userId: string): Promise<boolean> {
  const adminSupabase = createAdminClient();
  const { data: systemAdmin } = await adminSupabase
    .from('system_admins')
    .select('id, is_admin')
    .eq('id', userId)
    .maybeSingle();

  return systemAdmin?.is_admin === true;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status, reason } = await req.json();
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = await isSystemAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }
    const { data: updatedOnboarding, error: updateError } = await adminSupabase
      .from('employee_onboarding')
      .update({ 
        status: status === 'active' ? 'approved' : status,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[PATCH status] update error:', updateError);
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    if (status === 'approved' || status === 'active') {
      const { data: profileData } = await adminSupabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', id)
        .single();
      const displayName = profileData?.full_name || updatedOnboarding.full_name || 'Anonymous';

      const { data: upsertData, error: upsertError } = await adminSupabase
        .from('employees')
        .upsert({
          user_id: id,
          employer_id: updatedOnboarding.employer_id,
          employee_code: updatedOnboarding.employee_code,
          full_name: displayName,
          name: displayName,
          email: profileData?.email || updatedOnboarding.email,
          phone: profileData?.phone || updatedOnboarding.phone,
          job_title: updatedOnboarding.job_title,
          department: updatedOnboarding.department,
          monthly_salary: updatedOnboarding.monthly_salary,
          status: 'Active',
          kyc_status: 'approved',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (upsertError) console.error('[employees upsert error]', upsertError);
    } else if (status === 'suspended' || status === 'rejected') {
      // Update status in employees table too if it exists
      await adminSupabase
        .from('employees')
        .update({ status: status === 'suspended' ? 'Inactive' : 'Inactive' })
        .eq('user_id', id);
    }

    const titleMap: Record<string, string> = {
      approved: 'Account Activated',
      active: 'Account Activated',
      suspended: 'Account Suspended',
      pending: 'Account Set to Pending',
      rejected: 'Account Rejected',
    };

    const messageMap: Record<string, string> = {
      approved: 'Your EaziWage account has been activated. You can now request wage advances.',
      active: 'Your EaziWage account has been activated. You can now request wage advances.',
      suspended: 'Your EaziWage account has been suspended. Please contact support for more information.',
      pending: 'Your account status has been set to pending. Additional information may be required.',
      rejected: `Your account application was rejected. Reason: ${reason || 'Not provided'}`,
    };

    await adminSupabase.from('notifications').insert({
      user_id: id,
      type: 'account_update',
      title: titleMap[status] || 'Account Status Update',
      message: messageMap[status] || `Your account status is now ${status}.`,
      read: false,
      created_at: new Date().toISOString(),
    });

    const { data: adminProfile } = await adminSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    await adminSupabase.from('system_audit_logs').insert({
      admin_id: user.id,
      admin_name: adminProfile?.full_name || 'Admin',
      target_id: id,
      target_type: 'employee',
      action: 'account_status',
      new_status: status,
      reason: reason || null,
      created_at: new Date().toISOString(),
    });

    try {
      await pusherServer.trigger(`user-${id}`, 'kyc-update', {
        status: status === 'active' ? 'approved' : status,
        message: messageMap[status]
      });
    } catch (err) {
      console.error('[Pusher] Trigger error:', err);
    }

    return NextResponse.json({ success: true, message: `Status updated to ${status}` });
  } catch (error) {
    console.error('[PATCH /api/admin/employees/[id]/status] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}