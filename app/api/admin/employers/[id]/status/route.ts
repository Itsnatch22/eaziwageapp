import { NextRequest, NextResponse } from 'next/server';
import { adminApiLimiter, checkRateLimit } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/server/admin-auth';
import { EmployerStatusPatchSchema } from '@/lib/validations/route-schemas';
import { notifyEmployer } from '@/lib/notifications';
import { resolveDefaultAdvanceRange } from '@/lib/services/advance-defaults';
import { promoteEmployerToLive, type EmployerOnboardingRow } from '@/lib/services/employer-promotion';
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

const REQUIRED_DOCUMENT_TYPES = [
  'certificate_of_incorporation', 'business_registration', 'tax_compliance_certificate',
  'cr12_document', 'kra_pin_certificate', 'business_permit', 'audited_financials',
  'bank_statement', 'proof_of_address', 'proof_of_bank_account', 'employment_contract_template',
];

export async function PATCH(
  req: NextRequest,
  { params }: IdRouteContext
): Promise<NextResponse> {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = await checkRateLimit(adminApiLimiter, `admin-employer-status:${ip}`);

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

  if (status === 'rejected' && !reason?.trim()) {
    return NextResponse.json({ error: 'A reason is required when rejecting an employer.' }, { status: 422 });
  }

  console.log(`[PATCH employer status] Attempting update for ID: ${id} to status: ${status}`);

  const { data: initialEmployer, error: employerFetchError } = await adminSupabase
    .from('employer_onboarding')
    .select('id,user_id,company_name,status,account_status,industry,country,registration_number,tax_id,physical_address,contact_person,contact_email,contact_phone,payroll_cycle,risk_score,risk_rating,min_advance_amount,max_advance_amount,currency,max_advance_percentage,cooldown_period')
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
        .select('id,user_id,company_name,status,account_status,industry,country,registration_number,tax_id,physical_address,contact_person,contact_email,contact_phone,payroll_cycle,risk_score,risk_rating,min_advance_amount,max_advance_amount,currency,max_advance_percentage,cooldown_period')
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

  // Account approval (this route) and KYC document approval are separate
  // gates — approving the account must never bulk-approve every document as
  // a side effect (that used to happen here). Dashboard access is granted
  // below independent of the employer_onboarding KYC rollup (`status`);
  // money-movement eligibility (employers.is_verified) is still
  // independently gated elsewhere and only ever set by
  // fn_sync_employer_kyc_to_live() reacting to real per-document review
  // outcomes. See feedback_separate_account_kyc_review_approval.
  if (status === 'rejected') {
    const { error: docsError } = await adminSupabase
      .from('employer_kyc_documents')
      .update({ status: 'rejected', reviewer_notes: reason, reviewed_at: new Date().toISOString(), reviewed_by: user.id })
      .eq('user_id', employer.user_id);

    if (docsError) {
      console.error('[PATCH employer status] documents reject error:', docsError);
      return NextResponse.json({ error: 'Failed to reject employer documents' }, { status: 500 });
    }
  } else if (status === 'pending') {
    // Resets every document back to pending review — mirrors the employee-side
    // route. The trigger then derives 'pending' or 'under_review' depending on
    // whether all 11 documents exist yet; there's no way to force a literal
    // 'pending' once documents already exist.
    const { error: docsError } = await adminSupabase
      .from('employer_kyc_documents')
      .update({ status: 'pending' })
      .eq('user_id', employer.user_id);

    if (docsError) {
      console.error('[PATCH employer status] documents reset error:', docsError);
      return NextResponse.json({ error: 'Failed to reset employer documents' }, { status: 500 });
    }
  }

  // account_status is the sole, unconditional carrier of the admin's account
  // decision — no trigger ever touches it, so there's no "un-suspend" special
  // case needed the way employer_onboarding.status used to require.
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    account_status: status,
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

  // Account approval no longer depends on KYC completeness, so it always
  // succeeds — but it's still useful for the admin to know if they just
  // granted dashboard access to an employer whose KYC review isn't actually
  // done yet. Non-blocking: informational only, never fails the request.
  let kycWarning: string | null = null;
  if (status === 'approved') {
    const { data: kycDocs } = await adminSupabase
      .from('employer_kyc_documents')
      .select('document_type, status')
      .eq('user_id', employer.user_id);

    const docs = kycDocs ?? [];
    const submittedCount = docs.filter((d) => REQUIRED_DOCUMENT_TYPES.includes(d.document_type)).length;
    const rejectedCount = docs.filter((d) => d.status === 'rejected').length;
    const approvedCount = docs.filter((d) => d.status === 'approved').length;

    if (rejectedCount > 0) {
      kycWarning = `Dashboard access granted, but ${rejectedCount} KYC document(s) are still marked rejected.`;
    } else if (submittedCount < REQUIRED_DOCUMENT_TYPES.length) {
      kycWarning = `Dashboard access granted, but only ${submittedCount} of ${REQUIRED_DOCUMENT_TYPES.length} required KYC documents have been submitted.`;
    } else if (approvedCount < REQUIRED_DOCUMENT_TYPES.length) {
      kycWarning = `Dashboard access granted, but only ${approvedCount} of ${REQUIRED_DOCUMENT_TYPES.length} required KYC documents are approved. Money-movement features (advances) will stay blocked until KYC review is complete.`;
    }
  }

  let resolvedCompanyCode: string | null = null;
  const { data: existingEmployer } = await adminSupabase
    .from('employers')
    .select('id, company_code, employer_code')
    .eq('user_id', employer.user_id)
    .maybeSingle();

  if (status === 'approved') {
    // Route through the canonical promotion path (also used by the KYC review
    // routes) instead of duplicating the employers-table sync inline — the
    // duplicate here never set organization_id (required by
    // advances.organization_id NOT NULL) or stamped
    // employee_onboarding.live_employer_id. Re-fetch first so we pick up the
    // company_code/min_advance_amount/max_advance_amount the employer_onboarding
    // update above just wrote (including any admin-provided employer_code or
    // resolved default range).
    const { data: fullOnboarding, error: fullOnboardingError } = await adminSupabase
      .from('employer_onboarding')
      .select(
        'id, user_id, company_name, company_code, industry, country, registration_number, tax_id, physical_address, contact_person, contact_email, contact_phone, payroll_cycle, risk_score, risk_rating, min_advance_amount, max_advance_amount, max_advance_percentage, cooldown_period, payday_day_of_month, mobile_money_provider'
      )
      .eq('id', activeId)
      .maybeSingle();

    if (fullOnboardingError || !fullOnboarding) {
      console.error('[PATCH employer status] Failed to re-fetch onboarding for promotion:', fullOnboardingError);
      return NextResponse.json({ error: 'Employer status updated, but promotion failed' }, { status: 500 });
    }

    const promotion = await promoteEmployerToLive(adminSupabase, fullOnboarding as EmployerOnboardingRow);
    console.log(`[PATCH employer status] Promoted employer, liveEmployersId=${promotion.liveEmployersId}`);
    resolvedCompanyCode = fullOnboarding.company_code ?? null;

    if (promotion.liveEmployersId && env.PII_ENCRYPTION_KEY) {
      try {
        await adminSupabase.rpc('promote_employer_bank_account', {
          p_onboarding_id: activeId,
          p_employer_id:   promotion.liveEmployersId,
          p_key:           env.PII_ENCRYPTION_KEY,
        });
        console.log(`[PATCH employer status] Bank account promoted for employer ${activeId}`);
      } catch (bankErr) {
        // Non-blocking — approval proceeds even if promotion fails.
        // Bank account can be promoted manually via the admin panel if needed.
        console.error('[PATCH employer status] Bank account promotion failed:', bankErr);
      }
    }
  } else if (existingEmployer) {
    // Employer was already promoted to `employers` on a prior approval — a
    // non-approval status change (suspend/reject/pending) doesn't need a full
    // re-promotion, just the status flag kept in sync. is_verified is
    // deliberately NOT touched here — it's owned exclusively by
    // fn_sync_employer_kyc_to_live(), reacting to the real KYC rollup, never
    // by this account-status action.
    const primaryStatus = toPrimaryEmployerStatus(status);
    const { error: syncError } = await adminSupabase
      .from('employers')
      .update({ status: primaryStatus, updated_at: new Date().toISOString() })
      .eq('id', existingEmployer.id);

    if (syncError) {
      console.error('[PATCH employer status] employers status sync error:', syncError);
      return NextResponse.json({ error: 'Employer status updated, but primary employer sync failed' }, { status: 500 });
    }

    resolvedCompanyCode = existingEmployer.company_code ?? null;
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
      kyc_warning: kycWarning,
    },
  });
}
