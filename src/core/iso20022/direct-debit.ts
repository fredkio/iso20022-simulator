import { XMLParser } from 'fast-xml-parser';

export interface Pain008Payload {
  msgId: string;
  creDtTm: string;
  initiatingPartyName: string;
  paymentInfoId: string;
  amount: number;
  currency?: string;
  serviceLevel?: string; // NURG
  localInstrument?: string; // NPSDD
  sequenceType?: string; // FRST, RCUR, FNAL, OOFF
  requestedCollectionDate: string;
  creditorName: string;
  creditorAccount: string;
  creditorBankBic: string;
  creditorBankMemberId: string;
  instructionId: string;
  endToEndId: string;
  mandateId: string;
  dateOfSignature?: string;
  debtorBankBic: string;
  debtorBankMemberId: string;
  debtorName: string;
  debtorAccount: string;
  remittanceInfo?: string;
  debtorBvn?: string;
  creditorBvn?: string;
  nameEnquiryMsgId?: string;
  location?: string;
  channelCode?: string;
}

export interface Pain002Payload {
  msgId: string;
  creDtTm: string;
  initiatingPartyName: string;
  originalMsgId: string;
  originalMsgNameId?: string; // pain.008.001.11 or pain.001.001.12
  groupStatus: 'ACSC' | 'RJCT' | 'ACTC';
  originalPaymentInfoId?: string;
  statusId: string;
  originalEndToEndId: string;
  transactionStatus: 'ACSC' | 'RJCT' | 'ACTC';
  reasonCode?: string;
  reasonDescription?: string;
}

export function buildPain008Xml(payload: Pain008Payload): string {
  const ccy = payload.currency || 'NGN';
  const amtFormatted = payload.amount.toFixed(2);
  const svc = payload.serviceLevel || 'NURG';
  const lcl = payload.localInstrument || 'NPSDD';
  const seq = payload.sequenceType || 'FRST';
  const dtSgn = payload.dateOfSignature || payload.requestedCollectionDate;
  const dbtrBvn = payload.debtorBvn || '22222222222';
  const cdtrBvn = payload.creditorBvn || '22222222222';
  const loc = payload.location || '013223231333';
  const channel = payload.channelCode || '4';

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:pain.008.001.11">
    <CstmrDrctDbtInitn>
        <GrpHdr>
            <MsgId>${payload.msgId}</MsgId>
            <CreDtTm>${payload.creDtTm}</CreDtTm>
            <NbOfTxs>1</NbOfTxs>
            <CtrlSum>${amtFormatted}</CtrlSum>
            <InitgPty>
                <Nm>${payload.initiatingPartyName}</Nm>
            </InitgPty>
            <FwdgAgt>
                <FinInstnId>
                    <BICFI>${payload.creditorBankBic}</BICFI>
                </FinInstnId>
            </FwdgAgt>
        </GrpHdr>
        <PmtInf>
            <PmtInfId>${payload.paymentInfoId}</PmtInfId>
            <PmtMtd>DD</PmtMtd>
            <NbOfTxs>1</NbOfTxs>
            <CtrlSum>${amtFormatted}</CtrlSum>
            <PmtTpInf>
                <SvcLvl>
                    <Cd>${svc}</Cd>
                </SvcLvl>
                <LclInstrm>
                    <Prtry>${lcl}</Prtry>
                </LclInstrm>
                <SeqTp>${seq}</SeqTp>
            </PmtTpInf>
            <ReqdColltnDt>${payload.requestedCollectionDate}</ReqdColltnDt>
            <Cdtr>
                <Nm>${payload.creditorName}</Nm>
            </Cdtr>
            <CdtrAcct>
                <Id>
                    <IBAN>${payload.creditorAccount}</IBAN>
                </Id>
                <Ccy>${ccy}</Ccy>
            </CdtrAcct>
            <CdtrAgt>
                <FinInstnId>
                    <BICFI>${payload.creditorBankBic}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${payload.creditorBankMemberId}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </CdtrAgt>
            <DrctDbtTxInf>
                <PmtId>
                    <InstrId>${payload.instructionId}</InstrId>
                    <EndToEndId>${payload.endToEndId}</EndToEndId>
                </PmtId>
                <InstdAmt Ccy="${ccy}">${amtFormatted}</InstdAmt>
                <DrctDbtTx>
                    <MndtRltdInf>
                        <MndtId>${payload.mandateId}</MndtId>
                        <DtOfSgntr>${dtSgn}</DtOfSgntr>
                        <FrstColltnDt>${payload.requestedCollectionDate}</FrstColltnDt>
                        <FnlColltnDt>2025-12-31Z</FnlColltnDt>
                        <Frqcy>
                            <Tp>MNTH</Tp>
                        </Frqcy>
                    </MndtRltdInf>
                </DrctDbtTx>
                <DbtrAgt>
                    <FinInstnId>
                        <ClrSysMmbId>
                            <MmbId>${payload.debtorBankMemberId}</MmbId>
                        </ClrSysMmbId>
                    </FinInstnId>
                </DbtrAgt>
                <Dbtr>
                    <Nm>${payload.debtorName}</Nm>
                </Dbtr>
                <DbtrAcct>
                    <Id>
                        <IBAN>${payload.debtorAccount}</IBAN>
                        <Othr>
                            <Id>${payload.debtorAccount}</Id>
                        </Othr>
                    </Id>
                    <Ccy>${ccy}</Ccy>
                </DbtrAcct>
                <RmtInf>
                    <Ustrd>${payload.remittanceInfo || 'Direct Debit Collection'}</Ustrd>
                </RmtInf>
            </DrctDbtTxInf>
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
                        <BiometricData/>
                    </DebtorMetadata>
                    <CreditorInfo>
                        <AccountDesignation>1</AccountDesignation>
                        <IdType>BVN</IdType>
                        <IdValue>${cdtrBvn}</IdValue>
                        <AccountTier>1</AccountTier>
                    </CreditorInfo>
                    <CreditorMetadata/>
                    <TransactionInfo>
                        <TransactionLocation>${loc}</TransactionLocation>
                        <NameEnquiryMsgId>${payload.nameEnquiryMsgId || ''}</NameEnquiryMsgId>
                        <ChannelCode>${channel}</ChannelCode>
                        <FixedCollectionAmount>false</FixedCollectionAmount>
                        <MandateCode>${payload.mandateId}</MandateCode>
                    </TransactionInfo>
                </CustomData>
            </Envlp>
        </SplmtryData>
    </CstmrDrctDbtInitn>
</ns2:Document>`;

  return xml.trim();
}

export function buildPain002Xml(payload: Pain002Payload): string {
  const origMsgNm = payload.originalMsgNameId || 'pain.008.001.11';
  const reasonCode = payload.reasonCode || (payload.transactionStatus === 'ACSC' ? '000' : 'AC01');
  const reasonDesc = payload.reasonDescription || (payload.transactionStatus === 'ACSC' ? 'Accepted' : 'Rejected');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:pain.002.001.14">
    <CstmrPmtStsRpt>
        <GrpHdr>
            <MsgId>${payload.msgId}</MsgId>
            <CreDtTm>${payload.creDtTm}</CreDtTm>
            <InitgPty>
                <Nm>${payload.initiatingPartyName}</Nm>
            </InitgPty>
        </GrpHdr>
        <OrgnlGrpInfAndSts>
            <OrgnlMsgId>${payload.originalMsgId}</OrgnlMsgId>
            <OrgnlMsgNmId>${origMsgNm}</OrgnlMsgNmId>
            <GrpSts>${payload.groupStatus}</GrpSts>
        </OrgnlGrpInfAndSts>
        <OrgnlPmtInfAndSts>
            <OrgnlPmtInfId>${payload.originalPaymentInfoId || payload.originalMsgId}</OrgnlPmtInfId>
            <TxInfAndSts>
                <StsId>${payload.statusId}</StsId>
                <OrgnlEndToEndId>${payload.originalEndToEndId}</OrgnlEndToEndId>
                <TxSts>${payload.transactionStatus}</TxSts>
                <StsRsnInf>
                    <Rsn>
                        <Cd>${reasonCode}</Cd>
                    </Rsn>
                    <AddtlInf>${reasonDesc}</AddtlInf>
                </StsRsnInf>
            </TxInfAndSts>
        </OrgnlPmtInfAndSts>
    </CstmrPmtStsRpt>
</ns2:Document>`;

  return xml.trim();
}

export function parseDirectDebitXml(xml: string): Record<string, any> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false,
  });

  const parsed = parser.parse(xml);
  const doc = parsed['ns2:Document'] || parsed.Document || parsed;
  const isInitn = Boolean(doc.CstmrDrctDbtInitn);
  const root = doc.CstmrDrctDbtInitn || doc.CstmrPmtStsRpt || {};

  const grpHdr = root.GrpHdr || {};
  const pmtInf = root.PmtInf || {};
  const txInf = Array.isArray(pmtInf.DrctDbtTxInf) ? pmtInf.DrctDbtTxInf[0] : (pmtInf.DrctDbtTxInf || {});
  const amtObj = txInf.InstdAmt;

  const dbtrAcct = txInf.DbtrAcct?.Id?.IBAN || txInf.DbtrAcct?.Id?.Othr?.Id;
  const cdtrAcct = pmtInf.CdtrAcct?.Id?.IBAN;

  return {
    rawParsed: parsed,
    isInitiation: isInitn,
    msgId: grpHdr.MsgId,
    creDtTm: grpHdr.CreDtTm,
    originalMsgId: root.OrgnlGrpInfAndSts?.OrgnlMsgId,
    initiatingPartyName: grpHdr.InitgPty?.Nm,
    paymentInfoId: pmtInf.PmtInfId,
    instructionId: txInf.PmtId?.InstrId,
    endToEndId: txInf.PmtId?.EndToEndId,
    mandateId: txInf.DrctDbtTx?.MndtRltdInf?.MndtId,
    amount: amtObj ? parseFloat(amtObj['#text'] || amtObj || '0') : undefined,
    currency: amtObj?.['@_Ccy'] || 'NGN',
    debtorName: txInf.Dbtr?.Nm,
    debtorAccount: String(dbtrAcct || ''),
    debtorBank: txInf.DbtrAgt?.FinInstnId?.ClrSysMmbId?.MmbId || txInf.DbtrAgt?.FinInstnId?.BICFI,
    debtorBankBic: txInf.DbtrAgt?.FinInstnId?.BICFI,
    creditorName: pmtInf.Cdtr?.Nm,
    creditorAccount: String(cdtrAcct || ''),
    creditorBank: pmtInf.CdtrAgt?.FinInstnId?.ClrSysMmbId?.MmbId || pmtInf.CdtrAgt?.FinInstnId?.BICFI,
    creditorBankBic: pmtInf.CdtrAgt?.FinInstnId?.BICFI,
    remittanceInfo: txInf.RmtInf?.Ustrd,
    status: root.OrgnlGrpInfAndSts?.GrpSts,
  };
}
