import { NextRequest, NextResponse } from 'next/server';
import { getSimulatorInstance } from '@/core/simulator-instance';

export async function GET(
  req: NextRequest,
  { params }: { params: { uetr: string } }
) {
  const { switchEngine, ledgerEngine } = getSimulatorInstance();
  const uetr = params.uetr;

  const transaction = switchEngine.getTransaction(uetr);
  if (!transaction) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  const isoMessages = switchEngine.getMessagesForTransaction(uetr);
  const events = switchEngine.getEventsForTransaction(uetr);
  const journalEntries = ledgerEngine.getJournalEntries(uetr);

  // Collate validation results from pacs.008 message
  const pacs008 = isoMessages.find((m) => m.messageType === 'pacs.008.001.10');
  const validations = pacs008?.validationResults || [];

  return NextResponse.json({
    transaction,
    isoMessages,
    events,
    validations,
    journalEntries,
  });
}
