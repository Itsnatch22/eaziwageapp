import { NextRequest, NextResponse } from 'next/server';
import { payoutService } from '@/lib/services/payout-service';

/**
 * Admin Disbursement Route
 * POST /api/admin/advances/[id]/disburse
 */
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

  } catch (err: any) {
    console.error(`[Admin Disburse] Error: ${err.message}`);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
