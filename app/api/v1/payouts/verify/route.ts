import { NextRequest, NextResponse } from 'next/server';
import { dusupayWebhook } from '@/lib/dusupay/webhooks';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * DusuPay Verification Callback
 * This endpoint is called by DusuPay to verify if EaziWage approves the payout.
 * We should check if the merchant_reference exists in our database and is in 'processing' status.
 * 
 * Expected Query Params:
 * - merchant_reference
 * - internal_reference
 * - transaction_amount
 * - transaction_currency
 * - event (e.g., 'payout.verify')
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const merchantReference = searchParams.get('merchant_reference');
  
  if (!merchantReference) {
    return new NextResponse('Missing merchant_reference', { status: 400 });
  }

  // 1. Validate the transaction exists and is pending/processing
  const { data: advance, error } = await supabaseAdmin
    .from('advances')
    .select('id, status, amount, currency')
    .eq('reference', merchantReference)
    .single();

  if (error || !advance) {
    console.error(`[DusuPay Verify] Transaction not found: ${merchantReference}`);
    return new NextResponse('Transaction not found', { status: 404 });
  }

  // 2. Check if the status is valid for approval
  if (!['processing', 'approved'].includes(advance.status)) {
    console.warn(`[DusuPay Verify] Invalid transaction status: ${advance.status} for ${merchantReference}`);
    return new NextResponse('Invalid transaction status', { status: 400 });
  }

  // 3. Respond with HTTP 200 to approve the payout
  console.log(`[DusuPay Verify] Approving payout: ${merchantReference}`);
  return new NextResponse('OK', { status: 200 });
}

/**
 * Handle POST if DusuPay uses POST for verification (check documentation)
 */
export async function POST(req: NextRequest) {
  return GET(req);
}
