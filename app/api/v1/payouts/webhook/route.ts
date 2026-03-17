import { NextRequest, NextResponse } from 'next/server';
import { dusupayWebhook } from '@/lib/dusupay/webhooks';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { WebhookPayload } from '@/lib/dusupay/types';

/**
 * DusuPay Status Webhook
 * This endpoint is called when the payout process reaches a final state (COMPLETED or FAILED).
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || '0.0.0.0';
  const rawBody = await req.text();
  const signature = req.headers.get('x-dusupay-signature') || ''; // HMAC header check prompt for header name

  // 1. IP Validation
  if (!dusupayWebhook.validateIp(ip.split(',')[0].trim())) {
    console.warn(`[DusuPay Webhook] Invalid source IP: ${ip}`);
    // Optional: Log but proceed if signature is valid (depends on security requirements)
  }

  // 2. Signature Verification
  const body = JSON.parse(rawBody);
  const event = body.event;
  const payload = body.payload;

  // Let's assume the signature is provided in x-dusupay-signature
  // Check the prompt for the exact format: "HMAC Format: t=timestamp,s=hash"
  const hmacHeader = req.headers.get('x-dusupay-signature');
  if (hmacHeader && !dusupayWebhook.verifyHmac(rawBody, hmacHeader)) {
    console.error('[DusuPay Webhook] Invalid HMAC signature');
    return new NextResponse('Invalid signature', { status: 401 });
  }

  // 3. Process the webhook
  try {
    const merchantReference = payload.merchant_reference;
    const internalReference = payload.internal_reference;
    const status = payload.transaction_status; // 'COMPLETED' or 'FAILED'

    // a. Record in Audit Table
    await supabaseAdmin.from('dusupay_transactions').insert({
      merchant_reference: merchantReference,
      internal_reference: internalReference,
      event_type: event,
      status: status,
      amount: payload.transaction_amount,
      currency: payload.transaction_currency,
      raw_payload: body
    });

    // b. Update Advance Record
    const { data: advance, error: advanceError } = await supabaseAdmin
      .from('advances')
      .select('id, status, employer_id, amount')
      .eq('reference', merchantReference)
      .single();

    if (advance) {
      const dbStatus = status === 'COMPLETED' ? 'completed' : 'failed';
      
      const updateData: any = { 
        status: dbStatus, 
        internal_reference: internalReference,
        updated_at: new Date().toISOString()
      };
      
      if (status === 'COMPLETED') {
        updateData.disbursed_at = new Date().toISOString();
      }

      await supabaseAdmin
        .from('advances')
        .update(updateData)
        .eq('id', advance.id);

      // c. Handle Employer Wallet Deductions (V2 logic)
      if (status === 'COMPLETED' || status === 'FAILED') {
        // Find the reserved transaction
        const { data: reservedTx } = await supabaseAdmin
          .from('wallet_transactions')
          .select('id')
          .eq('reference', `ADV-RESERVE-${advance.id}`)
          .eq('status', 'pending')
          .single();

        if (reservedTx) {
          if (status === 'COMPLETED') {
            await supabaseAdmin
              .from('wallet_transactions')
              .update({ 
                status: 'completed', 
                internal_reference: internalReference,
                description: `Disbursement completed for advance ${advance.id}`
              })
              .eq('id', reservedTx.id);
          } else {
            // If failed, we should probably refund the reserved amount (delete or set to failed)
            // If it's failed, the trigger doesn't subtract from balance anyway, 
            // but we should mark it failed so it doesn't stay pending.
            await supabaseAdmin
              .from('wallet_transactions')
              .update({ status: 'failed', description: `Disbursement failed: ${payload.status_message}` })
              .eq('id', reservedTx.id);
            
            // Note: If we want to refund the balance immediately, we might need a 'refund' transaction 
            // or just ensure the trigger doesn't count 'failed' towards balance.
            // The current trigger only processes 'completed' status.
          }
        }
      }
    }

    return new NextResponse('OK', { status: 200 });

  } catch (err: any) {
    console.error(`[DusuPay Webhook] Error: ${err.message}`);
    // Always return 200 to DusuPay if we've received it, to stop retries,
    // unless it's a transient error that they should retry.
    return new NextResponse('OK', { status: 200 });
  }
}
