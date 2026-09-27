import { NextRequest, NextResponse } from 'next/server';
import { getSimulatorInstance } from '@/core/simulator-instance';

export async function POST(
  req: NextRequest,
  { params }: { params: { bankId: string } }
) {
  try {
    const body = await req.json();
    const {
      debtorAccountNumber,
      destinationBankCode,
      creditorAccountNumber,
      creditorName,
      amount,
      currency = 'NGN',
      remittanceInfo,
      scenario = 'SUCCESS',
    } = body;

    if (!debtorAccountNumber || !destinationBankCode || !creditorAccountNumber || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing mandatory transfer parameters' },
        { status: 400 }
      );
    }

    const { switchEngine } = getSimulatorInstance();

    const result = await switchEngine.initiateCustomerTransfer({
      originatingBankId: params.bankId,
      debtorAccountNumber,
      destinationBankCode,
      creditorAccountNumber,
      creditorName: creditorName || 'Beneficiary',
      amount: Number(amount),
      currency,
      remittanceInfo: remittanceInfo || 'Interbank payment',
      scenario,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal processing error' },
      { status: 500 }
    );
  }
}
