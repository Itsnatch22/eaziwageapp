import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { policies } from '@/lib/db/schema';
import { requireOrganization, enforceCountryCap } from '@/lib/auth';
import { updatePolicySchema } from '@/lib/validations';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Authenticate and get organization
    const organization = await requireOrganization();

    // Fetch policy for this organization
    const [policy] = await db
      .select()
      .from(policies)
      .where(eq(policies.organization_id, organization.id))
      .limit(1);

    if (!policy) {
      // Create default policy if none exists
      const [newPolicy] = await db
        .insert(policies)
        .values({
          organization_id: organization.id,
        })
        .returning();

      const transformed = {
        id: newPolicy.id,
        organization_id: newPolicy.organization_id,
        withdrawal_limit_percent: parseFloat(newPolicy.withdrawal_limit_percent),
        frequency_cap: newPolicy.frequency_cap ? parseInt(newPolicy.frequency_cap) : null,
        frequency_period: newPolicy.frequency_period as 'week' | 'month',
        auto_approval_enabled: newPolicy.auto_approval_enabled === '1',
        auto_approval_threshold: parseFloat(newPolicy.auto_approval_threshold),
        access_days: newPolicy.access_days as number[],
        access_start_hour: parseInt(newPolicy.access_start_hour),
        access_end_hour: parseInt(newPolicy.access_end_hour),
        updated_at: newPolicy.updated_at.toISOString(),
      };

      return NextResponse.json(transformed);
    }

    // Transform to frontend format
    const transformed = {
      id: policy.id,
      organization_id: policy.organization_id,
      withdrawal_limit_percent: parseFloat(policy.withdrawal_limit_percent),
      frequency_cap: policy.frequency_cap ? parseInt(policy.frequency_cap) : null,
      frequency_period: policy.frequency_period as 'week' | 'month',
      auto_approval_enabled: policy.auto_approval_enabled === '1',
      auto_approval_threshold: parseFloat(policy.auto_approval_threshold),
      access_days: policy.access_days as number[],
      access_start_hour: parseInt(policy.access_start_hour),
      access_end_hour: parseInt(policy.access_end_hour),
      updated_at: policy.updated_at.toISOString(),
    };

    return NextResponse.json(transformed);

  } catch (error) {
    console.error('Error fetching policies:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === 'No organization found') {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch policies' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate and get organization
    const organization = await requireOrganization();

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updatePolicySchema.parse(body);

    // Enforce country-specific caps if withdrawal_limit_percent is being updated
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

    // Prepare update data
    const updateData: any = {
      updated_at: new Date(),
    };

    if (validatedData.withdrawal_limit_percent !== undefined) {
      updateData.withdrawal_limit_percent = validatedData.withdrawal_limit_percent.toString();
    }
    if (validatedData.frequency_cap !== undefined) {
      updateData.frequency_cap = validatedData.frequency_cap?.toString() ?? null;
    }
    if (validatedData.frequency_period !== undefined) {
      updateData.frequency_period = validatedData.frequency_period;
    }
    if (validatedData.auto_approval_enabled !== undefined) {
      updateData.auto_approval_enabled = validatedData.auto_approval_enabled ? '1' : '0';
    }
    if (validatedData.auto_approval_threshold !== undefined) {
      updateData.auto_approval_threshold = validatedData.auto_approval_threshold.toString();
    }
    if (validatedData.access_days !== undefined) {
      updateData.access_days = validatedData.access_days;
    }
    if (validatedData.access_start_hour !== undefined) {
      updateData.access_start_hour = validatedData.access_start_hour.toString();
    }
    if (validatedData.access_end_hour !== undefined) {
      updateData.access_end_hour = validatedData.access_end_hour.toString();
    }

    // Update policy
    const [updated] = await db
      .update(policies)
      .set(updateData)
      .where(eq(policies.organization_id, organization.id))
      .returning();

    // Transform to frontend format
    const transformed = {
      id: updated.id,
      organization_id: updated.organization_id,
      withdrawal_limit_percent: parseFloat(updated.withdrawal_limit_percent),
      frequency_cap: updated.frequency_cap ? parseInt(updated.frequency_cap) : null,
      frequency_period: updated.frequency_period as 'week' | 'month',
      auto_approval_enabled: updated.auto_approval_enabled === '1',
      auto_approval_threshold: parseFloat(updated.auto_approval_threshold),
      access_days: updated.access_days as number[],
      access_start_hour: parseInt(updated.access_start_hour),
      access_end_hour: parseInt(updated.access_end_hour),
      updated_at: updated.updated_at.toISOString(),
    };

    return NextResponse.json(transformed);

  } catch (error) {
    console.error('Error updating policies:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === 'No organization found') {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update policies' },
      { status: 500 }
    );
  }
}