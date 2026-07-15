import { NextRequest, NextResponse } from 'next/server';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { EmployeeStatusPatchSchema } from '@/lib/validations/route-schemas';
import { notifyEmployee } from '@/lib/notifications';
import { activateUser, deactivateUser } from '@/lib/activation';
import { requireAdmin } from '@/lib/server/admin-auth';

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
    const raw = await req.json().catch(() => null);
    const statusParsed = EmployeeStatusPatchSchema.safeParse(raw);
    if (!statusParsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: statusParsed.error.issues },
        { status: 422 },
      );
    }
    const { status, reason } = statusParsed.data;

    // Previously this route's own isSystemAdmin() checked only system_admins,
    // ignoring the profiles.role fallback — a legitimate profiles.role-based admin
    // (no system_admins row) got wrongly 403'd. requireAdmin() checks both.
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

    const { data: initialOnboardingRecord, error: fetchError } = await adminSupabase
      .from('employee_onboarding')
      .select('id, user_id, employer_id, employee_code, full_name, email, phone, job_title, department, monthly_salary, start_date, employment_type')
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
        .select('id, user_id, employer_id, employee_code, full_name, email, phone, job_title, department, monthly_salary, start_date, employment_type')
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

    const liveStatus = toLiveEmployeeStatus(status);
    const kycStatus = toKycStatus(status);
    const normalizedEmploymentType =
      typeof onboardingRecord?.employment_type === 'string'
        ? onboardingRecord.employment_type.replace(/_/g, '-').toLowerCase()
        : undefined;

    if (status === 'rejected' && !reason?.trim()) {
      return NextResponse.json({ error: 'A reason is required when rejecting an employee.' }, { status: 422 });
    }

    if (onboardingRecord && normalizedEmploymentType && normalizedEmploymentType !== onboardingRecord.employment_type) {
      const { error: normaliseError } = await adminSupabase
        .from('employee_onboarding')
        .update({ employment_type: normalizedEmploymentType })
        .eq('id', onboardingRecord.id);

      if (normaliseError) {
        console.error('[PATCH status] failed to normalise employment_type:', normaliseError);
        return NextResponse.json({ error: 'Failed to normalise employment data' }, { status: 500 });
      }
    }

    // No direct employee_onboarding.status write for approved/pending/rejected —
    // bulk-updating employee_kyc_documents below fires
    // trg_recompute_onboarding_status, which derives the rollup status itself.
    // 'suspended' is the one exception the trigger explicitly carves out (it
    // skips recompute while status is already 'suspended'), so that one is
    // still written directly.
    if (status === 'approved' || status === 'active') {
      const { error: docsError } = await adminSupabase
        .from('employee_kyc_documents')
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user.id })
        .eq('user_id', userId);

      if (docsError) {
        console.error('[PATCH status] documents approve error:', docsError);
        return NextResponse.json({ error: 'Failed to approve KYC documents' }, { status: 500 });
      }
    } else if (status === 'rejected') {
      const { error: docsError } = await adminSupabase
        .from('employee_kyc_documents')
        .update({ status: 'rejected', reviewer_notes: reason, reviewed_at: new Date().toISOString(), reviewed_by: user.id })
        .eq('user_id', userId);

      if (docsError) {
        console.error('[PATCH status] documents reject error:', docsError);
        return NextResponse.json({ error: 'Failed to reject KYC documents' }, { status: 500 });
      }
    } else if (status === 'pending') {
      // Resets every document back to pending review. The trigger then derives
      // 'pending' if this employee hasn't submitted all 8 documents yet, or
      // 'under_review' if all 8 exist but aren't all approved — there's no way
      // to force a literal 'pending' once documents already exist, so per
      // product decision, "Pending" here means "back in the review queue."
      const { error: docsError } = await adminSupabase
        .from('employee_kyc_documents')
        .update({ status: 'pending' })
        .eq('user_id', userId);

      if (docsError) {
        console.error('[PATCH status] documents reset error:', docsError);
        return NextResponse.json({ error: 'Failed to reset KYC documents' }, { status: 500 });
      }
    } else if (status === 'suspended' && onboardingRecord) {
      const { error: updateError } = await adminSupabase
        .from('employee_onboarding')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', onboardingRecord.id);

      if (updateError) {
        console.error('[PATCH status] onboarding update error:', updateError);
        return NextResponse.json({ error: 'Failed to update onboarding status' }, { status: 500 });
      }
    }

    async function resolveEmployerId(ref: string | undefined): Promise<string | null> {
      if (!ref) return null;

      const { data, error } = await adminSupabase
        .rpc('resolve_live_employer_id', { p_ref: ref });

      if (error || !data) {
        console.error('[resolveEmployerId] RPC failed:', error?.message);
        return null;
      }

      return data as string;
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
          return NextResponse.json({
            error: 'Employer account is not fully set up. The employer must be approved through the admin panel before employees can request advances.',
            code: 'EMPLOYER_NOT_PROMOTED'
          }, { status: 400 });
        }

        upsertPayload.employer_id = resolvedEmployerId;
        upsertPayload.employee_code = onboardingRecord.employee_code;
        upsertPayload.full_name = displayName;
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
      action: `employee_status_${status}`,
      new_value: { status },
      reason: reason || null,
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
