import { NextRequest, NextResponse } from 'next/server';
import { getSimulatorInstance } from '@/core/simulator-instance';

export async function GET(req: NextRequest) {
  const { switchEngine } = getSimulatorInstance();
  const searchParams = req.nextUrl.searchParams;

  const search = searchParams.get('search')?.toLowerCase();
  const status = searchParams.get('status');
  const participant = searchParams.get('participant');

  let transactions = switchEngine.getTransactions();

  if (status && status !== 'ALL') {
    transactions = transactions.filter((t) => t.status === status);
  }

  if (participant && participant !== 'ALL') {
    transactions = transactions.filter(
      (t) => t.originatingInstitution.code === participant || t.destinationInstitution.code === participant
    );
  }

  if (search) {
    transactions = transactions.filter(
      (t) =>
        t.uetr.toLowerCase().includes(search) ||
        t.instructionId.toLowerCase().includes(search) ||
        t.endToEndId.toLowerCase().includes(search) ||
        t.debtor.accountNumber.includes(search) ||
        t.creditor.accountNumber.includes(search) ||
        t.debtor.name.toLowerCase().includes(search) ||
        t.creditor.name.toLowerCase().includes(search)
    );
  }

  return NextResponse.json({
    transactions,
    total: transactions.length,
  });
}
