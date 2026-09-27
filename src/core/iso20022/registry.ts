export type IsoBusinessDomain = 'PAYMENTS' | 'ACCOUNT_MANAGEMENT' | 'CASH_MANAGEMENT' | 'MANDATES';

export interface IsoMessageDefinition {
  messageType: string;               // e.g. 'pacs.008'
  messageVersion: string;            // e.g. '001.12'
  fullIdentifier: string;            // e.g. 'pacs.008.001.12'
  businessName: string;              // e.g. 'Financial Institutional Customer Credit Transfer'
  businessDomain: IsoBusinessDomain;
  schemaLocation: string;            // e.g. 'urn:iso:std:iso:20022:tech:xsd:pacs.008.001.12'
  direction: 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';
  requestResponseRelationship?: {
    isRequest: boolean;
    pairedResponseType?: string;     // e.g. 'pacs.002.001.12'
    pairedRequestType?: string;      // e.g. 'pacs.008.001.12'
  };
  active: boolean;
  phase: number;
  description: string;
}

export const ISO_MESSAGE_REGISTRY: IsoMessageDefinition[] = [
  // --- 1. Account Management / Identification Verification (Name Enquiry) ---
  {
    messageType: 'acmt.023',
    messageVersion: '001.04',
    fullIdentifier: 'acmt.023.001.04',
    businessName: 'Identification Verification Request (Name Enquiry)',
    businessDomain: 'ACCOUNT_MANAGEMENT',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:acmt.023.001.04',
    direction: 'OUTBOUND',
    requestResponseRelationship: {
      isRequest: true,
      pairedResponseType: 'acmt.024.001.04',
    },
    active: true,
    phase: 1,
    description: 'Mandatory domestic clearing pre-requisite querying destination core for account existence, ClrSysMmbId, and verified holder name.',
  },
  {
    messageType: 'acmt.024',
    messageVersion: '001.04',
    fullIdentifier: 'acmt.024.001.04',
    businessName: 'Identification Verification Report',
    businessDomain: 'ACCOUNT_MANAGEMENT',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:acmt.024.001.04',
    direction: 'INBOUND',
    requestResponseRelationship: {
      isRequest: false,
      pairedRequestType: 'acmt.023.001.04',
    },
    active: true,
    phase: 1,
    description: 'Destination core verification report with XML Digital Signature and Supplementary Data (BVN, AccountTier, RiskRating).',
  },

  // --- 2. Primary Credit Clearing & Status Reporting ---
  {
    messageType: 'pacs.008',
    messageVersion: '001.12',
    fullIdentifier: 'pacs.008.001.12',
    businessName: 'FI to FI Customer Credit Transfer',
    businessDomain: 'PAYMENTS',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:pacs.008.001.12',
    direction: 'OUTBOUND',
    requestResponseRelationship: {
      isRequest: true,
      pairedResponseType: 'pacs.002.001.12',
    },
    active: true,
    phase: 2,
    description: 'Instant credit transfer with RTNS channel, CTAA local instrument, and Supplementary Data (Debtor/Creditor BVN, AccountTier, Location, RiskRating).',
  },
  {
    messageType: 'pacs.002',
    messageVersion: '001.12',
    fullIdentifier: 'pacs.002.001.12',
    businessName: 'Payment Status Report (FI to FI)',
    businessDomain: 'PAYMENTS',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:pacs.002.001.12',
    direction: 'INBOUND',
    requestResponseRelationship: {
      isRequest: false,
      pairedRequestType: 'pacs.008.001.12',
    },
    active: true,
    phase: 2,
    description: 'Interbank status report confirming ACSC (Settlement Completed), ACTC (Accepted), or RJCT (Rejected with reason code).',
  },
  {
    messageType: 'pacs.028',
    messageVersion: '001.06',
    fullIdentifier: 'pacs.028.001.06',
    businessName: 'FI to FI Payment Status Request',
    businessDomain: 'PAYMENTS',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:pacs.028.001.06',
    direction: 'OUTBOUND',
    requestResponseRelationship: {
      isRequest: true,
      pairedResponseType: 'pacs.002.001.12',
    },
    active: true,
    phase: 2,
    description: 'Payment status enquiry investigating status of an earlier pacs.008 transaction by OrgnlMsgId / OrgnlTxId.',
  },

  // --- 3. Direct Debit Clearing & Execution ---
  {
    messageType: 'pacs.003',
    messageVersion: '001.11',
    fullIdentifier: 'pacs.003.001.11',
    businessName: 'FI to FI Customer Direct Debit',
    businessDomain: 'PAYMENTS',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:pacs.003.001.11',
    direction: 'OUTBOUND',
    requestResponseRelationship: {
      isRequest: true,
      pairedResponseType: 'pacs.002.001.12',
    },
    active: true,
    phase: 3,
    description: 'Interbank direct debit clearing instruction routed through Central Switch backed by a registered mandate.',
  },
  {
    messageType: 'pain.008',
    messageVersion: '001.11',
    fullIdentifier: 'pain.008.001.11',
    businessName: 'Customer Direct Debit Initiation',
    businessDomain: 'PAYMENTS',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:pain.008.001.11',
    direction: 'OUTBOUND',
    requestResponseRelationship: {
      isRequest: true,
      pairedResponseType: 'pain.002.001.14',
    },
    active: true,
    phase: 3,
    description: 'Customer initiates direct debit collection with service level NURG and NPSDD local instrument.',
  },
  {
    messageType: 'pain.002',
    messageVersion: '001.14',
    fullIdentifier: 'pain.002.001.14',
    businessName: 'Customer Payment Status Report',
    businessDomain: 'PAYMENTS',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:pain.002.001.14',
    direction: 'INBOUND',
    requestResponseRelationship: {
      isRequest: false,
      pairedRequestType: 'pain.008.001.11',
    },
    active: true,
    phase: 3,
    description: 'Customer payment status report acknowledging direct debit initiation status.',
  },

  // --- 4. Cash Management, Statements & Account Reporting ---
  {
    messageType: 'camt.060',
    messageVersion: '001.07',
    fullIdentifier: 'camt.060.001.07',
    businessName: 'Account Reporting Request',
    businessDomain: 'CASH_MANAGEMENT',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:camt.060.001.07',
    direction: 'OUTBOUND',
    requestResponseRelationship: {
      isRequest: true,
      pairedResponseType: 'camt.052.001.12',
    },
    active: true,
    phase: 4,
    description: 'Requests account balances or statements over the central switch with ReqdMsgNmId STATEMENT and date filters.',
  },
  {
    messageType: 'camt.052',
    messageVersion: '001.12',
    fullIdentifier: 'camt.052.001.12',
    businessName: 'Bank-to-Customer Account Report (Intraday)',
    businessDomain: 'CASH_MANAGEMENT',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:camt.052.001.12',
    direction: 'INBOUND',
    requestResponseRelationship: {
      isRequest: false,
      pairedRequestType: 'camt.060.001.07',
    },
    active: true,
    phase: 4,
    description: 'Intra-day interim account balance report with CLRG balances and CRDT/DBIT entry items.',
  },
  {
    messageType: 'camt.053',
    messageVersion: '001.12',
    fullIdentifier: 'camt.053.001.12',
    businessName: 'Bank-to-Customer Statement (End-of-Day)',
    businessDomain: 'CASH_MANAGEMENT',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:camt.053.001.12',
    direction: 'INBOUND',
    requestResponseRelationship: {
      isRequest: false,
      pairedRequestType: 'camt.060.001.07',
    },
    active: true,
    phase: 4,
    description: 'Official end-of-day bank statement with opening OPBD and closing CLBD balances and booked transactions.',
  },

  // --- 5. Request-to-Pay (RTP) ---
  {
    messageType: 'pain.013',
    messageVersion: '001.11',
    fullIdentifier: 'pain.013.001.11',
    businessName: 'Creditor Payment Activation Request (Request to Pay)',
    businessDomain: 'PAYMENTS',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:pain.013.001.11',
    direction: 'OUTBOUND',
    requestResponseRelationship: {
      isRequest: true,
      pairedResponseType: 'pain.014.001.11',
    },
    active: true,
    phase: 5,
    description: 'Creditor requests payment activation from debtor customer with Supplementary Data (BVN, Location).',
  },
  {
    messageType: 'pain.014',
    messageVersion: '001.11',
    fullIdentifier: 'pain.014.001.11',
    businessName: 'Creditor Payment Activation Request Status Report',
    businessDomain: 'PAYMENTS',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:pain.014.001.11',
    direction: 'INBOUND',
    requestResponseRelationship: {
      isRequest: false,
      pairedRequestType: 'pain.013.001.11',
    },
    active: true,
    phase: 5,
    description: 'Debtor responds to payment activation request with ACCP (Accepted) or RJCT.',
  },

  // --- 6. Direct Debit Mandate Lifecycle ---
  {
    messageType: 'pain.009',
    messageVersion: '001.08',
    fullIdentifier: 'pain.009.001.08',
    businessName: 'Mandate Initiation Request',
    businessDomain: 'MANDATES',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:pain.009.001.08',
    direction: 'OUTBOUND',
    requestResponseRelationship: {
      isRequest: true,
      pairedResponseType: 'pain.012.001.08',
    },
    active: true,
    phase: 6,
    description: 'Initiates a direct debit mandate with recurring frequency, collection amount limit, and biometric metadata.',
  },
  {
    messageType: 'pain.012',
    messageVersion: '001.08',
    fullIdentifier: 'pain.012.001.08',
    businessName: 'Mandate Acceptance Report',
    businessDomain: 'MANDATES',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:pain.012.001.08',
    direction: 'INBOUND',
    requestResponseRelationship: {
      isRequest: false,
      pairedRequestType: 'pain.009.001.08',
    },
    active: true,
    phase: 6,
    description: 'Reports acceptance (Accptd: true) or rejection of a mandate instruction.',
  },
  {
    messageType: 'pain.010',
    messageVersion: '001.08',
    fullIdentifier: 'pain.010.001.08',
    businessName: 'Mandate Amendment Request',
    businessDomain: 'MANDATES',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:pain.010.001.08',
    direction: 'OUTBOUND',
    requestResponseRelationship: {
      isRequest: true,
      pairedResponseType: 'pain.012.001.08',
    },
    active: true,
    phase: 6,
    description: 'Amends parameters of an active mandate (reason AC04, updated debtor account).',
  },
  {
    messageType: 'pain.011',
    messageVersion: '001.08',
    fullIdentifier: 'pain.011.001.08',
    businessName: 'Mandate Cancellation Request',
    businessDomain: 'MANDATES',
    schemaLocation: 'urn:iso:std:iso:20022:tech:xsd:pain.011.001.08',
    direction: 'OUTBOUND',
    requestResponseRelationship: {
      isRequest: true,
      pairedResponseType: 'pain.012.001.08',
    },
    active: true,
    phase: 6,
    description: 'Cancels an existing mandate with reason code (e.g. AC04, AC06, MS02).',
  },
];

export function getMessageDefinition(messageTypeOrFull: string): IsoMessageDefinition | undefined {
  return ISO_MESSAGE_REGISTRY.find(
    (m) => m.fullIdentifier === messageTypeOrFull || m.messageType === messageTypeOrFull
  );
}

export function getAllSupportedMessageTypes(): string[] {
  return ISO_MESSAGE_REGISTRY.filter((m) => m.active).map((m) => m.fullIdentifier);
}

export const ISO_REGISTRY = ISO_MESSAGE_REGISTRY;
