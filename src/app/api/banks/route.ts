import { NextResponse } from 'next/server';
import { getSimulatorInstance } from '@/core/simulator-instance';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const { switchEngine, bankCore } = getSimulatorInstance();
  const participants = switchEngine.getParticipants();

  const banksData = participants.map((p) => {
    const accounts = bankCore.getAccountsByInstitution(p.id);
    return {
      ...p,
      accounts: accounts.map((acc) => {
        const customer = bankCore.getCustomer(acc.customerId);
        return {
          ...acc,
          customer,
        };
      }),
    };
  });

  return NextResponse.json({ success: true, banks: banksData });
}
