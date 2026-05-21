import { NextResponse } from 'next/server';
import { createSupabaseServerClient, requireOrganization } from '@/lib/auth';

export async function GET() {
  try {
    const organization = await requireOrganization();
    const supabase = await createSupabaseServerClient();

    const { data: integration, error } = await supabase
      .from('payroll_integrations')
      .select('id, provider, status, last_synced_at')
      .eq('organization_id', organization.id)
      .single();

    if (error || !integration) {
      return NextResponse.json(null);
    }

    const transformed = {
      id: integration.id,
      provider: integration.provider,
      status: integration.status,
      last_synced_at: integration.last_synced_at ?? null,
    };

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Error fetching integration:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'No organization found') {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to fetch integration' }, { status: 500 });
  }
}
