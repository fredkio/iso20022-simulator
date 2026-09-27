import { XMLParser } from 'fast-xml-parser';

export interface Pacs003Payload {
  msgId: string;
  creDtTm: string;
  amount: number;
  currency: string;
  settlementDate: string;
  creditorBankBic: string;
  creditorBankMemberId: string;
  debtorBankBic: string;
  debtorBankMemberId: string;
  instructionId: string;
  endToEndId: string;
  txId: string;
  localInstrument?: string; // e.g. NPSDD
  mandateId: string;
  dateOfSignature?: string;
  firstCollectionDate?: string;
  finalCollectionDate?: string;
  frequencyType?: string; // DAIL, WEEK, MNTH, QURT, YEAR
  creditorName: string;
  creditorAccount: string;
  debtorName: string;
  debtorAccount: string;
  narration?: string;
  debtorBvn?: string;
  debtorAccountTier?: string;
  creditorBvn?: string;
  creditorAccountTier?: string;
  transactionLocation?: string;
  nameEnquiryMsgId?: string;
  channelCode?: string;
  riskRating?: string;
  fixedCollectionAmount?: boolean;
}

export function buildPacs003Xml(payload: Pacs003Payload): string {
  const amtFormatted = payload.amount.toFixed(2);
  const dtOfSgntr = payload.dateOfSignature || payload.settlementDate;
  const frstColltn = payload.firstCollectionDate || payload.settlementDate;
  const fnlColltn = payload.finalCollectionDate ? `<FnlColltnDt>${payload.finalCollectionDate}</FnlColltnDt>` : '';
  const frqcy = payload.frequencyType || 'MNTH';
  const dbtrBvn = payload.debtorBvn || '2211232344';
  const cdtrBvn = payload.creditorBvn || '2211232346';
  const dbtrTier = payload.debtorAccountTier || '1';
  const cdtrTier = payload.creditorAccountTier || '1';
  const location = payload.transactionLocation || '01080652440N020900337921E';
  const channel = payload.channelCode || '4';
  const risk = payload.riskRating || 'R000000000000000000B9';
  const isFixed = payload.fixedCollectionAmount !== undefined ? payload.fixedCollectionAmount : false;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:pacs.003.001.11">
    <FIToFICstmrDrctDbt>
        <GrpHdr>
            <MsgId>${payload.msgId}</MsgId>
            <CreDtTm>${payload.creDtTm}</CreDtTm>
            <NbOfTxs>1</NbOfTxs>
            <CtrlSum>${amtFormatted}</CtrlSum>
            <InstgAgt>
                <FinInstnId>
                    <BICFI>${payload.creditorBankBic}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${payload.creditorBankMemberId}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </InstgAgt>
            <InstdAgt>
                <FinInstnId>
                    <BICFI>${payload.debtorBankBic}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${payload.debtorBankMemberId}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </InstdAgt>
        </GrpHdr>
        <DrctDbtTxInf>
            <PmtId>
                <InstrId>${payload.instructionId}</InstrId>
                <EndToEndId>${payload.endToEndId}</EndToEndId>
                <TxId>${payload.txId}</TxId>
            </PmtId>
            <PmtTpInf>
                <LclInstrm>
                    <Prtry>${payload.localInstrument || 'NPSDD'}</Prtry>
                </LclInstrm>
            </PmtTpInf>
            <IntrBkSttlmAmt Ccy="${payload.currency || 'NGN'}">${amtFormatted}</IntrBkSttlmAmt>
            <IntrBkSttlmDt>${payload.settlementDate}</IntrBkSttlmDt>
            <InstdAmt Ccy="${payload.currency || 'NGN'}">${amtFormatted}</InstdAmt>
            <DrctDbtTx>
                <MndtRltdInf>
                    <MndtId>${payload.mandateId}</MndtId>
                    <DtOfSgntr>${dtOfSgntr}</DtOfSgntr>
                    <FrstColltnDt>${frstColltn}</FrstColltnDt>
                    ${fnlColltn}
                    <Frqcy>
                        <Tp>${frqcy}</Tp>
                    </Frqcy>
                </MndtRltdInf>
            </DrctDbtTx>
            <Cdtr>
                <Nm>${payload.creditorName}</Nm>
            </Cdtr>
            <CdtrAcct>
                <Id>
                    <IBAN>${payload.creditorAccount}</IBAN>
                </Id>
                <Nm>${payload.creditorName}</Nm>
            </CdtrAcct>
            <CdtrAgt>
                <FinInstnId>
                    <BICFI>${payload.creditorBankBic}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${payload.creditorBankMemberId}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </CdtrAgt>
            <InstgAgt>
                <FinInstnId>
                    <BICFI>${payload.creditorBankBic}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${payload.creditorBankMemberId}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </InstgAgt>
            <InstdAgt>
                <FinInstnId>
                    <BICFI>${payload.debtorBankBic}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${payload.debtorBankMemberId}</MmbId>
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
                    <BICFI>${payload.debtorBankBic}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${payload.debtorBankMemberId}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </DbtrAgt>
            <RmtInf>
                <Ustrd>${payload.narration || 'Direct Debit Collection'}</Ustrd>
            </RmtInf>
        </DrctDbtTxInf>
        <SplmtryData>
            <PlcAndNm>AdditionalVerificationDetails</PlcAndNm>
            <Envlp>
                <CustomData>
                    <DebtorInfo>
                        <AccountDesignation>1</AccountDesignation>
                        <IdType>BVN</IdType>
                        <IdValue>${dbtrBvn}</IdValue>
                        <AccountTier>${dbtrTier}</AccountTier>
                    </DebtorInfo>
                    <DebtorMetadata>
                        <BiometricData/>
                    </DebtorMetadata>
                    <CreditorInfo>
                        <AccountDesignation>1</AccountDesignation>
                        <IdType>BVN</IdType>
                        <IdValue>${cdtrBvn}</IdValue>
                        <AccountTier>${cdtrTier}</AccountTier>
                    </CreditorInfo>
                    <CreditorMetadata/>
                    <TransactionInfo>
                        <TransactionLocation>${location}</TransactionLocation>
                        <NameEnquiryMsgId>${payload.nameEnquiryMsgId || ''}</NameEnquiryMsgId>
                        <ChannelCode>${channel}</ChannelCode>
                        <RiskRating>${risk}</RiskRating>
                        <FixedCollectionAmount>${isFixed ? 'true' : 'false'}</FixedCollectionAmount>
                    </TransactionInfo>
                </CustomData>
            </Envlp>
        </SplmtryData>
    </FIToFICstmrDrctDbt>
</ns2:Document>`;

  return xml.trim();
}

export function parsePacs003Xml(xml: string): Record<string, any> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false,
  });

  const parsed = parser.parse(xml);
  const doc = parsed['ns2:Document'] || parsed.Document || parsed;
  const root = doc.FIToFICstmrDrctDbt;
  if (!root) {
    throw new Error('Invalid pacs.003 XML: FIToFICstmrDrctDbt block missing');
  }

  const grpHdr = root.GrpHdr || {};
  const txInf = Array.isArray(root.DrctDbtTxInf) ? root.DrctDbtTxInf[0] : (root.DrctDbtTxInf || {});
  const pmtId = txInf.PmtId || {};
  const mndt = txInf.DrctDbtTx?.MndtRltdInf || {};
  const amtObj = txInf.IntrBkSttlmAmt || {};

  const cdtrAcct = txInf.CdtrAcct?.Id?.IBAN || txInf.CdtrAcct?.Id;
  const dbtrAcct = txInf.DbtrAcct?.Id?.IBAN || txInf.DbtrAcct?.Id;

  // Supplementary
  const splmtry = root.SplmtryData?.Envlp?.CustomData || {};
  const txInfo = splmtry.TransactionInfo || {};

  return {
    rawParsed: parsed,
    msgId: grpHdr.MsgId,
    creDtTm: grpHdr.CreDtTm,
    instructionId: pmtId.InstrId,
    endToEndId: pmtId.EndToEndId,
    txId: pmtId.TxId,
    mandateId: mndt.MndtId,
    amount: parseFloat(amtObj['#text'] || amtObj || '0'),
    currency: amtObj['@_Ccy'] || 'NGN',
    settlementDate: txInf.IntrBkSttlmDt,
    creditorName: txInf.Cdtr?.Nm,
    creditorAccount: String(cdtrAcct || ''),
    creditorBank: txInf.CdtrAgt?.FinInstnId?.ClrSysMmbId?.MmbId || grpHdr.InstgAgt?.FinInstnId?.ClrSysMmbId?.MmbId,
    debtorName: txInf.Dbtr?.Nm,
    debtorAccount: String(dbtrAcct || ''),
    debtorBank: txInf.DbtrAgt?.FinInstnId?.ClrSysMmbId?.MmbId || grpHdr.InstdAgt?.FinInstnId?.ClrSysMmbId?.MmbId,
    narration: txInf.RmtInf?.Ustrd,
    localInstrument: txInf.PmtTpInf?.LclInstrm?.Prtry,
    riskRating: txInfo.RiskRating,
  };
}
