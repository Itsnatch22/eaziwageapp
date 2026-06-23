import { NextRequest, NextResponse } from 'next/server';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { notifyEmployee } from '@/lib/notifications';
import { activateUser, deactivateUser } from '@/lib/activation';
import { createAdminClient } from '@/lib/supabaseAdmin';

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
  employment_type?: string;
  hire_date?: string;
}

type EmployeeActionStatus = 'active' | 'approved' | 'pending' | 'rejected' | 'suspended';

async function isSystemAdmin(userId: string): Promise<boolean> {
  const adminSupabase = createAdminClient();
  const { data: systemAdmin } = await adminSupabase
    .from('system_admins')
    .select('id, is_admin')
    .eq('id', userId)
    .maybeSingle();

  return systemAdmin?.is_admin === true;
}

function toOnboardingStatus(status: EmployeeActionStatus): 'approved' | 'pending' | 'rejected' | 'suspended' {
  return status === 'active' || status === 'approved' ? 'approved' : status;
}

function toLiveEmployeeStatus(status: EmployeeActionStatus): 'Active' | 'Inactive' {
  return status === 'active' || status === 'approved' ? 'Active' : 'Inactive';
}

function toKycStatus(status: EmployeeActionStatus): 'approved' | 'pending' | 'rejected' | undefined {
  if (status === 'active' || status === 'approved') return 'approved';
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'rejected';
  return undefined;
}

export async function PATCH(
  req: NextRequest,
  { params }: IdRouteContext
) {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    const { status, reason } = await req.json() as { status?: string; reason?: string };
    const supabase = await createRouteHandlerClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = await isSystemAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    if (status !== 'active' && status !== 'approved' && status !== 'pending' && status !== 'rejected' && status !== 'suspended') {
      return NextResponse.json({ error: 'Invalid employee status' }, { status: 400 });
    }
    
    const { data: initialOnboardingRecord, error: fetchError } = await adminSupabase
      .from('employee_onboarding')
      .select('*')
      .or(`id.eq.${id},user_id.eq.${id}`)
      .maybeSingle();
    let onboardingRecord = initialOnboardingRecord;

    if (fetchError) {
      console.error('[PATCH status] fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch onboarding record' }, { status: 500 });
    }

    const { data: initialEmployeeRecord, error: employeeFetchError } = await adminSupabase
      .from('employees')
      .select('id,user_id,status,kyc_status')
      .or(`id.eq.${id},user_id.eq.${id}`)
      .maybeSingle();

    if (employeeFetchError) {
      console.error('[PATCH status] employee fetch error:', employeeFetchError);
      return NextResponse.json({ error: 'Failed to fetch employee record' }, { status: 500 });
    }

    if (!onboardingRecord && initialEmployeeRecord?.user_id) {
      const { data: fallbackOnboarding, error: fallbackError } = await adminSupabase
        .from('employee_onboarding')
        .select('*')
        .eq('user_id', initialEmployeeRecord.user_id)
        .maybeSingle();

      if (fallbackError) {
        console.error('[PATCH status] fallback onboarding fetch error:', fallbackError);
        return NextResponse.json({ error: 'Failed to fetch onboarding record' }, { status: 500 });
      }
      onboardingRecord = fallbackOnboarding;
    }

    if (!onboardingRecord) {
      console.warn('[PATCH status] No onboarding record found for ID:', id);
    }

    const userId = onboardingRecord?.user_id || initialEmployeeRecord?.user_id;
    if (!userId) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    }

    const resolvedStatus = toOnboardingStatus(status);
    const liveStatus = toLiveEmployeeStatus(status);
    const kycStatus = toKycStatus(status);
    const normalizedEmploymentType =
      typeof onboardingRecord?.employment_type === 'string'
        ? onboardingRecord.employment_type.replace(/_/g, '-').toLowerCase()
        : undefined;

    if (onboardingRecord) {
      if (normalizedEmploymentType && normalizedEmploymentType !== onboardingRecord.employment_type) {
        const { error: normaliseError } = await adminSupabase
          .from('employee_onboarding')
          .update({ employment_type: normalizedEmploymentType })
          .eq('id', onboardingRecord.id);

        if (normaliseError) {
          console.error('[PATCH status] failed to normalise employment_type:', normaliseError);
          return NextResponse.json({ error: 'Failed to normalise employment data' }, { status: 500 });
        }
      }

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

    async function resolveEmployerId(ref: string | undefined) {
      if (!ref) return null;

      const { data: byId } = await adminSupabase
        .from('employers')
        .select('id')
        .eq('id', ref)
        .maybeSingle();
      if (byId?.id) return byId.id;

      const { data: onboardingEmployer } = await adminSupabase
        .from('employer_onboarding')
        .select('user_id')
        .eq('id', ref)
        .maybeSingle();

      if (onboardingEmployer?.user_id) {
        const { data: byEmployerUser } = await adminSupabase
          .from('employers')
          .select('id')
          .eq('user_id', onboardingEmployer.user_id)
          .maybeSingle();
        if (byEmployerUser?.id) return byEmployerUser.id;
      }

      const { data: byEmployerRef } = await adminSupabase
        .from('employers')
        .select('id')
        .eq('employer_id', ref)
        .maybeSingle();
      if (byEmployerRef?.id) return byEmployerRef.id;

      return null;
    }

    if (status === 'approved' || status === 'active') {
      const { data: profileData } = await adminSupabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', userId)
        .maybeSingle();
      
      const displayName = profileData?.full_name || onboardingRecord?.full_name || 'Anonymous';

      const upsertPayload: Partial<EmployeeUpsertPayload> = {
        user_id: userId,
        status: liveStatus,
        kyc_status: 'approved',
        updated_at: new Date().toISOString(),
      };

      if (onboardingRecord) {
        const resolvedEmployerId = await resolveEmployerId(onboardingRecord.employer_id);
        if (!resolvedEmployerId) {
          console.error('[PATCH status] no employer record found for onboarding id:', onboardingRecord.employer_id);
          return NextResponse.json({ error: 'Employer record not found for onboarding id. Please create/approve the employer first.' }, { status: 400 });
        }

        upsertPayload.employer_id = resolvedEmployerId;
        upsertPayload.employee_code = onboardingRecord.employee_code;
        upsertPayload.full_name = displayName;
        upsertPayload.name = displayName;
        upsertPayload.email = profileData?.email || onboardingRecord.email;
        upsertPayload.phone = profileData?.phone || onboardingRecord.phone;
        upsertPayload.job_title = onboardingRecord.job_title;
        upsertPayload.department = onboardingRecord.department;
        upsertPayload.monthly_salary = onboardingRecord.monthly_salary;
        upsertPayload.employment_type = normalizedEmploymentType || 'full-time';
        upsertPayload.hire_date = onboardingRecord.start_date;

        const { error: upsertError } = await adminSupabase
          .from('employees')
          .upsert(upsertPayload, { onConflict: 'user_id' });

        if (upsertError) {
          console.error('[employees upsert error]', upsertError);
          return NextResponse.json({ error: 'Failed to create/update employee', details: upsertError }, { status: 500 });
        }
      } else {
        const { data: existingEmployee } = await adminSupabase
          .from('employees')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (existingEmployee) {
          const { error: updateErr } = await adminSupabase
            .from('employees')
            .update({ status: liveStatus, kyc_status: 'approved', updated_at: new Date().toISOString() })
            .eq('user_id', userId);

          if (updateErr) {
            console.error('[PATCH status] failed to update existing employee status:', updateErr);
            return NextResponse.json({ error: 'Failed to update existing employee status' }, { status: 500 });
          }
        } else {
          console.warn('[PATCH status] No onboarding and no employee record for user:', userId);
          return NextResponse.json({ error: 'Cannot create employee record: missing onboarding/employer mapping' }, { status: 400 });
        }
      }
      await activateUser(userId);
    } else {
      const { data: existingEmployee } = await adminSupabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingEmployee) {
        const employeeUpdate: Record<string, unknown> = {
          status: liveStatus,
          updated_at: new Date().toISOString(),
        };
        if (kycStatus) employeeUpdate.kyc_status = kycStatus;

        const { error: employeeUpdateError } = await adminSupabase
          .from('employees')
          .update(employeeUpdate)
          .eq('user_id', userId);

        if (employeeUpdateError) {
          console.error('[PATCH status] employee status update error:', employeeUpdateError);
          return NextResponse.json({ error: 'Failed to update employee status' }, { status: 500 });
        }
      }
      await deactivateUser(userId);
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

    await notifyEmployee({
      userId,
      type: 'kyc_update', 
      title: titleMap[status] || 'Account Status Update',
      message: messageMap[status] || `Your account status is now ${status}.`,
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


    return NextResponse.json({ success: true, message: `Status updated to ${status}` });
  } catch (error) {
    try {
      const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
      console.error('[PATCH /api/admin/employees/[id]/status] Error (serialized):', serialized);
    } catch (serErr) {
      console.error('[PATCH /api/admin/employees/[id]/status] Error (raw):', error, 'Serialization failed:', serErr);
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
