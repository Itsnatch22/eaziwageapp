import { supabaseAdmin } from '../supabaseAdmin';
import { dusupayClient } from '../dusupay/client';
import { PayoutMethod, Currency } from '../dusupay/types';
import { generateMerchantReference, formatPhoneNumber } from '../dusupay/utils';

export class PayoutService {
  /**
   * Admin funds an employer's wallet from the platform's Stanbic source.
   */
  async fundEmployerWallet(
    employerId: string,
    amount: number,
    adminId: string,
    description: string = 'Funding from Stanbic'
  ) {
    // 1. Check admin wallet balance (Main Stanbic Source)
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

    // 2. Perform internal transaction
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

  /**
   * Reserve funds in the employer's wallet for an upcoming disbursement.
   */
  async reserveFunds(employerId: string, amount: number, advanceId: string) {
    // 1. Get employer wallet
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('employer_wallets')
      .select('id, balance, arrears_balance')
      .eq('employer_id', employerId)
      .single();

    if (walletError || !wallet) {
      throw new Error('Employer wallet not found');
    }

    // 2. Check if employer has enough balance
    // If we allow arrears, we could proceed even if balance < amount
    // For now, let's assume they need balance unless specified otherwise.
    if (wallet.balance < amount) {
      // Option: Automatically move to arrears if allowed by organization settings
      // For this implementation, we'll just check balance.
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
    // ... existing implementation ...
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

      // Update advance with internal reference
      if (payoutResponse.data?.internal_reference) {
        await supabaseAdmin
          .from('advances')
          .update({ internal_reference: payoutResponse.data.internal_reference })
          .eq('id', advanceId);
      }

      return payoutResponse;
    } catch (err: any) {
      // Handle failure
      await supabaseAdmin
        .from('advances')
        .update({ status: 'failed', reason: err.message })
        .eq('id', advanceId);

      throw err;
    }
  }

  /**
   * Handle repayment of an advance (e.g. from salary deduction).
   * This adds funds back to the Admin Wallet and settles the employer's arrears if any.
   */
  async handleRepayment(advanceId: string, amount: number) {
    // This would typically be called when salary is processed
    // 1. Mark advance as repaid
    // 2. Add funds back to Admin Wallet
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
