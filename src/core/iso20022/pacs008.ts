import { XMLParser } from 'fast-xml-parser';

export interface Pacs008Payload {
  msgId: string;
  creDtTm: string;
  uetr?: string;
  numberOfTransactions?: number;
  settlementAmount?: number;
  instructionId: string;
  endToEndId: string;
  txId?: string;
  transactionId?: string;
  amount: number;
  currency: string;
  settlementDate: string;
  instructingAgentBic?: string;
  instructedAgentBic?: string;
  debtorName: string;
  debtorAccount: string;
  debtorAgentBic: string;
  debtorAgentMemberId?: string;
  debtorBvn?: string;
  debtorAccountTier?: string;
  creditorName: string;
  creditorAccount: string;
  creditorAgentBic: string;
  creditorAgentMemberId?: string;
  creditorBvn?: string;
  creditorAccountTier?: string;
  remittanceInfo?: string;
  remittanceInformation?: string;
  localInstrument?: string;
  clrChannel?: string;
  nameEnquiryMsgId?: string;
  channelCode?: string;
  transactionLocation?: string;
  riskRating?: string;
}

export function buildPacs008Xml(payload: Pacs008Payload): string {
  const instgMmb = payload.debtorAgentMemberId || payload.instructingAgentBic || payload.debtorAgentBic;
  const instdMmb = payload.creditorAgentMemberId || payload.instructedAgentBic || payload.creditorAgentBic;
  const dbtrBvn = payload.debtorBvn || '2211232344';
  const cdtrBvn = payload.creditorBvn || '2211232346';
  const dbtrTier = payload.debtorAccountTier || '1';
  const cdtrTier = payload.creditorAccountTier || '1';
  const location = payload.transactionLocation || '01080652440N020900337921E';
  const channel = payload.channelCode || '1';
  const risk = payload.riskRating || 'R000000000000000000B9';
  const nameEnqId = payload.nameEnquiryMsgId || '';
  const txId = payload.txId || payload.transactionId || `TX${Date.now()}`;

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.12">
    <FIToFICstmrCdtTrf>
        <GrpHdr>
            <MsgId>${payload.msgId}</MsgId>
            <CreDtTm>${payload.creDtTm}</CreDtTm>
            <BtchBookg>false</BtchBookg>
            <NbOfTxs>1</NbOfTxs>
            <SttlmInf>
                <SttlmMtd>CLRG</SttlmMtd>
            </SttlmInf>
            <InstgAgt>
                <FinInstnId>
                    <BICFI>${payload.debtorAgentBic}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${instgMmb}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </InstgAgt>
            <InstdAgt>
                <FinInstnId>
                    <ClrSysMmbId>
                        <MmbId>${instdMmb}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </InstdAgt>
        </GrpHdr>
        <CdtTrfTxInf>
            <PmtId>
                <InstrId>${payload.instructionId}</InstrId>
                <EndToEndId>${payload.endToEndId}</EndToEndId>
                <TxId>${txId}</TxId>
                ${payload.uetr ? `<UETR>${payload.uetr}</UETR>` : ''}
            </PmtId>
            <PmtTpInf>
                <ClrChanl>${payload.clrChannel || 'RTNS'}</ClrChanl>
                <SvcLvl>
                    <Prtry>0100</Prtry>
                </SvcLvl>
                <LclInstrm>
                    <Prtry>${payload.localInstrument || 'CTAA'}</Prtry>
                </LclInstrm>
                <CtgyPurp>
                    <Prtry>001</Prtry>
                </CtgyPurp>
            </PmtTpInf>
            <IntrBkSttlmAmt Ccy="${payload.currency}">${payload.amount.toFixed(2)}</IntrBkSttlmAmt>
            <IntrBkSttlmDt>${payload.settlementDate}</IntrBkSttlmDt>
            <ChrgBr>SLEV</ChrgBr>
            <InstgAgt>
                <FinInstnId>
                    <ClrSysMmbId>
                        <MmbId>${instgMmb}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </InstgAgt>
            <InstdAgt>
                <FinInstnId>
                    <ClrSysMmbId>
                        <MmbId>${instdMmb}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </InstdAgt>
            <Dbtr>
                <Nm>${payload.debtorName}</Nm>
            </Dbtr>
            <DbtrAcct>
                <Id>
                    <IBAN>${payload.debtorAccount}</IBAN>
                </Id>
                <Nm>${payload.debtorName}</Nm>
            </DbtrAcct>
            <DbtrAgt>
                <FinInstnId>
                    <ClrSysMmbId>
                        <MmbId>${instgMmb}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </DbtrAgt>
            <CdtrAgt>
                <FinInstnId>
                    <ClrSysMmbId>
                        <MmbId>${instdMmb}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </CdtrAgt>
            <Cdtr>
                <Nm>${payload.creditorName}</Nm>
            </Cdtr>
            <CdtrAcct>
                <Id>
                    <IBAN>${payload.creditorAccount}</IBAN>
                </Id>
                <Nm>${payload.creditorName}</Nm>
            </CdtrAcct>
            <InstrForNxtAgt>
                <InstrInf>/BNF/Beneficiary info</InstrInf>
            </InstrForNxtAgt>
            <InstrForNxtAgt>
                <InstrInf>/SMPL/Sample data</InstrInf>
            </InstrForNxtAgt>
            <RmtInf>
                <Ustrd>${payload.remittanceInfo || payload.remittanceInformation || 'Funds Transfer'}</Ustrd>
            </RmtInf>
        </CdtTrfTxInf>
        <SplmtryData>
            <PlcAndNm>AdditionalVerificationDetails</PlcAndNm>
            <Envlp>
                <CustomData>
                    <DebtorInfo>
                        <AccountDesignation>1</AccountDesignation>
                        <IdType>bvn</IdType>
                        <IdValue>${dbtrBvn}</IdValue>
                        <AccountTier>${dbtrTier}</AccountTier>
                    </DebtorInfo>
                    <DebtorMetadata>
                        <!-- Biometrics/Address -->
                    </DebtorMetadata>
                    <CreditorInfo>
                        <AccountDesignation>1</AccountDesignation>
                        <IdType>bvn</IdType>
                        <IdValue>${cdtrBvn}</IdValue>
                        <AccountTier>${cdtrTier}</AccountTier>
                    </CreditorInfo>
                    <CreditorMetadata>
                        <!-- Metadata -->
                    </CreditorMetadata>
                    <TransactionInfo>
                        <TransactionLocation>${location}</TransactionLocation>
                        <NameEnquiryMsgId>${nameEnqId}</NameEnquiryMsgId>
                        <ChannelCode>${channel}</ChannelCode>
                        <RiskRating>${risk}</RiskRating>
                    </TransactionInfo>
                </CustomData>
            </Envlp>
        </SplmtryData>
    </FIToFICstmrCdtTrf>
</ns2:Document>`;

  return xml.trim();
}

export function parsePacs008Xml(xml: string): Record<string, any> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false,
  });

  const parsed = parser.parse(xml);
  const doc = parsed['ns2:Document'] || parsed.Document || parsed;
  const root = doc.FIToFICstmrCdtTrf;
  if (!root) {
    throw new Error('Invalid pacs.008 XML: FIToFICstmrCdtTrf root tag missing');
  }

  const grpHdr = root.GrpHdr || {};
  const txInf = Array.isArray(root.CdtTrfTxInf) ? root.CdtTrfTxInf[0] : (root.CdtTrfTxInf || {});
  const pmtId = txInf.PmtId || {};
  const amtObj = txInf.IntrBkSttlmAmt || {};

  const dbtrAcct = txInf.DbtrAcct?.Id?.IBAN || txInf.DbtrAcct?.Id?.Othr?.Id || txInf.DbtrAcct?.Id;
  const cdtrAcct = txInf.CdtrAcct?.Id?.IBAN || txInf.CdtrAcct?.Id?.Othr?.Id || txInf.CdtrAcct?.Id;

  // Supplementary data
  const splmtry = root.SplmtryData?.Envlp?.CustomData || {};
  const debtorInfo = splmtry.DebtorInfo || {};
  const creditorInfo = splmtry.CreditorInfo || {};
  const txInfo = splmtry.TransactionInfo || {};

  return {
    rawParsed: parsed,
    msgId: grpHdr.MsgId,
    creDtTm: grpHdr.CreDtTm,
    instructionId: pmtId.InstrId,
    endToEndId: pmtId.EndToEndId,
    txId: pmtId.TxId,
    uetr: pmtId.UETR || pmtId.TxId,
    amount: parseFloat(amtObj['#text'] || amtObj || '0'),
    currency: amtObj['@_Ccy'] || 'NGN',
    settlementDate: txInf.IntrBkSttlmDt,
    chargeBearer: txInf.ChrgBr,
    debtorName: txInf.Dbtr?.Nm,
    debtorAccount: String(dbtrAcct || ''),
    debtorAgent: grpHdr.InstgAgt?.FinInstnId?.BICFI || txInf.DbtrAgt?.FinInstnId?.ClrSysMmbId?.MmbId || 'UNKNOWN',
    creditorName: txInf.Cdtr?.Nm,
    creditorAccount: String(cdtrAcct || ''),
    creditorAgent: grpHdr.InstdAgt?.FinInstnId?.ClrSysMmbId?.MmbId || txInf.CdtrAgt?.FinInstnId?.ClrSysMmbId?.MmbId || 'UNKNOWN',
    remittanceInfo: txInf.RmtInf?.Ustrd,
    clrChannel: txInf.PmtTpInf?.ClrChanl,
    localInstrument: txInf.PmtTpInf?.LclInstrm?.Prtry,
    debtorBvn: debtorInfo.IdValue,
    creditorBvn: creditorInfo.IdValue,
    transactionLocation: txInfo.TransactionLocation,
    nameEnquiryMsgId: txInfo.NameEnquiryMsgId,
    riskRating: txInfo.RiskRating,
  };
}
