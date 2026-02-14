import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { payrollIntegrations } from '@/lib/db/schema';
import { requireOrganization } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Authenticate and get organization
    const organization = await requireOrganization();

    // Fetch payroll integration for this organization
    const [integration] = await db
      .select()
      .from(payrollIntegrations)
      .where(eq(payrollIntegrations.organization_id, organization.id))
      .limit(1);

    if (!integration) {
      return NextResponse.json(null);
    }

    // Transform to frontend format (exclude sensitive credentials)
    const transformed = {
      id: integration.id,
      provider: integration.provider,
      status: integration.status,
      last_synced_at: integration.last_synced_at?.toISOString() ?? null,
    };

    return NextResponse.json(transformed);

  } catch (error) {
    console.error('Error fetching integration:', error);

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
      { error: 'Failed to fetch integration' },
      { status: 500 }
    );
  }
}