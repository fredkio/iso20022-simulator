import { XMLParser } from 'fast-xml-parser';

export interface Pain013Payload {
  msgId: string;
  creDtTm: string;
  initiatingPartyName: string;
  initiatingPartyOrgId: string;
  paymentInfoId: string;
  requiredExecutionDateTime: string;
  debtorName: string;
  debtorAccount: string;
  debtorBankBic: string;
  debtorBankMemberId: string;
  creditorName: string;
  creditorAccount: string;
  creditorBankBic: string;
  creditorBankMemberId: string;
  endToEndId: string;
  amount: number;
  currency?: string;
  purpose?: string;
  debtorBvn?: string;
  creditorBvn?: string;
  location?: string;
}

export interface Pain014Payload {
  msgId: string;
  creDtTm: string;
  initiatingPartyName: string;
  creditorName: string;
  creditorAccount: string;
  debtorName: string;
  debtorAccount: string;
  debtorBankBic: string;
  debtorBankMemberId: string;
  creditorBankBic: string;
  creditorBankMemberId: string;
  originalMsgId: string;
  originalCreDtTm: string;
  originalEndToEndId: string;
  status: 'ACCP' | 'RJCT';
  statusReasonCode?: string;
}

export function buildPain013Xml(payload: Pain013Payload): string {
  const ccy = payload.currency || 'NGN';
  const dbtrBvn = payload.debtorBvn || '22222222222';
  const cdtrBvn = payload.creditorBvn || '22222222222';
  const loc = payload.location || '01080652440N020900337921E';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:pain.013.001.11">
<CdtrPmtActvtnReq>
<GrpHdr>
<MsgId>${payload.msgId}</MsgId>
<CreDtTm>${payload.creDtTm}</CreDtTm>
<InitgPty>
<Nm>${payload.initiatingPartyName}</Nm>
<Id>
<OrgId>
<Othr>
<Id>${payload.initiatingPartyOrgId}</Id>
</Othr>
</OrgId>
</Id>
</InitgPty>
</GrpHdr>
<PmtInf>
<PmtInfId>${payload.paymentInfoId}</PmtInfId>
<PmtMtd>TRF</PmtMtd>
<ReqdExctnDt>
<DtTm>${payload.requiredExecutionDateTime}</DtTm>
</ReqdExctnDt>
<Dbtr>
<Nm>${payload.debtorName}</Nm>
</Dbtr>
<DbtrAcct>
<Id>
<IBAN>${payload.debtorAccount}</IBAN>
<Othr>
<Id>${payload.debtorBankMemberId}</Id>
</Othr>
</Id>
<Ccy>${ccy}</Ccy>
<Nm>${payload.debtorName}</Nm>
</DbtrAcct>
<DbtrAgt>
<FinInstnId>
<BICFI>${payload.debtorBankBic}</BICFI>
<ClrSysMmbId>
<MmbId>${payload.debtorBankMemberId}</MmbId>
</ClrSysMmbId>
</FinInstnId>
</DbtrAgt>
<CdtTrfTx>
<PmtId>
<EndToEndId>${payload.endToEndId}</EndToEndId>
</PmtId>
<Amt>
<InstdAmt Ccy="${ccy}">${payload.amount.toFixed(2)}</InstdAmt>
</Amt>
<CdtrAgt>
<FinInstnId>
<BICFI>${payload.creditorBankBic}</BICFI>
<ClrSysMmbId>
<MmbId>${payload.creditorBankMemberId}</MmbId>
</ClrSysMmbId>
</FinInstnId>
</CdtrAgt>
<Cdtr>
<Nm>${payload.creditorName}</Nm>
</Cdtr>
<CdtrAcct>
<Id>
<IBAN>${payload.creditorAccount}</IBAN>
<Othr>
<Id>${payload.creditorBankMemberId}</Id>
</Othr>
</Id>
<Nm>${payload.creditorName}</Nm>
</CdtrAcct>
<Purp>
<Prtry>${payload.purpose || 'Payment Request'}</Prtry>
</Purp>
</CdtTrfTx>
</PmtInf>
<SplmtryData>
<PlcAndNm>AdditionalVerificationDetails</PlcAndNm>
<Envlp>
<CustomData>
<DebtorInfo>
<AccountDesignation>1</AccountDesignation>
<IdType>BVN</IdType>
<IdValue>${dbtrBvn}</IdValue>
<AccountTier>1</AccountTier>
</DebtorInfo>
<DebtorMetadata>
<BiometricData>QKPTU</BiometricData>
<AdrLine>12 Ade Ode Street, Victoria Island</AdrLine>
<PhneNb>09038472264</PhneNb>
<EmailAdr>mt@nibss.com</EmailAdr>
</DebtorMetadata>
<CreditorInfo>
<AccountDesignation>1</AccountDesignation>
<IdType>BVN</IdType>
<IdValue>${cdtrBvn}</IdValue>
<AccountTier>1</AccountTier>
</CreditorInfo>
<TransactionInfo>
<TransactionLocation>${loc}</TransactionLocation>
<ChannelCode>4</ChannelCode>
<MandateCategory>0</MandateCategory>
</TransactionInfo>
</CustomData>
</Envlp>
</SplmtryData>
</CdtrPmtActvtnReq>
</ns2:Document>`;

  return xml.trim();
}

export function buildPain014Xml(payload: Pain014Payload): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:pain.014.001.11">
    <CdtrPmtActvtnReqStsRpt>
        <GrpHdr>
            <MsgId>${payload.msgId}</MsgId>
            <CreDtTm>${payload.creDtTm}</CreDtTm>
            <InitgPty>
                <Nm>${payload.initiatingPartyName}</Nm>
            </InitgPty>
            <Cdtr>
                <Nm>${payload.creditorName}</Nm>
            </Cdtr>
            <CdtrAcct>
                <Id>
                    <IBAN>${payload.creditorAccount}</IBAN>
                </Id>
                <Nm>${payload.creditorName}</Nm>
            </CdtrAcct>
            <Dbtr>
                <Nm>${payload.debtorName}</Nm>
            </Dbtr>
            <DbtrAcct>
                <Id>
                    <IBAN>${payload.debtorAccount}</IBAN>
                </Id>
                <Nm>${payload.debtorName}</Nm>
            </DbtrAcct>
            <FwdgAgt>
                <FinInstnId>
                    <BICFI>${payload.debtorBankBic}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${payload.debtorBankMemberId}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </FwdgAgt>
            <DbtrAgt>
                <FinInstnId>
                    <BICFI>${payload.debtorBankBic}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${payload.debtorBankMemberId}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </DbtrAgt>
            <CdtrAgt>
                <FinInstnId>
                    <BICFI>${payload.creditorBankBic}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${payload.creditorBankMemberId}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </CdtrAgt>
        </GrpHdr>
        <OrgnlGrpInfAndSts>
            <OrgnlMsgId>${payload.originalMsgId}</OrgnlMsgId>
            <OrgnlMsgNmId>pain.013.001.11</OrgnlMsgNmId>
            <OrgnlCreDtTm>${payload.originalCreDtTm}</OrgnlCreDtTm>
            <GrpSts>${payload.status}</GrpSts>
        </OrgnlGrpInfAndSts>
        <OrgnlPmtInfAndSts>
            <OrgnlPmtInfId>${payload.originalMsgId}</OrgnlPmtInfId>
            <TxInfAndSts>
                <OrgnlEndToEndId>${payload.originalEndToEndId}</OrgnlEndToEndId>
                <TxSts>${payload.status}</TxSts>
            </TxInfAndSts>
        </OrgnlPmtInfAndSts>
    </CdtrPmtActvtnReqStsRpt>
</ns2:Document>`;

  return xml.trim();
}

export function parseRtpXml(xml: string): Record<string, any> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false,
  });

  const parsed = parser.parse(xml);
  const doc = parsed['ns2:Document'] || parsed.Document || parsed;
  const isReq = Boolean(doc.CdtrPmtActvtnReq);
  const root = doc.CdtrPmtActvtnReq || doc.CdtrPmtActvtnReqStsRpt || {};

  const grpHdr = root.GrpHdr || {};
  const pmtInf = root.PmtInf || {};
  const cdtTx = Array.isArray(pmtInf.CdtTrfTx) ? pmtInf.CdtTrfTx[0] : (pmtInf.CdtTrfTx || {});
  const amtObj = cdtTx.Amt?.InstdAmt;

  const dbtrAcct = pmtInf.DbtrAcct?.Id?.IBAN || root.GrpHdr?.DbtrAcct?.Id?.IBAN;
  const cdtrAcct = cdtTx.CdtrAcct?.Id?.IBAN || root.GrpHdr?.CdtrAcct?.Id?.IBAN;

  return {
    rawParsed: parsed,
    isRequest: isReq,
    msgId: grpHdr.MsgId,
    creDtTm: grpHdr.CreDtTm,
    originalMsgId: root.OrgnlGrpInfAndSts?.OrgnlMsgId,
    status: root.OrgnlGrpInfAndSts?.GrpSts,
    endToEndId: cdtTx.PmtId?.EndToEndId || root.OrgnlPmtInfAndSts?.TxInfAndSts?.OrgnlEndToEndId,
    amount: amtObj ? parseFloat(amtObj['#text'] || amtObj || '0') : undefined,
    currency: amtObj?.['@_Ccy'] || 'NGN',
    debtorName: pmtInf.Dbtr?.Nm || grpHdr.Dbtr?.Nm,
    debtorAccount: String(dbtrAcct || ''),
    debtorBank: pmtInf.DbtrAgt?.FinInstnId?.ClrSysMmbId?.MmbId || grpHdr.DbtrAgt?.FinInstnId?.ClrSysMmbId?.MmbId,
    creditorName: cdtTx.Cdtr?.Nm || grpHdr.Cdtr?.Nm,
    creditorAccount: String(cdtrAcct || ''),
    creditorBank: cdtTx.CdtrAgt?.FinInstnId?.ClrSysMmbId?.MmbId || grpHdr.CdtrAgt?.FinInstnId?.ClrSysMmbId?.MmbId,
  };
}
