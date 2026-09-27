import { NextResponse } from 'next/server';
import { getSimulatorInstance } from '@/core/simulator-instance';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const { switchEngine } = getSimulatorInstance();
  const participants = switchEngine.getParticipants();
  const transactions = switchEngine.getTransactions();

  const totalTransactions = transactions.length;
  const completed = transactions.filter((t) => t.status === 'COMPLETED').length;
  const rejected = transactions.filter((t) => t.status === 'REJECTED' || t.status === 'FAILED').length;
  const activeParticipants = participants.filter((p) => p.status === 'ONLINE').length;
  const offlineParticipants = participants.filter((p) => p.status === 'OFFLINE').length;
  const totalVolume = transactions
    .filter((t) => t.status === 'COMPLETED')
    .reduce((sum, t) => sum + t.amount, 0);

  const avgLatency =
    completed > 0
      ? Math.round(
          transactions
            .filter((t) => t.status === 'COMPLETED' && t.latencyMs)
            .reduce((sum, t) => sum + (t.latencyMs || 0), 0) / completed
        )
      : 0;

  const successRate = totalTransactions > 0 ? Math.round((completed / totalTransactions) * 100) : 100;

  return NextResponse.json({
    metrics: {
      totalTransactions,
      completed,
      rejected,
      successRate,
      activeParticipants,
      offlineParticipants,
      totalVolume,
      avgLatency,
    },
    participants,
  });
}
