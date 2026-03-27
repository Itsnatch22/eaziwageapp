import { NextRequest, NextResponse } from 'next/server';
import { dusupay, PayoutStatus } from '@/lib/dusupay';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyEmployee, notifyEmployer } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  console.log(`[Dusupay Webhook] Received request from ${ip}`);

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('dusupay-signature');

    if (!signature || !dusupay.verifyWebhookSignature(rawBody, signature)) {
      console.error('[Dusupay Webhook] Invalid or missing signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { event, payload } = dusupay.parseWebhook(body);
    
    const merchantReference = payload.merchant_reference || payload.transaction_id;
    const internalReference = payload.internal_reference || payload.dusupay_reference;
    const transactionStatus = payload.transaction_status || payload.status;
    const amount = Number(payload.amount);
    const currency = payload.currency;

    if (!merchantReference) {
      console.error('[Dusupay Webhook] Missing reference');
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
    }

    await supabaseAdmin.from('dusupay_transactions').upsert({
      merchant_reference: merchantReference,
      internal_reference: internalReference,
      event_type: event,
      status: transactionStatus,
      amount: amount,
      currency: currency,
      raw_payload: body,
    }, { onConflict: 'merchant_reference' });

    if (event.startsWith('collection.')) {
      await handleCollectionEvent(event, payload, merchantReference, internalReference);
    } 
    else {
      await handlePayoutEvent(event, payload, merchantReference, internalReference);
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (err: any) {
    console.error('[Dusupay Webhook] Fatal error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function handleCollectionEvent(event: string, payload: any, merchantRef: string, internalRef: string) {
  if (!merchantRef.startsWith('DEP-')) return;

  const parts = merchantRef.split('-');
  const employerId = parts[1];
  const amount = Number(payload.amount);

  if (!employerId) return;

  const { data: wallet } = await supabaseAdmin
    .from('employer_wallets')
    .select('id')
    .eq('employer_id', employerId)
    .maybeSingle();

  if (!wallet) {
    const { data: newWallet } = await supabaseAdmin
      .from('employer_wallets')
      .insert({ employer_id: employerId, balance: 0 })
      .select('id')
      .single();
    if (!newWallet) return;
  }

  const walletId = wallet?.id || (await supabaseAdmin.from('employer_wallets').select('id').eq('employer_id', employerId).single()).data?.id;

  const status = (event === 'collection.completed' || payload.status === 'COMPLETED') ? 'completed' : 'failed';
  
  await supabaseAdmin
    .from('wallet_transactions')
    .upsert({
      wallet_id: walletId,
      amount: amount, // Positive for deposits
      type: 'deposit',
      status: status,
      reference: merchantRef,
      internal_reference: internalRef,
      description: 'Wallet Funding via Dusupay',
      metadata: payload
    }, { onConflict: 'reference' });

  try {
    const { data: employer } = await supabaseAdmin
      .from('employer_onboarding')
      .select('user_id')
      .eq('id', employerId)
      .single();

    if (employer?.user_id) {
      await notifyEmployer({
        userId: employer.user_id,
        type: 'system',
        title: status === 'completed' ? '💰 Wallet Funded' : '❌ Funding Failed',
        message: status === 'completed' 
          ? `Your wallet has been successfully funded with ${amount}. You can now disburse advances.`
          : `We couldn't process your wallet funding of ${amount}. Please check your payment details.`,
        metadata: { amount, status, reference: merchantRef }
      });
    }
  } catch (notifyErr) {
    console.error('[webhook-collection] Notification failed:', notifyErr);
  }

  console.log(`[Dusupay Webhook] Wallet funding ${status} for Employer: ${employerId}`);
}

async function handlePayoutEvent(event: string, payload: any, merchantRef: string, internalRef: string) {
  const isCompleted = event === 'transaction.completed' || payload.status === PayoutStatus.COMPLETED;
  const isFailed = ['transaction.failed', 'request.failed'].includes(event) || 
                   [PayoutStatus.FAILED, PayoutStatus.CANCELLED].includes(payload.status);
  let newStatus = isCompleted ? 'completed' : isFailed ? 'failed' : 'processing';
  
  const { data: advance } = await supabaseAdmin
    .from('advances')
    .select('id, status, employer_id, amount, employee_id, employee_onboarding(user_id)')
    .eq('reference', merchantRef)
    .single();

  if (advance && !['completed', 'failed', 'repaid'].includes(advance.status)) {
    await supabaseAdmin.from('advances').update({
      status: newStatus,
      internal_reference: internalRef,
      ...(isCompleted && { disbursed_at: new Date().toISOString() })
    }).eq('id', advance.id);

    try {
      const employeeUserId = (advance.employee_onboarding as any)?.user_id;
      if (employeeUserId) {
        await notifyEmployee({
          userId: employeeUserId,
          type: 'advance_approval',
          title: isCompleted ? '✅ Funds Received!' : '❌ Disbursement Failed',
          message: isCompleted 
            ? `Your advance of ${advance.amount} has been successfully sent to your mobile wallet/account.`
            : `There was an issue sending your advance of ${advance.amount}. Please contact support.`,
          metadata: { advance_id: advance.id, status: newStatus }
        });
      }
    } catch (notifyErr) {
      console.error('[webhook-payout] Notification failed:', notifyErr);
    }

    if (isCompleted && advance.employer_id) {
      const { data: wallet } = await supabaseAdmin
        .from('employer_wallets')
        .select('id')
        .eq('employer_id', advance.employer_id)
        .single();

      if (wallet) {
        await supabaseAdmin.from('wallet_transactions').upsert({
          wallet_id: wallet.id,
          amount: -Number(advance.amount), // Negative for payouts
          type: 'payout',
          status: 'completed',
          reference: `PAY-${merchantRef}`,
          internal_reference: internalRef,
          description: `Disbursement for Advance #${advance.id}`,
          metadata: { advance_id: advance.id }
        }, { onConflict: 'reference' });
      }
    }
  }
}
