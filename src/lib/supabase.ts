import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IsoStoredMessage, TransactionEvent, CanonicalPayment, JournalEntry, Account } from '@/types';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (url && key) {
    try {
      supabaseClient = createClient(url, key, {
        auth: { persistSession: false },
      });
      return supabaseClient;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return null;
}

export async function syncIsoMessageToSupabase(msg: IsoStoredMessage): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[Supabase Sync] Client not initialized, skipping ISO message sync');
    return;
  }

  try {
    const { error } = await client.from('iso_messages').upsert({
      id: msg.id,
      business_journey_id: msg.businessJourneyId,
      transaction_id: msg.transactionId,
      message_type: msg.messageType,
      message_version: msg.messageVersion,
      message_id: msg.messageId,
      original_message_id: msg.originalMessageId,
      sender_bic: msg.senderBic,
      receiver_bic: msg.receiverBic,
      raw_xml: msg.rawXml,
      parsed_json: msg.parsedJson,
      uetr: msg.uetr,
      instruction_id: msg.instructionId,
      end_to_end_id: msg.endToEndId,
      amount: msg.amount,
      currency: msg.currency,
      debtor_agent: msg.debtorAgent,
      creditor_agent: msg.creditorAgent,
      settlement_date: msg.settlementDate || null,
      schema_validation_status: msg.schemaValidationStatus,
      business_validation_status: msg.businessValidationStatus,
      processing_status: msg.processingStatus,
      validation_results: msg.validationResults,
      received_at: msg.receivedAt,
    }, { onConflict: 'message_id' });
    if (error) {
      console.error('[Supabase Sync Error] iso_messages upsert failed:', error);
    } else {
      console.log(`[Supabase Sync] Successfully persisted ISO message ${msg.messageType} (${msg.messageId})`);
    }
  } catch (err) {
    console.error('Error syncing ISO message to Supabase:', err);
  }
}

export async function syncTransactionEventToSupabase(evt: TransactionEvent): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[Supabase Sync] Client not initialized, skipping event sync');
    return;
  }

  try {
    const { error } = await client.from('transaction_events').upsert({
      id: evt.id,
      transaction_id: evt.transactionId,
      business_journey_id: evt.businessJourneyId,
      event_code: evt.eventCode,
      actor: evt.actor,
      stage: evt.stage,
      status: evt.status,
      description: evt.description,
      details: evt.details || {},
      sequence_no: evt.sequenceNo,
      timestamp: evt.timestamp,
    }, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase Sync Error] transaction_events upsert failed:', error);
    }
  } catch (err) {
    console.error('Error syncing event to Supabase:', err);
  }
}

export async function syncPaymentToSupabase(tx: CanonicalPayment): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[Supabase Sync] Client not initialized, skipping payment sync');
    return;
  }

  try {
    const { error } = await client.from('payment_transactions').upsert({
      id: tx.id,
      business_journey_id: tx.businessJourneyId,
      uetr: tx.uetr,
      instruction_id: tx.instructionId,
      end_to_end_id: tx.endToEndId,
      tx_id: tx.txId,
      originating_institution_id: tx.originatingInstitution.id,
      destination_institution_id: tx.destinationInstitution.id,
      debtor_account: tx.debtor.accountNumber,
      debtor_name: tx.debtor.name,
      creditor_account: tx.creditor.accountNumber,
      creditor_name: tx.creditor.name,
      amount: tx.amount,
      currency: tx.currency,
      local_instrument: tx.localInstrument,
      status: tx.status,
      status_reason_code: tx.statusReasonCode || null,
      status_reason_desc: tx.statusReasonDescription || null,
      latency_ms: tx.latencyMs || null,
      initiated_at: tx.initiatedAt,
      completed_at: tx.completedAt || null,
    }, { onConflict: 'uetr' });
    if (error) {
      console.error('[Supabase Sync Error] payment_transactions upsert failed:', error);
    } else {
      console.log(`[Supabase Sync] Successfully persisted payment transaction ${tx.uetr} (Status: ${tx.status})`);
    }
  } catch (err) {
    console.error('Error syncing payment transaction to Supabase:', err);
  }
}

export async function syncAccountBalanceToSupabase(acc: Account): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[Supabase Sync] Client not initialized, skipping account sync');
    return;
  }

  try {
    const { error } = await client
      .from('accounts')
      .update({
        available_balance: acc.availableBalance,
        ledger_balance: acc.ledgerBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('account_number', acc.accountNumber);
    if (error) {
      console.error('[Supabase Sync Error] accounts balance update failed:', error);
    } else {
      console.log(`[Supabase Sync] Successfully updated account balance for ${acc.accountNumber}: ₦${acc.availableBalance.toLocaleString()}`);
    }
  } catch (err) {
    console.error('Error syncing account balance to Supabase:', err);
  }
}
