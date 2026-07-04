import { NextRequest, NextResponse } from 'next/server';
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';
import { EmployerStatusPatchSchema } from '@/lib/validations/route-schemas';
import { notifyEmployer } from '@/lib/notifications';
import { resolveDefaultAdvanceRange } from '@/lib/services/advance-defaults';
import { getEnv } from '@/env';

const env = getEnv();

// Produces a code satisfying employers.company_code check: ^[A-Z0-9]{3,20}$
function generatePrimaryCompanyCode(sourceId: string): string {
  return sourceId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

function toPrimaryEmployerStatus(status: string): 'approved' | 'pending' | 'suspended' {
  if (status === 'approved' || status === 'suspended') return status;
  return 'pending';
}

export async function PATCH(
  req: NextRequest,
  { params }: IdRouteContext
): Promise<NextResponse> {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(apiLimiter, `admin-employer-status:${ip}`);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: rateResult.headers }
    );
  }

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { user, adminSupabase } = auth;

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle<{ full_name: string | null }>();

  const raw = await req.json().catch(() => null);
  const statusParsed = EmployerStatusPatchSchema.safeParse(raw);
  if (!statusParsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: statusParsed.error.issues },
      { status: 422 },
    );
  }
  const { status, employer_code, min_advance_amount, initial_credit_limit, reason } = statusParsed.data;

  console.log(`[PATCH employer status] Attempting update for ID: ${id} to status: ${status}`);

  const { data: initialEmployer, error: employerFetchError } = await adminSupabase
    .from('employer_onboarding')
    .select('id,user_id,company_name,industry,country,registration_number,tax_id,physical_address,contact_person,contact_email,contact_phone,payroll_cycle,risk_score,risk_rating,min_advance_amount,max_advance_amount,currency,max_advance_percentage,cooldown_period')
    .eq('id', id)
    .maybeSingle();
  let employer = initialEmployer;

  if (!employer && !employerFetchError) {
    console.log(`[PATCH employer status] ID ${id} not found in onboarding, checking primary 'employers' table...`);
    const { data: primaryEmp } = await adminSupabase
      .from('employers')
      .select('id,user_id,company_name')
      .eq('id', id)
      .maybeSingle();
    
    if (primaryEmp) {
      const { data: fallbackOnboarding } = await adminSupabase
        .from('employer_onboarding')
        .select('id,user_id,company_name,industry,country,registration_number,tax_id,physical_address,contact_person,contact_email,contact_phone,payroll_cycle,risk_score,risk_rating,min_advance_amount,max_advance_amount,currency,max_advance_percentage,cooldown_period')
        .eq('user_id', primaryEmp.user_id)
        .maybeSingle();
      
      if (fallbackOnboarding) {
        console.log(`[PATCH employer status] Found onboarding record ${fallbackOnboarding.id} via user_id ${primaryEmp.user_id}`);
        employer = fallbackOnboarding;
      }
    }
  }

  if (employerFetchError || !employer) {
    console.error(`[PATCH employer status] Employer not found for ID: ${id}`, employerFetchError);
    return NextResponse.json({ 
      error: 'Employer record not found. The ID might be incorrect or the record was deleted.',
      debug_id: id 
    }, { status: 404 });
  }

  const activeId = employer.id;

  const updatePayload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    // Always stamp company_code on the onboarding record so it becomes the
    // canonical lookup source for employee registration.
    ...(!(employer as Record<string, unknown>).company_code && status !== 'rejected'
      ? { company_code: (typeof employer_code === 'string' && employer_code.trim()
          ? employer_code.trim().replace(/[^A-Z0-9]/gi, '').slice(0, 20).toUpperCase()
          : generatePrimaryCompanyCode(employer.id)) }
      : {}),
  };

  const resolvedMinAdvance =
    typeof min_advance_amount === 'number' && Number.isFinite(min_advance_amount)
      ? min_advance_amount
      : (typeof initial_credit_limit === 'number' && Number.isFinite(initial_credit_limit)
          ? initial_credit_limit
          : undefined);

  // Flat 500/50000 (KES-shaped) fallbacks previously applied to every employer
  // regardless of country — a Ugandan/Tanzanian/Rwandan employer got the same raw
  // number as a Kenyan one, wildly under- or over-valuing the actual limit in their
  // currency. Scale the baseline via the live exchange rate for their currency instead.
  const needsDefaultRange =
    status === 'approved' &&
    (typeof resolvedMinAdvance !== 'number' || resolvedMinAdvance <= 0) &&
    (!employer.min_advance_amount || Number(employer.min_advance_amount) <= 0);
  const needsDefaultMax =
    status === 'approved' &&
    (!(employer as { max_advance_amount?: number | null }).max_advance_amount ||
      Number((employer as { max_advance_amount?: number | null }).max_advance_amount) <= 0);
  const defaultRange =
    needsDefaultRange || needsDefaultMax
      ? await resolveDefaultAdvanceRange(adminSupabase, employer.country)
      : null;

  if (typeof resolvedMinAdvance === 'number' && resolvedMinAdvance > 0) {
    updatePayload.min_advance_amount = Math.round(resolvedMinAdvance);
  } else if (needsDefaultRange && defaultRange) {
    updatePayload.min_advance_amount = defaultRange.min_advance_amount;
  }

  if (needsDefaultMax && defaultRange) {
    updatePayload.max_advance_amount = defaultRange.max_advance_amount;
  }

  const { error: updateError } = await adminSupabase
    .from('employer_onboarding')
    .update(updatePayload)
    .eq('id', activeId);

  if (updateError) {
    console.error('[PATCH employer status] Error:', updateError);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  console.log(`[PATCH employer status] Successfully updated record ${activeId}`);

  let resolvedCompanyCode: string | null = null;
  const { data: existingEmployer } = await adminSupabase
    .from('employers')
    .select('id, company_code, employer_code')
    .eq('user_id', employer.user_id)
    .maybeSingle();

  // Run sync when approving OR when an employers row already exists (keeps it in sync on
  // every status change). Never creates an employers row for non-approved statuses.
  if (status === 'approved' || existingEmployer) {
    const { data: profileRow } = await adminSupabase
      .from('profiles')
      .select('email, phone')
      .eq('id', employer.user_id)
      .maybeSingle();

    // Canonical code — must satisfy employers.company_code check: ^[A-Z0-9]{3,20}$
    // Priority: admin-provided → employer_onboarding.company_code (stamped above) →
    //           existing employers row → deterministic fallback from onboarding UUID.
    const onboardingCode = (employer as Record<string, unknown>).company_code as string | null;
    const canonicalCode: string =
      (typeof employer_code === 'string' && employer_code.trim()
        ? employer_code.trim().replace(/[^A-Z0-9]/gi, '').slice(0, 20).toUpperCase()
        : null) ??
      onboardingCode ??
      existingEmployer?.company_code ??
      generatePrimaryCompanyCode(employer.id);

    const primaryStatus = toPrimaryEmployerStatus(status);

    const syncPayload = {
      user_id:             employer.user_id,
      company_name:        employer.company_name || 'Unknown company',
      // Bug 1 fix: single valid code used for both columns — no EW- prefix.
      company_code:        canonicalCode,
      employer_code:       canonicalCode,
      // Bug 2 fix: always carry onboarding_id so the public employers join works.
      onboarding_id:       activeId,
      email:               employer.contact_email || profileRow?.email || null,
      phone:               employer.contact_phone || profileRow?.phone || null,
      status:              primaryStatus,
      industry:            employer.industry || null,
      country:             employer.country || null,
      registration_number: employer.registration_number || null,
      tax_id:              employer.tax_id || null,
      address:             employer.physical_address || null,
      contact_person:      employer.contact_person || null,
      contact_email:       employer.contact_email || null,
      contact_phone:       employer.contact_phone || null,
      payroll_cycle:       employer.payroll_cycle || null,
      risk_score:          employer.risk_score ?? null,
      risk_rating:         employer.risk_rating || null,
      is_verified:         primaryStatus === 'approved',
      // PROMOTION PATH — intentionally reads employer_onboarding to populate employers
      // This is the ONLY place where employer_onboarding values are mapped to employers columns
      // max_advance_percentage → advance_limit_percent
      // cooldown_period → cooldown_days
      advance_limit_percent: (employer as { max_advance_percentage?: number | null }).max_advance_percentage ?? 50,
      cooldown_days:         (employer as { cooldown_period?: number | null }).cooldown_period ?? 7,
      min_advance_amount:    (updatePayload.min_advance_amount as number | undefined) ?? employer.min_advance_amount ?? defaultRange?.min_advance_amount ?? 500,
      max_advance_amount:    (updatePayload.max_advance_amount as number | undefined) ?? (employer as { max_advance_amount?: number | null }).max_advance_amount ?? defaultRange?.max_advance_amount ?? 50000,
      updated_at:          new Date().toISOString(),
    };

    // Bug 3 fix: commit employers row FIRST so the FK
    // (profiles.company_code → employers.company_code) is satisfied before we touch profiles.
    const { error: syncError } = existingEmployer
      ? await adminSupabase.from('employers').update(syncPayload).eq('id', existingEmployer.id)
      : await adminSupabase.from('employers').insert({
          ...syncPayload,
          employer_id: employer.user_id,
          created_at: new Date().toISOString(),
        });

    if (syncError) {
      console.error('[PATCH employer status] Primary employers sync error:', syncError);
      return NextResponse.json({ error: 'Employer status updated, but primary employer sync failed' }, { status: 500 });
    }

    // On a fresh insert existingEmployer is null — resolve the just-created row's id.
    const { data: resolvedEmployer } = await adminSupabase
      .from('employers')
      .select('id')
      .eq('user_id', employer.user_id)
      .maybeSingle();

    const employerLiveId = existingEmployer?.id ?? resolvedEmployer?.id;

    if (status === 'approved' && employerLiveId && env.PII_ENCRYPTION_KEY) {
      try {
        await adminSupabase.rpc('promote_employer_bank_account', {
          p_onboarding_id: activeId,
          p_employer_id:   employerLiveId,
          p_key:           env.PII_ENCRYPTION_KEY,
        });
        console.log(`[PATCH employer status] Bank account promoted for employer ${activeId}`);
      } catch (bankErr) {
        // Non-blocking — approval proceeds even if promotion fails.
        // Bank account can be promoted manually via the admin panel if needed.
        console.error('[PATCH employer status] Bank account promotion failed:', bankErr);
      }
    }

    // profiles.company_code update is safe now — employers row is committed.
    const { error: profileCodeError } = await adminSupabase
      .from('profiles')
      .update({ company_code: canonicalCode })
      .eq('id', employer.user_id);

    if (profileCodeError) {
      // Non-fatal: employees can still register; log for investigation.
      console.error('[PATCH employer status] profiles.company_code update failed:', profileCodeError.message);
    }

    resolvedCompanyCode = canonicalCode;
  }

  const statusLabel: Record<string, string> = {
    approved: 'Approved',
    pending: 'Pending Review',
    rejected: 'Rejected',
    suspended: 'Suspended',
    risk_review_in_progress: 'Under Risk Review',
  };

  await notifyEmployer({
    userId: employer.user_id,
    type: 'status_change',
    title: `Account ${statusLabel[status] ?? status.replace(/_/g, ' ')}`,
    message:
      status === 'approved'
        ? `Your employer profile is now fully active.${resolvedCompanyCode ? ` Your company code is ${resolvedCompanyCode}.` : ''}`
        : `Your employer account status has been updated to ${statusLabel[status] ?? status.replace(/_/g, ' ')}.${reason ? ` Reason: ${reason}` : ''}`,
    metadata: {
      companyName: employer.company_name,
      contactPerson: employer.contact_person ?? undefined,
      previousStatus: undefined,
      newStatus: status,
      reason: reason ?? undefined,
      effectiveAt: new Date().toLocaleString(),
    },
  });

  await adminSupabase.from('system_audit_logs').insert({
    admin_id: user.id,
    admin_name: profile?.full_name || 'Admin',
    target_id: activeId,
    target_type: 'employer',
    action: 'account_status',
    new_status: status,
    reason: reason || null,
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({
    message: `Employer status updated to ${status}`,
    data: {
      status,
      company_code: resolvedCompanyCode,
      min_advance_amount: updatePayload.min_advance_amount ?? employer.min_advance_amount ?? null,
    },
  });
}
