import { NextRequest, NextResponse } from 'next/server';
import { payoutService } from '@/lib/services/payout-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Initiate disbursement using the PayoutService
    const result = await payoutService.disburseAdvance(id);

    return NextResponse.json({ 
      message: 'Disbursement initiated successfully',
      data: result
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Admin Disburse] Error: ${message}`);
    return NextResponse.json({ message }, { status: 500 });
  }
}
