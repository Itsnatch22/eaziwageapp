import { NextRequest, NextResponse } from 'next/server';
import { dusupay } from '@/lib/dusupay';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Dusupay Payout Verification Endpoint
 * 
 * Used for manual verification or status polling if needed.
 * Example: GET /api/dusupay/verify?reference=EWA-20260312-XXXX
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference');

  if (!reference) {
    return NextResponse.json({ error: 'Reference parameter is required' }, { status: 400 });
  }

  try {
    // 1. Check current status with Dusupay API
    const result = await dusupay.checkPayoutStatus(reference);

    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        message: result.message || 'Failed to fetch status from Dusupay',
        errorCode: result.errorCode 
      }, { status: 400 });
    }

    // 2. Sync with our database if needed
    // This provides a manual "sync" button functionality if the webhook was missed
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

        if (dbStatus && advance.status !== dbStatus) {
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

  } catch (err: any) {
    console.error('[Dusupay Verify] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
