import {
  Participant,
  IsoStoredMessage,
  TransactionEvent,
  CanonicalPayment,
  ValidationLayerResult,
  ScenarioType,
} from '@/types';
import { parsePacs008Xml, buildPacs008Xml } from '../iso20022/pacs008';
import { parsePacs002Xml, buildPacs002Xml } from '../iso20022/pacs002';
import { buildAcmt023Xml, parseAcmt023Xml, buildAcmt024Xml, parseAcmt024Xml } from '../iso20022/acmt';
import { buildPacs003Xml, parsePacs003Xml } from '../iso20022/pacs003';
import { buildPacs028Xml, parsePacs028Xml } from '../iso20022/pacs028';
import { buildCamt060Xml, parseCamt060Xml, buildCamt052_053Xml, parseCamt052Or053Xml } from '../iso20022/camt';
import { buildPain009Xml, buildPain012Xml, buildPain010Xml, buildPain011Xml, parseMandateXml } from '../iso20022/mandates';
import { buildPain013Xml, buildPain014Xml, parseRtpXml } from '../iso20022/rtp';
import { buildPain008Xml, buildPain002Xml, parseDirectDebitXml } from '../iso20022/direct-debit';
import {
  validateXmlWellFormed,
  validateXsdSchema,
  validateSchemeRules,
  validateParticipants,
  validateDuplicateCheck,
  validateRouting,
} from '../iso20022/validators';
import { BankCore } from '../core-banking/bank-core';
import { v4 as uuidv4 } from 'uuid';
import {
  syncIsoMessageToSupabase,
  syncTransactionEventToSupabase,
  syncPaymentToSupabase,
} from '@/lib/supabase';

export interface DirectDebitWorkflowResult {
  success: boolean;
  businessJourneyId: string;
  transactionId: string;
  status: 'ACSC' | 'RJCT';
  reasonCode?: string;
  reasonDescription?: string;
  amount: number;
  currency: string;
  debtorAccount: string;
  creditorAccount: string;
  mandateId: string;
  pain008Xml: string;
  pacs003Xml: string;
  pacs002Xml: string;
  pain002Xml: string;
  events: TransactionEvent[];
  messages: IsoStoredMessage[];
}

export interface GenericIsoProcessResult {
  success: boolean;
  messageType: string;
  parsed: Record<string, any>;
  responseXml?: string;
  responseMessageType?: string;
  responseParsed?: Record<string, any>;
  error?: string;
  reasonCode?: string;
  transactionId?: string;
  uetr?: string;
}

export function detectIsoMessageType(xml: string): string | null {
  const nsMatch = xml.match(/urn:iso:std:iso:20022:tech:xsd:([a-z]{4}\.\d{3}\.\d{3}\.\d{2})/i);
  if (nsMatch && nsMatch[1]) {
    return nsMatch[1].toLowerCase();
  }

  if (xml.includes('IdVrfctnReq')) return 'acmt.023.001.04';
  if (xml.includes('IdVrfctnRpt')) return 'acmt.024.001.04';
  if (xml.includes('FIToFICstmrCdtTrf')) return 'pacs.008.001.12';
  if (xml.includes('FIToFIPmtStsRpt')) return 'pacs.002.001.12';
  if (xml.includes('FIToFICstmrDrctDbt')) return 'pacs.003.001.11';
  if (xml.includes('FIToFIPmtStsReq')) return 'pacs.028.001.06';
  if (xml.includes('AcctRptgReq')) return 'camt.060.001.07';
  if (xml.includes('BkToCstmrAcctRpt')) return 'camt.052.001.12';
  if (xml.includes('BkToCstmrStmt')) return 'camt.053.001.12';
  if (xml.includes('MndtInitnReq')) return 'pain.009.001.08';
  if (xml.includes('MndtAccptncRpt')) return 'pain.012.001.08';
  if (xml.includes('MndtAmdmntReq')) return 'pain.010.001.08';
  if (xml.includes('MndtCxlReq')) return 'pain.011.001.08';
  if (xml.includes('CdtrPmtActvtnReqStsRpt')) return 'pain.014.001.11';
  if (xml.includes('CdtrPmtActvtnReq')) return 'pain.013.001.11';
  if (xml.includes('CstmrDrctDbtInitn')) return 'pain.008.001.11';
  if (xml.includes('CstmrPmtStsRpt')) return 'pain.002.001.14';

  return null;
}

export interface InboundTransferRequest {
  originatingBankId: string;
  debtorAccountNumber: string;
  destinationBankCode: string; // e.g. METRNG
  creditorAccountNumber: string;
  creditorName: string;
  amount: number;
  currency: string;
  remittanceInfo?: string;
  scenario?: ScenarioType;
}

export class SwitchEngine {
  public static readonly SLA_TIMEOUT_SECONDS = 20;
  public static readonly SLA_TIMEOUT_MS = 20000;

  private participants: Map<string, Participant>; // keyed by code (e.g. NAIJANG) and id
  private storedMessages: IsoStoredMessage[] = [];
  private events: TransactionEvent[] = [];
  private transactions: CanonicalPayment[] = [];
  private processedUetrs = new Set<string>();
  private processedInstructionIds = new Set<string>();
  private bankCore: BankCore;

  constructor(initialParticipants: Participant[], bankCore: BankCore) {
    this.participants = new Map();
    this.bankCore = bankCore;

    initialParticipants.forEach((p) => {
      this.participants.set(p.code, { ...p });
      this.participants.set(p.id, { ...p });
    });
  }

  public getParticipants(): Participant[] {
    // Unique participants by code
    const unique = new Map<string, Participant>();
    this.participants.forEach((p) => unique.set(p.code, p));
    return Array.from(unique.values());
  }

  public getParticipantByCode(code: string): Participant | undefined {
    return this.participants.get(code);
  }

  public setParticipantStatus(code: string, status: Participant['status']): void {
    const p = this.participants.get(code);
    if (p) {
      p.status = status;
      const byId = this.participants.get(p.id);
      if (byId) byId.status = status;
    }
  }

  public getTransactions(): CanonicalPayment[] {
    return this.transactions;
  }

  public getTransaction(uetr: string): CanonicalPayment | undefined {
    return this.transactions.find((tx) => tx.uetr === uetr || tx.id === uetr);
  }

  public getMessagesForTransaction(uetr: string): IsoStoredMessage[] {
    return this.storedMessages.filter((m) => m.uetr === uetr || m.businessJourneyId === uetr);
  }

  public getEventsForTransaction(uetrOrTxId: string): TransactionEvent[] {
    const tx = this.getTransaction(uetrOrTxId);
    return this.events.filter(
      (e) =>
        e.transactionId === uetrOrTxId ||
        e.businessJourneyId === uetrOrTxId ||
        (tx && (e.transactionId === tx.id || e.businessJourneyId === tx.businessJourneyId))
    );
  }

  public getAllEvents(): TransactionEvent[] {
    return this.events;
  }

  /**
   * Standalone Name Enquiry / Account Identification Verification (acmt.023 -> acmt.024)
   */
  public performNameEnquiry(req: {
    originatingBankId: string;
    destinationBankCode: string;
    accountNumber: string;
    scenario?: ScenarioType;
  }): {
    success: boolean;
    accountNumber: string;
    verifiedName?: string;
    error?: string;
    reasonCode?: string;
    acmt023Xml?: string;
    acmt024Xml?: string;
  } {
    const orig = this.participants.get(req.originatingBankId);
    const dest = this.participants.get(req.destinationBankCode);

    if (!orig || !dest) {
      return { success: false, accountNumber: req.accountNumber, error: 'Invalid participant configuration' };
    }

    const vrfId = `VRF-ENQ-${Date.now()}`;
    const msg023 = `MSG-023-${Date.now()}`;
    const acmt023Xml = buildAcmt023Xml({
      msgId: msg023,
      creDtTm: new Date().toISOString(),
      senderBic: orig.code,
      receiverBic: dest.code,
      verificationId: vrfId,
      accountNumber: req.accountNumber,
    });

    if (req.scenario === 'ACMT_TIMEOUT') {
      return {
        success: false,
        accountNumber: req.accountNumber,
        reasonCode: 'TO01',
        error: `Identification Verification Request Timed Out (${SwitchEngine.SLA_TIMEOUT_SECONDS}s SLA exceeded)`,
        acmt023Xml,
      };
    }

    const destAccount = this.bankCore.getAccount(req.accountNumber);
    const isVerified = Boolean(destAccount && destAccount.status !== 'CLOSED');
    const verifiedName = destAccount?.accountName;
    const msg024 = `MSG-024-${Date.now()}`;

    const acmt024Xml = buildAcmt024Xml({
      msgId: msg024,
      creDtTm: new Date().toISOString(),
      senderBic: dest.code,
      receiverBic: orig.code,
      originalVerificationId: vrfId,
      isVerified,
      reasonCode: isVerified ? 'VALID' : 'AC01',
      reasonDescription: isVerified ? 'Account verified' : 'Account does not exist',
      accountNumber: req.accountNumber,
      verifiedPartyName: verifiedName || 'N/A',
      destinationBic: dest.code,
    });

    return {
      success: isVerified,
      accountNumber: req.accountNumber,
      verifiedName,
      reasonCode: isVerified ? 'VALID' : 'AC01',
      error: isVerified ? undefined : 'Account does not exist at destination institution',
      acmt023Xml,
      acmt024Xml,
    };
  }

  private emitEvent(
    txId: string,
    journeyId: string,
    eventCode: TransactionEvent['eventCode'],
    actor: string,
    stage: TransactionEvent['stage'],
    status: TransactionEvent['status'],
    description: string,
    details?: Record<string, any>
  ): TransactionEvent {
    const event: TransactionEvent = {
      id: uuidv4(),
      transactionId: txId,
      businessJourneyId: journeyId,
      eventCode,
      actor,
      stage,
      status,
      description,
      details,
      timestamp: new Date().toISOString(),
      sequenceNo: this.events.length + 1,
    };
    this.events.unshift(event);
    syncTransactionEventToSupabase(event).catch(() => {});
    return event;
  }

  /**
   * Main High-Level Entry Point: Process Customer-Initiated Interbank Transfer
   */
  public async initiateCustomerTransfer(req: InboundTransferRequest): Promise<{
    success: boolean;
    uetr: string;
    canonicalPayment?: CanonicalPayment;
    error?: string;
    reasonCode?: string;
  }> {
    const startTime = Date.now();
    const journeyId = uuidv4();
    const uetr = uuidv4();
    const instructionId = `INST-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const endToEndId = `E2E-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const txId = `TX-${Date.now()}`;
    const scenario = req.scenario || 'SUCCESS';

    const origParticipant = this.participants.get(req.originatingBankId);
    const destParticipant = this.participants.get(req.destinationBankCode);

    if (!origParticipant) {
      return { success: false, uetr, error: 'Originating bank unrecognized in Switch Registry' };
    }

    const debtorAcc = this.bankCore.getAccount(req.debtorAccountNumber);
    if (!debtorAcc) {
      return { success: false, uetr, error: 'Originating debtor account not found' };
    }

    // 1. CUSTOMER_INITIATED Event
    this.emitEvent(
      txId,
      journeyId,
      'CUSTOMER_INITIATED',
      origParticipant.name,
      'ORIGINATION',
      'INFO',
      `Customer initiated transfer of ₦${req.amount.toLocaleString()} to ${req.creditorName} at ${destParticipant?.name || req.destinationBankCode}`,
      { amount: req.amount, currency: req.currency, debtorAccount: req.debtorAccountNumber, scenario }
    );

    // Initial Canonical Payment Record
    const canonicalPayment: CanonicalPayment = {
      id: txId,
      businessJourneyId: journeyId,
      uetr,
      instructionId,
      endToEndId,
      txId,
      originatingInstitution: {
        id: origParticipant.id,
        code: origParticipant.code,
        name: origParticipant.name,
        routingCode: origParticipant.routingCode,
      },
      destinationInstitution: {
        id: destParticipant?.id || 'unknown',
        code: destParticipant?.code || req.destinationBankCode,
        name: destParticipant?.name || 'Unknown Institution',
        routingCode: destParticipant?.routingCode || '999',
      },
      debtor: {
        name: debtorAcc.accountName,
        accountNumber: debtorAcc.accountNumber,
        accountType: debtorAcc.accountType,
      },
      creditor: {
        name: req.creditorName,
        accountNumber: req.creditorAccountNumber,
      },
      amount: req.amount,
      currency: req.currency,
      localInstrument: 'INST',
      chargeBearer: 'SLEV',
      remittanceInformation: req.remittanceInfo,
      status: 'PENDING',
      initiatedAt: new Date().toISOString(),
    };
    this.transactions.unshift(canonicalPayment);

    // -------------------------------------------------------------
    // MANDATORY DOMESTIC PREREQUISITE: ACMT 023 & ACMT 024
    // Identification Verification (Name Enquiry) before PACS 008
    // -------------------------------------------------------------
    const targetCreditorAccount = scenario === 'INVALID_ACCOUNT' ? '9999999999' : req.creditorAccountNumber;
    const acmt023MsgId = `MSG-023-${Date.now()}`;
    const vrfId = `VRF-${Date.now()}`;

    const acmt023Xml = buildAcmt023Xml({
      msgId: acmt023MsgId,
      creDtTm: new Date().toISOString(),
      senderBic: origParticipant.code,
      receiverBic: req.destinationBankCode,
      verificationId: vrfId,
      accountNumber: targetCreditorAccount,
      partyName: req.creditorName,
    });

    this.emitEvent(
      txId,
      journeyId,
      'IDENTIFICATION_VERIFICATION_REQUESTED',
      origParticipant.name,
      'ORIGINATION',
      'INFO',
      `Dispatched acmt.023.001.03 Identification Verification Request to Switch for ${targetCreditorAccount} (${req.destinationBankCode})`,
      { msgId: acmt023MsgId, verificationId: vrfId, targetAccount: targetCreditorAccount }
    );

    // Persist acmt.023 in Hybrid Store
    const parsed023 = parseAcmt023Xml(acmt023Xml);
    this.persistHybridMessage({
      businessJourneyId: journeyId,
      transactionId: txId,
      messageType: 'acmt.023.001.04',
      messageVersion: '04',
      messageId: acmt023MsgId,
      senderBic: origParticipant.code,
      receiverBic: req.destinationBankCode,
      rawXml: acmt023Xml,
      parsedJson: parsed023.rawParsed,
      uetr,
      endToEndId,
      instructionId,
      amount: 0,
      currency: req.currency,
      debtorAgent: origParticipant.code,
      creditorAgent: req.destinationBankCode,
      settlementDate: new Date().toISOString().split('T')[0],
      schemaValidationStatus: 'PASS',
      businessValidationStatus: 'PASS',
      processingStatus: 'FORWARDED',
      validationResults: [{ layer: 'XML_WELL_FORMED', status: 'PASS', summary: 'acmt.023 is well-formed' }],
    });

    // Check SLA Timeout for ACMT Identification Verification (20s SLA)
    if (scenario === 'ACMT_TIMEOUT') {
      canonicalPayment.status = 'TIMEOUT';
      canonicalPayment.statusReasonCode = 'TO01';
      canonicalPayment.statusReasonDescription = `Identification Verification Request Timed Out (${SwitchEngine.SLA_TIMEOUT_SECONDS}s SLA exceeded)`;
      canonicalPayment.completedAt = new Date().toISOString();
      canonicalPayment.latencyMs = SwitchEngine.SLA_TIMEOUT_MS;
      await syncPaymentToSupabase(canonicalPayment);

      this.emitEvent(
        txId,
        journeyId,
        'SWITCH_TIMEOUT',
        'CENTRAL_SWITCH',
        'SWITCHING',
        'ERROR',
        `ACMT Identification Verification timed out after ${SwitchEngine.SLA_TIMEOUT_SECONDS}s SLA. Destination bank (${req.destinationBankCode}) failed to respond with acmt.024.`,
        { timeoutSeconds: SwitchEngine.SLA_TIMEOUT_SECONDS, reasonCode: 'TO01', targetAccount: targetCreditorAccount }
      );

      this.emitEvent(
        txId,
        journeyId,
        'CUSTOMER_NOTIFIED',
        origParticipant.name,
        'NOTIFICATION',
        'ERROR',
        `Customer banking channel updated: Name enquiry timed out after ${SwitchEngine.SLA_TIMEOUT_SECONDS}s SLA. Transfer aborted before debit.`,
        { latencyMs: canonicalPayment.latencyMs, status: 'TIMEOUT', reasonCode: 'TO01' }
      );

      return {
        success: false,
        uetr,
        canonicalPayment,
        error: canonicalPayment.statusReasonDescription,
        reasonCode: 'TO01',
      };
    }

    // Destination Core evaluates beneficiary existence
    const destAccount = this.bankCore.getAccount(targetCreditorAccount);
    const isVerified = Boolean(destAccount && destAccount.status !== 'CLOSED');
    const verifiedName = destAccount?.accountName || req.creditorName;
    const acmt024MsgId = `MSG-024-${Date.now()}`;

    const acmt024Xml = buildAcmt024Xml({
      msgId: acmt024MsgId,
      creDtTm: new Date().toISOString(),
      senderBic: req.destinationBankCode,
      receiverBic: origParticipant.code,
      originalVerificationId: vrfId,
      isVerified,
      reasonCode: isVerified ? 'VALID' : 'AC01',
      reasonDescription: isVerified ? 'Account verified and active' : 'Beneficiary account does not exist at destination institution',
      accountNumber: targetCreditorAccount,
      verifiedPartyName: isVerified ? verifiedName : 'N/A',
      destinationBic: req.destinationBankCode,
    });

    // Persist acmt.024 in Hybrid Store
    const parsed024 = parseAcmt024Xml(acmt024Xml);
    this.persistHybridMessage({
      businessJourneyId: journeyId,
      transactionId: txId,
      messageType: 'acmt.024.001.04',
      messageVersion: '04',
      messageId: acmt024MsgId,
      originalMessageId: acmt023MsgId,
      senderBic: req.destinationBankCode,
      receiverBic: origParticipant.code,
      rawXml: acmt024Xml,
      parsedJson: parsed024.rawParsed,
      uetr,
      endToEndId,
      instructionId,
      amount: 0,
      currency: req.currency,
      debtorAgent: origParticipant.code,
      creditorAgent: req.destinationBankCode,
      settlementDate: new Date().toISOString().split('T')[0],
      schemaValidationStatus: 'PASS',
      businessValidationStatus: 'PASS',
      processingStatus: 'PROCESSED',
      validationResults: [{ layer: 'XML_WELL_FORMED', status: 'PASS', summary: 'acmt.024 is well-formed' }],
    });

    if (!isVerified) {
      canonicalPayment.status = 'REJECTED';
      canonicalPayment.statusReasonCode = 'AC01';
      canonicalPayment.statusReasonDescription = `Identification Verification Failed (acmt.024): Account ${targetCreditorAccount} does not exist at ${destParticipant?.name || req.destinationBankCode}`;
      canonicalPayment.completedAt = new Date().toISOString();
      canonicalPayment.latencyMs = Date.now() - startTime;
      await syncPaymentToSupabase(canonicalPayment);

      this.emitEvent(
        txId,
        journeyId,
        'IDENTIFICATION_FAILED',
        destParticipant?.name || req.destinationBankCode,
        'DESTINATION',
        'ERROR',
        `Destination bank rejected acmt.023 verification: Account ${targetCreditorAccount} not found (AC01). Clearing halted before pacs.008 generation.`,
        { reasonCode: 'AC01', targetAccount: targetCreditorAccount }
      );

      return {
        success: false,
        uetr,
        canonicalPayment,
        error: canonicalPayment.statusReasonDescription,
        reasonCode: 'AC01',
      };
    }

    this.emitEvent(
      txId,
      journeyId,
      'IDENTIFICATION_VERIFIED',
      destParticipant?.name || req.destinationBankCode,
      'DESTINATION',
      'SUCCESS',
      `Identification Verified via acmt.024.001.03: Account holder "${verifiedName}". Prerequisite fulfilled, proceeding to pacs.008 clearing.`,
      { verifiedName, accountNumber: targetCreditorAccount }
    );

    // 2. BANK_VALIDATED & Core Debit
    const debitResult = this.bankCore.validateAndDebit(
      req.debtorAccountNumber,
      scenario === 'INSUFFICIENT_FUNDS' ? debtorAcc.availableBalance + 100000 : req.amount,
      verifiedName,
      req.creditorAccountNumber,
      destParticipant?.name || req.destinationBankCode,
      endToEndId,
      uetr
    );

    if (!debitResult.success) {
      canonicalPayment.status = 'FAILED';
      canonicalPayment.statusReasonCode = debitResult.errorCode || 'AM04';
      canonicalPayment.statusReasonDescription = debitResult.error;
      canonicalPayment.completedAt = new Date().toISOString();
      canonicalPayment.latencyMs = Date.now() - startTime;

      this.emitEvent(
        txId,
        journeyId,
        'TRANSACTION_REJECTED',
        origParticipant.name,
        'ORIGINATION',
        'ERROR',
        `Originating Core rejected transfer: ${debitResult.error}`,
        { errorCode: debitResult.errorCode }
      );

      return {
        success: false,
        uetr,
        canonicalPayment,
        error: debitResult.error,
        reasonCode: debitResult.errorCode,
      };
    }

    this.emitEvent(
      txId,
      journeyId,
      'BANK_VALIDATED',
      origParticipant.name,
      'ORIGINATION',
      'SUCCESS',
      `Originating bank validated account balance and placed debit on ${req.debtorAccountNumber}`,
      { balanceAfter: debtorAcc.availableBalance }
    );

    // 3. ISO_MESSAGE_CREATED (pacs.008)
    const pacs008MsgId = `MSG-008-${Date.now()}`;
    let pacs008Xml = buildPacs008Xml({
      msgId: pacs008MsgId,
      creDtTm: new Date().toISOString(),
      uetr,
      instructionId,
      endToEndId,
      txId,
      amount: req.amount,
      currency: scenario === 'SCHEME_RULE_FAILURE' ? 'EUR' : req.currency,
      settlementDate: new Date().toISOString().split('T')[0],
      debtorName: debtorAcc.accountName,
      debtorAccount: debtorAcc.accountNumber,
      debtorAgentBic: origParticipant.code,
      creditorName: req.creditorName,
      creditorAccount: scenario === 'INVALID_ACCOUNT' ? '9999999999' : req.creditorAccountNumber,
      creditorAgentBic: req.destinationBankCode,
      remittanceInfo: req.remittanceInfo,
      localInstrument: 'INST',
    });

    if (scenario === 'MALFORMED_XML') {
      pacs008Xml = pacs008Xml.replace('</FIToFICstmrCdtTrf>', '<UNCLOSED_TAG>');
    }

    this.emitEvent(
      txId,
      journeyId,
      'ISO_MESSAGE_CREATED',
      origParticipant.name,
      'ORIGINATION',
      'SUCCESS',
      `Generated pacs.008.001.10 XML Credit Transfer instruction`,
      { msgId: pacs008MsgId, uetr }
    );

    // 4. Ingest into Central Switch Pipeline
    return await this.processInboundPacs008({
      rawXml: pacs008Xml,
      senderCode: origParticipant.code,
      receiverCode: req.destinationBankCode,
      journeyId,
      uetr,
      instructionId,
      endToEndId,
      txId,
      canonicalPayment,
      startTime,
      scenario,
    });
  }

  /**
   * Central Switch Pipeline for pacs.008
   */
  public async processInboundPacs008(input: {
    rawXml: string;
    senderCode: string;
    receiverCode: string;
    journeyId: string;
    uetr: string;
    instructionId: string;
    endToEndId: string;
    txId: string;
    canonicalPayment: CanonicalPayment;
    startTime: number;
    scenario: ScenarioType;
  }): Promise<{
    success: boolean;
    uetr: string;
    canonicalPayment?: CanonicalPayment;
    error?: string;
    reasonCode?: string;
  }> {
    const { rawXml, senderCode, receiverCode, journeyId, uetr, instructionId, endToEndId, txId, canonicalPayment, startTime, scenario } = input;

    // A. SWITCH_RECEIVED
    this.emitEvent(
      txId,
      journeyId,
      'SWITCH_RECEIVED',
      'CENTRAL_SWITCH',
      'SWITCHING',
      'INFO',
      `Central Switch received inbound pacs.008 message from ${senderCode}`,
      { sender: senderCode, receiver: receiverCode, byteSize: rawXml.length }
    );
    canonicalPayment.status = 'SWITCH_RECEIVED';

    const validationLayers: ValidationLayerResult[] = [];

    // B. Layer 1: XML Well-Formedness
    const wellFormed = validateXmlWellFormed(rawXml);
    validationLayers.push(wellFormed);
    if (wellFormed.status === 'FAIL') {
      return await this.rejectAtSwitch(input, validationLayers, 'XML_MALFORMED', wellFormed.summary, 'ED05');
    }

    // Parse pacs.008
    let parsedFields: Record<string, any>;
    try {
      parsedFields = parsePacs008Xml(rawXml);
    } catch (err: any) {
      const failLayer: ValidationLayerResult = {
        layer: 'XSD_SCHEMA',
        status: 'FAIL',
        summary: `XML Parsing error: ${err.message}`,
      };
      validationLayers.push(failLayer);
      return await this.rejectAtSwitch(input, validationLayers, 'SCHEMA_VALIDATION_FAILED', err.message, 'ED05');
    }

    // C. Layer 2: XSD Schema Validation
    const xsdResult = validateXsdSchema(rawXml, 'pacs.008', parsedFields);
    validationLayers.push(xsdResult);
    if (xsdResult.status === 'FAIL') {
      return await this.rejectAtSwitch(input, validationLayers, 'XSD_VALIDATION_FAILED', xsdResult.summary, 'ED05');
    }
    this.emitEvent(txId, journeyId, 'SCHEMA_VALIDATED', 'CENTRAL_SWITCH', 'SWITCHING', 'SUCCESS', 'ISO 20022 XSD Schema validation passed');

    // D. Layer 3: Scheme / NPS Rules Validation
    const schemeResult = validateSchemeRules(parsedFields, 'pacs.008');
    validationLayers.push(schemeResult);
    if (schemeResult.status === 'FAIL') {
      return await this.rejectAtSwitch(input, validationLayers, 'SCHEME_RULES_FAILED', schemeResult.summary, 'AG01');
    }
    this.emitEvent(txId, journeyId, 'BUSINESS_RULES_VALIDATED', 'CENTRAL_SWITCH', 'SWITCHING', 'SUCCESS', 'Scheme & NPS business usage rules passed');

    // E. Layer 4: Participant Validation
    const sender = this.participants.get(senderCode);
    const receiver = this.participants.get(receiverCode);

    // Scenario simulation: Force receiver offline if scenario requested
    const effectiveReceiver = scenario === 'DEST_OFFLINE' && receiver
      ? { ...receiver, status: 'OFFLINE' as const }
      : receiver;

    const participantResult = validateParticipants(sender, effectiveReceiver);
    validationLayers.push(participantResult);
    if (participantResult.status === 'FAIL') {
      const code = participantResult.details?.reasonCode || 'DS04';
      return await this.rejectAtSwitch(input, validationLayers, 'PARTICIPANT_UNAVAILABLE', participantResult.summary, code);
    }

    // F. Layer 5: Duplicate Check
    if (scenario === 'DUPLICATE_REPLAY') {
      // simulate duplicate key presence
      this.processedUetrs.add(uetr);
    }

    const duplicateResult = validateDuplicateCheck(uetr, instructionId, this.processedUetrs, this.processedInstructionIds);
    validationLayers.push(duplicateResult);
    if (duplicateResult.status === 'FAIL') {
      return await this.rejectAtSwitch(input, validationLayers, 'DUPLICATE_DETECTED', duplicateResult.summary, 'AM05');
    }

    // Register UETR for idempotency
    this.processedUetrs.add(uetr);
    this.processedInstructionIds.add(instructionId);

    // G. Layer 6: Routing Resolution
    const routingResult = validateRouting(receiver);
    validationLayers.push(routingResult);
    if (routingResult.status === 'FAIL') {
      return await this.rejectAtSwitch(input, validationLayers, 'ROUTING_FAILED', routingResult.summary, 'DS04');
    }

    this.emitEvent(
      txId,
      journeyId,
      'ROUTE_IDENTIFIED',
      'CENTRAL_SWITCH',
      'SWITCHING',
      'SUCCESS',
      `Identified destination routing endpoint: ${receiver!.name} (${receiver!.code}) -> ${receiver!.endpoint}`,
      { endpoint: receiver!.endpoint }
    );
    canonicalPayment.status = 'SWITCH_ROUTED';

    // Store pacs.008 in Hybrid ISO Message Store
    this.persistHybridMessage({
      businessJourneyId: journeyId,
      transactionId: txId,
      messageType: 'pacs.008.001.12',
      messageVersion: '12',
      messageId: parsedFields.msgId,
      senderBic: senderCode,
      receiverBic: receiverCode,
      rawXml,
      parsedJson: parsedFields.rawParsed,
      uetr,
      endToEndId,
      instructionId,
      amount: parsedFields.amount,
      currency: parsedFields.currency,
      debtorAgent: senderCode,
      creditorAgent: receiverCode,
      settlementDate: parsedFields.settlementDate,
      schemaValidationStatus: 'PASS',
      businessValidationStatus: 'PASS',
      processingStatus: 'FORWARDED',
      validationResults: validationLayers,
    });

    // H. Delivery to Destination Bank Core
    this.emitEvent(
      txId,
      journeyId,
      'DESTINATION_BANK_RECEIVED',
      receiver!.name,
      'DESTINATION',
      'INFO',
      `Destination Bank ${receiver!.name} Core received pacs.008 credit instruction`,
      { creditorAccount: parsedFields.creditorAccount, amount: parsedFields.amount }
    );

    // Scenario Simulation: SWITCH_TIMEOUT (20s SLA exceeded waiting for Destination Bank response)
    if (scenario === 'SWITCH_TIMEOUT') {
      canonicalPayment.status = 'TIMEOUT';
      canonicalPayment.statusReasonCode = 'AB03';
      canonicalPayment.statusReasonDescription = `Settlement Timed Out - No Response from Destination Bank within ${SwitchEngine.SLA_TIMEOUT_SECONDS}s SLA`;
      canonicalPayment.completedAt = new Date().toISOString();
      canonicalPayment.latencyMs = SwitchEngine.SLA_TIMEOUT_MS;

      this.emitEvent(
        txId,
        journeyId,
        'SWITCH_TIMEOUT',
        'CENTRAL_SWITCH',
        'SWITCHING',
        'ERROR',
        `pacs.008 settlement timed out after ${SwitchEngine.SLA_TIMEOUT_SECONDS}s SLA waiting for destination bank (${receiver!.name}) response. Automated reversal initiated.`,
        { timeoutSeconds: SwitchEngine.SLA_TIMEOUT_SECONDS, reasonCode: 'AB03', uetr }
      );

      // Automated reversal at Originating Bank Core
      this.bankCore.reverseDebit(
        parsedFields.debtorAccount,
        parsedFields.amount,
        endToEndId,
        uetr,
        `Settlement Timed Out - Destination Bank did not respond within ${SwitchEngine.SLA_TIMEOUT_SECONDS}s SLA (AB03)`
      );

      // Generate pacs.002 timeout rejection report
      const pacs002MsgId = `MSG-002-TO-${Date.now()}`;
      const pacs002Xml = buildPacs002Xml({
        msgId: pacs002MsgId,
        creDtTm: new Date().toISOString(),
        initiatingParty: 'CENTRAL_SWITCH',
        originalMsgId: parsedFields.msgId,
        originalMsgNameId: 'pacs.008.001.10',
        originalInstructionId: instructionId,
        originalEndToEndId: endToEndId,
        originalTxId: txId,
        originalUetr: uetr,
        transactionStatus: 'RJCT',
        statusReasonCode: 'AB03',
        statusReasonDescription: `Settlement Timed Out - No Response from Destination Bank within ${SwitchEngine.SLA_TIMEOUT_SECONDS}s SLA`,
        amount: parsedFields.amount,
        currency: parsedFields.currency,
        settlementDate: parsedFields.settlementDate,
        debtorName: parsedFields.debtorName,
        debtorAgentBic: senderCode,
        creditorName: parsedFields.creditorName,
        creditorAgentBic: receiverCode,
      });

      const parsedPacs002 = parsePacs002Xml(pacs002Xml);
      this.persistHybridMessage({
        businessJourneyId: journeyId,
        transactionId: txId,
        messageType: 'pacs.002.001.12',
        messageVersion: '12',
        messageId: pacs002MsgId,
        originalMessageId: parsedFields.msgId,
        senderBic: 'CENTRAL_SWITCH',
        receiverBic: senderCode,
        rawXml: pacs002Xml,
        parsedJson: parsedPacs002.rawParsed,
        uetr,
        endToEndId,
        instructionId,
        amount: parsedFields.amount,
        currency: parsedFields.currency,
        debtorAgent: senderCode,
        creditorAgent: receiverCode,
        settlementDate: parsedFields.settlementDate,
        schemaValidationStatus: 'PASS',
        businessValidationStatus: 'PASS',
        processingStatus: 'PROCESSED',
        validationResults: [
          { layer: 'XML_WELL_FORMED', status: 'PASS', summary: 'pacs.002 timeout rejection is well-formed' },
          { layer: 'XSD_SCHEMA', status: 'PASS', summary: 'pacs.002 timeout rejection schema valid' },
        ],
      });

      this.emitEvent(
        txId,
        journeyId,
        'ORIGINATING_BANK_RECEIVED_RESPONSE',
        sender!.name,
        'ORIGINATION',
        'ERROR',
        `Originating Bank ${sender!.name} received timeout rejection (AB03) and refunded customer account`,
        { txStatus: 'RJCT', reasonCode: 'AB03' }
      );

      await syncPaymentToSupabase(canonicalPayment);

      this.emitEvent(
        txId,
        journeyId,
        'CUSTOMER_NOTIFIED',
        sender!.name,
        'NOTIFICATION',
        'ERROR',
        `Customer banking channel updated: Transfer TIMEOUT (${SwitchEngine.SLA_TIMEOUT_SECONDS}s SLA exceeded). Debited funds refunded.`,
        { latencyMs: canonicalPayment.latencyMs, status: 'TIMEOUT', reasonCode: 'AB03' }
      );

      return {
        success: false,
        uetr,
        canonicalPayment,
        error: canonicalPayment.statusReasonDescription,
        reasonCode: 'AB03',
      };
    }

    // Credit Beneficiary at Destination Core
    const creditResult = this.bankCore.creditBeneficiary(
      parsedFields.creditorAccount,
      parsedFields.amount,
      parsedFields.debtorName,
      parsedFields.debtorAccount,
      sender!.name,
      endToEndId,
      uetr
    );

    // I. Generate pacs.002 Payment Status Report
    const pacs002MsgId = `MSG-002-${Date.now()}`;
    const txStatus = creditResult.success ? 'ACTC' : 'RJCT';
    const reasonCode = creditResult.errorCode;
    const reasonDesc = creditResult.error;

    const pacs002Xml = buildPacs002Xml({
      msgId: pacs002MsgId,
      creDtTm: new Date().toISOString(),
      initiatingParty: receiver!.name,
      originalMsgId: parsedFields.msgId,
      originalMsgNameId: 'pacs.008.001.10',
      originalInstructionId: instructionId,
      originalEndToEndId: endToEndId,
      originalTxId: txId,
      originalUetr: uetr,
      transactionStatus: txStatus,
      statusReasonCode: reasonCode,
      statusReasonDescription: reasonDesc,
      amount: parsedFields.amount,
      currency: parsedFields.currency,
      settlementDate: parsedFields.settlementDate,
      debtorName: parsedFields.debtorName,
      debtorAgentBic: senderCode,
      creditorName: parsedFields.creditorName,
      creditorAgentBic: receiverCode,
    });

    if (creditResult.success) {
      this.emitEvent(
        txId,
        journeyId,
        'ACCOUNT_CREDITED',
        receiver!.name,
        'DESTINATION',
        'SUCCESS',
        `Destination bank credited ₦${parsedFields.amount.toLocaleString()} to account ${parsedFields.creditorAccount}`,
        { creditorAccount: parsedFields.creditorAccount }
      );
    } else {
      this.emitEvent(
        txId,
        journeyId,
        'TRANSACTION_REJECTED',
        receiver!.name,
        'DESTINATION',
        'ERROR',
        `Destination bank rejected credit: ${creditResult.error} (${reasonCode})`,
        { reasonCode, creditorAccount: parsedFields.creditorAccount }
      );

      // Reverse debit at Originating Core
      this.bankCore.reverseDebit(
        parsedFields.debtorAccount,
        parsedFields.amount,
        endToEndId,
        uetr,
        creditResult.error || 'Destination credit failure'
      );
    }

    // J. Return pacs.002 to Switch
    this.emitEvent(
      txId,
      journeyId,
      'RESPONSE_CREATED',
      receiver!.name,
      'DESTINATION',
      creditResult.success ? 'SUCCESS' : 'WARNING',
      `Generated pacs.002.001.12 Payment Status Report: Status=${txStatus}`,
      { msgId: pacs002MsgId, txStatus, reasonCode }
    );

    this.emitEvent(
      txId,
      journeyId,
      'SWITCH_RECEIVED_RESPONSE',
      'CENTRAL_SWITCH',
      'SWITCHING',
      'INFO',
      `Switch received and correlated pacs.002 response for UETR: ${uetr}`,
      { txStatus }
    );

    // Store pacs.002 in Hybrid ISO Message Store
    const parsedPacs002 = parsePacs002Xml(pacs002Xml);
    this.persistHybridMessage({
      businessJourneyId: journeyId,
      transactionId: txId,
      messageType: 'pacs.002.001.12',
      messageVersion: '12',
      messageId: pacs002MsgId,
      originalMessageId: parsedFields.msgId,
      senderBic: receiverCode,
      receiverBic: senderCode,
      rawXml: pacs002Xml,
      parsedJson: parsedPacs002.rawParsed,
      uetr,
      endToEndId,
      instructionId,
      amount: parsedFields.amount,
      currency: parsedFields.currency,
      debtorAgent: senderCode,
      creditorAgent: receiverCode,
      settlementDate: parsedFields.settlementDate,
      schemaValidationStatus: 'PASS',
      businessValidationStatus: 'PASS',
      processingStatus: 'PROCESSED',
      validationResults: [
        { layer: 'XML_WELL_FORMED', status: 'PASS', summary: 'pacs.002 is well-formed' },
        { layer: 'XSD_SCHEMA', status: 'PASS', summary: 'pacs.002 XSD schema valid' },
      ],
    });

    // K. Delivery to Originating Bank Core & Customer Notification
    this.emitEvent(
      txId,
      journeyId,
      'ORIGINATING_BANK_RECEIVED_RESPONSE',
      sender!.name,
      'ORIGINATION',
      'INFO',
      `Originating Bank ${sender!.name} received final settlement status (${txStatus})`,
      { txStatus }
    );

    canonicalPayment.status = creditResult.success ? 'COMPLETED' : 'REJECTED';
    canonicalPayment.statusReasonCode = reasonCode;
    canonicalPayment.statusReasonDescription = reasonDesc;
    canonicalPayment.completedAt = new Date().toISOString();
    canonicalPayment.latencyMs = Date.now() - startTime;
    await syncPaymentToSupabase(canonicalPayment);

    this.emitEvent(
      txId,
      journeyId,
      'CUSTOMER_NOTIFIED',
      sender!.name,
      'NOTIFICATION',
      creditResult.success ? 'SUCCESS' : 'ERROR',
      `Customer banking channel updated: Transfer ${creditResult.success ? 'SUCCESSFUL' : 'FAILED'} (Latency: ${canonicalPayment.latencyMs}ms)`,
      { latencyMs: canonicalPayment.latencyMs, status: canonicalPayment.status }
    );

    return {
      success: creditResult.success,
      uetr,
      canonicalPayment,
      error: creditResult.error,
      reasonCode,
    };
  }

  private async rejectAtSwitch(
    input: any,
    validations: ValidationLayerResult[],
    stage: string,
    reason: string,
    reasonCode: string
  ): Promise<{ success: boolean; uetr: string; canonicalPayment: CanonicalPayment; error: string; reasonCode: string }> {
    const { txId, journeyId, uetr, instructionId, endToEndId, canonicalPayment, startTime, senderCode, receiverCode, rawXml } = input;

    canonicalPayment.status = 'REJECTED';
    canonicalPayment.statusReasonCode = reasonCode;
    canonicalPayment.statusReasonDescription = reason;
    canonicalPayment.completedAt = new Date().toISOString();
    canonicalPayment.latencyMs = Date.now() - startTime;
    await syncPaymentToSupabase(canonicalPayment);

    this.emitEvent(
      txId,
      journeyId,
      'VALIDATION_FAILED',
      'CENTRAL_SWITCH',
      'SWITCHING',
      'ERROR',
      `Switch validation failed at ${stage}: ${reason} (Reason Code: ${reasonCode})`,
      { reasonCode, validations }
    );

    // Reversal at Originating Bank Core
    const debtorAcc = canonicalPayment.debtor.accountNumber;
    this.bankCore.reverseDebit(debtorAcc, canonicalPayment.amount, endToEndId, uetr, reason);

    // Store failed message in store
    this.persistHybridMessage({
      businessJourneyId: journeyId,
      transactionId: txId,
      messageType: 'pacs.008.001.12',
      messageVersion: '12',
      messageId: `REJ-${Date.now()}`,
      senderBic: senderCode,
      receiverBic: receiverCode,
      rawXml,
      parsedJson: { error: reason },
      uetr,
      endToEndId,
      instructionId,
      amount: canonicalPayment.amount,
      currency: canonicalPayment.currency,
      debtorAgent: senderCode,
      creditorAgent: receiverCode,
      settlementDate: new Date().toISOString().split('T')[0],
      schemaValidationStatus: validations.find((v) => v.layer === 'XSD_SCHEMA')?.status || 'FAIL',
      businessValidationStatus: validations.find((v) => v.layer === 'SCHEME_RULES')?.status || 'FAIL',
      processingStatus: 'REJECTED',
      validationResults: validations,
    });

    return {
      success: false,
      uetr,
      canonicalPayment,
      error: reason,
      reasonCode,
    };
  }

  /**
   * Unified Engine Entry Point: Dispatches and processes any of the 17 domestic ISO 20022 messages
   */
  public async processGenericIsoMessage(rawXml: string, scenario: ScenarioType = 'SUCCESS'): Promise<GenericIsoProcessResult> {
    const wellFormedResult = validateXmlWellFormed(rawXml);
    if (wellFormedResult.status === 'FAIL') {
      return {
        success: false,
        messageType: 'UNKNOWN',
        parsed: {},
        error: wellFormedResult.message,
        reasonCode: 'GE01',
      };
    }

    const detectedType = detectIsoMessageType(rawXml);
    if (!detectedType) {
      return {
        success: false,
        messageType: 'UNKNOWN',
        parsed: {},
        error: 'Unrecognized ISO 20022 message schema or namespace',
        reasonCode: 'RC01',
      };
    }

    const journeyId = uuidv4();
    const nowIso = new Date().toISOString();

    // 1. pacs.008 Credit Transfer
    if (detectedType.startsWith('pacs.008')) {
      try {
        const parsed = parsePacs008Xml(rawXml);
        const txId = uuidv4();
        const uetr = parsed.uetr || uuidv4();
        const debtorParticipant = this.participants.get(parsed.debtorAgent) || Array.from(this.participants.values())[0];
        const creditorParticipant = this.participants.get(parsed.creditorAgent) || Array.from(this.participants.values())[1];

        const canonicalPayment: CanonicalPayment = {
          id: txId,
          businessJourneyId: journeyId,
          uetr,
          instructionId: parsed.instructionId || `INST-${Date.now()}`,
          endToEndId: parsed.endToEndId || `E2E-${Date.now()}`,
          txId,
          originatingInstitution: {
            id: debtorParticipant?.id || 'orig',
            code: debtorParticipant?.code || parsed.debtorAgent || 'NAIJANG',
            name: debtorParticipant?.name || 'Debtor Institution',
            routingCode: debtorParticipant?.routingCode || '011',
          },
          destinationInstitution: {
            id: creditorParticipant?.id || 'dest',
            code: creditorParticipant?.code || parsed.creditorAgent || 'METRNG',
            name: creditorParticipant?.name || 'Creditor Institution',
            routingCode: creditorParticipant?.routingCode || '033',
          },
          debtor: {
            name: parsed.debtorName || 'Unknown Debtor',
            accountNumber: parsed.debtorAccount || '',
          },
          creditor: {
            name: parsed.creditorName || 'Unknown Creditor',
            accountNumber: parsed.creditorAccount || '',
          },
          amount: parsed.amount,
          currency: parsed.currency || 'NGN',
          localInstrument: parsed.localInstrument || 'INST',
          chargeBearer: 'SLEV',
          remittanceInformation: parsed.remittanceInfo,
          status: 'PENDING',
          initiatedAt: nowIso,
        };
        this.transactions.unshift(canonicalPayment);

        const result = await this.processInboundPacs008({
          rawXml,
          senderCode: canonicalPayment.originatingInstitution.code,
          receiverCode: canonicalPayment.destinationInstitution.code,
          journeyId,
          uetr,
          instructionId: canonicalPayment.instructionId,
          endToEndId: canonicalPayment.endToEndId,
          txId,
          canonicalPayment,
          startTime: Date.now(),
          scenario,
        });

        const pacs002Msg = this.storedMessages.find((m) => m.businessJourneyId === journeyId && m.messageType.startsWith('pacs.002'));

        return {
          success: result.success,
          messageType: detectedType,
          parsed: result.canonicalPayment || {},
          responseXml: pacs002Msg?.rawXml,
          responseMessageType: 'pacs.002.001.12',
          error: result.error,
          reasonCode: result.reasonCode,
          transactionId: result.canonicalPayment?.id,
          uetr: result.uetr,
        };
      } catch (err: any) {
        return {
          success: false,
          messageType: detectedType,
          parsed: {},
          error: err.message,
          reasonCode: 'ED05',
        };
      }
    }

    // 2. acmt.023 Identification Verification Request
    if (detectedType.startsWith('acmt.023')) {
      try {
        const parsed = parseAcmt023Xml(rawXml);
        const destAccount = this.bankCore.getAccount(parsed.accountNumber);
        const isVerified = Boolean(destAccount && destAccount.status !== 'CLOSED');
        const verifiedName = destAccount?.accountName;
        const msg024Id = `MSG-024-${Date.now()}`;

        const responseXml = buildAcmt024Xml({
          msgId: msg024Id,
          creDtTm: nowIso,
          senderBic: parsed.receiverBic || '999057',
          receiverBic: parsed.senderBic || '999058',
          originalVerificationId: parsed.verificationId || parsed.msgId,
          isVerified,
          reasonCode: isVerified ? 'VALID' : 'AC01',
          reasonDescription: isVerified ? 'Account verified' : 'Account does not exist',
          accountNumber: parsed.accountNumber,
          verifiedPartyName: verifiedName || 'N/A',
          destinationBic: parsed.receiverBic || '999057',
        });

        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.verificationId || parsed.msgId,
          messageType: detectedType,
          messageVersion: '04',
          messageId: parsed.msgId,
          senderBic: parsed.senderBic || 'UNKNOWN',
          receiverBic: parsed.receiverBic || 'CENTRAL_SWITCH',
          rawXml,
          parsedJson: parsed,
          uetr: parsed.verificationId,
          endToEndId: parsed.verificationId,
          instructionId: parsed.msgId,
          debtorAgent: parsed.senderBic || '',
          creditorAgent: parsed.receiverBic || '',
          processingStatus: 'PROCESSED',
        });

        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.verificationId || parsed.msgId,
          messageType: 'acmt.024.001.04',
          messageVersion: '04',
          messageId: msg024Id,
          originalMessageId: parsed.msgId,
          senderBic: parsed.receiverBic || 'CENTRAL_SWITCH',
          receiverBic: parsed.senderBic || 'UNKNOWN',
          rawXml: responseXml,
          parsedJson: { isVerified, verifiedName, reasonCode: isVerified ? 'VALID' : 'AC01' },
          uetr: parsed.verificationId,
          endToEndId: parsed.verificationId,
          instructionId: msg024Id,
          debtorAgent: parsed.receiverBic || '',
          creditorAgent: parsed.senderBic || '',
          processingStatus: isVerified ? 'PROCESSED' : 'REJECTED',
        });

        return {
          success: isVerified,
          messageType: detectedType,
          parsed,
          responseXml,
          responseMessageType: 'acmt.024.001.04',
          responseParsed: { isVerified, verifiedName },
          error: isVerified ? undefined : 'Account does not exist at destination institution',
          reasonCode: isVerified ? 'VALID' : 'AC01',
          transactionId: parsed.verificationId,
        };
      } catch (err: any) {
        return { success: false, messageType: detectedType, parsed: {}, error: err.message, reasonCode: 'SY01' };
      }
    }

    // 3. acmt.024 Identification Verification Report
    if (detectedType.startsWith('acmt.024')) {
      try {
        const parsed = parseAcmt024Xml(rawXml);
        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.originalVerificationId || parsed.msgId,
          messageType: detectedType,
          messageVersion: '04',
          messageId: parsed.msgId,
          originalMessageId: parsed.originalVerificationId,
          senderBic: parsed.senderBic || 'DEST_BANK',
          receiverBic: parsed.receiverBic || 'ORIG_BANK',
          rawXml,
          parsedJson: parsed,
          uetr: parsed.originalVerificationId,
          endToEndId: parsed.originalVerificationId,
          instructionId: parsed.msgId,
          processingStatus: parsed.isVerified ? 'PROCESSED' : 'REJECTED',
        });
        return { success: true, messageType: detectedType, parsed };
      } catch (err: any) {
        return { success: false, messageType: detectedType, parsed: {}, error: err.message, reasonCode: 'SY01' };
      }
    }

    // 4. pacs.003 FI to FI Customer Direct Debit
    if (detectedType.startsWith('pacs.003')) {
      try {
        const parsed = parsePacs003Xml(rawXml);
        const txId = parsed.txId || `TX-DD-${Date.now()}`;
        const uetr = uuidv4();
        const debtorAcc = this.bankCore.getAccount(parsed.debtorAccount);
        const amount = parsed.amount || 0;

        let isSuccess = false;
        let reasonCode = 'ACSC';
        let reasonDesc = 'Direct debit accepted and settled';

        if (!debtorAcc) {
          reasonCode = 'AC01';
          reasonDesc = 'Debtor account does not exist';
        } else if (debtorAcc.status !== 'ACTIVE') {
          reasonCode = 'AC04';
          reasonDesc = `Debtor account is ${debtorAcc.status}`;
        } else if (debtorAcc.availableBalance < amount) {
          reasonCode = 'AM04';
          reasonDesc = 'Insufficient funds for direct debit collection';
        } else {
          // Execute debit from debtor
          this.bankCore.validateAndDebit(
            parsed.debtorAccount,
            amount,
            parsed.creditorName,
            parsed.creditorAccount,
            parsed.creditorBankBic || 'Creditor Bank',
            parsed.mandateId,
            txId
          );

          // Credit creditor account if exists in BankCore
          const creditorAcc = this.bankCore.getAccount(parsed.creditorAccount);
          if (creditorAcc) {
            this.bankCore.creditBeneficiaryAccount(
              parsed.creditorAccount,
              amount,
              parsed.debtorName,
              parsed.debtorAccount,
              parsed.debtorBankBic || 'Debtor Bank',
              parsed.mandateId,
              txId
            );
          }
          isSuccess = true;
        }

        const msg002Id = `MSG-002-DD-${Date.now()}`;
        const responseXml = buildPacs002Xml({
          msgId: msg002Id,
          creDtTm: nowIso,
          senderBic: 'CENTRAL_SWITCH',
          receiverBic: parsed.creditorBankBic || 'CREDITOR_BANK',
          originalMsgId: parsed.msgId,
          originalMsgNameId: 'pacs.003.001.11',
          originalEndToEndId: parsed.endToEndId || txId,
          originalTxId: txId,
          groupStatus: isSuccess ? 'ACSC' : 'RJCT',
          transactionStatus: isSuccess ? 'ACSC' : 'RJCT',
          reasonCode: isSuccess ? undefined : reasonCode,
          reasonDescription: reasonDesc,
          instgAgtMemberId: parsed.debtorBankMemberId || '044',
          instdAgtMemberId: parsed.creditorBankMemberId || '058',
        });

        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: txId,
          messageType: detectedType,
          messageVersion: '11',
          messageId: parsed.msgId,
          senderBic: parsed.creditorBankBic || 'CREDITOR_BANK',
          receiverBic: parsed.debtorBankBic || 'DEBTOR_BANK',
          rawXml,
          parsedJson: parsed,
          uetr,
          endToEndId: parsed.endToEndId || txId,
          instructionId: parsed.instructionId || txId,
          amount,
          currency: parsed.currency || 'NGN',
          debtorAgent: parsed.debtorBankBic,
          creditorAgent: parsed.creditorBankBic,
          processingStatus: isSuccess ? 'PROCESSED' : 'REJECTED',
        });

        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: txId,
          messageType: 'pacs.002.001.12',
          messageVersion: '12',
          messageId: msg002Id,
          originalMessageId: parsed.msgId,
          senderBic: 'CENTRAL_SWITCH',
          receiverBic: parsed.creditorBankBic || 'CREDITOR_BANK',
          rawXml: responseXml,
          parsedJson: { groupStatus: isSuccess ? 'ACSC' : 'RJCT', reasonCode, reasonDesc },
          uetr,
          endToEndId: parsed.endToEndId || txId,
          instructionId: msg002Id,
          amount,
          currency: parsed.currency || 'NGN',
          processingStatus: isSuccess ? 'PROCESSED' : 'REJECTED',
        });

        const canonicalPayment: CanonicalPayment = {
          id: txId,
          businessJourneyId: journeyId,
          uetr: parsed.endToEndId || uetr,
          instructionId: parsed.instructionId || txId,
          endToEndId: parsed.endToEndId || txId,
          txId,
          originatingInstitution: {
            id: 'creditor-bank',
            code: parsed.creditorBankBic || 'CREDITOR_BANK',
            name: parsed.creditorName || 'Creditor Bank',
            routingCode: parsed.creditorBankMemberId || '058',
          },
          destinationInstitution: {
            id: 'debtor-bank',
            code: parsed.debtorBankBic || 'DEBTOR_BANK',
            name: parsed.debtorName || 'Debtor Bank',
            routingCode: parsed.debtorBankMemberId || '044',
          },
          debtor: {
            name: parsed.debtorName || 'Customer Debtor',
            accountNumber: parsed.debtorAccount,
          },
          creditor: {
            name: parsed.creditorName || 'Creditor',
            accountNumber: parsed.creditorAccount,
          },
          amount,
          currency: parsed.currency || 'NGN',
          localInstrument: 'DD',
          chargeBearer: 'SLEV',
          remittanceInformation: parsed.narration || parsed.mandateId,
          status: isSuccess ? 'COMPLETED' : 'REJECTED',
          statusReasonCode: isSuccess ? undefined : reasonCode,
          statusReasonDescription: reasonDesc,
          initiatedAt: nowIso,
          completedAt: new Date().toISOString(),
          latencyMs: Date.now() - new Date(nowIso).getTime(),
        };
        this.transactions.unshift(canonicalPayment);
        syncPaymentToSupabase(canonicalPayment).catch(() => {});

        return {
          success: isSuccess,
          messageType: detectedType,
          parsed,
          responseXml,
          responseMessageType: 'pacs.002.001.12',
          responseParsed: { status: isSuccess ? 'ACSC' : 'RJCT', reasonCode, reasonDesc },
          error: isSuccess ? undefined : reasonDesc,
          reasonCode,
          transactionId: txId,
          uetr,
        };
      } catch (err: any) {
        return { success: false, messageType: detectedType, parsed: {}, error: err.message, reasonCode: 'SY01' };
      }
    }

    // 5. pacs.028 FI to FI Payment Status Request
    if (detectedType.startsWith('pacs.028')) {
      try {
        const parsed = parsePacs028Xml(rawXml);
        const origTxId = parsed.originalTxId;
        const origMsgId = parsed.originalMsgId;

        // Search in transactions or stored messages
        const foundTx = this.transactions.find(
          (t) => t.id === origTxId || t.instructionId === origTxId || t.endToEndId === origTxId || t.uetr === origTxId
        );
        const foundMsg = this.storedMessages.find(
          (m) => m.messageId === origMsgId || m.instructionId === origTxId || m.transactionId === origTxId
        );

        let groupStatus: 'ACSC' | 'RJCT' | 'ACTC' = 'RJCT';
        let txStatus: 'ACSC' | 'RJCT' | 'ACTC' = 'RJCT';
        let reasonCode: string | undefined = 'TXNF';
        let reasonDesc = 'Transaction not found';

        if (foundTx) {
          if (foundTx.status === 'COMPLETED') {
            groupStatus = 'ACSC';
            txStatus = 'ACSC';
            reasonCode = undefined;
            reasonDesc = 'Payment completed successfully';
          } else if (foundTx.status === 'REJECTED') {
            groupStatus = 'RJCT';
            txStatus = 'RJCT';
            reasonCode = foundTx.failureReasonCode || 'AM04';
            reasonDesc = foundTx.failureReason || 'Payment rejected';
          } else {
            groupStatus = 'ACTC';
            txStatus = 'ACTC';
            reasonCode = undefined;
            reasonDesc = 'Payment in clearing';
          }
        } else if (foundMsg) {
          if (foundMsg.processingStatus === 'PROCESSED') {
            groupStatus = 'ACSC';
            txStatus = 'ACSC';
            reasonCode = undefined;
            reasonDesc = 'Message processed successfully';
          } else {
            groupStatus = 'RJCT';
            txStatus = 'RJCT';
            reasonCode = 'RJCT';
            reasonDesc = 'Message rejected or unconfirmed';
          }
        }

        const msg002Id = `MSG-002-PSR-${Date.now()}`;
        const responseXml = buildPacs002Xml({
          msgId: msg002Id,
          creDtTm: nowIso,
          senderBic: 'CENTRAL_SWITCH',
          receiverBic: parsed.instgAgtMemberId || 'ORIG_BANK',
          originalMsgId: parsed.originalMsgId,
          originalMsgNameId: parsed.originalMsgNameId || 'pacs.008.001.12',
          originalEndToEndId: parsed.statusRequestId || origTxId,
          originalTxId: origTxId,
          groupStatus,
          transactionStatus: txStatus,
          reasonCode,
          reasonDescription: reasonDesc,
          instgAgtMemberId: parsed.instdAgtMemberId || '044',
          instdAgtMemberId: parsed.instgAgtMemberId || '058',
        });

        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: origTxId,
          messageType: detectedType,
          messageVersion: '06',
          messageId: parsed.msgId,
          originalMessageId: origMsgId,
          senderBic: parsed.instgAgtMemberId || 'ORIG_BANK',
          receiverBic: 'CENTRAL_SWITCH',
          rawXml,
          parsedJson: parsed,
          uetr: parsed.statusRequestId,
          endToEndId: origTxId,
          instructionId: parsed.statusRequestId,
          processingStatus: 'PROCESSED',
        });

        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: origTxId,
          messageType: 'pacs.002.001.12',
          messageVersion: '12',
          messageId: msg002Id,
          originalMessageId: parsed.msgId,
          senderBic: 'CENTRAL_SWITCH',
          receiverBic: parsed.instgAgtMemberId || 'ORIG_BANK',
          rawXml: responseXml,
          parsedJson: { groupStatus, txStatus, reasonCode, reasonDesc },
          uetr: parsed.statusRequestId,
          endToEndId: origTxId,
          instructionId: msg002Id,
          processingStatus: groupStatus === 'ACSC' ? 'PROCESSED' : 'REJECTED',
        });

        return {
          success: groupStatus === 'ACSC' || groupStatus === 'ACTC',
          messageType: detectedType,
          parsed,
          responseXml,
          responseMessageType: 'pacs.002.001.12',
          responseParsed: { groupStatus, txStatus, reasonCode, reasonDesc },
          reasonCode,
          error: groupStatus === 'RJCT' ? reasonDesc : undefined,
          transactionId: origTxId,
        };
      } catch (err: any) {
        return { success: false, messageType: detectedType, parsed: {}, error: err.message, reasonCode: 'SY01' };
      }
    }

    // 6. camt.060 Account Reporting Request
    if (detectedType.startsWith('camt.060')) {
      try {
        const parsed = parseCamt060Xml(rawXml);
        const account = this.bankCore.getAccount(parsed.accountNumber);
        if (!account) {
          return {
            success: false,
            messageType: detectedType,
            parsed,
            error: `Account ${parsed.accountNumber} not found for reporting`,
            reasonCode: 'AC01',
          };
        }

        const is052 = parsed.requestedMsgNameId?.toLowerCase().includes('052') || parsed.requestedMsgNameId === 'INTERIM';
        const targetType = is052 ? 'camt.052' : 'camt.053';
        const targetVersionType = is052 ? 'camt.052.001.12' : 'camt.053.001.12';
        const msgRptId = `MSG-${is052 ? '052' : '053'}-${Date.now()}`;

        const rawTransactions = this.bankCore.getAccountTransactions(parsed.accountNumber);
        const entries = (rawTransactions.length > 0 ? rawTransactions : [
          {
            amount: 50000,
            type: 'CREDIT' as const,
            timestamp: nowIso,
            reference: 'INTERBANK-CR-INITIAL',
          },
        ]).map((t) => ({
          amount: t.amount,
          indicator: (t.type === 'CREDIT' ? 'CRDT' : 'DBIT') as 'CRDT' | 'DBIT',
          bookingDate: t.timestamp.split('T')[0],
          valueDate: t.timestamp.split('T')[0],
          reference: t.reference,
        }));

        const responseXml = buildCamt052_053Xml(targetType, {
          msgId: msgRptId,
          creDtTm: nowIso,
          recipientName: 'Instructing Agent',
          originalQueryMsgId: parsed.msgId,
          originalQueryMsgNameId: 'camt.060.001.07',
          originalQueryCreDtTm: parsed.creDtTm,
          reportId: `RPT-${Date.now()}`,
          fromDateTime: nowIso,
          toDateTime: nowIso,
          accountNumber: parsed.accountNumber,
          currency: account.currency || 'NGN',
          ownerCode: account.institutionId,
          servicerMemberId: parsed.senderMemberId || '044',
          openingBalance: account.ledgerBalance,
          closingBalance: account.availableBalance,
          entries,
        });

        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.reportingReqId || parsed.msgId,
          messageType: detectedType,
          messageVersion: '07',
          messageId: parsed.msgId,
          senderBic: parsed.senderMemberId || '044',
          receiverBic: 'CENTRAL_SWITCH',
          rawXml,
          parsedJson: parsed,
          uetr: parsed.reportingReqId,
          endToEndId: parsed.reportingReqId,
          instructionId: parsed.msgId,
          processingStatus: 'PROCESSED',
        });

        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.reportingReqId || parsed.msgId,
          messageType: targetVersionType,
          messageVersion: '12',
          messageId: msgRptId,
          originalMessageId: parsed.msgId,
          senderBic: 'CENTRAL_SWITCH',
          receiverBic: parsed.senderMemberId || '044',
          rawXml: responseXml,
          parsedJson: { closingBalance: account.availableBalance, entriesCount: entries.length },
          uetr: parsed.reportingReqId,
          endToEndId: parsed.reportingReqId,
          instructionId: msgRptId,
          processingStatus: 'PROCESSED',
        });

        return {
          success: true,
          messageType: detectedType,
          parsed,
          responseXml,
          responseMessageType: targetVersionType,
          responseParsed: { accountNumber: parsed.accountNumber, balance: account.availableBalance, entriesCount: entries.length },
          transactionId: parsed.reportingReqId,
        };
      } catch (err: any) {
        return { success: false, messageType: detectedType, parsed: {}, error: err.message, reasonCode: 'SY01' };
      }
    }

    // 7. camt.052 or camt.053
    if (detectedType.startsWith('camt.052') || detectedType.startsWith('camt.053')) {
      try {
        const parsed = parseCamt052Or053Xml(rawXml);
        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.reportId || parsed.msgId,
          messageType: detectedType,
          messageVersion: '12',
          messageId: parsed.msgId,
          originalMessageId: parsed.originalQueryMsgId,
          senderBic: 'REPORTING_AGENT',
          receiverBic: 'CENTRAL_SWITCH',
          rawXml,
          parsedJson: parsed,
          uetr: parsed.reportId,
          endToEndId: parsed.reportId,
          instructionId: parsed.msgId,
          processingStatus: 'PROCESSED',
        });
        return { success: true, messageType: detectedType, parsed };
      } catch (err: any) {
        return { success: false, messageType: detectedType, parsed: {}, error: err.message, reasonCode: 'SY01' };
      }
    }

    // 8. pain.009 Mandate Initiation Request
    if (detectedType.startsWith('pain.009')) {
      try {
        const parsed = parseMandateXml(rawXml);
        const debtorAcc = this.bankCore.getAccount(parsed.debtorAccount);
        const isAccepted = Boolean(debtorAcc && debtorAcc.status === 'ACTIVE');
        const msg012Id = `MSG-012-${Date.now()}`;

        const responseXml = buildPain012Xml({
          msgId: msg012Id,
          creDtTm: nowIso,
          originalMsgId: parsed.msgId,
          originalCreDtTm: parsed.creDtTm,
          originalMandateId: parsed.mandateId || `MNDT-${Date.now()}`,
          accepted: isAccepted,
          reasonCode: isAccepted ? undefined : 'AC01',
          reasonDescription: isAccepted ? 'Mandate accepted by debtor agent' : 'Debtor account invalid or inactive',
          mandateDetails: {
            mandateId: parsed.mandateId,
            debtorName: parsed.debtorName,
            debtorAccount: parsed.debtorAccount,
            debtorBankBic: parsed.debtorBank || '999057',
            debtorBankMemberId: parsed.debtorBank || '999057',
            creditorName: parsed.creditorName,
            creditorAccount: parsed.creditorAccount,
            creditorBankBic: parsed.creditorBank || '999058',
            creditorBankMemberId: parsed.creditorBank || '999058',
            collectionAmount: parsed.amount || 50000,
          },
        });

        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.mandateId || parsed.msgId,
          messageType: detectedType,
          messageVersion: '08',
          messageId: parsed.msgId,
          senderBic: parsed.creditorBank || 'CREDITOR_BANK',
          receiverBic: parsed.debtorBank || 'DEBTOR_BANK',
          rawXml,
          parsedJson: parsed,
          uetr: parsed.mandateId,
          endToEndId: parsed.mandateId,
          instructionId: parsed.msgId,
          amount: parsed.amount,
          debtorAgent: parsed.debtorBank,
          creditorAgent: parsed.creditorBank,
          processingStatus: isAccepted ? 'PROCESSED' : 'REJECTED',
        });

        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.mandateId || parsed.msgId,
          messageType: 'pain.012.001.08',
          messageVersion: '08',
          messageId: msg012Id,
          originalMessageId: parsed.msgId,
          senderBic: parsed.debtorBank || 'DEBTOR_BANK',
          receiverBic: parsed.creditorBank || 'CREDITOR_BANK',
          rawXml: responseXml,
          parsedJson: { accepted: isAccepted },
          uetr: parsed.mandateId,
          endToEndId: parsed.mandateId,
          instructionId: msg012Id,
          processingStatus: isAccepted ? 'PROCESSED' : 'REJECTED',
        });

        return {
          success: isAccepted,
          messageType: detectedType,
          parsed,
          responseXml,
          responseMessageType: 'pain.012.001.08',
          responseParsed: { accepted: isAccepted },
          error: isAccepted ? undefined : 'Debtor account invalid or inactive',
          reasonCode: isAccepted ? 'ACCP' : 'AC01',
          transactionId: parsed.mandateId,
        };
      } catch (err: any) {
        return { success: false, messageType: detectedType, parsed: {}, error: err.message, reasonCode: 'SY01' };
      }
    }

    // 9. pain.010 Mandate Amendment or pain.011 Mandate Cancellation
    if (detectedType.startsWith('pain.010') || detectedType.startsWith('pain.011')) {
      try {
        const parsed = parseMandateXml(rawXml);
        const msg012Id = `MSG-012-${Date.now()}`;
        const isCancel = detectedType.startsWith('pain.011');

        const responseXml = buildPain012Xml({
          msgId: msg012Id,
          creDtTm: nowIso,
          originalMsgId: parsed.msgId,
          originalCreDtTm: parsed.creDtTm,
          originalMandateId: parsed.mandateId || `MNDT-${Date.now()}`,
          accepted: true,
          reasonDescription: isCancel ? 'Mandate cancellation processed' : 'Mandate amendment accepted',
          mandateDetails: {
            mandateId: parsed.mandateId,
            debtorName: parsed.debtorName,
            debtorAccount: parsed.debtorAccount,
            debtorBankMemberId: parsed.debtorBank || '999057',
            creditorName: parsed.creditorName,
            creditorAccount: parsed.creditorAccount,
            creditorBankMemberId: parsed.creditorBank || '999058',
          },
        });

        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.mandateId || parsed.msgId,
          messageType: detectedType,
          messageVersion: '08',
          messageId: parsed.msgId,
          senderBic: parsed.creditorBank || 'CREDITOR_BANK',
          receiverBic: parsed.debtorBank || 'DEBTOR_BANK',
          rawXml,
          parsedJson: parsed,
          uetr: parsed.mandateId,
          endToEndId: parsed.mandateId,
          instructionId: parsed.msgId,
          processingStatus: 'PROCESSED',
        });

        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.mandateId || parsed.msgId,
          messageType: 'pain.012.001.08',
          messageVersion: '08',
          messageId: msg012Id,
          originalMessageId: parsed.msgId,
          senderBic: parsed.debtorBank || 'DEBTOR_BANK',
          receiverBic: parsed.creditorBank || 'CREDITOR_BANK',
          rawXml: responseXml,
          parsedJson: { accepted: true },
          uetr: parsed.mandateId,
          endToEndId: parsed.mandateId,
          instructionId: msg012Id,
          processingStatus: 'PROCESSED',
        });

        return {
          success: true,
          messageType: detectedType,
          parsed,
          responseXml,
          responseMessageType: 'pain.012.001.08',
          responseParsed: { accepted: true },
          transactionId: parsed.mandateId,
        };
      } catch (err: any) {
        return { success: false, messageType: detectedType, parsed: {}, error: err.message, reasonCode: 'SY01' };
      }
    }

    // 10. pain.012 Mandate Acceptance Report
    if (detectedType.startsWith('pain.012')) {
      try {
        const parsed = parseMandateXml(rawXml);
        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.mandateId || parsed.msgId,
          messageType: detectedType,
          messageVersion: '08',
          messageId: parsed.msgId,
          originalMessageId: parsed.msgId,
          senderBic: parsed.debtorBank || 'DEBTOR_BANK',
          receiverBic: parsed.creditorBank || 'CREDITOR_BANK',
          rawXml,
          parsedJson: parsed,
          uetr: parsed.mandateId,
          endToEndId: parsed.mandateId,
          instructionId: parsed.msgId,
          processingStatus: parsed.accepted ? 'PROCESSED' : 'REJECTED',
        });
        return { success: true, messageType: detectedType, parsed };
      } catch (err: any) {
        return { success: false, messageType: detectedType, parsed: {}, error: err.message, reasonCode: 'SY01' };
      }
    }

    // 11. pain.013 Creditor Payment Activation Request (RTP)
    if (detectedType.startsWith('pain.013')) {
      try {
        const parsed = parseRtpXml(rawXml);
        const debtorAcc = this.bankCore.getAccount(parsed.debtorAccount);
        const isAccp = Boolean(debtorAcc && debtorAcc.status === 'ACTIVE');
        const msg014Id = `MSG-014-${Date.now()}`;

        const responseXml = buildPain014Xml({
          msgId: msg014Id,
          creDtTm: nowIso,
          initiatingPartyName: parsed.debtorName || 'Instructed Debtor',
          creditorName: parsed.creditorName,
          creditorAccount: parsed.creditorAccount,
          debtorName: parsed.debtorName,
          debtorAccount: parsed.debtorAccount,
          debtorBankBic: parsed.debtorBank || '999057',
          debtorBankMemberId: parsed.debtorBank || '999057',
          creditorBankBic: parsed.creditorBank || '999058',
          creditorBankMemberId: parsed.creditorBank || '999058',
          originalMsgId: parsed.msgId,
          originalCreDtTm: parsed.creDtTm,
          originalEndToEndId: parsed.endToEndId || parsed.msgId,
          status: isAccp ? 'ACCP' : 'RJCT',
          statusReasonCode: isAccp ? undefined : 'AC01',
        });

        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.endToEndId || parsed.msgId,
          messageType: detectedType,
          messageVersion: '11',
          messageId: parsed.msgId,
          senderBic: parsed.creditorBank || 'CREDITOR_BANK',
          receiverBic: parsed.debtorBank || 'DEBTOR_BANK',
          rawXml,
          parsedJson: parsed,
          uetr: parsed.endToEndId,
          endToEndId: parsed.endToEndId,
          instructionId: parsed.msgId,
          amount: parsed.amount,
          debtorAgent: parsed.debtorBank,
          creditorAgent: parsed.creditorBank,
          processingStatus: isAccp ? 'PROCESSED' : 'REJECTED',
        });

        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.endToEndId || parsed.msgId,
          messageType: 'pain.014.001.11',
          messageVersion: '11',
          messageId: msg014Id,
          originalMessageId: parsed.msgId,
          senderBic: parsed.debtorBank || 'DEBTOR_BANK',
          receiverBic: parsed.creditorBank || 'CREDITOR_BANK',
          rawXml: responseXml,
          parsedJson: { status: isAccp ? 'ACCP' : 'RJCT' },
          uetr: parsed.endToEndId,
          endToEndId: parsed.endToEndId,
          instructionId: msg014Id,
          processingStatus: isAccp ? 'PROCESSED' : 'REJECTED',
        });

        return {
          success: isAccp,
          messageType: detectedType,
          parsed,
          responseXml,
          responseMessageType: 'pain.014.001.11',
          responseParsed: { status: isAccp ? 'ACCP' : 'RJCT' },
          error: isAccp ? undefined : 'Debtor account not eligible for RTP',
          reasonCode: isAccp ? 'ACCP' : 'AC01',
          transactionId: parsed.endToEndId,
        };
      } catch (err: any) {
        return { success: false, messageType: detectedType, parsed: {}, error: err.message, reasonCode: 'SY01' };
      }
    }

    // 12. pain.014 Creditor Payment Activation Status Report
    if (detectedType.startsWith('pain.014')) {
      try {
        const parsed = parseRtpXml(rawXml);
        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.originalMsgId || parsed.msgId,
          messageType: detectedType,
          messageVersion: '11',
          messageId: parsed.msgId,
          originalMessageId: parsed.originalMsgId,
          senderBic: parsed.debtorBank || 'DEBTOR_BANK',
          receiverBic: parsed.creditorBank || 'CREDITOR_BANK',
          rawXml,
          parsedJson: parsed,
          uetr: parsed.endToEndId,
          endToEndId: parsed.endToEndId,
          instructionId: parsed.msgId,
          processingStatus: parsed.status === 'ACCP' ? 'PROCESSED' : 'REJECTED',
        });
        return { success: true, messageType: detectedType, parsed };
      } catch (err: any) {
        return { success: false, messageType: detectedType, parsed: {}, error: err.message, reasonCode: 'SY01' };
      }
    }

    // 13. pain.008 Customer Direct Debit Initiation (4-Stage Clearing Workflow: pain.008 -> pacs.003 -> pacs.002 -> pain.002)
    if (detectedType.startsWith('pain.008')) {
      try {
        const ddResult = await this.executeDirectDebitWorkflow(rawXml);
        return {
          success: ddResult.success,
          messageType: detectedType,
          parsed: parseDirectDebitXml(rawXml),
          responseXml: ddResult.pain002Xml,
          responseMessageType: 'pain.002.001.14',
          responseParsed: {
            status: ddResult.status,
            reasonCode: ddResult.reasonCode,
            reasonDesc: ddResult.reasonDescription,
            pacs003Xml: ddResult.pacs003Xml,
            pacs002Xml: ddResult.pacs002Xml,
          },
          error: ddResult.success ? undefined : ddResult.reasonDescription,
          reasonCode: ddResult.reasonCode,
          transactionId: ddResult.transactionId,
          uetr: ddResult.transactionId,
        };
      } catch (err: any) {
        return { success: false, messageType: detectedType, parsed: {}, error: err.message, reasonCode: 'SY01' };
      }
    }

    // 14. pain.002 Customer Payment Status Report
    if (detectedType.startsWith('pain.002')) {
      try {
        const parsed = parseDirectDebitXml(rawXml);
        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.originalMsgId || parsed.msgId,
          messageType: detectedType,
          messageVersion: '14',
          messageId: parsed.msgId,
          originalMessageId: parsed.originalMsgId,
          senderBic: 'CENTRAL_SWITCH',
          receiverBic: 'CLIENT',
          rawXml,
          parsedJson: parsed,
          uetr: parsed.msgId,
          endToEndId: parsed.msgId,
          instructionId: parsed.msgId,
          processingStatus: parsed.status === 'ACSC' ? 'PROCESSED' : 'REJECTED',
        });
        return { success: true, messageType: detectedType, parsed };
      } catch (err: any) {
        return { success: false, messageType: detectedType, parsed: {}, error: err.message, reasonCode: 'SY01' };
      }
    }

    // 15. pacs.002 Payment Status Report (inbound direct)
    if (detectedType.startsWith('pacs.002')) {
      try {
        const parsed = parsePacs002Xml(rawXml);
        this.persistHybridMessage({
          businessJourneyId: journeyId,
          transactionId: parsed.originalTxId || parsed.msgId,
          messageType: detectedType,
          messageVersion: '12',
          messageId: parsed.msgId,
          originalMessageId: parsed.originalMsgId,
          senderBic: parsed.senderBic || 'SETTLEMENT_CORE',
          receiverBic: parsed.receiverBic || 'SWITCH',
          rawXml,
          parsedJson: parsed,
          uetr: parsed.originalEndToEndId,
          endToEndId: parsed.originalEndToEndId,
          instructionId: parsed.msgId,
          processingStatus: parsed.groupStatus === 'ACSC' ? 'PROCESSED' : 'REJECTED',
        });
        return { success: true, messageType: detectedType, parsed };
      } catch (err: any) {
        return { success: false, messageType: detectedType, parsed: {}, error: err.message, reasonCode: 'SY01' };
      }
    }

    return {
      success: false,
      messageType: detectedType,
      parsed: {},
      error: `Unsupported ISO 20022 message type: ${detectedType}`,
      reasonCode: 'UNSP',
    };
  }

  /**
   * 4-Stage Canonical Direct Debit Clearing Workflow:
   * Leg 1: Initial Institution / Biller sends pain.008.001.11 to Pseudo Institution (Apex Direct Debit Gateway PSEUNG).
   * Leg 2: Pseudo Institution validates mandate reference, transforms instruction into pacs.003.001.11, and dispatches to Central Switch.
   * Leg 3: Central Switch validates and routes pacs.003 to Customer Bank (Debtor Bank). Customer Bank debits customer (1010-CUST-DEP) and credits settlement clearing (1020-SETTLE-CLR), returning pacs.002.001.12 (ACSC / RJCT).
   * Leg 4: Central Switch routes pacs.002 to Pseudo Institution. If ACSC, Pseudo Institution debits settlement clearing (1020-SETTLE-CLR) and credits Biller account (1010-CUST-DEP), then transforms pacs.002 into pain.002.001.14 and delivers it to the initial institution.
   */
  public async executeDirectDebitWorkflow(input: string | {
    rawXml?: string;
    debtorAccount?: string;
    creditorAccount?: string;
    amount?: number;
    mandateId?: string;
    debtorBankCode?: string;
    billerBankCode?: string;
  }): Promise<DirectDebitWorkflowResult> {
    const nowIso = new Date().toISOString();
    const journeyId = uuidv4();
    const txId = uuidv4();
    const events: TransactionEvent[] = [];
    const messages: IsoStoredMessage[] = [];

    // Parse or build pain.008 XML
    let pain008Xml: string;
    let parsedPain008: Record<string, any>;

    if (typeof input === 'string') {
      pain008Xml = input;
      parsedPain008 = parseDirectDebitXml(pain008Xml);
    } else if (input.rawXml) {
      pain008Xml = input.rawXml;
      parsedPain008 = parseDirectDebitXml(pain008Xml);
    } else {
      const debtorAccNum = input.debtorAccount || '0112345678';
      const creditorAccNum = input.creditorAccount || '9981122334';
      const amt = input.amount || 25000;
      const mndtId = input.mandateId || `MNDT-${Date.now()}`;
      const pain008MsgId = `MSG-008-${Date.now()}`;
      const endToEndId = `E2E-DD-${Date.now()}`;
      const instrId = `INST-008-${Date.now()}`;

      const debtorAcc = this.bankCore.getAccount(debtorAccNum);
      const creditorAcc = this.bankCore.getAccount(creditorAccNum);

      pain008Xml = buildPain008Xml({
        msgId: pain008MsgId,
        creDtTm: nowIso,
        initiatingPartyName: creditorAcc?.accountName || 'PowerGrid Utilities',
        paymentInfoId: `PMT-${Date.now()}`,
        amount: amt,
        currency: 'NGN',
        requestedCollectionDate: nowIso.split('T')[0],
        creditorName: creditorAcc?.accountName || 'PowerGrid Utilities',
        creditorAccount: creditorAccNum,
        creditorBankBic: 'PSEUNG',
        creditorBankMemberId: '998',
        instructionId: instrId,
        endToEndId,
        mandateId: mndtId,
        debtorBankBic: input.debtorBankCode || 'NAIJANG',
        debtorBankMemberId: '011',
        debtorName: debtorAcc?.accountName || 'Fred Okon',
        debtorAccount: debtorAccNum,
        remittanceInfo: 'Monthly Utility Collection',
      });
      parsedPain008 = parseDirectDebitXml(pain008Xml);
    }

    const amount = parsedPain008.amount || 0;
    const currency = parsedPain008.currency || 'NGN';
    const debtorAccount = parsedPain008.debtorAccount || '';
    const creditorAccount = parsedPain008.creditorAccount || '';
    const mandateId = parsedPain008.mandateId || `MNDT-${Date.now()}`;
    const endToEndId = parsedPain008.endToEndId || `E2E-DD-${Date.now()}`;
    const instructionId = parsedPain008.instructionId || `INST-DD-${Date.now()}`;

    // Participants lookup
    const pseudoParticipant = this.participants.get('PSEUNG') || this.participants.get('pseudo-inst') || {
      id: 'pseudo-inst',
      code: 'PSEUNG',
      name: 'Apex Direct Debit Gateway (Pseudo Inst)',
      routingCode: '998',
      status: 'ONLINE' as const,
      supportedMessages: [],
      capabilities: { instantTransfer: true, directDebit: true, requestToPay: true, camtReporting: true },
      brandColor: '#0284C7',
      accentColor: '#38BDF8',
      endpoint: '/api/banks/PSEUNG/inbound',
    };
    const debtorBankCode = parsedPain008.debtorBank || parsedPain008.debtorBankBic || 'NAIJANG';
    const debtorParticipant = this.participants.get(debtorBankCode) || Array.from(this.participants.values())[0];
    const billerBankCode = parsedPain008.creditorBank || parsedPain008.creditorBankBic || 'PSEUNG';
    const billerParticipant = this.participants.get(billerBankCode) || pseudoParticipant;

    // -----------------------------------------------------------------
    // LEG 1: Initial Institution / Biller sends pain.008 to Pseudo Institution
    // -----------------------------------------------------------------
    const pain008Stored = this.persistHybridMessage({
      businessJourneyId: journeyId,
      transactionId: txId,
      messageType: 'pain.008.001.11',
      messageVersion: '11',
      messageId: parsedPain008.msgId,
      senderBic: billerParticipant.code,
      receiverBic: pseudoParticipant.code,
      rawXml: pain008Xml,
      parsedJson: parsedPain008.rawParsed || parsedPain008,
      uetr: endToEndId,
      endToEndId,
      instructionId,
      amount,
      currency,
      debtorAgent: debtorParticipant.code,
      creditorAgent: pseudoParticipant.code,
      settlementDate: nowIso.split('T')[0],
      schemaValidationStatus: 'PASS',
      businessValidationStatus: 'PASS',
      processingStatus: 'PROCESSED',
      validationResults: [{ layer: 'XML_WELL_FORMED', status: 'PASS', summary: 'pain.008 Customer Direct Debit Initiation well-formed' }],
    });
    messages.push(pain008Stored);

    const ev1 = this.emitEvent(
      txId,
      journeyId,
      'CUSTOMER_INITIATED',
      billerParticipant.name,
      'ORIGINATION',
      'INFO',
      `Initial institution dispatched pain.008.001.11 Customer Direct Debit Initiation (₦${amount.toLocaleString()}) to Pseudo Institution (${pseudoParticipant.name})`,
      { msgId: parsedPain008.msgId, mandateId, endToEndId, amount }
    );
    events.push(ev1);

    // -----------------------------------------------------------------
    // LEG 2: Pseudo Institution generates pacs.003 and dispatches to Central Switch
    // -----------------------------------------------------------------
    const pacs003MsgId = `MSG-003-${Date.now()}`;
    const pacs003Xml = buildPacs003Xml({
      msgId: pacs003MsgId,
      creDtTm: nowIso,
      amount,
      currency,
      settlementDate: nowIso.split('T')[0],
      creditorBankBic: pseudoParticipant.code,
      creditorBankMemberId: pseudoParticipant.routingCode,
      debtorBankBic: debtorParticipant.code,
      debtorBankMemberId: debtorParticipant.routingCode,
      instructionId,
      endToEndId,
      txId,
      mandateId,
      creditorName: parsedPain008.creditorName || 'PowerGrid Collections',
      creditorAccount: creditorAccount,
      debtorName: parsedPain008.debtorName || 'Customer Debtor',
      debtorAccount: debtorAccount,
      narration: parsedPain008.remittanceInfo || 'Direct Debit Collection',
    });

    const parsedPacs003 = parsePacs003Xml(pacs003Xml);
    const pacs003Stored = this.persistHybridMessage({
      businessJourneyId: journeyId,
      transactionId: txId,
      messageType: 'pacs.003.001.11',
      messageVersion: '11',
      messageId: pacs003MsgId,
      originalMessageId: parsedPain008.msgId,
      senderBic: pseudoParticipant.code,
      receiverBic: debtorParticipant.code,
      rawXml: pacs003Xml,
      parsedJson: parsedPacs003.rawParsed || parsedPacs003,
      uetr: endToEndId,
      endToEndId,
      instructionId,
      amount,
      currency,
      debtorAgent: debtorParticipant.code,
      creditorAgent: pseudoParticipant.code,
      settlementDate: nowIso.split('T')[0],
      schemaValidationStatus: 'PASS',
      businessValidationStatus: 'PASS',
      processingStatus: 'FORWARDED',
      validationResults: [{ layer: 'XML_WELL_FORMED', status: 'PASS', summary: 'pacs.003 FI to FI Customer Direct Debit well-formed' }],
    });
    messages.push(pacs003Stored);

    const ev2 = this.emitEvent(
      txId,
      journeyId,
      'ISO_MESSAGE_CREATED',
      pseudoParticipant.name,
      'ORIGINATION',
      'INFO',
      `Pseudo Institution translated pain.008 into pacs.003.001.11 FI to FI Direct Debit and dispatched to Central Switch`,
      { pacs003MsgId, mandateId, endToEndId }
    );
    events.push(ev2);

    const ev3 = this.emitEvent(
      txId,
      journeyId,
      'SWITCH_RECEIVED',
      'CENTRAL_SWITCH',
      'SWITCHING',
      'INFO',
      `Central Switch received inbound pacs.003 from Pseudo Institution (${pseudoParticipant.code}) destined for ${debtorParticipant.name}`,
      { byteSize: pacs003Xml.length }
    );
    events.push(ev3);

    const ev4 = this.emitEvent(
      txId,
      journeyId,
      'ROUTE_IDENTIFIED',
      'CENTRAL_SWITCH',
      'SWITCHING',
      'SUCCESS',
      `Central Switch identified route to Customer Bank: ${debtorParticipant.name} (${debtorParticipant.code})`,
      { destination: debtorParticipant.code }
    );
    events.push(ev4);

    // -----------------------------------------------------------------
    // LEG 3: Customer Bank receives pacs.003, executes debit, and responds with pacs.002
    // -----------------------------------------------------------------
    const ev5 = this.emitEvent(
      txId,
      journeyId,
      'DESTINATION_BANK_RECEIVED',
      debtorParticipant.name,
      'DESTINATION',
      'INFO',
      `Customer Bank (${debtorParticipant.name}) received pacs.003 direct debit instruction for account ${debtorAccount}`
    );
    events.push(ev5);

    const debtorAcc = this.bankCore.getAccount(debtorAccount);
    let isSuccess = false;
    let txStatus: 'ACSC' | 'RJCT' = 'RJCT';
    let reasonCode: string | undefined = undefined;
    let reasonDesc = '';

    if (!debtorAcc) {
      reasonCode = 'AC01';
      reasonDesc = `Customer account ${debtorAccount} does not exist at ${debtorParticipant.name}`;
    } else if (debtorAcc.status !== 'ACTIVE') {
      reasonCode = 'AC04';
      reasonDesc = `Customer account is ${debtorAcc.status}`;
    } else if (debtorAcc.availableBalance < amount) {
      reasonCode = 'AM04';
      reasonDesc = `Insufficient funds: Required ₦${amount.toLocaleString()}, Available ₦${debtorAcc.availableBalance.toLocaleString()}`;
    } else {
      const debitRes = this.bankCore.validateAndDebit(
        debtorAccount,
        amount,
        parsedPain008.creditorName || 'PowerGrid Utilities',
        creditorAccount,
        pseudoParticipant.code,
        mandateId,
        txId
      );

      if (debitRes.success) {
        isSuccess = true;
        txStatus = 'ACSC';
        reasonDesc = 'Direct debit processed and settled successfully';

        const ev6 = this.emitEvent(
          txId,
          journeyId,
          'ACCOUNT_CREDITED',
          debtorParticipant.name,
          'DESTINATION',
          'SUCCESS',
          `Customer Bank debited ₦${amount.toLocaleString()} from ${debtorAccount} (Balance: ₦${debtorAcc.availableBalance.toLocaleString()})`,
          { balanceRemaining: debtorAcc.availableBalance }
        );
        events.push(ev6);
      } else {
        reasonCode = debitRes.errorCode || 'AM04';
        reasonDesc = debitRes.error || 'Debit execution failed';
      }
    }

    if (!isSuccess) {
      const evReject = this.emitEvent(
        txId,
        journeyId,
        'TRANSACTION_REJECTED',
        debtorParticipant.name,
        'DESTINATION',
        'ERROR',
        `Customer Bank rejected direct debit instruction: [${reasonCode}] ${reasonDesc}`,
        { reasonCode, reasonDesc }
      );
      events.push(evReject);
    }

    const pacs002MsgId = `MSG-002-DD-${Date.now()}`;
    const pacs002Xml = buildPacs002Xml({
      msgId: pacs002MsgId,
      creDtTm: nowIso,
      originalMsgId: pacs003MsgId,
      originalMsgNameId: 'pacs.003.001.11',
      originalInstructionId: instructionId,
      originalEndToEndId: endToEndId,
      originalTxId: txId,
      transactionStatus: txStatus,
      statusReasonCode: isSuccess ? undefined : reasonCode,
      statusReasonDescription: reasonDesc,
      amount,
      currency,
      settlementDate: nowIso.split('T')[0],
      senderBic: debtorParticipant.code,
      receiverBic: pseudoParticipant.code,
    });

    const parsedPacs002 = parsePacs002Xml(pacs002Xml);
    const pacs002Stored = this.persistHybridMessage({
      businessJourneyId: journeyId,
      transactionId: txId,
      messageType: 'pacs.002.001.12',
      messageVersion: '12',
      messageId: pacs002MsgId,
      originalMessageId: pacs003MsgId,
      senderBic: debtorParticipant.code,
      receiverBic: pseudoParticipant.code,
      rawXml: pacs002Xml,
      parsedJson: parsedPacs002.rawParsed || parsedPacs002,
      uetr: endToEndId,
      endToEndId,
      instructionId,
      amount,
      currency,
      debtorAgent: debtorParticipant.code,
      creditorAgent: pseudoParticipant.code,
      settlementDate: nowIso.split('T')[0],
      schemaValidationStatus: 'PASS',
      businessValidationStatus: 'PASS',
      processingStatus: isSuccess ? 'PROCESSED' : 'REJECTED',
      validationResults: [{ layer: 'XML_WELL_FORMED', status: 'PASS', summary: 'pacs.002 Payment Status Report well-formed' }],
    });
    messages.push(pacs002Stored);

    const ev7 = this.emitEvent(
      txId,
      journeyId,
      'RESPONSE_CREATED',
      debtorParticipant.name,
      'DESTINATION',
      isSuccess ? 'SUCCESS' : 'WARNING',
      `Customer Bank generated pacs.002.001.12 Payment Status Report: Status=${txStatus}${reasonCode ? ` Reason=${reasonCode}` : ''}`,
      { pacs002MsgId, status: txStatus, reasonCode }
    );
    events.push(ev7);

    const ev8 = this.emitEvent(
      txId,
      journeyId,
      'SWITCH_RECEIVED_RESPONSE',
      'CENTRAL_SWITCH',
      'SWITCHING',
      'INFO',
      `Central Switch received and forwarded pacs.002 response back to Pseudo Institution (${pseudoParticipant.name})`,
      { status: txStatus }
    );
    events.push(ev8);

    // -----------------------------------------------------------------
    // LEG 4: Pseudo Institution receives pacs.002, credits biller, and converts to pain.002
    // -----------------------------------------------------------------
    if (isSuccess) {
      const billerAcc = this.bankCore.getAccount(creditorAccount);
      if (billerAcc) {
        this.bankCore.creditBeneficiaryAccount(
          creditorAccount,
          amount,
          parsedPain008.debtorName || 'Customer Debtor',
          debtorAccount,
          debtorParticipant.code,
          mandateId,
          txId
        );
      }
    }

    const pain002MsgId = `MSG-002-CST-${Date.now()}`;
    const pain002Xml = buildPain002Xml({
      msgId: pain002MsgId,
      creDtTm: nowIso,
      initiatingPartyName: parsedPain008.initiatingPartyName || parsedPain008.creditorName || 'PowerGrid Utilities',
      originalMsgId: parsedPain008.msgId,
      originalMsgNameId: 'pain.008.001.11',
      groupStatus: txStatus,
      statusId: `STS-${Date.now()}`,
      originalEndToEndId: endToEndId,
      transactionStatus: txStatus,
      reasonCode: isSuccess ? undefined : reasonCode,
      reasonDescription: reasonDesc,
    });

    const parsedPain002 = parseDirectDebitXml(pain002Xml);
    const pain002Stored = this.persistHybridMessage({
      businessJourneyId: journeyId,
      transactionId: txId,
      messageType: 'pain.002.001.14',
      messageVersion: '14',
      messageId: pain002MsgId,
      originalMessageId: parsedPain008.msgId,
      senderBic: pseudoParticipant.code,
      receiverBic: billerParticipant.code,
      rawXml: pain002Xml,
      parsedJson: parsedPain002.rawParsed || parsedPain002,
      uetr: endToEndId,
      endToEndId,
      instructionId,
      amount,
      currency,
      debtorAgent: debtorParticipant.code,
      creditorAgent: pseudoParticipant.code,
      settlementDate: nowIso.split('T')[0],
      schemaValidationStatus: 'PASS',
      businessValidationStatus: 'PASS',
      processingStatus: isSuccess ? 'PROCESSED' : 'REJECTED',
      validationResults: [{ layer: 'XML_WELL_FORMED', status: 'PASS', summary: 'pain.002 Customer Payment Status Report well-formed' }],
    });
    messages.push(pain002Stored);

    const ev9 = this.emitEvent(
      txId,
      journeyId,
      'ORIGINATING_BANK_RECEIVED_RESPONSE',
      pseudoParticipant.name,
      'ORIGINATION',
      isSuccess ? 'SUCCESS' : 'WARNING',
      `Pseudo Institution processed pacs.002, settled biller ledger, and converted to pain.002.001.14 for initial institution`,
      { pain002MsgId, status: txStatus }
    );
    events.push(ev9);

    const ev10 = this.emitEvent(
      txId,
      journeyId,
      'CUSTOMER_NOTIFIED',
      billerParticipant.name,
      'NOTIFICATION',
      isSuccess ? 'SUCCESS' : 'ERROR',
      `Initial institution received pain.002.001.14: Direct Debit collection ${isSuccess ? 'SUCCESSFUL (ACSC)' : `REJECTED (${reasonCode})`}`,
      { status: txStatus, reasonCode, reasonDesc }
    );
    events.push(ev10);

    const canonicalPayment: CanonicalPayment = {
      id: txId,
      businessJourneyId: journeyId,
      uetr: endToEndId,
      instructionId,
      endToEndId,
      txId,
      originatingInstitution: {
        id: billerParticipant.id,
        code: billerParticipant.code,
        name: billerParticipant.name,
        routingCode: billerParticipant.routingCode,
      },
      destinationInstitution: {
        id: debtorParticipant.id,
        code: debtorParticipant.code,
        name: debtorParticipant.name,
        routingCode: debtorParticipant.routingCode,
      },
      debtor: {
        name: parsedPain008.debtorName || debtorAcc?.accountName || 'Customer Debtor',
        accountNumber: debtorAccount,
      },
      creditor: {
        name: parsedPain008.initiatingPartyName || parsedPain008.creditorName || 'PowerGrid Utilities',
        accountNumber: creditorAccount,
      },
      amount,
      currency,
      localInstrument: 'DD',
      chargeBearer: 'SLEV',
      remittanceInformation: `Direct Debit Mandate: ${mandateId}`,
      status: isSuccess ? 'COMPLETED' : 'REJECTED',
      statusReasonCode: isSuccess ? undefined : reasonCode,
      statusReasonDescription: reasonDesc,
      initiatedAt: nowIso,
      completedAt: new Date().toISOString(),
      latencyMs: Date.now() - new Date(nowIso).getTime(),
    };
    this.transactions.unshift(canonicalPayment);
    syncPaymentToSupabase(canonicalPayment).catch(() => {});

    return {
      success: isSuccess,
      businessJourneyId: journeyId,
      transactionId: txId,
      status: txStatus,
      reasonCode: isSuccess ? undefined : reasonCode,
      reasonDescription: reasonDesc,
      amount,
      currency,
      debtorAccount,
      creditorAccount,
      mandateId,
      pain008Xml,
      pacs003Xml,
      pacs002Xml,
      pain002Xml,
      events,
      messages,
    };
  }

  private persistHybridMessage(msgData: Partial<IsoStoredMessage>): IsoStoredMessage {
    const stored: IsoStoredMessage = {
      id: uuidv4(),
      businessJourneyId: msgData.businessJourneyId!,
      transactionId: msgData.transactionId!,
      messageType: msgData.messageType!,
      messageVersion: msgData.messageVersion || '10',
      messageId: msgData.messageId!,
      originalMessageId: msgData.originalMessageId,
      senderBic: msgData.senderBic!,
      receiverBic: msgData.receiverBic!,
      rawXml: msgData.rawXml!,
      parsedJson: msgData.parsedJson || {},
      uetr: msgData.uetr!,
      endToEndId: msgData.endToEndId!,
      instructionId: msgData.instructionId!,
      amount: msgData.amount || 0,
      currency: msgData.currency || 'NGN',
      debtorAgent: msgData.debtorAgent || '',
      creditorAgent: msgData.creditorAgent || '',
      settlementDate: msgData.settlementDate || '',
      schemaValidationStatus: msgData.schemaValidationStatus || 'PASS',
      businessValidationStatus: msgData.businessValidationStatus || 'PASS',
      processingStatus: msgData.processingStatus || 'PROCESSED',
      validationResults: msgData.validationResults || [],
      receivedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    };

    this.storedMessages.unshift(stored);
    syncIsoMessageToSupabase(stored).catch(() => {});
    return stored;
  }
}
