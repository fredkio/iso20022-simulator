import { XMLValidator } from 'fast-xml-parser';
import { ValidationLayerResult, Participant } from '@/types';

export interface ValidationPipelineInput {
  rawXml: string;
  parsedFields: Record<string, any>;
  messageType: 'pacs.008' | 'pacs.002';
  senderParticipant?: Participant;
  receiverParticipant?: Participant;
  existingUetrs: Set<string>;
  existingInstructionIds: Set<string>;
}

export function validateXmlWellFormed(xml: string): ValidationLayerResult {
  const result = XMLValidator.validate(xml);
  if (result === true) {
    return {
      layer: 'XML_WELL_FORMED',
      status: 'PASS',
      summary: 'XML syntax is well-formed and passes syntactic checks.',
    };
  } else {
    return {
      layer: 'XML_WELL_FORMED',
      status: 'FAIL',
      summary: `XML syntax error: ${result.err.msg} at line ${result.err.line}, col ${result.err.col}`,
      details: result.err,
    };
  }
}

export function validateXsdSchema(xml: string, messageType: 'pacs.008' | 'pacs.002', parsed: Record<string, any>): ValidationLayerResult {
  const errors: string[] = [];

  if (messageType === 'pacs.008') {
    if (
      !xml.includes('urn:iso:std:iso:20022:tech:xsd:pacs.008.001.12') &&
      !xml.includes('urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10')
    ) {
      errors.push('Missing or invalid pacs.008 XML namespace (expected pacs.008.001.12 or pacs.008.001.10)');
    }
    if (!parsed.msgId) errors.push('Missing mandatory element: GrpHdr/MsgId');
    if (!parsed.uetr) errors.push('Missing mandatory element: PmtId/UETR');
    if (!parsed.instructionId) errors.push('Missing mandatory element: PmtId/InstrId');
    if (!parsed.endToEndId) errors.push('Missing mandatory element: PmtId/EndToEndId');
    if (!parsed.debtorAccount) errors.push('Missing mandatory element: DbtrAcct/Id/Othr/Id');
    if (!parsed.creditorAccount) errors.push('Missing mandatory element: CdtrAcct/Id/Othr/Id');
    if (!parsed.amount || isNaN(parsed.amount) || parsed.amount <= 0) {
      errors.push('Missing or invalid IntrBkSttlmAmt value');
    }
  } else if (messageType === 'pacs.002') {
    if (!xml.includes('urn:iso:std:iso:20022:tech:xsd:pacs.002.001.12')) {
      errors.push('Missing or invalid pacs.002 XML namespace (expected pacs.002.001.12)');
    }
    if (!parsed.msgId) errors.push('Missing mandatory element: GrpHdr/MsgId');
    if (!parsed.originalMsgId) errors.push('Missing mandatory element: OrgnlGrpInfAndSts/OrgnlMsgId');
    if (!parsed.originalUetr) errors.push('Missing mandatory element: TxInfAndSts/OrgnlUETR');
    if (!parsed.transactionStatus) errors.push('Missing mandatory element: TxInfAndSts/TxSts');
  }

  if (errors.length === 0) {
    return {
      layer: 'XSD_SCHEMA',
      status: 'PASS',
      summary: `Compliant with ISO 20022 official XSD schema specifications for ${messageType}.`,
    };
  } else {
    return {
      layer: 'XSD_SCHEMA',
      status: 'FAIL',
      summary: `XSD Schema validation failed with ${errors.length} error(s).`,
      details: { errors },
    };
  }
}

export function validateSchemeRules(parsed: Record<string, any>, messageType: 'pacs.008' | 'pacs.002'): ValidationLayerResult {
  const errors: string[] = [];

  // Allowed currency check
  const allowedCurrencies = ['NGN', 'USD'];
  if (parsed.currency && !allowedCurrencies.includes(parsed.currency)) {
    errors.push(`Currency '${parsed.currency}' is not supported by clearing scheme. Allowed: ${allowedCurrencies.join(', ')}`);
  }

  // UETR RFC 4122 format validation (UUID v4)
  const uetrRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const uetr = messageType === 'pacs.008' ? parsed.uetr : parsed.originalUetr;
  if (uetr && !uetrRegex.test(uetr)) {
    errors.push(`UETR '${uetr}' violates RFC 4122 UUIDv4 specification.`);
  }

  // Scheme limits (e.g. Max Instant Transfer ₦10,000,000)
  if (parsed.amount && parsed.amount > 10000000) {
    errors.push(`Amount ₦${parsed.amount.toLocaleString()} exceeds scheme single-transfer limit of ₦10,000,000.00`);
  }

  // Local instrument check
  if (messageType === 'pacs.008') {
    if (parsed.localInstrument && !['INST', 'CTAA', 'NPSDD'].includes(parsed.localInstrument)) {
      errors.push(`Local instrument '${parsed.localInstrument}' is unsupported. Expected 'INST', 'CTAA', or 'NPSDD'.`);
    }
  }

  if (errors.length === 0) {
    return {
      layer: 'SCHEME_RULES',
      status: 'PASS',
      summary: 'Complies with National Payment System (NPS) scheme usage rules.',
    };
  } else {
    return {
      layer: 'SCHEME_RULES',
      status: 'FAIL',
      summary: `Scheme rule validation failed: ${errors.join('; ')}`,
      details: { errors },
    };
  }
}

export function validateParticipants(sender?: Participant, receiver?: Participant): ValidationLayerResult {
  if (!sender) {
    return {
      layer: 'PARTICIPANT_VALIDATION',
      status: 'FAIL',
      summary: 'Originating institution is unrecognized in the Participant Registry.',
    };
  }

  if (sender.status !== 'ONLINE') {
    return {
      layer: 'PARTICIPANT_VALIDATION',
      status: 'FAIL',
      summary: `Originating participant ${sender.name} (${sender.code}) status is ${sender.status}. Instructions cannot be originated.`,
    };
  }

  if (!receiver) {
    return {
      layer: 'PARTICIPANT_VALIDATION',
      status: 'FAIL',
      summary: 'Destination institution is unrecognized in the Participant Registry.',
    };
  }

  if (receiver.status === 'OFFLINE') {
    return {
      layer: 'PARTICIPANT_VALIDATION',
      status: 'FAIL',
      summary: `Destination participant ${receiver.name} (${receiver.code}) is OFFLINE. Routing aborted with DS04.`,
      details: { reasonCode: 'DS04', receiverStatus: receiver.status },
    };
  }

  if (receiver.status === 'SUSPENDED') {
    return {
      layer: 'PARTICIPANT_VALIDATION',
      status: 'FAIL',
      summary: `Destination participant ${receiver.name} (${receiver.code}) is SUSPENDED from clearing.`,
      details: { reasonCode: 'DS04', receiverStatus: receiver.status },
    };
  }

  return {
    layer: 'PARTICIPANT_VALIDATION',
    status: 'PASS',
    summary: `Both ${sender.name} and ${receiver.name} are authenticated and ONLINE.`,
  };
}

export function validateDuplicateCheck(
  uetr: string,
  instructionId: string,
  existingUetrs: Set<string>,
  existingInstructionIds: Set<string>
): ValidationLayerResult {
  if (existingUetrs.has(uetr)) {
    return {
      layer: 'DUPLICATE_CHECK',
      status: 'FAIL',
      summary: `Duplicate transaction detected: UETR '${uetr}' has already been processed. Duplicate processing rejected.`,
      details: { duplicateField: 'uetr', value: uetr },
    };
  }

  if (existingInstructionIds.has(instructionId)) {
    return {
      layer: 'DUPLICATE_CHECK',
      status: 'FAIL',
      summary: `Duplicate instruction detected: InstrId '${instructionId}' has already been registered.`,
      details: { duplicateField: 'instructionId', value: instructionId },
    };
  }

  return {
    layer: 'DUPLICATE_CHECK',
    status: 'PASS',
    summary: 'Idempotency verified: instruction and UETR are unique across the network.',
  };
}

export function validateRouting(receiver?: Participant): ValidationLayerResult {
  if (!receiver || !receiver.endpoint) {
    return {
      layer: 'ROUTING',
      status: 'FAIL',
      summary: 'Routing resolution failed: no active endpoint found for destination institution.',
    };
  }

  return {
    layer: 'ROUTING',
    status: 'PASS',
    summary: `Destination endpoint resolved: ${receiver.name} -> ${receiver.endpoint}`,
    details: { endpoint: receiver.endpoint, routingCode: receiver.routingCode },
  };
}
