export type ParticipantStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'SUSPENDED';

export interface Participant {
  id: string;
  code: string;           // e.g. NAIJANG, METRNG
  name: string;           // e.g. Naija Bank
  routingCode: string;    // e.g. 011, 033
  status: ParticipantStatus;
  supportedMessages: string[];
  capabilities: {
    instantTransfer: boolean;
    directDebit: boolean;
    requestToPay: boolean;
    camtReporting: boolean;
  };
  brandColor: string;
  accentColor: string;
  logoUrl?: string;
  endpoint: string;
}

export interface Customer {
  id: string;
  institutionId: string;
  fullName: string;
  email: string;
  phone: string;
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface Account {
  id: string;
  institutionId: string;
  customerId: string;
  accountNumber: string;
  accountName: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'CORPORATE';
  availableBalance: number;
  ledgerBalance: number;
  currency: string;
  status: 'ACTIVE' | 'DORMANT' | 'FROZEN' | 'CLOSED';
}

export type LedgerAccountType = 'ASSET' | 'LIABILITY' | 'EQUITY';

export interface LedgerAccount {
  id: string;
  institutionId: string;
  code: string;           // e.g. 1010-CUST-DEPOSITS, 1020-SETTLEMENT-CLEARING
  name: string;
  type: LedgerAccountType;
  balance: number;
  currency: string;
}

export interface JournalLine {
  id: string;
  ledgerAccountId: string;
  ledgerAccountName: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
}

export interface JournalEntry {
  id: string;
  institutionId: string;
  transactionId: string;
  reference: string;
  description: string;
  postedAt: string;
  lines: JournalLine[];
}

export type PaymentStatus = 
  | 'PENDING'
  | 'VALIDATED'
  | 'SWITCH_RECEIVED'
  | 'SWITCH_ROUTED'
  | 'CREDITED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'TIMEOUT';

export interface CanonicalPayment {
  id: string;
  businessJourneyId: string;
  uetr: string;
  instructionId: string;
  endToEndId: string;
  txId: string;

  originatingInstitution: {
    id: string;
    code: string;
    name: string;
    routingCode: string;
  };

  destinationInstitution: {
    id: string;
    code: string;
    name: string;
    routingCode: string;
  };

  debtor: {
    name: string;
    accountNumber: string;
    accountType?: string;
  };

  creditor: {
    name: string;
    accountNumber: string;
    accountType?: string;
  };

  amount: number;
  currency: string;
  localInstrument: string;
  chargeBearer: 'SLEV' | 'SHAR' | 'DEBT' | 'CRED';
  categoryPurpose?: string;
  remittanceInformation?: string;

  status: PaymentStatus;
  messageType?: string;
  statusReasonCode?: string;      // e.g. AC01, AM04, DS04
  statusReasonDescription?: string;
  failureReasonCode?: string;
  failureReason?: string;
  
  initiatedAt: string;
  completedAt?: string;
  latencyMs?: number;
}

export interface ValidationLayerResult {
  layer: 'XML_WELL_FORMED' | 'XSD_SCHEMA' | 'SCHEME_RULES' | 'PARTICIPANT_VALIDATION' | 'DUPLICATE_CHECK' | 'ROUTING';
  status: 'PASS' | 'FAIL';
  summary: string;
  message?: string;
  details?: Record<string, any>;
}

export interface IsoStoredMessage {
  id: string;
  businessJourneyId: string;
  transactionId: string;
  messageType: string;
  messageVersion: string;
  messageId: string;
  originalMessageId?: string;
  senderBic: string;
  receiverBic: string;
  
  // Hybrid Storage components
  rawXml: string;
  parsedJson: Record<string, any>;

  // Normalised / Queryable fields
  uetr: string;
  endToEndId: string;
  instructionId: string;
  amount: number;
  currency: string;
  debtorAgent: string;
  creditorAgent: string;
  settlementDate: string;

  schemaValidationStatus: 'PASS' | 'FAIL';
  businessValidationStatus: 'PASS' | 'FAIL';
  processingStatus: 'PROCESSED' | 'REJECTED' | 'FORWARDED';
  
  validationResults: ValidationLayerResult[];

  receivedAt: string;
  processedAt?: string;
}

export interface TransactionEvent {
  id: string;
  transactionId: string;
  businessJourneyId: string;
  eventCode: 
    | 'CUSTOMER_INITIATED'
    | 'IDENTIFICATION_VERIFICATION_REQUESTED' // acmt.023
    | 'IDENTIFICATION_VERIFIED'              // acmt.024
    | 'IDENTIFICATION_FAILED'
    | 'BANK_VALIDATED'
    | 'ISO_MESSAGE_CREATED'
    | 'SWITCH_RECEIVED'
    | 'SCHEMA_VALIDATED'
    | 'BUSINESS_RULES_VALIDATED'
    | 'ROUTE_IDENTIFIED'
    | 'DESTINATION_BANK_RECEIVED'
    | 'ACCOUNT_CREDITED'
    | 'RESPONSE_CREATED'
    | 'SWITCH_RECEIVED_RESPONSE'
    | 'ORIGINATING_BANK_RECEIVED_RESPONSE'
    | 'CUSTOMER_NOTIFIED'
    | 'TRANSACTION_REJECTED'
    | 'VALIDATION_FAILED'
    | 'DUPLICATE_DETECTED'
    | 'SWITCH_TIMEOUT';
  actor: string; // 'BANK_A' | 'SWITCH' | 'BANK_C' | etc.
  stage: 'ORIGINATION' | 'SWITCHING' | 'DESTINATION' | 'SETTLEMENT' | 'NOTIFICATION';
  status: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  description: string;
  details?: Record<string, any>;
  timestamp: string;
  sequenceNo: number;
}

export type ScenarioType = 
  | 'SUCCESS'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_ACCOUNT'
  | 'DEST_OFFLINE'
  | 'DUPLICATE_REPLAY'
  | 'MALFORMED_XML'
  | 'SCHEME_RULE_FAILURE'
  | 'SWITCH_TIMEOUT'
  | 'ACMT_TIMEOUT';

export interface SimulationScenario {
  id: ScenarioType;
  name: string;
  description: string;
  expectedOutcome: 'SUCCESS' | 'REJECTED' | 'FAILED';
  statusCode?: string;
}
