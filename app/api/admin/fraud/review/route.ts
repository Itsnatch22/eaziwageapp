import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAccess } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

type FraudFlagStatus = 'open' | 'reviewed' | 'cleared' | 'confirmed_fraud';
type AdvanceStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'fraud_review'
  | 'rejected';

interface ReviewAction {
  flagId: string;
  advanceId: string;
  action: 'clear' | 'confirm_fraud';
  notes: string;
}

interface ReviewResponse {
  success: boolean;
  flagId: string;
  newFlagStatus: FraudFlagStatus;
  newAdvanceStatus: AdvanceStatus;
}

function isReviewAction(body: unknown): body is ReviewAction {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.flagId === 'string' && b.flagId.length > 0 &&
    typeof b.advanceId === 'string' && b.advanceId.length > 0 &&
    (b.action === 'clear' || b.action === 'confirm_fraud') &&
    typeof b.notes === 'string'
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminAccess = await checkAdminAccess({ user, adminSupabase: supabaseAdmin });
    if (adminAccess.error || !adminAccess.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: unknown = await req.json().catch(() => null);
    if (!isReviewAction(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { flagId, advanceId, action, notes } = body;

    if (notes.trim().length < 5) {
      return NextResponse.json(
        { error: 'Review notes are required (minimum 5 characters)' },
        { status: 422 }
      );
    }

     const { data: existingFlag, error: flagFetchError } = await supabaseAdmin
      .from('fraud_flags')
      .select('id, status, advance_id')
      .eq('id', flagId)
      .maybeSingle();

    if (flagFetchError) throw flagFetchError;
    if (!existingFlag) {
      return NextResponse.json({ error: 'Fraud flag not found' }, { status: 404 });
    }
    if (existingFlag.status !== 'open' && existingFlag.status !== 'reviewed') {
      return NextResponse.json(
        { error: `Flag is already ${existingFlag.status} — cannot re-review` },
        { status: 409 }
      );
    }
    if (existingFlag.advance_id !== advanceId) {
      return NextResponse.json(
        { error: 'advanceId does not match the fraud flag record' },
        { status: 422 }
      );
    }

    const nowIso = new Date().toISOString();

    if (action === 'clear') {
    
      const { error: flagUpdateError } = await supabaseAdmin
        .from('fraud_flags')
        .update({
          status: 'cleared' satisfies FraudFlagStatus,
          reviewed_by: user.id,
          reviewed_at: nowIso,
          review_notes: notes.trim(),
          updated_at: nowIso,
        })
        .eq('id', flagId);

      if (flagUpdateError) throw flagUpdateError;

      const { error: advanceUpdateError } = await supabaseAdmin
        .from('advances')
        .update({
          status: 'pending' satisfies AdvanceStatus,
          fraud_cleared_by: user.id,
          fraud_cleared_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', advanceId);

      if (advanceUpdateError) throw advanceUpdateError;

      const response: ReviewResponse = {
        success: true,
        flagId,
        newFlagStatus: 'cleared',
        newAdvanceStatus: 'pending',
      };

      return NextResponse.json(response);
    }

    if (action === 'confirm_fraud') {
      const { error: flagUpdateError } = await supabaseAdmin
        .from('fraud_flags')
        .update({
          status: 'confirmed_fraud' satisfies FraudFlagStatus,
          reviewed_by: user.id,
          reviewed_at: nowIso,
          review_notes: notes.trim(),
          updated_at: nowIso,
        })
        .eq('id', flagId);

      if (flagUpdateError) throw flagUpdateError;

      const { error: advanceUpdateError } = await supabaseAdmin
        .from('advances')
        .update({
          status: 'rejected' satisfies AdvanceStatus,
          updated_at: nowIso,
        })
        .eq('id', advanceId);

      if (advanceUpdateError) throw advanceUpdateError;

      const response: ReviewResponse = {
        success: true,
        flagId,
        newFlagStatus: 'confirmed_fraud',
        newAdvanceStatus: 'rejected',
      };

      return NextResponse.json(response);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Fraud Review POST] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}