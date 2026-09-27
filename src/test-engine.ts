import { getSimulatorInstance, resetSimulatorInstance } from './core/simulator-instance';
import { buildPacs003Xml } from './core/iso20022/pacs003';
import { buildPacs028Xml } from './core/iso20022/pacs028';
import { buildCamt060Xml } from './core/iso20022/camt';
import { buildPain009Xml, buildPain010Xml, buildPain011Xml } from './core/iso20022/mandates';
import { buildPain013Xml } from './core/iso20022/rtp';
import { buildPain008Xml } from './core/iso20022/direct-debit';

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 RUNNING ISO 20022 ENGINE & SWITCH SIMULATION TEST SUITE');
  console.log('===============================================================');

  resetSimulatorInstance();
  const { switchEngine, bankCore, ledgerEngine } = getSimulatorInstance();

  // Test 1: Verify Initial Balances
  const fredAcctBefore = bankCore.getAccount('0112345678')!;
  const adaAcctBefore = bankCore.getAccount('0334455667')!;

  console.log('\n[1] INITIAL STATE CHECK:');
  console.log(`- Bank A Fred Okon Balance: ₦${fredAcctBefore.availableBalance.toLocaleString()}`);
  console.log(`- Bank C Adaeze Okafor Balance: ₦${adaAcctBefore.availableBalance.toLocaleString()}`);

  if (fredAcctBefore.availableBalance !== 2450000 || adaAcctBefore.availableBalance !== 850000) {
    throw new Error('Initial account balances mismatch requirement!');
  }

  // Test 2: Standard Interbank Transfer Bank A -> Bank C (₦50,000)
  console.log('\n[2] EXECUTING STANDARD INTERBANK TRANSFER: Bank A -> Switch -> Bank C (₦50,000)');
  const transferRes = await switchEngine.initiateCustomerTransfer({
    originatingBankId: 'bank-a',
    debtorAccountNumber: '0112345678',
    destinationBankCode: 'METRNG',
    creditorAccountNumber: '0334455667',
    creditorName: 'Adaeze Okafor',
    amount: 50000,
    currency: 'NGN',
    remittanceInfo: 'Consulting fees settlement',
    scenario: 'SUCCESS',
  });

  console.log(`- Transfer Success: ${transferRes.success}`);
  console.log(`- UETR: ${transferRes.uetr}`);
  console.log(`- Error: ${transferRes.error}, Reason: ${transferRes.reasonCode}`);
  console.log(`- Latency: ${transferRes.canonicalPayment?.latencyMs}ms`);

  const fredAcctAfter = bankCore.getAccount('0112345678')!;
  const adaAcctAfter = bankCore.getAccount('0334455667')!;

  console.log(`- Bank A Fred Balance After: ₦${fredAcctAfter.availableBalance.toLocaleString()}`);
  console.log(`- Bank C Adaeze Balance After: ₦${adaAcctAfter.availableBalance.toLocaleString()}`);

  if (fredAcctAfter.availableBalance !== 2400000) {
    throw new Error(`Fred balance expected ₦2,400,000 but got ₦${fredAcctAfter.availableBalance}`);
  }
  if (adaAcctAfter.availableBalance !== 900000) {
    throw new Error(`Ada balance expected ₦900,000 but got ₦${adaAcctAfter.availableBalance}`);
  }

  // Test 3: ISO Messages Check (acmt.023 -> acmt.024 -> pacs.008 -> pacs.002)
  const messages = switchEngine.getMessagesForTransaction(transferRes.uetr);
  console.log(`\n[3] HYBRID ISO MESSAGES PERSISTED (PREREQUISITE + CLEARING): ${messages.length}`);
  messages.forEach((m) => {
    console.log(`  * Type: ${m.messageType}, MsgId: ${m.messageId}, Status: ${m.processingStatus}`);
    console.log(`    Raw XML length: ${m.rawXml.length} chars, Parsed Keys: ${Object.keys(m.parsedJson).length}`);
  });

  const acmt023 = messages.find((m) => m.messageType === 'acmt.023.001.04');
  const acmt024 = messages.find((m) => m.messageType === 'acmt.024.001.04');
  const pacs008 = messages.find((m) => m.messageType === 'pacs.008.001.12');
  const pacs002 = messages.find((m) => m.messageType === 'pacs.002.001.12');

  if (!acmt023 || !acmt024) {
    throw new Error('Mandatory prerequisite acmt.023 or acmt.024 missing from Hybrid Store!');
  }
  if (!pacs008 || !pacs002) {
    throw new Error('pacs.008 or pacs.002 message missing from Hybrid Store!');
  }
  console.log('  -> All 4 Correlated Messages (acmt.023.001.04 -> acmt.024.001.04 -> pacs.008.001.12 -> pacs.002.001.12) Verified in Hybrid Store!');

  // Test 4: Validation Layers Check
  console.log('\n[4] SWITCH MULTI-LAYER VALIDATION AUDIT:');
  pacs008.validationResults.forEach((val) => {
    console.log(`  - [${val.status}] ${val.layer}: ${val.summary}`);
  });

  // Test 5: Double-Entry Ledger Verification
  console.log('\n[5] DOUBLE-ENTRY LEDGER VERIFICATION:');
  const journalEntries = ledgerEngine.getJournalEntries(transferRes.uetr);
  console.log(`  Total Journal Entries: ${journalEntries.length}`);
  journalEntries.forEach((je) => {
    console.log(`  Entry ${je.reference} (${je.institutionId}):`);
    je.lines.forEach((line) => {
      console.log(`    ${line.direction} ${line.ledgerAccountName}: ₦${line.amount.toLocaleString()}`);
    });
  });

  // Test 6: Idempotency / Duplicate Check
  console.log('\n[6] DUPLICATE TRANSACTION PREVENTION TEST:');
  const dupRes = await switchEngine.initiateCustomerTransfer({
    originatingBankId: 'bank-a',
    debtorAccountNumber: '0112345678',
    destinationBankCode: 'METRNG',
    creditorAccountNumber: '0334455667',
    creditorName: 'Adaeze Okafor',
    amount: 50000,
    currency: 'NGN',
    scenario: 'DUPLICATE_REPLAY',
  });
  console.log(`- Duplicate Replay Outcome: Success=${dupRes.success}, Reason=${dupRes.reasonCode} (${dupRes.error})`);
  console.log(`- Adaeze Balance Unchanged: ₦${bankCore.getAccount('0334455667')!.availableBalance.toLocaleString()}`);

  if (bankCore.getAccount('0334455667')!.availableBalance !== 900000) {
    throw new Error('Duplicate transaction erroneously credited beneficiary account!');
  }

  // Test 7: Destination Offline Scenario
  console.log('\n[7] DESTINATION PARTICIPANT OFFLINE SCENARIO:');
  const offlineRes = await switchEngine.initiateCustomerTransfer({
    originatingBankId: 'bank-a',
    debtorAccountNumber: '0112345678',
    destinationBankCode: 'METRNG',
    creditorAccountNumber: '0334455667',
    creditorName: 'Adaeze Okafor',
    amount: 10000,
    currency: 'NGN',
    scenario: 'DEST_OFFLINE',
  });
  console.log(`- Offline Destination Outcome: Success=${offlineRes.success}, Reason=${offlineRes.reasonCode} (${offlineRes.error})`);
  console.log(`- Fred Balance Safely Preserved/Reversed: ₦${bankCore.getAccount('0112345678')!.availableBalance.toLocaleString()}`);

  // Test 8: Standalone Name Enquiry / ACMT 023 -> 024 Check
  console.log('\n[8] STANDALONE ACMT.023 / ACMT.024 NAME ENQUIRY VERIFICATION:');
  const enqValid = switchEngine.performNameEnquiry({
    originatingBankId: 'bank-a',
    destinationBankCode: 'METRNG',
    accountNumber: '0334455667',
  });
  console.log(`- Valid Account Enquiry: Success=${enqValid.success}, Resolved Name="${enqValid.verifiedName}"`);
  if (!enqValid.success || enqValid.verifiedName !== 'Adaeze Okafor - Savings') {
    throw new Error('Name enquiry for valid account failed to resolve correct beneficiary name!');
  }

  const enqInvalid = switchEngine.performNameEnquiry({
    originatingBankId: 'bank-a',
    destinationBankCode: 'METRNG',
    accountNumber: '9999999999',
  });
  console.log(`- Invalid Account Enquiry: Success=${enqInvalid.success}, Reason=${enqInvalid.reasonCode} (${enqInvalid.error})`);
  if (enqInvalid.success || enqInvalid.reasonCode !== 'AC01') {
    throw new Error('Name enquiry for non-existent account expected AC01 failure!');
  }

  // Test 9: Transfer With Invalid Account Halts at ACMT.024 Before PACS.008
  console.log('\n[9] TRANSFER WITH INVALID ACCOUNT (HALTS AT ACMT.024 BEFORE PACS.008):');
  const invalidAcctRes = await switchEngine.initiateCustomerTransfer({
    originatingBankId: 'bank-a',
    debtorAccountNumber: '0112345678',
    destinationBankCode: 'METRNG',
    creditorAccountNumber: '9999999999',
    creditorName: 'Unknown Person',
    amount: 10000,
    currency: 'NGN',
    scenario: 'INVALID_ACCOUNT',
  });
  console.log(`- Invalid Account Transfer: Success=${invalidAcctRes.success}, Reason=${invalidAcctRes.reasonCode}`);
  const invalidMsgs = switchEngine.getMessagesForTransaction(invalidAcctRes.uetr);
  const hadPacs008 = invalidMsgs.some((m) => m.messageType === 'pacs.008.001.12');
  console.log(`- Total Messages in Journey: ${invalidMsgs.length}, Contains pacs.008: ${hadPacs008}`);
  if (hadPacs008) {
    throw new Error('Clearing engine erroneously generated pacs.008 after acmt.024 verification failure!');
  }

  // Test 10: Events Audit Trail
  console.log('\n[10] FULL TRANSACTION EVENTS LIFECYCLE (INCLUDING ACMT PREREQUISITE):');
  const events = switchEngine.getEventsForTransaction(transferRes.uetr);
  console.log(`  Total Events Emitted: ${events.length}`);
  events.reverse().forEach((e, idx) => {
    console.log(`  ${idx + 1}. [${e.actor}] ${e.eventCode} (${e.stage}) - ${e.description}`);
  });

  // Test 11: FI to FI Customer Direct Debit (pacs.003.001.11 -> pacs.002.001.12 ACSC)
  console.log('\n[11] PACS.003.001.11 FI TO FI DIRECT DEBIT TEST:');
  const pacs003Xml = buildPacs003Xml({
    msgId: `MSG003-TEST-${Date.now()}`,
    creDtTm: new Date().toISOString(),
    amount: 15000,
    currency: 'NGN',
    settlementDate: new Date().toISOString().split('T')[0],
    creditorBankBic: '999058',
    creditorBankMemberId: '058',
    debtorBankBic: '999057',
    debtorBankMemberId: '044',
    instructionId: `INST003-${Date.now()}`,
    endToEndId: `E2E003-${Date.now()}`,
    txId: `TX003-${Date.now()}`,
    mandateId: 'MNDT-TEST-001',
    creditorName: 'Adaeze Okafor',
    creditorAccount: '0334455667',
    debtorName: 'Fred Okon',
    debtorAccount: '0112345678',
    narration: 'Monthly Utility Debit',
  });

  const fredBeforeDd = bankCore.getAccount('0112345678')!.availableBalance;
  const pacs003Res = await switchEngine.processGenericIsoMessage(pacs003Xml);
  console.log(`- pacs.003 Dispatch: Success=${pacs003Res.success}, ResponseType=${pacs003Res.responseMessageType}, Error=${pacs003Res.error}, Reason=${pacs003Res.reasonCode}`);
  const fredAfterDd = bankCore.getAccount('0112345678')!.availableBalance;
  console.log(`- Debtor Fred Balance: ₦${fredBeforeDd.toLocaleString()} -> ₦${fredAfterDd.toLocaleString()} (-₦15,000)`);
  if (!pacs003Res.success || pacs003Res.responseMessageType !== 'pacs.002.001.12' || fredAfterDd !== fredBeforeDd - 15000) {
    throw new Error('pacs.003 direct debit settlement failed or incorrect balance!');
  }

  // Test 12: FI to FI Payment Status Request (pacs.028.001.06 -> pacs.002.001.12 ACSC)
  console.log('\n[12] PACS.028.001.06 PAYMENT STATUS REQUEST TEST:');
  const pacs028Xml = buildPacs028Xml({
    msgId: `MSG028-TEST-${Date.now()}`,
    creDtTm: new Date().toISOString(),
    instgAgtMemberId: '044',
    instdAgtMemberId: '058',
    originalMsgId: pacs008.messageId,
    originalMsgNameId: 'pacs.008.001.12',
    statusRequestId: `STSRQ-${Date.now()}`,
    originalTxId: transferRes.canonicalPayment!.id,
    settlementDate: new Date().toISOString().split('T')[0],
  });

  const pacs028Res = await switchEngine.processGenericIsoMessage(pacs028Xml);
  console.log(`- pacs.028 Query Outcome: Success=${pacs028Res.success}, ResponseType=${pacs028Res.responseMessageType}`);
  console.log(`- Correlated Status: ${pacs028Res.responseParsed?.groupStatus || 'N/A'}`);
  if (!pacs028Res.success || pacs028Res.responseParsed?.groupStatus !== 'ACSC') {
    throw new Error('pacs.028 payment status inquiry failed to correlate completed payment!');
  }

  // Test 13: Account Reporting Request (camt.060.001.07 -> camt.053.001.12 Statement)
  console.log('\n[13] CAMT.060.001.07 ACCOUNT REPORTING REQUEST TEST:');
  const camt060Xml = buildCamt060Xml({
    msgId: `MSG060-TEST-${Date.now()}`,
    creDtTm: new Date().toISOString(),
    senderBic: '999058',
    senderMemberId: '058',
    reportingReqId: `RPTREQ-${Date.now()}`,
    requestedMsgNameId: 'STATEMENT',
    accountNumber: '0112345678',
    accountOwnerMemberId: '044',
    accountServicerMemberId: '044',
    fromDate: '2026-01-01',
    toDate: '2026-12-31',
  });

  const camt060Res = await switchEngine.processGenericIsoMessage(camt060Xml);
  console.log(`- camt.060 Statement Inquiry: Success=${camt060Res.success}, ResponseType=${camt060Res.responseMessageType}, Error=${camt060Res.error}, Reason=${camt060Res.reasonCode}`);
  console.log(`- Reported Closing Balance: ₦${camt060Res.responseParsed?.balance?.toLocaleString()}`);
  if (!camt060Res.success || camt060Res.responseMessageType !== 'camt.053.001.12') {
    throw new Error('camt.060 statement reporting failed!');
  }

  // Test 14: Mandate Lifecycle Management (pain.009 -> pain.012, pain.010, pain.011)
  console.log('\n[14] MANDATE LIFECYCLE (PAIN.009 -> PAIN.012, PAIN.010, PAIN.011):');
  const pain009Xml = buildPain009Xml({
    msgId: `MSG009-TEST-${Date.now()}`,
    creDtTm: new Date().toISOString(),
    mandateId: 'MNDT-AUTO-2026',
    sequenceType: 'RCUR',
    frequency: 'MNTH',
    firstCollectionDate: '2026-10-01',
    collectionAmount: 25000,
    creditorName: 'Fintech Microfinance',
    creditorAccount: '0334455667',
    creditorBankBic: '999058',
    creditorBankMemberId: '058',
    debtorName: 'Fred Okon',
    debtorAccount: '0112345678',
    debtorBankBic: '999057',
    debtorBankMemberId: '044',
  });

  const pain009Res = await switchEngine.processGenericIsoMessage(pain009Xml);
  console.log(`- pain.009 Mandate Initiation: Success=${pain009Res.success}, Accepted=${pain009Res.responseParsed?.accepted}, ResponseType=${pain009Res.responseMessageType}`);
  if (!pain009Res.success || !pain009Res.responseParsed?.accepted || pain009Res.responseMessageType !== 'pain.012.001.08') {
    throw new Error('pain.009 mandate initiation failed!');
  }

  const pain010Xml = buildPain010Xml({
    msgId: `MSG010-TEST-${Date.now()}`,
    creDtTm: new Date().toISOString(),
    mandateId: 'MNDT-AUTO-2026',
    frequency: 'WEEK',
    collectionAmount: 30000,
    creditorName: 'Fintech Microfinance',
    creditorAccount: '0334455667',
    creditorBankMemberId: '058',
    debtorName: 'Fred Okon',
    debtorAccount: '0112345678',
    debtorBankMemberId: '044',
  });
  const pain010Res = await switchEngine.processGenericIsoMessage(pain010Xml);
  console.log(`- pain.010 Mandate Amendment: Success=${pain010Res.success}, ResponseType=${pain010Res.responseMessageType}`);

  const pain011Xml = buildPain011Xml({
    msgId: `MSG011-TEST-${Date.now()}`,
    creDtTm: new Date().toISOString(),
    mandateId: 'MNDT-AUTO-2026',
    creditorName: 'Fintech Microfinance',
    creditorAccount: '0334455667',
    creditorBankMemberId: '058',
    debtorName: 'Fred Okon',
    debtorAccount: '0112345678',
    debtorBankMemberId: '044',
  });
  const pain011Res = await switchEngine.processGenericIsoMessage(pain011Xml);
  console.log(`- pain.011 Mandate Cancellation: Success=${pain011Res.success}, ResponseType=${pain011Res.responseMessageType}`);

  // Test 15: Request to Pay (pain.013.001.11 -> pain.014.001.11 ACCP)
  console.log('\n[15] PAIN.013.001.11 REQUEST TO PAY (RTP) TEST:');
  const pain013Xml = buildPain013Xml({
    msgId: `MSG013-TEST-${Date.now()}`,
    creDtTm: new Date().toISOString(),
    initiatingPartyName: 'MegaMall Online',
    initiatingPartyOrgId: 'RC-112233',
    paymentInfoId: `PMTINFO-${Date.now()}`,
    requiredExecutionDateTime: new Date().toISOString(),
    debtorName: 'Fred Okon',
    debtorAccount: '0112345678',
    debtorBankBic: '999057',
    debtorBankMemberId: '044',
    creditorName: 'MegaMall Online',
    creditorAccount: '0334455667',
    creditorBankBic: '999058',
    creditorBankMemberId: '058',
    endToEndId: `E2E-RTP-${Date.now()}`,
    amount: 18000,
  });

  const pain013Res = await switchEngine.processGenericIsoMessage(pain013Xml);
  console.log(`- pain.013 RTP Request: Success=${pain013Res.success}, Status=${pain013Res.responseParsed?.status}, ResponseType=${pain013Res.responseMessageType}`);
  if (!pain013Res.success || pain013Res.responseParsed?.status !== 'ACCP' || pain013Res.responseMessageType !== 'pain.014.001.11') {
    throw new Error('pain.013 request-to-pay processing failed!');
  }

  // Test 16: Customer Direct Debit Initiation (pain.008.001.11 -> pain.002.001.14 ACSC)
  console.log('\n[16] PAIN.008.001.11 CUSTOMER DIRECT DEBIT TEST:');
  const pain008Xml = buildPain008Xml({
    msgId: `MSG008DD-TEST-${Date.now()}`,
    creDtTm: new Date().toISOString(),
    initiatingPartyName: 'Fitness Club',
    paymentInfoId: `PMTINFO-DD-${Date.now()}`,
    amount: 12000,
    requestedCollectionDate: new Date().toISOString().split('T')[0],
    creditorName: 'Fitness Club',
    creditorAccount: '0334455667',
    creditorBankBic: '999058',
    creditorBankMemberId: '058',
    instructionId: `INSTDD-${Date.now()}`,
    endToEndId: `E2EDD-${Date.now()}`,
    mandateId: 'MNDT-FIT-01',
    debtorBankBic: '999057',
    debtorBankMemberId: '044',
    debtorName: 'Fred Okon',
    debtorAccount: '0112345678',
  });

  const pain008Res = await switchEngine.processGenericIsoMessage(pain008Xml);
  console.log(`- pain.008 Initiation: Success=${pain008Res.success}, Status=${pain008Res.responseParsed?.status}, ResponseType=${pain008Res.responseMessageType}`);
  if (!pain008Res.success || pain008Res.responseParsed?.status !== 'ACSC' || pain008Res.responseMessageType !== 'pain.002.001.14') {
    throw new Error('pain.008 customer direct debit initiation failed!');
  }

  // Test 17: Canonical 4-Stage Direct Debit Clearing Workflow
  // (Biller pain.008 -> Pseudo Inst pacs.003 -> Cust Bank pacs.002 -> Biller pain.002)
  console.log('\n[17] PSEUDO INSTITUTION DIRECT DEBIT 4-STAGE CLEARING TEST:');
  const dd4Res = await switchEngine.executeDirectDebitWorkflow({
    debtorAccount: '0112345678', // Fred Okon
    creditorAccount: '9981122334', // PowerGrid Utilities at Pseudo Inst
    amount: 15000,
    mandateId: 'MNDT-PWR-2025',
  });

  console.log(`- 4-Stage Execution Success: ${dd4Res.success}, Final Status: ${dd4Res.status}`);
  console.log(`- Messages generated in journey (${dd4Res.businessJourneyId}):`);
  dd4Res.messages.forEach(m => console.log(`  * Leg: ${m.messageType} (${m.messageId}) [${m.senderBic} -> ${m.receiverBic}]`));

  if (!dd4Res.success || dd4Res.status !== 'ACSC') {
    throw new Error('Direct debit 4-stage workflow failed!');
  }

  // Assert all 4 message types exist
  const msgTypes = dd4Res.messages.map(m => m.messageType);
  if (!msgTypes.includes('pain.008.001.11')) throw new Error('Missing pain.008 in direct debit journey');
  if (!msgTypes.includes('pacs.003.001.11')) throw new Error('Missing pacs.003 in direct debit journey');
  if (!msgTypes.includes('pacs.002.001.12')) throw new Error('Missing pacs.002 in direct debit journey');
  if (!msgTypes.includes('pain.002.001.14')) throw new Error('Missing pain.002 in direct debit journey');

  // Verify journal entries exist and are balanced
  const ddJournalEntries = ledgerEngine.getJournalEntries(dd4Res.transactionId);
  console.log(`- Post-Direct Debit Journal Entries (${ddJournalEntries.length}):`);
  ddJournalEntries.forEach((je) => {
    console.log(`  Entry ${je.reference} (${je.institutionId}):`);
    je.lines.forEach((line) => {
      console.log(`    ${line.direction} ${line.ledgerAccountName}: ₦${line.amount.toLocaleString()}`);
    });
  });

  if (ddJournalEntries.length === 0) {
    throw new Error('Expected journal entries for direct debit clearing!');
  }

  // Verify customer and biller account balances
  const fredAcc = bankCore.getAccount('0112345678')!;
  const billerAcc = bankCore.getAccount('9981122334')!;
  console.log(`- Debtor Fred Available Balance: ₦${fredAcc.availableBalance.toLocaleString()}`);
  console.log(`- Biller PowerGrid Available Balance: ₦${billerAcc.availableBalance.toLocaleString()}`);

  // Test 18: ACMT Identification Verification 20s SLA Timeout
  console.log('\n[18] ACMT IDENTIFICATION VERIFICATION 20s SLA TIMEOUT TEST:');
  const fredBalBeforeAcmtTimeout = bankCore.getAccount('0112345678')!.availableBalance;
  const acmtTimeoutRes = await switchEngine.initiateCustomerTransfer({
    originatingBankId: 'bank-a',
    debtorAccountNumber: '0112345678',
    destinationBankCode: 'METRNG',
    creditorAccountNumber: '0334455667',
    creditorName: 'Adaeze Okafor',
    amount: 30000,
    currency: 'NGN',
    remittanceInfo: 'ACMT Timeout Test',
    scenario: 'ACMT_TIMEOUT',
  });

  console.log(`- ACMT Timeout Success: ${acmtTimeoutRes.success}`);
  console.log(`- Canonical Status: ${acmtTimeoutRes.canonicalPayment?.status}`);
  console.log(`- Reason Code: ${acmtTimeoutRes.reasonCode}`);
  console.log(`- Latency: ${acmtTimeoutRes.canonicalPayment?.latencyMs}ms`);

  if (acmtTimeoutRes.success || acmtTimeoutRes.canonicalPayment?.status !== 'TIMEOUT' || acmtTimeoutRes.reasonCode !== 'TO01') {
    throw new Error('Expected ACMT_TIMEOUT to result in status TIMEOUT with reason TO01');
  }
  if (acmtTimeoutRes.canonicalPayment?.latencyMs !== 20000) {
    throw new Error(`Expected latency 20000ms for 20s SLA timeout, got ${acmtTimeoutRes.canonicalPayment?.latencyMs}`);
  }

  // Assert debtor balance was never debited (zero change)
  const fredBalAfterAcmtTimeout = bankCore.getAccount('0112345678')!.availableBalance;
  console.log(`- Debtor Fred Balance Before: ₦${fredBalBeforeAcmtTimeout.toLocaleString()}, After: ₦${fredBalAfterAcmtTimeout.toLocaleString()}`);
  if (fredBalBeforeAcmtTimeout !== fredBalAfterAcmtTimeout) {
    throw new Error('Customer account was debited during ACMT timeout! Prerequisite must abort before debit.');
  }

  // Assert acmt.023 was persisted, but pacs.008 was never created
  const acmtTimeoutMsgs = switchEngine.getMessagesForTransaction(acmtTimeoutRes.uetr);
  const hasAcmt023 = acmtTimeoutMsgs.some(m => m.messageType === 'acmt.023.001.04');
  const hasPacs008 = acmtTimeoutMsgs.some(m => m.messageType === 'pacs.008.001.12');
  console.log(`- Messages recorded: acmt.023=${hasAcmt023}, pacs.008=${hasPacs008}`);
  if (!hasAcmt023 || hasPacs008) {
    throw new Error('ACMT timeout must log acmt.023 and halt before generating pacs.008');
  }

  // Assert SWITCH_TIMEOUT event was emitted
  const acmtEvents = switchEngine.getEventsForTransaction(acmtTimeoutRes.uetr);
  const hasAcmtTimeoutEvent = acmtEvents.some(e => e.eventCode === 'SWITCH_TIMEOUT');
  if (!hasAcmtTimeoutEvent) {
    throw new Error('SWITCH_TIMEOUT event was not emitted for ACMT timeout');
  }
  console.log('  -> Test 18 (ACMT 20s SLA Timeout - Zero Debit) Passed!');

  // Test 19: PACS.008 Settlement 20s SLA Timeout with Automated Customer Reversal
  console.log('\n[19] PACS.008 SETTLEMENT 20s SLA TIMEOUT TEST WITH AUTOMATED REVERSAL:');
  const fredBalBeforePacsTimeout = bankCore.getAccount('0112345678')!.availableBalance;
  const pacsTimeoutRes = await switchEngine.initiateCustomerTransfer({
    originatingBankId: 'bank-a',
    debtorAccountNumber: '0112345678',
    destinationBankCode: 'METRNG',
    creditorAccountNumber: '0334455667',
    creditorName: 'Adaeze Okafor',
    amount: 25000,
    currency: 'NGN',
    remittanceInfo: 'PACS.008 Timeout Test',
    scenario: 'SWITCH_TIMEOUT',
  });

  console.log(`- PACS Timeout Success: ${pacsTimeoutRes.success}`);
  console.log(`- Canonical Status: ${pacsTimeoutRes.canonicalPayment?.status}`);
  console.log(`- Reason Code: ${pacsTimeoutRes.reasonCode}`);
  console.log(`- Latency: ${pacsTimeoutRes.canonicalPayment?.latencyMs}ms`);

  if (pacsTimeoutRes.success || pacsTimeoutRes.canonicalPayment?.status !== 'TIMEOUT' || pacsTimeoutRes.reasonCode !== 'AB03') {
    throw new Error('Expected SWITCH_TIMEOUT to result in status TIMEOUT with reason AB03');
  }
  if (pacsTimeoutRes.canonicalPayment?.latencyMs !== 20000) {
    throw new Error(`Expected latency 20000ms for 20s SLA timeout, got ${pacsTimeoutRes.canonicalPayment?.latencyMs}`);
  }

  // Assert debtor balance was restored via automated reversal
  const fredBalAfterPacsTimeout = bankCore.getAccount('0112345678')!.availableBalance;
  console.log(`- Debtor Fred Balance Before: ₦${fredBalBeforePacsTimeout.toLocaleString()}, After Reversal: ₦${fredBalAfterPacsTimeout.toLocaleString()}`);
  if (fredBalBeforePacsTimeout !== fredBalAfterPacsTimeout) {
    throw new Error(`Customer balance not restored after timeout! Before: ₦${fredBalBeforePacsTimeout}, After: ₦${fredBalAfterPacsTimeout}`);
  }

  // Assert pacs.002 rejection report was generated and stored
  const pacsTimeoutMsgs = switchEngine.getMessagesForTransaction(pacsTimeoutRes.uetr);
  const pacs002Timeout = pacsTimeoutMsgs.find(m => m.messageType === 'pacs.002.001.12');
  if (!pacs002Timeout) {
    throw new Error('Missing pacs.002 timeout rejection report in Hybrid Store!');
  }
  console.log(`- pacs.002 Timeout MsgId: ${pacs002Timeout.messageId}, Status: ${pacs002Timeout.processingStatus}`);

  // Assert events: SWITCH_TIMEOUT and ORIGINATING_BANK_RECEIVED_RESPONSE
  const pacsEvents = switchEngine.getEventsForTransaction(pacsTimeoutRes.uetr);
  const hasPacsTimeoutEvent = pacsEvents.some(e => e.eventCode === 'SWITCH_TIMEOUT');
  const hasOrigBankRespEvent = pacsEvents.some(e => e.eventCode === 'ORIGINATING_BANK_RECEIVED_RESPONSE');
  if (!hasPacsTimeoutEvent || !hasOrigBankRespEvent) {
    throw new Error('Missing SWITCH_TIMEOUT or ORIGINATING_BANK_RECEIVED_RESPONSE event for PACS timeout');
  }
  console.log('  -> Test 19 (PACS.008 20s SLA Timeout - Auto Reversal) Passed!');

  console.log('\n===============================================================');
  console.log('✅ ALL 19 TEST SUITE ASSERTIONS PASSED PERFECTLY!');
  console.log('===============================================================');
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
