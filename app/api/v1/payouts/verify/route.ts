import { NextRequest, NextResponse } from 'next/server';
import { dusupayWebhook } from '@/lib/dusupay/webhooks';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const merchantReference = searchParams.get('merchant_reference');
  
  if (!merchantReference) {
    return new NextResponse('Missing merchant_reference', { status: 400 });
  }

  const { data: advance, error } = await supabaseAdmin
    .from('advances')
    .select('id, status, amount, currency')
    .eq('reference', merchantReference)
    .single();

  if (error || !advance) {
    console.error(`[DusuPay Verify] Transaction not found: ${merchantReference}`);
    return new NextResponse('Transaction not found', { status: 404 });
  }

  if (!['processing', 'approved'].includes(advance.status)) {
    console.warn(`[DusuPay Verify] Invalid transaction status: ${advance.status} for ${merchantReference}`);
    return new NextResponse('Invalid transaction status', { status: 400 });
  }
  console.log(`[DusuPay Verify] Approving payout: ${merchantReference}`);
  return new NextResponse('OK', { status: 200 });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
