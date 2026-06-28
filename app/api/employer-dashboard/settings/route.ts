import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { getAdvanceLimit } from '@/lib/utils';
import { EmployerProfileUpdateSchema } from '@/lib/validations/route-schemas';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: employer, error } = await supabase
    .from('employers')
    .select(`
      id,
      company_name,
      contact_person,
      contact_email,
      contact_phone,
      phone,
      payroll_cycle,
      country,
      registration_number,
      tax_id,
      industry,
      onboarding_id,
      employer_onboarding!onboarding_id (
        physical_address,
        city,
        postal_code,
        county_region,
        sector,
        bank_name,
        bank_account_number,
        email_notifications,
        advance_alerts,
        payroll_reminders,
        weekly_reports,
        max_advance_percentage,
        min_advance_amount,
        advance_access_days,
        cooldown_period
      )
    `)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[employer-settings/GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch employer settings' }, { status: 500 });
  }

  if (!employer) {
    const { data: ob } = await supabase
      .from('employer_onboarding')
      .select(`id, company_name, contact_person, contact_email, phone, payroll_cycle, country, registration_number, tax_id, industry, physical_address, city, postal_code, county_region, sector, bank_name, bank_account_number, email_notifications, advance_alerts, payroll_reminders, weekly_reports, max_advance_percentage, min_advance_amount, advance_access_days, cooldown_period`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ob) {
      return NextResponse.json({ error: 'No employer profile found.' }, { status: 404 });
    }

    const countryLimitFb = getAdvanceLimit(ob.country);
    return NextResponse.json({
      employer: {
        id: ob.id, company_name: ob.company_name, contact_person: ob.contact_person,
        contact_email: ob.contact_email, contact_phone: ob.phone, payroll_cycle: ob.payroll_cycle,
        country: ob.country, registration_number: ob.registration_number, tax_id: ob.tax_id,
        industry: ob.industry, onboarding_id: ob.id, physical_address: ob.physical_address,
        city: ob.city, postal_code: ob.postal_code, county_region: ob.county_region,
        sector: ob.sector, bank_name: ob.bank_name, bank_account_number: ob.bank_account_number,
        email_notifications: ob.email_notifications ?? true, advance_alerts: ob.advance_alerts ?? true,
        payroll_reminders: ob.payroll_reminders ?? true, weekly_reports: ob.weekly_reports ?? false,
        max_advance_percentage: Math.min(ob.max_advance_percentage ?? 50, countryLimitFb),
        min_advance_amount: ob.min_advance_amount ?? 500, max_advance_amount: 50000,
        advance_access_days: ob.advance_access_days ?? [1, 25], cooldown_period: ob.cooldown_period ?? 7,
      },
    });
  }

  const onboarding = Array.isArray(employer.employer_onboarding)
    ? employer.employer_onboarding[0]
    : employer.employer_onboarding;
  const liveEmployer = {
    id: employer.id,
    company_name: employer.company_name,
    contact_person: employer.contact_person,
    contact_email: employer.contact_email,
    contact_phone: employer.contact_phone,
    payroll_cycle: employer.payroll_cycle,
    country: employer.country,
    registration_number: employer.registration_number,
    tax_id: employer.tax_id,
    industry: employer.industry,
    onboarding_id: employer.onboarding_id,
  };
  const countryLimit = getAdvanceLimit(liveEmployer.country);
  
  return NextResponse.json({
    employer: {
      ...liveEmployer,
      ...onboarding,
      contact_phone: liveEmployer.contact_phone ?? employer.phone,
      email_notifications: onboarding?.email_notifications ?? true,
      advance_alerts: onboarding?.advance_alerts ?? true,
      payroll_reminders: onboarding?.payroll_reminders ?? true,
      weekly_reports: onboarding?.weekly_reports ?? false,
      max_advance_percentage: Math.min(onboarding?.max_advance_percentage ?? 50, countryLimit),
      min_advance_amount: onboarding?.min_advance_amount ?? 500,
      max_advance_amount: 50000,
      advance_access_days: onboarding?.advance_access_days ?? [1, 25],
      cooldown_period: onboarding?.cooldown_period ?? 7,
    },
  });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settingsParsed = EmployerProfileUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!settingsParsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: settingsParsed.error.issues },
      { status: 422 },
    );
  }
  const input = settingsParsed.data;

  const { data: existing, error: existingError } = await supabase
    .from('employers')
    .select('id, onboarding_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingError) {
    console.error('[employer-settings/PUT] Fetch error:', existingError);
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existing) {
    // No employers record yet — update employer_onboarding directly
    const { data: obFallback } = await supabase
      .from('employer_onboarding')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!obFallback) {
      return NextResponse.json({ error: 'No employer profile found.' }, { status: 404 });
    }

    const { error: obUpdateError } = await supabase
      .from('employer_onboarding')
      .update({
        physical_address: input.physicalAddress ?? null,
        city: input.city ?? null,
        postal_code: input.postalCode ?? null,
        county_region: input.countyRegion ?? null,
        email_notifications: input.emailNotifications ?? true,
        advance_alerts: input.advanceAlerts ?? true,
        payroll_reminders: input.payrollReminders ?? true,
        weekly_reports: input.weeklyReports ?? false,
        max_advance_percentage: input.maxAdvancePercentage ?? 50,
        min_advance_amount: input.minAdvanceAmount ?? 500,
        advance_access_days: input.advanceAccessDays ?? [1, 25],
        cooldown_period: input.cooldownPeriod ?? 7,
        updated_at: new Date().toISOString(),
      })
      .eq('id', obFallback.id);

    if (obUpdateError) {
      return NextResponse.json({ error: obUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Settings updated successfully.' });
  }

  const updates = {
    company_name: input.companyName ?? null,
    contact_person: input.contactPerson ?? null,
    contact_email: input.contactEmail ?? null,
    contact_phone: input.contactPhone ?? null,
    payroll_cycle: input.payrollCycle ?? null,
    country: input.country ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error: onboardingUpdateError } = await supabase
    .from('employer_onboarding')
    .update({
      physical_address: input.physicalAddress ?? null,
      city: input.city ?? null,
      postal_code: input.postalCode ?? null,
      county_region: input.countyRegion ?? null,
      email_notifications: input.emailNotifications ?? true,
      advance_alerts: input.advanceAlerts ?? true,
      payroll_reminders: input.payrollReminders ?? true,
      weekly_reports: input.weeklyReports ?? false,
      max_advance_percentage: input.maxAdvancePercentage ?? 50,
      min_advance_amount: input.minAdvanceAmount ?? 500,
      advance_access_days: input.advanceAccessDays ?? [1, 25],
      cooldown_period: input.cooldownPeriod ?? 7,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.onboarding_id);

  if (onboardingUpdateError) {
    console.error('[employer-settings/PUT] Onboarding update error:', onboardingUpdateError);
    return NextResponse.json({ error: onboardingUpdateError.message }, { status: 500 });
  }

  const { data: updated, error: updateError } = await supabase
    .from('employers')
    .update(updates)
    .eq('id', existing.id)
    .select(`
      id,
      company_name,
      contact_person,
      contact_email,
      contact_phone,
      phone,
      payroll_cycle,
      country,
      registration_number,
      tax_id,
      industry,
      onboarding_id,
      employer_onboarding!onboarding_id (
        physical_address,
        city,
        postal_code,
        county_region,
        sector,
        bank_name,
        bank_account_number
      )
    `)
    .single();

  if (updateError) {
    console.error('[employer-settings/PUT] Update error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }


  const finalCountryLimit = getAdvanceLimit(updated.country);
  const updatedOnboarding = Array.isArray(updated.employer_onboarding)
    ? updated.employer_onboarding[0]
    : updated.employer_onboarding;
  const updatedEmployer = {
    id: updated.id,
    company_name: updated.company_name,
    contact_person: updated.contact_person,
    contact_email: updated.contact_email,
    contact_phone: updated.contact_phone,
    payroll_cycle: updated.payroll_cycle,
    country: updated.country,
    registration_number: updated.registration_number,
    tax_id: updated.tax_id,
    industry: updated.industry,
    onboarding_id: updated.onboarding_id,
  };

  return NextResponse.json({
    message: 'Settings updated successfully.',
    employer: {
      ...updatedEmployer,
      ...updatedOnboarding,
      contact_phone: updatedEmployer.contact_phone ?? updated.phone,
      email_notifications: input.emailNotifications ?? true,
      advance_alerts: input.advanceAlerts ?? true,
      payroll_reminders: input.payrollReminders ?? true,
      weekly_reports: input.weeklyReports ?? false,
      max_advance_percentage: Math.min(input.maxAdvancePercentage ?? 50, finalCountryLimit),
      min_advance_amount: input.minAdvanceAmount ?? 500,
      max_advance_amount: input.maxAdvanceAmount ?? 50000,
      advance_access_days: input.advanceAccessDays ?? [1, 25],
      cooldown_period: input.cooldownPeriod ?? 7,
    },
  });
  }
