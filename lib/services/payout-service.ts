import { supabaseAdmin } from '../supabaseAdmin';
import { dusupayClient } from '../dusupay/client';
import { PayoutMethod, Currency, PayoutStatus } from '../dusupay/types';
import { generateMerchantReference } from '../dusupay/utils';

const mapPayoutStatusToAdvanceStatus = (status?: PayoutStatus) => {
  switch (status) {
    case PayoutStatus.COMPLETED:
      return 'completed';
    case PayoutStatus.FAILED:
    case PayoutStatus.CANCELLED:
      return 'failed';
    case PayoutStatus.PROCESSING:
    case PayoutStatus.PENDING:
    default:
      return 'processing';
  }
};

export class PayoutService {
  async fundEmployerWallet(
    employerId: string,
    amount: number,
    adminId: string,
    description: string = 'Funding from Stanbic'
  ) {
    const { data: adminWallet, error: adminWalletError } = await supabaseAdmin
      .from('admin_wallets')
      .select('id, balance')
      .eq('name', 'Main Stanbic Source')
      .single();

    if (adminWalletError || !adminWallet) {
      throw new Error(`Admin wallet not found: ${adminWalletError?.message}`);
    }

    if (adminWallet.balance < amount) {
      throw new Error('Insufficient funds in platform Stanbic source');
    }

    const { data, error } = await supabaseAdmin.rpc('fund_employer_from_admin', {
      p_employer_id: employerId,
      p_admin_wallet_id: adminWallet.id,
      p_amount: amount,
      p_description: description,
      p_admin_id: adminId
    });

    if (error) {
      throw new Error(`Funding failed: ${error.message}`);
    }

    return data;
  }

  async reserveFunds(employerId: string, amount: number, advanceId: string) {
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('employer_wallets')
      .select('id, balance, arrears_balance')
      .eq('employer_id', employerId)
      .single();

    if (walletError || !wallet) {
      throw new Error('Employer wallet not found');
    }

    // Employer wallet balance must cover the reserved payout amount.
    if (wallet.balance < amount) {
      throw new Error('Insufficient balance in employer wallet');
    }

    // 3. Create a pending payout transaction to "reserve" the funds
    const { data, error } = await supabaseAdmin
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        amount: -amount,
        type: 'payout',
        status: 'pending',
        reference: `ADV-RESERVE-${advanceId}`,
        description: `Reserved for advance ${advanceId}`,
        metadata: { advance_id: advanceId }
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reserve funds: ${error.message}`);
    }

    return data;
  }

  /**
   * Disburse an approved advance to an employee via DusuPay.
   */
  async disburseAdvance(advanceId: string) {
    // 1. Fetch advance details
    const { data: advance, error: advanceError } = await supabaseAdmin
      .from('advances')
      .select(`
        *,
        employee_onboarding!employee_id (
          id,
          full_name,
          mobile_money_number,
          mobile_money_provider,
          bank_account,
          bank_name
        ),
        organizations (
          id,
          name,
          payout_settings
        )
      `)
      .eq('id', advanceId)
      .single();

    if (advanceError || !advance) {
      throw new Error(`Advance not found: ${advanceError?.message}`);
    }

    if (advance.status !== 'approved' && advance.status !== 'processing') {
      throw new Error(`Advance is not in approved or processing status: ${advance.status}`);
    }

    // 2. Map payment details from onboarding data
    const employee = advance.employee_onboarding;
    const isMobileMoney = advance.disbursement_method === 'mobile_money';
    
    const payoutData = {
      type: isMobileMoney ? PayoutMethod.MOBILE_MONEY : PayoutMethod.BANK,
      account: isMobileMoney ? employee.mobile_money_number : employee.bank_account,
      provider_code: isMobileMoney ? employee.mobile_money_provider : employee.bank_name,
      // Note: provider_code might need mapping to DusuPay codes
    };

    if (!payoutData.account) {
      throw new Error('Employee has no payment account details configured');
    }

    const merchantReference = generateMerchantReference(advanceId);
    
    // 3. Initiate DusuPay Payout
    try {
      // Update advance status to processing
      await supabaseAdmin
        .from('advances')
        .update({ status: 'processing', reference: merchantReference })
        .eq('id', advanceId);

      const payoutResponse = await dusupayClient.sendFunds({
        merchant_reference: merchantReference,
        transaction_method: payoutData.type,
        currency: advance.currency as Currency || 'KES',
        amount: advance.amount,
        provider_code: payoutData.provider_code,
        account_number: payoutData.account,
        customer_name: employee.full_name || 'EaziWage Employee',
        description: `EaziWage Advance: ${advanceId}`,
        // bank_code: needs mapping if it's a bank transfer
      });

      // 4. Update transaction audit trail
      await supabaseAdmin.from('dusupay_transactions').insert({
        merchant_reference: merchantReference,
        internal_reference: payoutResponse.data?.internal_reference,
        event_type: 'payout_initiated',
        status: payoutResponse.data?.transaction_status || 'PENDING',
        amount: advance.amount,
        currency: advance.currency,
        raw_payload: payoutResponse
      });

      const transactionStatus = payoutResponse.data?.transaction_status;
      const advanceUpdate: {
        status: string;
        internal_reference?: string;
        disbursed_at?: string;
      } = {
        status: mapPayoutStatusToAdvanceStatus(transactionStatus),
      };

      if (payoutResponse.data?.internal_reference) {
        advanceUpdate.internal_reference = payoutResponse.data.internal_reference;
      }

      if (transactionStatus === PayoutStatus.COMPLETED) {
        advanceUpdate.disbursed_at = new Date().toISOString();
      }

      await supabaseAdmin
        .from('advances')
        .update(advanceUpdate)
        .eq('id', advanceId);

      return payoutResponse;
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'Unknown payout error';

      await supabaseAdmin
        .from('advances')
        .update({ status: 'failed', reason })
        .eq('id', advanceId);

      throw err;
    }
  }

  /**
   * Handle repayment of an advance (e.g. from salary deduction).
   * This adds funds back to the Admin Wallet and settles the employer's arrears if any.
   */
  async handleRepayment(advanceId: string, amount: number) {
    const { data, error } = await supabaseAdmin.rpc('repay_advance_to_admin', {
      p_advance_id: advanceId,
      p_amount: amount
    });

    if (error) {
      throw new Error(`Repayment failed: ${error.message}`);
    }

    return data;
  }
}

export const payoutService = new PayoutService();
