import { NextRequest, NextResponse } from 'next/server';
import { dusupay } from '@/lib/dusupay';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference');

  if (!reference) {
    return NextResponse.json({ error: 'Reference parameter is required' }, { status: 400 });
  }

  try {
    const result = await dusupay.checkPayoutStatus(reference);

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        message: result.message || 'Failed to fetch status from Dusupay',
        errorCode: result.errorCode 
      }, { status: 400 });
    }

    if (result.status) {
      const { data: advance } = await supabaseAdmin
        .from('advances')
        .select('id, status')
        .eq('reference', reference)
        .single();

      if (advance) {
        let dbStatus: string | null = null;
        if (result.status === 'COMPLETED') dbStatus = 'completed';
        if (['FAILED', 'CANCELLED'].includes(result.status)) dbStatus = 'failed';

        // Same terminal-status guard as the webhook handler (handlePayoutEvent
        // in app/api/webhook/dusupay/route.ts) — without it, this route could
        // flip an already-completed/repaid advance back to 'failed' (or vice
        // versa) just because a later status poll disagreed, with no audit
        // trail of the conflict. Once an advance leaves 'processing', only a
        // real repayment/admin action should move it again.
        if (['completed', 'failed', 'repaid'].includes(advance.status)) {
          if (dbStatus && dbStatus !== advance.status) {
            console.warn('[Dusupay Verify] Ignoring status disagreement on terminal advance', {
              advanceId: advance.id,
              currentStatus: advance.status,
              dusupayStatus: result.status,
            });
          }
        } else if (dbStatus && advance.status !== dbStatus) {
          await supabaseAdmin
            .from('advances')
            .update({
              status: dbStatus,
              internal_reference: result.internalReference,
              ...(dbStatus === 'completed' && { disbursed_at: new Date().toISOString() })
            })
            .eq('id', advance.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      reference: result.merchantReference,
      internalReference: result.internalReference,
      status: result.status,
      raw: result.raw
    });

  } catch (err: unknown) {
    console.error('[Dusupay Verify] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
