import type { SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/env';

// Must satisfy employers.company_code check: ^[A-Z0-9]{3,20}$
function generateCompanyCode(sourceId: string): string {
  return sourceId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  Kenya: 'KE', Uganda: 'UG', Tanzania: 'TZ', Rwanda: 'RW',
};

export interface EmployerOnboardingRow {
  id: string;
  user_id: string;
  company_name: string | null;
  company_code: string | null;
  industry: string | null;
  country: string | null;
  registration_number: string | null;
  tax_id: string | null;
  physical_address: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  payroll_cycle: string | null;
  risk_score: number | null;
  risk_rating: string | null;
  min_advance_amount: number | null;
  max_advance_percentage: number | null;
  cooldown_period: number | null;
  payday_day_of_month: number | null;
  mobile_money_provider: string | null;
}

/**
 * Promotes an approved employer_onboarding row into the live `employers`
 * table — resolving organization_id, stamping a canonical company_code,
 * upserting the employers row, and stamping any employee_onboarding rows
 * that were submitted before this employer was approved. Idempotent (safe
 * to call again on an already-promoted employer — upserts by user_id/id).
 *
 * Shared by both the per-document review route (called once the last of the
 * 11 required documents is approved) and the whole-application bulk review
 * route, so this logic exists in exactly one place.
 */
export async function promoteEmployerToLive(
  adminSupabase: SupabaseClient,
  employer: EmployerOnboardingRow,
): Promise<{ liveEmployersId: string | null }> {
  // Fetch profile for email + existing company_code
  const { data: profileRow } = await adminSupabase
    .from('profiles')
    .select('email, phone, company_code')
    .eq('id', employer.user_id)
    .maybeSingle();

  // Check if an employers row already exists for this user
  const { data: existingEmployer } = await adminSupabase
    .from('employers')
    .select('id, company_code, organization_id')
    .eq('user_id', employer.user_id)
    .maybeSingle();

  // Canonical company_code — must satisfy ^[A-Z0-9]{3,20}$
  // Priority: existing employers row → onboarding record → deterministic fallback
  const canonicalCode: string =
    existingEmployer?.company_code ??
    (employer.company_code ? String(employer.company_code).replace(/[^A-Z0-9]/gi, '').slice(0, 20).toUpperCase() : null) ??
    (profileRow?.company_code ? String(profileRow.company_code).replace(/[^A-Z0-9]/gi, '').slice(0, 20).toUpperCase() : null) ??
    generateCompanyCode(employer.id);

  // Stamp company_code on employer_onboarding if not already set
  if (!employer.company_code) {
    await adminSupabase
      .from('employer_onboarding')
      .update({ company_code: canonicalCode, updated_at: new Date().toISOString() })
      .eq('id', employer.id);
  }

  // Ensure min advance amount is set
  if (!employer.min_advance_amount || Number(employer.min_advance_amount) <= 0) {
    await adminSupabase
      .from('employer_onboarding')
      .update({ min_advance_amount: 500, updated_at: new Date().toISOString() })
      .eq('id', employer.id);
  }

  // mobile_money_number is encrypted at rest — decrypt it here rather than
  // ever selecting/passing along the raw ciphertext. employers.mobile_money_number
  // is read by the payday-recoupment flow to actually initiate a DusuPay
  // mobile money collection — a corrupted value there means real collection
  // attempts against a garbage MSISDN.
  let decryptedMobileMoneyNumber: string | null = null;
  const { PII_ENCRYPTION_KEY } = getEnv();
  if (PII_ENCRYPTION_KEY) {
    const { data: dec } = await adminSupabase.rpc('admin_get_employer_mobile_money', {
      p_onboarding_id: employer.id,
      p_key: PII_ENCRYPTION_KEY,
    });
    decryptedMobileMoneyNumber = dec ?? null;
  }

  // Resolve organization_id — required by advances.organization_id NOT NULL.
  // Look up by country_code first, then country name. Non-fatal if not found (logged).
  const employerCountryCode = COUNTRY_CODE_MAP[employer.country ?? ''] ?? null;
  let resolvedOrgId: string | null = existingEmployer?.organization_id ?? null;
  if (!resolvedOrgId) {
    const byCode = employerCountryCode
      ? (await adminSupabase.from('organizations').select('id').eq('country_code', employerCountryCode).maybeSingle()).data?.id
      : null;
    const byName = !byCode && employer.country
      ? (await adminSupabase.from('organizations').select('id').eq('country', employer.country).maybeSingle()).data?.id
      : null;
    resolvedOrgId = byCode ?? byName ?? null;
  }
  if (!resolvedOrgId) {
    console.warn(`[employer-promotion] No organization found for country=${employer.country}. advances will fail until organization_id is set manually.`);
  }

  const syncPayload = {
    user_id:             employer.user_id,
    company_name:        employer.company_name || 'Unknown company',
    company_code:        canonicalCode,
    employer_code:       canonicalCode,
    onboarding_id:       employer.id,
    organization_id:     resolvedOrgId,
    email:               employer.contact_email || profileRow?.email || `${employer.user_id}@placeholder.eaziwage.com`,
    phone:               employer.contact_phone || profileRow?.phone || null,
    status:              'approved' as const,
    industry:            employer.industry || null,
    country:             employer.country || 'Kenya',
    registration_number: employer.registration_number || null,
    tax_id:              employer.tax_id || null,
    address:             employer.physical_address || null,
    contact_person:      employer.contact_person || null,
    contact_email:       employer.contact_email || null,
    contact_phone:       employer.contact_phone || null,
    payroll_cycle:       employer.payroll_cycle || null,
    risk_score:          employer.risk_score ?? 3.0,
    risk_rating:         employer.risk_rating || 'B',
    is_verified:         true,
    // PROMOTION PATH — intentionally reads employer_onboarding to populate employers
    // max_advance_percentage → advance_limit_percent
    // cooldown_period → cooldown_days
    advance_limit_percent: Number(employer.max_advance_percentage ?? 50),
    cooldown_days:        Number(employer.cooldown_period ?? 7),
    min_advance_amount:   Number(employer.min_advance_amount ?? 500),
    payday_day_of_month: employer.payday_day_of_month ?? null,
    mobile_money_provider: employer.mobile_money_provider || null,
    mobile_money_number: decryptedMobileMoneyNumber || null,
    updated_at:          new Date().toISOString(),
  };

  console.log(`[employer-promotion] employers sync: ${existingEmployer ? 'UPDATE' : 'INSERT'} for user ${employer.user_id}`);

  // Upsert employers row BEFORE touching profiles (avoids FK violation).
  // Capture the live employers.id so we can explicitly stamp employee_onboarding below.
  // The DB trigger (trg_employers_stamp_live_employer_id) also does this, but we do it
  // explicitly here too because the approval trigger fires before this INSERT exists.
  let liveEmployersId: string | null = existingEmployer?.id ?? null;

  if (existingEmployer) {
    const { error: syncError } = await adminSupabase.from('employers').update(syncPayload).eq('id', existingEmployer.id);
    if (syncError) {
      console.error('[employer-promotion] employers UPDATE failed:', syncError);
    }
  } else {
    const { data: newEmployer, error: syncError } = await adminSupabase
      .from('employers')
      .insert({ ...syncPayload, employer_id: employer.user_id, created_at: new Date().toISOString() })
      .select('id')
      .single();
    if (syncError) {
      console.error('[employer-promotion] employers INSERT failed:', syncError);
      // Non-fatal — continue so admin isn't blocked
    } else {
      liveEmployersId = newEmployer?.id ?? null;
    }
  }

  if (liveEmployersId) {
    // Stamp live_employer_id on any employee_onboarding rows that were
    // submitted before this employer was approved (the DB trigger covers going-forward;
    // this explicit call covers the window between the approval UPDATE and this INSERT).
    const { error: stampError } = await adminSupabase
      .from('employee_onboarding')
      .update({ live_employer_id: liveEmployersId })
      .eq('employer_id', employer.id)
      .is('live_employer_id', null);
    if (stampError) {
      console.error('[employer-promotion] live_employer_id stamp failed:', stampError.message);
    }

    // profiles.company_code update is safe now: employers row is committed.
    const { error: profileCodeError } = await adminSupabase
      .from('profiles')
      .update({ company_code: canonicalCode })
      .eq('id', employer.user_id);
    if (profileCodeError) {
      console.error('[employer-promotion] profiles.company_code update failed:', profileCodeError.message);
    }
  }

  return { liveEmployersId };
}
