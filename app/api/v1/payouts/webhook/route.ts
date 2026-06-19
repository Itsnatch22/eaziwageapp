import { NextRequest, NextResponse } from 'next/server';
import { dusupayWebhook } from '@/lib/dusupay/webhooks';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

interface DusupayWebhookPayload {
  merchant_reference?: string;
  internal_reference?: string;
  transaction_status?: string;
  transaction_amount?: number | string;
  transaction_currency?: string;
  status_message?: string;
  transaction_type?: string;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || '0.0.0.0';
  const rawBody = await req.text();

  if (!dusupayWebhook.validateIp(ip.split(',')[0].trim())) {
    console.warn(`[DusuPay Webhook] Invalid source IP: ${ip}`);
  }
  const body = JSON.parse(rawBody) as { event: string; payload: unknown };
  const event = body.event;
  const payload = body.payload as DusupayWebhookPayload;

  const hmacHeader = req.headers.get('hmac-signature') || req.headers.get('x-dusupay-signature');
  // Require a signature header and verify it. If missing or invalid, reject.
  if (!hmacHeader || !dusupayWebhook.verifyHmac(rawBody, hmacHeader)) {
    console.error('[DusuPay Webhook] Invalid or missing HMAC signature');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const merchantReference = payload.merchant_reference;
    const internalReference = payload.internal_reference;
    const status = payload.transaction_status; // 'COMPLETED' or 'FAILED'
    const transactionAmount = payload.transaction_amount;
    const transactionCurrency = payload.transaction_currency;

    await supabaseAdmin.from('dusupay_transactions').insert({
      merchant_reference: merchantReference,
      internal_reference: internalReference,
      event_type: event,
      status: status,
      amount: transactionAmount,
      currency: transactionCurrency,
      raw_payload: body
    });

    const { data: advance } = await supabaseAdmin
      .from('advances')
      .select('id, status, employer_id, amount')
      .eq('reference', merchantReference)
      .single();

    if (advance) {
      const dbStatus = status === 'COMPLETED' ? 'completed' : 'failed';
      
      const updateData: Record<string, unknown> = { 
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

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown webhook error';
    console.error(`[DusuPay Webhook] Error: ${message}`);
    return new NextResponse('OK', { status: 200 });
  }
}
