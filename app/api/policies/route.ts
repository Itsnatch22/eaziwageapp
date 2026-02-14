import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, requireOrganization, enforceCountryCap } from '@/lib/auth';
import { updatePolicySchema } from '@/lib/validations';

function transformPolicy(policy: any) {
  return {
    id: policy.id,
    organization_id: policy.organization_id,
    withdrawal_limit_percent: Number(policy.withdrawal_limit_percent ?? 50),
    frequency_cap: policy.frequency_cap === null || policy.frequency_cap === undefined ? null : Number(policy.frequency_cap),
    frequency_period: (policy.frequency_period ?? 'month') as 'week' | 'month',
    auto_approval_enabled: policy.auto_approval_enabled === true || policy.auto_approval_enabled === '1' || policy.auto_approval_enabled === 1,
    auto_approval_threshold: Number(policy.auto_approval_threshold ?? 500),
    access_days: Array.isArray(policy.access_days) ? policy.access_days : [0, 1, 2, 3, 4, 5, 6],
    access_start_hour: Number(policy.access_start_hour ?? 0),
    access_end_hour: Number(policy.access_end_hour ?? 23),
    updated_at: policy.updated_at ?? new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const organization = await requireOrganization();
    const supabase = await createSupabaseServerClient();

    const { data: existing, error: fetchError } = await supabase
      .from('policies')
      .select('*')
      .eq('organization_id', organization.id)
      .single();

    if (!fetchError && existing) {
      return NextResponse.json(transformPolicy(existing));
    }

    const defaultPolicy = {
      organization_id: organization.id,
      withdrawal_limit_percent: 50,
      frequency_cap: null,
      frequency_period: 'month',
      auto_approval_enabled: false,
      auto_approval_threshold: 500,
      access_days: [0, 1, 2, 3, 4, 5, 6],
      access_start_hour: 0,
      access_end_hour: 23,
    };

    const { data: created, error: createError } = await supabase
      .from('policies')
      .insert(defaultPolicy)
      .select('*')
      .single();

    if (createError || !created) {
      return NextResponse.json({ error: 'Failed to create default policy' }, { status: 500 });
    }

    return NextResponse.json(transformPolicy(created));
  } catch (error) {
    console.error('Error fetching policies:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'No organization found') {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to fetch policies' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const organization = await requireOrganization();
    const supabase = await createSupabaseServerClient();

    const body = await request.json();
    const validatedData = updatePolicySchema.parse(body);

    if (validatedData.withdrawal_limit_percent !== undefined) {
      const { allowed, maxCap } = await enforceCountryCap(
        organization.id,
        validatedData.withdrawal_limit_percent
      );

      if (!allowed) {
        return NextResponse.json(
          {
            error: `Withdrawal limit exceeds country cap of ${maxCap}% for ${organization.country}`,
            maxCap,
          },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      ...validatedData,
    };

    const { data: updated, error: updateError } = await supabase
      .from('policies')
      .update(updateData)
      .eq('organization_id', organization.id)
      .select('*')
      .single();

    if (!updateError && updated) {
      return NextResponse.json(transformPolicy(updated));
    }

    const upsertData = {
      organization_id: organization.id,
      ...validatedData,
      updated_at: new Date().toISOString(),
    };

    const { data: createdOrUpdated, error: upsertError } = await supabase
      .from('policies')
      .upsert(upsertData, { onConflict: 'organization_id' })
      .select('*')
      .single();

    if (upsertError || !createdOrUpdated) {
      return NextResponse.json({ error: 'Failed to update policies' }, { status: 500 });
    }

    return NextResponse.json(transformPolicy(createdOrUpdated));
  } catch (error) {
    console.error('Error updating policies:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'No organization found') {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to update policies' }, { status: 500 });
  }
}
