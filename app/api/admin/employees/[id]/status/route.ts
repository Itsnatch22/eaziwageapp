import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import pusherServer from '@/lib/pusher-server';

interface EmployeeUpsertPayload {
  user_id: string;
  status: string;
  kyc_status: string;
  updated_at: string;
  employer_id?: string;
  employee_code?: string;
  full_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  job_title?: string;
  department?: string;
  monthly_salary?: number;
}

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
    // ── Find Onboarding Record ──────────────────────────────────────────────
    // The 'id' in the URL could be either the employee_onboarding.id (PK) 
    // or the user_id (Auth ID). We try both.
    const { data: onboardingRecord, error: fetchError } = await adminSupabase
      .from('employee_onboarding')
      .select('*')
      .or(`id.eq.${id},user_id.eq.${id}`)
      .maybeSingle();

    if (fetchError) {
      console.error('[PATCH status] fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch onboarding record' }, { status: 500 });
    }

    if (!onboardingRecord) {
      console.warn('[PATCH status] No onboarding record found for ID:', id);
      // Even if no onboarding record exists, we might still have a record in 'employees' table.
      // We'll proceed to check the employees table below.
    }

    const userId = onboardingRecord?.user_id || id;
    const resolvedStatus = status === 'active' || status === 'approved' ? 'approved' : status;

    // ── Update Onboarding Table ──────────────────────────────────────────────
    if (onboardingRecord) {
      const { error: updateError } = await adminSupabase
        .from('employee_onboarding')
        .update({ 
          status: resolvedStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', onboardingRecord.id);

      if (updateError) {
        console.error('[PATCH status] onboarding update error:', updateError);
        return NextResponse.json({ error: 'Failed to update onboarding status' }, { status: 500 });
      }
    }

    // ── Sync to Primary 'employees' Table ─────────────────────────────────────
    if (status === 'approved' || status === 'active') {
      const { data: profileData } = await adminSupabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', userId)
        .single();
      
      const displayName = profileData?.full_name || onboardingRecord?.full_name || 'Anonymous';

      const upsertPayload: Partial<EmployeeUpsertPayload> = {
        user_id: userId,
        status: 'Active',
        kyc_status: 'approved',
        updated_at: new Date().toISOString(),
      };

      // Only include onboarding data if it exists
      if (onboardingRecord) {
        upsertPayload.employer_id = onboardingRecord.employer_id;
        upsertPayload.employee_code = onboardingRecord.employee_code;
        upsertPayload.full_name = displayName;
        upsertPayload.name = displayName;
        upsertPayload.email = profileData?.email || onboardingRecord.email;
        upsertPayload.phone = profileData?.phone || onboardingRecord.phone;
        upsertPayload.job_title = onboardingRecord.job_title;
        upsertPayload.department = onboardingRecord.department;
        upsertPayload.monthly_salary = onboardingRecord.monthly_salary;
      }

      const { error: upsertError } = await adminSupabase
        .from('employees')
        .upsert(upsertPayload, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('[employees upsert error]', upsertError);
      }
    } else {
      // Sync other statuses (suspended, rejected) to employees table if it exists
      const { data: existingEmployee } = await adminSupabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingEmployee) {
        const dbStatus = status === 'suspended' ? 'Inactive' : 'Inactive'; // Using 'Inactive' for now as per previous logic
        await adminSupabase
          .from('employees')
          .update({ status: dbStatus, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
      }
    }

    const titleMap: Record<string, string> = {
      approved:  'Account Activated',
      active:    'Account Activated',
      suspended: 'Account Suspended',
      pending:   'Account Set to Pending',
      rejected:  'Account Rejected',
    };

    const messageMap: Record<string, string> = {
      approved:  'Your EaziWage account has been activated. You can now request wage advances.',
      active:    'Your EaziWage account has been activated. You can now request wage advances.',
      suspended: 'Your EaziWage account has been suspended. Please contact support for more information.',
      pending:   'Your account status has been set to pending. Additional information may be required.',
      rejected:  `Your account application was rejected. Reason: ${reason || 'Not provided'}`,
    };

    await adminSupabase.from('notifications').insert({
      user_id: userId,
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
      target_id: userId,
      target_type: 'employee',
      action: 'account_status',
      new_status: status,
      reason: reason || null,
      created_at: new Date().toISOString(),
    });

    try {
      await pusherServer.trigger(`user-${userId}`, 'kyc-update', {
        status: status === 'active' || status === 'approved' ? 'approved' : status,
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