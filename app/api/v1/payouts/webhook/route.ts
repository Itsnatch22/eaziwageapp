import { NextRequest, NextResponse } from 'next/server';
import { dusupayWebhook } from '@/lib/dusupay/webhooks';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { WebhookPayload } from '@/lib/dusupay/types';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || '0.0.0.0';
  const rawBody = await req.text();
  const signature = req.headers.get('x-dusupay-signature') || '';

  if (!dusupayWebhook.validateIp(ip.split(',')[0].trim())) {
    console.warn(`[DusuPay Webhook] Invalid source IP: ${ip}`);
  }
  const body = JSON.parse(rawBody);
  const event = body.event;
  const payload = body.payload;

  const hmacHeader = req.headers.get('x-dusupay-signature');
  if (hmacHeader && !dusupayWebhook.verifyHmac(rawBody, hmacHeader)) {
    console.error('[DusuPay Webhook] Invalid HMAC signature');
    return new NextResponse('Invalid signature', { status: 401 });
  }

  try {
    const merchantReference = payload.merchant_reference;
    const internalReference = payload.internal_reference;
    const status = payload.transaction_status; // 'COMPLETED' or 'FAILED'

    await supabaseAdmin.from('dusupay_transactions').insert({
      merchant_reference: merchantReference,
      internal_reference: internalReference,
      event_type: event,
      status: status,
      amount: payload.transaction_amount,
      currency: payload.transaction_currency,
      raw_payload: body
    });

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

      if (status === 'COMPLETED' || status === 'FAILED') {
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
            await supabaseAdmin
              .from('wallet_transactions')
              .update({ status: 'failed', description: `Disbursement failed: ${payload.status_message}` })
              .eq('id', reservedTx.id);
          }
        }
      }
    }

    return new NextResponse('OK', { status: 200 });

  } catch (err: any) {
    console.error(`[DusuPay Webhook] Error: ${err.message}`);
    return new NextResponse('OK', { status: 200 });
  }
}
