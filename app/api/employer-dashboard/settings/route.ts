import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient as createClient } from '@/utils/supabase/server';
import { getAdvanceLimit } from '@/lib/utils';

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
    .from('employer_onboarding')
    .select(`
      id,
      company_name,
      contact_person,
      contact_email,
      contact_phone,
      payroll_cycle,
      physical_address,
      city,
      postal_code,
      county_region,
      country,
      registration_number,
      tax_id,
      industry,
      sector,
      bank_name,
      bank_account_number
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[employer-settings/GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!employer) {
    return NextResponse.json({ error: 'No employer profile found.' }, { status: 404 });
  }

  const countryLimit = getAdvanceLimit(employer.country);
  
  return NextResponse.json({
    employer: {
      ...employer,
      email_notifications: true,
      advance_alerts: true,
      payroll_reminders: true,
      weekly_reports: false,
      // Default EWA settings (since these columns don't exist in DB)
      max_advance_percentage: Math.min(50, countryLimit),
      min_advance_amount: 500,
      max_advance_amount: 50000,
      advance_access_days: [1, 25],
      cooldown_period: 7,
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

  const input = await req.json().catch(() => null);
  if (!input || typeof input !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from('employer_onboarding')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error('[employer-settings/PUT] Fetch error:', existingError);
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: 'No employer profile found.' }, { status: 404 });
  }

  const updates = {
    company_name: input.companyName ?? null,
    contact_person: input.contactPerson ?? null,
    contact_email: input.contactEmail ?? null,
    contact_phone: input.contactPhone ?? null,
    payroll_cycle: input.payrollCycle ?? null,
    physical_address: input.physicalAddress ?? null,
    city: input.city ?? null,
    postal_code: input.postalCode ?? null,
    county_region: input.countyRegion ?? null,
    country: input.country ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } = await supabase
    .from('employer_onboarding')
    .update(updates)
    .eq('id', existing.id)
    .select(`
      id,
      company_name,
      contact_person,
      contact_email,
      contact_phone,
      payroll_cycle,
      physical_address,
      city,
      postal_code,
      county_region,
      country,
      registration_number,
      tax_id,
      industry,
      sector,
      bank_name,
      bank_account_number
    `)
    .single();

  if (updateError) {
    console.error('[employer-settings/PUT] Update error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Return with default values for fields that weren't saved
  const finalCountryLimit = getAdvanceLimit(updated.country);

  return NextResponse.json({
    message: 'Settings updated successfully.',
    employer: {
      ...updated,
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