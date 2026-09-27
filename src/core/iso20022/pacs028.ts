import { XMLParser } from 'fast-xml-parser';

export interface Pacs028Payload {
  msgId: string;
  creDtTm: string;
  instgAgtBic?: string;
  instgAgtMemberId: string;
  originalMsgId: string;
  originalMsgNameId?: string; // e.g. pacs.008.001.12
  originalCreDtTm?: string;
  statusRequestId: string;
  originalTxId: string;
  instdAgtBic?: string;
  instdAgtMemberId: string;
  settlementDate?: string;
}

export function buildPacs028Xml(payload: Pacs028Payload): string {
  const origMsgNm = payload.originalMsgNameId || 'pacs.008.001.12';
  const sttlmDt = payload.settlementDate || new Date().toISOString().split('T')[0];

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:pacs.028.001.06">
    <FIToFIPmtStsReq>
        <GrpHdr>
            <MsgId>${payload.msgId}</MsgId>
            <CreDtTm>${payload.creDtTm}</CreDtTm>
            <InstgAgt>
                <FinInstnId>
                    <ClrSysMmbId>
                        <MmbId>${payload.instgAgtMemberId}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </InstgAgt>
        </GrpHdr>
        <OrgnlGrpInf>
            <OrgnlMsgId>${payload.originalMsgId}</OrgnlMsgId>
            <OrgnlMsgNmId>${origMsgNm}</OrgnlMsgNmId>
            <OrgnlCreDtTm>${payload.originalCreDtTm || payload.creDtTm}</OrgnlCreDtTm>
        </OrgnlGrpInf>
        <TxInf>
            <StsReqId>${payload.statusRequestId}</StsReqId>
            <OrgnlTxId>${payload.originalTxId}</OrgnlTxId>
            <InstgAgt>
                <FinInstnId>
                    <BICFI>${payload.instgAgtBic || payload.instgAgtMemberId}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${payload.instgAgtMemberId}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </InstgAgt>
            <InstdAgt>
                <FinInstnId>
                    <BICFI>${payload.instdAgtBic || payload.instdAgtMemberId}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${payload.instdAgtMemberId}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </InstdAgt>
            <OrgnlTxRef>
                <IntrBkSttlmDt>${sttlmDt}</IntrBkSttlmDt>
            </OrgnlTxRef>
        </TxInf>
    </FIToFIPmtStsReq>
</ns2:Document>`;

  return xml.trim();
}

export function parsePacs028Xml(xml: string): Record<string, any> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false,
  });

  const parsed = parser.parse(xml);
  const doc = parsed['ns2:Document'] || parsed.Document || parsed;
  const root = doc.FIToFIPmtStsReq;
  if (!root) {
    throw new Error('Invalid pacs.028 XML: FIToFIPmtStsReq block missing');
  }

  const grpHdr = root.GrpHdr || {};
  const orgnlGrp = root.OrgnlGrpInf || {};
  const txInf = Array.isArray(root.TxInf) ? root.TxInf[0] : (root.TxInf || {});

  return {
    rawParsed: parsed,
    msgId: grpHdr.MsgId,
    creDtTm: grpHdr.CreDtTm,
    originalMsgId: orgnlGrp.OrgnlMsgId,
    originalMsgNameId: orgnlGrp.OrgnlMsgNmId,
    originalCreDtTm: orgnlGrp.OrgnlCreDtTm,
    statusRequestId: txInf.StsReqId,
    originalTxId: txInf.OrgnlTxId,
    instgAgtMemberId: txInf.InstgAgt?.FinInstnId?.ClrSysMmbId?.MmbId || grpHdr.InstgAgt?.FinInstnId?.ClrSysMmbId?.MmbId,
    instdAgtMemberId: txInf.InstdAgt?.FinInstnId?.ClrSysMmbId?.MmbId,
    settlementDate: txInf.OrgnlTxRef?.IntrBkSttlmDt,
  };
}
