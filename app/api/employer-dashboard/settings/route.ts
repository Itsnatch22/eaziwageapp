import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/client';

export const runtime = 'edge';

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
    .select(
      'id, company_name, contact_person, contact_email, contact_phone, payroll_cycle, physical_address, city, postal_code, county_region, country',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!employer) {
    return NextResponse.json({ error: 'No employer profile found.' }, { status: 404 });
  }

  return NextResponse.json({ employer });
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
    .select(
      'id, company_name, contact_person, contact_email, contact_phone, payroll_cycle, physical_address, city, postal_code, county_region, country',
    )
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Settings updated successfully.', employer: updated });
}
