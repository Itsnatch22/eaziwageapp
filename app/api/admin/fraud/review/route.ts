import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { checkAdminRateLimit } from '@/lib/rate-limit';
import { FraudReviewBodySchema } from '@/lib/validations/route-schemas';

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

interface ReviewResponse {
  success: boolean;
  flagId: string;
  newFlagStatus: FraudFlagStatus;
  newAdvanceStatus: AdvanceStatus;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rateLimitResponse = await checkAdminRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
    const { user, adminSupabase } = auth;

    const raw = await req.json().catch(() => null);
    const parsed = FraudReviewBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 422 },
      );
    }

    const { flagId, advanceId, action, notes } = parsed.data;

     const { data: existingFlag, error: flagFetchError } = await adminSupabase
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
    
      const { error: flagUpdateError } = await adminSupabase
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

      const { error: advanceUpdateError } = await adminSupabase
        .from('advances')
        .update({
          status: 'pending' satisfies AdvanceStatus,
          fraud_cleared_by: user.id,
          fraud_cleared_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', advanceId);

      if (advanceUpdateError) throw advanceUpdateError;

      void adminSupabase.from('system_audit_logs').insert({
        admin_id: user.id,
        admin_name: user.email,
        target_id: advanceId,
        target_type: 'advance',
        action: 'fraud_flag_cleared',
        old_value: { flag_status: existingFlag.status },
        new_value: { flag_status: 'cleared', advance_status: 'pending' },
        metadata: { flagId, notes },
      }).then(({ error }) => { if (error) console.error('[audit] fraud_flag_cleared:', error); });

      const response: ReviewResponse = {
        success: true,
        flagId,
        newFlagStatus: 'cleared',
        newAdvanceStatus: 'pending',
      };

      return NextResponse.json(response);
    }

    if (action === 'confirm_fraud') {
      const { error: flagUpdateError } = await adminSupabase
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

      const { error: advanceUpdateError } = await adminSupabase
        .from('advances')
        .update({
          status: 'rejected' satisfies AdvanceStatus,
          updated_at: nowIso,
        })
        .eq('id', advanceId);

      if (advanceUpdateError) throw advanceUpdateError;

      void adminSupabase.from('system_audit_logs').insert({
        admin_id: user.id,
        admin_name: user.email,
        target_id: advanceId,
        target_type: 'advance',
        action: 'fraud_confirmed',
        old_value: { flag_status: existingFlag.status },
        new_value: { flag_status: 'confirmed_fraud', advance_status: 'rejected' },
        metadata: { flagId, notes },
      }).then(({ error }) => { if (error) console.error('[audit] fraud_confirmed:', error); });

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