import { XMLParser } from 'fast-xml-parser';

export interface Pacs002Payload {
  msgId: string;
  creDtTm: string;
  initiatingParty?: string;
  instgAgtBic?: string;
  instgAgtMemberId?: string;
  instdAgtBic?: string;
  instdAgtMemberId?: string;
  senderBic?: string;
  receiverBic?: string;
  originalMsgId: string;
  originalMsgNameId?: string; // e.g. pacs.008.001.12
  originalCreDtTm?: string;
  grpStatus?: string; // ACSC, ACTC, RJCT
  groupStatus?: string;
  statusId?: string; // e.g. AUTH
  originalInstructionId?: string;
  originalEndToEndId: string;
  originalTxId: string;
  originalUetr?: string;
  transactionStatus: 'ACSC' | 'ACTC' | 'RJCT' | 'PDNG';
  statusReasonCode?: string; // AC01, AM04, DS04, AM05, etc.
  reasonCode?: string;
  statusReasonDescription?: string;
  reasonDescription?: string;
  amount?: number;
  currency?: string;
  settlementDate?: string;
  debtorName?: string;
  debtorAgentBic?: string;
  creditorName?: string;
  creditorAgentBic?: string;
}

export function buildPacs002Xml(payload: Pacs002Payload): string {
  const grpSts = payload.grpStatus || payload.groupStatus || (payload.transactionStatus === 'RJCT' ? 'RJCT' : 'ACSC');
  const stsId = payload.statusId || (payload.transactionStatus === 'RJCT' ? 'RJCT' : 'AUTH');
  const instgMmb = payload.instgAgtMemberId || payload.creditorAgentBic || '999012';
  const instdMmb = payload.instdAgtMemberId || payload.debtorAgentBic || '999999';
  const origMsgNm = payload.originalMsgNameId || 'pacs.008.001.12';
  const origInstrId = payload.originalInstructionId || payload.originalTxId || payload.originalEndToEndId || 'INSTR-001';
  const sttlmDt = payload.settlementDate || new Date().toISOString().split('T')[0];
  const rsnCode = payload.statusReasonCode || payload.reasonCode;
  const rsnDesc = payload.statusReasonDescription || payload.reasonDescription || 'Transaction Status Information';

  const reasonBlock = rsnCode
    ? `
            <StsRsnInf>
                <Rsn>
                    <Cd>${rsnCode}</Cd>
                </Rsn>
                <AddtlInf>${rsnDesc}</AddtlInf>
            </StsRsnInf>`
    : '';

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.12">
    <FIToFIPmtStsRpt>
        <GrpHdr>
            <MsgId>${payload.msgId}</MsgId>
            <CreDtTm>${payload.creDtTm}</CreDtTm>
            <InstgAgt>
                <FinInstnId>
                    <BICFI>${payload.instgAgtBic || instgMmb}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${instgMmb}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </InstgAgt>
            <InstdAgt>
                <FinInstnId>
                    <BICFI>${payload.instdAgtBic || instdMmb}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${instdMmb}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </InstdAgt>
        </GrpHdr>
        <OrgnlGrpInfAndSts>
            <OrgnlMsgId>${payload.originalMsgId}</OrgnlMsgId>
            <OrgnlMsgNmId>${origMsgNm}</OrgnlMsgNmId>
            <OrgnlCreDtTm>${payload.originalCreDtTm || payload.creDtTm}</OrgnlCreDtTm>
            <GrpSts>${grpSts}</GrpSts>
        </OrgnlGrpInfAndSts>
        <TxInfAndSts>
            <StsId>${stsId}</StsId>
            <OrgnlInstrId>${origInstrId}</OrgnlInstrId>
            <OrgnlEndToEndId>${payload.originalEndToEndId}</OrgnlEndToEndId>
            <OrgnlTxId>${payload.originalTxId}</OrgnlTxId>
            ${payload.originalUetr ? `<OrgnlUETR>${payload.originalUetr}</OrgnlUETR>` : ''}
            <TxSts>${payload.transactionStatus}</TxSts>${reasonBlock}
            <InstgAgt>
                <FinInstnId>
                    <BICFI>${payload.instgAgtBic || instgMmb}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${instgMmb}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </InstgAgt>
            <InstdAgt>
                <FinInstnId>
                    <BICFI>${payload.instdAgtBic || instdMmb}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${instdMmb}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </InstdAgt>
            <OrgnlTxRef>
                <IntrBkSttlmDt>${sttlmDt}</IntrBkSttlmDt>
                ${payload.amount ? `<IntrBkSttlmAmt Ccy="${payload.currency || 'NGN'}">${payload.amount.toFixed(2)}</IntrBkSttlmAmt>` : ''}
            </OrgnlTxRef>
        </TxInfAndSts>
    </FIToFIPmtStsRpt>
</ns2:Document>`;

  return xml.trim();
}

export function parsePacs002Xml(xml: string): Record<string, any> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false,
  });

  const parsed = parser.parse(xml);
  const doc = parsed['ns2:Document'] || parsed.Document || parsed;
  const pmtSts = doc.FIToFIPmtStsRpt;
  if (!pmtSts) {
    throw new Error('Invalid pacs.002 XML: FIToFIPmtStsRpt block missing');
  }

  const grpHdr = pmtSts.GrpHdr || {};
  const orgnlGrp = pmtSts.OrgnlGrpInfAndSts || {};
  const txInf = pmtSts.TxInfAndSts || {};
  const orgnlRef = txInf.OrgnlTxRef || {};
  const sttlmAmt = orgnlRef.IntrBkSttlmAmt;

  return {
    rawParsed: parsed,
    msgId: grpHdr.MsgId,
    creDtTm: grpHdr.CreDtTm,
    originalMsgId: orgnlGrp.OrgnlMsgId,
    originalMsgNameId: orgnlGrp.OrgnlMsgNmId,
    grpStatus: orgnlGrp.GrpSts,
    statusId: txInf.StsId,
    originalInstructionId: txInf.OrgnlInstrId,
    originalEndToEndId: txInf.OrgnlEndToEndId,
    originalTxId: txInf.OrgnlTxId,
    originalUetr: txInf.OrgnlUETR,
    transactionStatus: txInf.TxSts || orgnlGrp.GrpSts,
    statusReasonCode: txInf.StsRsnInf?.Rsn?.Cd,
    statusReasonDescription: txInf.StsRsnInf?.AddtlInf,
    amount: typeof sttlmAmt === 'object' ? parseFloat(sttlmAmt['#text'] || 0) : parseFloat(sttlmAmt || 0),
    currency: typeof sttlmAmt === 'object' ? sttlmAmt['@_Ccy'] : 'NGN',
    settlementDate: orgnlRef.IntrBkSttlmDt,
  };
}
