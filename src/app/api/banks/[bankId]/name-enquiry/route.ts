import { NextRequest, NextResponse } from 'next/server';
import { getSimulatorInstance } from '@/core/simulator-instance';

export async function POST(
  req: NextRequest,
  { params }: { params: { bankId: string } }
) {
  try {
    const { destinationBankCode, accountNumber } = await req.json();

    if (!destinationBankCode || !accountNumber) {
      return NextResponse.json(
        { success: false, error: 'destinationBankCode and accountNumber are required' },
        { status: 400 }
      );
    }

    const { switchEngine } = getSimulatorInstance();
    const result = switchEngine.performNameEnquiry({
      originatingBankId: params.bankId,
      destinationBankCode,
      accountNumber,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Name Enquiry error' },
      { status: 500 }
    );
  }
}
