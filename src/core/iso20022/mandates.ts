import { XMLParser } from 'fast-xml-parser';

export interface MandatePayload {
  msgId: string;
  creDtTm: string;
  mandateId: string;
  sequenceType?: 'RCUR' | 'OOFF';
  frequency?: 'DAIL' | 'WEEK' | 'MNTH' | 'QURT' | 'YEAR';
  firstCollectionDate: string;
  finalCollectionDate?: string;
  trackingIndicator?: boolean;
  collectionAmount?: number;
  currency?: string;
  creditorName: string;
  creditorAccount: string;
  creditorBankBic: string;
  creditorBankMemberId: string;
  debtorName: string;
  debtorAccount: string;
  debtorBankBic: string;
  debtorBankMemberId: string;
  referredDocNumber?: string;
  debtorBvn?: string;
  creditorBvn?: string;
  debtorPhone?: string;
  debtorEmail?: string;
  transactionLocation?: string;
}

export interface MandateResponsePayload {
  msgId: string;
  creDtTm: string;
  originalMsgId: string;
  originalCreDtTm: string;
  originalMandateId: string;
  accepted: boolean;
  reasonCode?: string;
  reasonDescription?: string;
  mandateDetails: Partial<MandatePayload>;
}

export function buildPain009Xml(payload: MandatePayload): string {
  const seqTp = payload.sequenceType || 'RCUR';
  const frqcy = payload.frequency || 'WEEK';
  const ccy = payload.currency || 'NGN';
  const amt = payload.collectionAmount !== undefined ? payload.collectionAmount.toFixed(2) : '50000.00';
  const fnlDt = payload.finalCollectionDate || '2025-12-31Z';
  const dbtrBvn = payload.debtorBvn || '22222222222';
  const cdtrBvn = payload.creditorBvn || '22222222222';
  const location = payload.transactionLocation || '01080652440N020900337921E';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:pain.009.001.08">
<MndtInitnReq>
<GrpHdr>
<MsgId>${payload.msgId}</MsgId>
<CreDtTm>${payload.creDtTm}</CreDtTm>
</GrpHdr>
<Mndt>
<MndtId>${payload.mandateId}</MndtId>
<Ocrncs>
<SeqTp>${seqTp}</SeqTp>
<Frqcy>
<Tp>${frqcy}</Tp>
</Frqcy>
<FrstColltnDt>${payload.firstCollectionDate}</FrstColltnDt>
<FnlColltnDt>${fnlDt}</FnlColltnDt>
</Ocrncs>
<TrckgInd>${payload.trackingIndicator ? 'true' : 'false'}</TrckgInd>
<ColltnAmt Ccy="${ccy}">${amt}</ColltnAmt>
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
<RfrdDoc>
<Tp>
<CdOrPrtry>
<Cd>INV</Cd>
</CdOrPrtry>
</Tp>
<Nb>${payload.referredDocNumber || 'INV-2025-001'}</Nb>
</RfrdDoc>
</Mndt>
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
<BiometricData>QklPTU</BiometricData>
<AdrLine>12 Ade Ode Street, Victoria Island</AdrLine>
<PhneNb>${payload.debtorPhone || '09038472264'}</PhneNb>
<EmailAdr>${payload.debtorEmail || 'mt@nibss.com'}</EmailAdr>
</DebtorMetadata>
<CreditorInfo>
<AccountDesignation>1</AccountDesignation>
<IdType>BVN</IdType>
<IdValue>${cdtrBvn}</IdValue>
<AccountTier>1</AccountTier>
</CreditorInfo>
<TransactionInfo>
<TransactionLocation>${location}</TransactionLocation>
<ChannelCode>4</ChannelCode>
<MandateCategory>0</MandateCategory>
<FixedCollectionAmount>false</FixedCollectionAmount>
</TransactionInfo>
</CustomData>
</Envlp>
</SplmtryData>
</MndtInitnReq>
</ns2:Document>`;

  return xml.trim();
}

export function buildPain012Xml(payload: MandateResponsePayload): string {
  const m = payload.mandateDetails;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:pain.012.001.08">
   <MndtAccptncRpt>
       <GrpHdr>
           <MsgId>${payload.msgId}</MsgId>
           <CreDtTm>${payload.creDtTm}</CreDtTm>
       </GrpHdr>
       <UndrlygAccptncDtls>
           <OrgnlMsgInf>
               <MsgId>${payload.originalMsgId}</MsgId>
               <MsgNmId>pain.009.001.08</MsgNmId>
               <CreDtTm>${payload.originalCreDtTm}</CreDtTm>
           </OrgnlMsgInf>
           <AccptncRslt>
               <Accptd>${payload.accepted ? 'true' : 'false'}</Accptd>
           </AccptncRslt>
           <OrgnlMndt>
               <OrgnlMndtId>${payload.originalMandateId}</OrgnlMndtId>
               <OrgnlMndt>
                   <Ocrncs>
                       <SeqTp>${m.sequenceType || 'RCUR'}</SeqTp>
                       <Frqcy>
                           <Tp>${m.frequency || 'WEEK'}</Tp>
                       </Frqcy>
                       <FrstColltnDt>${m.firstCollectionDate || '2025-09-08Z'}</FrstColltnDt>
                       <FnlColltnDt>${m.finalCollectionDate || '2025-12-31Z'}</FnlColltnDt>
                   </Ocrncs>
                   <TrckgInd>${m.trackingIndicator ? 'true' : 'false'}</TrckgInd>
                   <Cdtr>
                       <Nm>${m.creditorName || 'Creditor'}</Nm>
                   </Cdtr>
                   <CdtrAcct>
                       <Id>
                           <IBAN>${m.creditorAccount || '0000000000'}</IBAN>
                       </Id>
                       <Nm>${m.creditorName || 'Creditor'}</Nm>
                   </CdtrAcct>
                   <CdtrAgt>
                       <FinInstnId>
                           <BICFI>${m.creditorBankBic || '999058'}</BICFI>
                           <ClrSysMmbId>
                               <MmbId>${m.creditorBankMemberId || '999058'}</MmbId>
                           </ClrSysMmbId>
                       </FinInstnId>
                   </CdtrAgt>
                   <Dbtr>
                       <Nm>${m.debtorName || 'Debtor'}</Nm>
                   </Dbtr>
                   <DbtrAcct>
                       <Id>
                           <IBAN>${m.debtorAccount || '0000000000'}</IBAN>
                       </Id>
                       <Nm>${m.debtorName || 'Debtor'}</Nm>
                   </DbtrAcct>
                   <DbtrAgt>
                       <FinInstnId>
                           <BICFI>${m.debtorBankBic || '999057'}</BICFI>
                           <ClrSysMmbId>
                               <MmbId>${m.debtorBankMemberId || '999057'}</MmbId>
                           </ClrSysMmbId>
                       </FinInstnId>
                   </DbtrAgt>
               </OrgnlMndt>
           </OrgnlMndt>
       </UndrlygAccptncDtls>
   </MndtAccptncRpt>
</ns2:Document>`;

  return xml.trim();
}

export function buildPain010Xml(payload: {
  msgId: string;
  creDtTm: string;
  initiatingParty?: string;
  originalMsgId?: string;
  originalCreDtTm?: string;
  amendmentReasonCode?: string;
  amendmentReasonDesc?: string;
  mandateId: string;
  mandateDetails?: Partial<MandatePayload>;
  frequency?: string;
  collectionAmount?: number;
  currency?: string;
  creditorName?: string;
  creditorAccount?: string;
  creditorBankMemberId?: string;
  debtorName?: string;
  debtorAccount?: string;
  debtorBankMemberId?: string;
}): string {
  const m = payload.mandateDetails || (payload as any);
  const origMsgId = payload.originalMsgId || payload.msgId;
  const origCreDtTm = payload.originalCreDtTm || payload.creDtTm;
  const initParty = payload.initiatingParty || m.creditorName || 'Initiating Party';
  const rsnCode = payload.amendmentReasonCode || 'MD01';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:pain.010.001.08">
    <MndtAmdmntReq>
        <GrpHdr>
            <MsgId>${payload.msgId}</MsgId>
            <CreDtTm>${payload.creDtTm}</CreDtTm>
            <InitgPty>
                <Nm>${initParty}</Nm>
            </InitgPty>
        </GrpHdr>
        <UndrlygAmdmntDtls>
            <OrgnlMsgInf>
                <MsgId>${origMsgId}</MsgId>
                <MsgNmId>pain.009.001.08</MsgNmId>
                <CreDtTm>${origCreDtTm}</CreDtTm>
            </OrgnlMsgInf>
            <AmdmntRsn>
                <Rsn>
                    <Cd>${rsnCode}</Cd>
                    <Prtry>${payload.amendmentReasonDesc || 'Mandate parameter update'}</Prtry>
                </Rsn>
            </AmdmntRsn>
            <Mndt>
                <MndtId>${payload.mandateId}</MndtId>
                <Ocrncs>
                    <SeqTp>${m.sequenceType || 'RCUR'}</SeqTp>
                    <Frqcy>
                        <Tp>${m.frequency || 'WEEK'}</Tp>
                    </Frqcy>
                    <FrstColltnDt>${m.firstCollectionDate || '2025-09-08Z'}</FrstColltnDt>
                    <FnlColltnDt>${m.finalCollectionDate || '2025-12-31Z'}</FnlColltnDt>
                </Ocrncs>
                <TrckgInd>false</TrckgInd>
                <Cdtr>
                    <Nm>${m.creditorName || 'Creditor'}</Nm>
                </Cdtr>
                <CdtrAcct>
                    <Id>
                        <IBAN>${m.creditorAccount || '0000000000'}</IBAN>
                    </Id>
                    <Nm>${m.creditorName || 'Creditor'}</Nm>
                </CdtrAcct>
                <CdtrAgt>
                    <FinInstnId>
                        <BICFI>${m.creditorBankBic || '999058'}</BICFI>
                        <ClrSysMmbId>
                            <MmbId>${m.creditorBankMemberId || '999058'}</MmbId>
                        </ClrSysMmbId>
                    </FinInstnId>
                </CdtrAgt>
                <Dbtr>
                    <Nm>${m.debtorName || 'Debtor'}</Nm>
                </Dbtr>
                <DbtrAcct>
                    <Id>
                        <IBAN>${m.debtorAccount || '0000000000'}</IBAN>
                    </Id>
                    <Nm>${m.debtorName || 'Debtor'}</Nm>
                </DbtrAcct>
                <DbtrAgt>
                    <FinInstnId>
                        <BICFI>${m.debtorBankBic || '999057'}</BICFI>
                        <ClrSysMmbId>
                            <MmbId>${m.debtorBankMemberId || '999057'}</MmbId>
                        </ClrSysMmbId>
                    </FinInstnId>
                </DbtrAgt>
            </Mndt>
            <OrgnlMndt>
                <OrgnlMndtId>${payload.mandateId}</OrgnlMndtId>
            </OrgnlMndt>
        </UndrlygAmdmntDtls>
    </MndtAmdmntReq>
</ns2:Document>`;

  return xml.trim();
}

export function buildPain011Xml(payload: {
  msgId: string;
  creDtTm: string;
  originalMsgId?: string;
  originalCreDtTm?: string;
  cancellationReasonCode?: string;
  cancellationReasonDesc?: string;
  originalMandateId?: string;
  mandateId?: string;
  mandateDetails?: Partial<MandatePayload>;
  creditorName?: string;
  creditorAccount?: string;
  creditorBankMemberId?: string;
  debtorName?: string;
  debtorAccount?: string;
  debtorBankMemberId?: string;
}): string {
  const m = payload.mandateDetails || (payload as any);
  const origMsgId = payload.originalMsgId || payload.msgId;
  const origCreDtTm = payload.originalCreDtTm || payload.creDtTm;
  const origMndtId = payload.originalMandateId || payload.mandateId || 'MNDT-001';
  const rsnCode = payload.cancellationReasonCode || 'CNCL';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:pain.011.001.08">
   <MndtCxlReq>
       <GrpHdr>
           <MsgId>${payload.msgId}</MsgId>
           <CreDtTm>${payload.creDtTm}</CreDtTm>
       </GrpHdr>
       <UndrlygCxlDtls>
           <OrgnlMsgInf>
               <MsgId>${origMsgId}</MsgId>
               <MsgNmId>pain.009.001.08</MsgNmId>
               <CreDtTm>${origCreDtTm}</CreDtTm>
           </OrgnlMsgInf>
           <CxlRsn>
               <Rsn>
                   <Cd>${rsnCode}</Cd>
                   <Prtry>${payload.cancellationReasonDesc || 'Cancelled by customer'}</Prtry>
               </Rsn>
           </CxlRsn>
           <OrgnlMndt>
               <OrgnlMndtId>${origMndtId}</OrgnlMndtId>
               <OrgnlMndt>
                   <Ocrncs>
                       <SeqTp>${m.sequenceType || 'RCUR'}</SeqTp>
                       <Frqcy>
                           <Tp>${m.frequency || 'WEEK'}</Tp>
                       </Frqcy>
                       <FrstColltnDt>${m.firstCollectionDate || '2025-09-08Z'}</FrstColltnDt>
                       <FnlColltnDt>${m.finalCollectionDate || '2025-12-31Z'}</FnlColltnDt>
                   </Ocrncs>
                   <TrckgInd>false</TrckgInd>
                   <Cdtr>
                       <Nm>${m.creditorName || 'Creditor'}</Nm>
                   </Cdtr>
                   <CdtrAcct>
                       <Id>
                           <IBAN>${m.creditorAccount || '0000000000'}</IBAN>
                       </Id>
                       <Nm>${m.creditorName || 'Creditor'}</Nm>
                   </CdtrAcct>
                   <CdtrAgt>
                       <FinInstnId>
                           <BICFI>${m.creditorBankBic || '999058'}</BICFI>
                           <ClrSysMmbId>
                               <MmbId>${m.creditorBankMemberId || '999058'}</MmbId>
                           </ClrSysMmbId>
                       </FinInstnId>
                   </CdtrAgt>
                   <Dbtr>
                       <Nm>${m.debtorName || 'Debtor'}</Nm>
                   </Dbtr>
                   <DbtrAcct>
                       <Id>
                           <IBAN>${m.debtorAccount || '0000000000'}</IBAN>
                       </Id>
                       <Nm>${m.debtorName || 'Debtor'}</Nm>
                   </DbtrAcct>
                   <DbtrAgt>
                       <FinInstnId>
                           <BICFI>${m.debtorBankBic || '999057'}</BICFI>
                           <ClrSysMmbId>
                               <MmbId>${m.debtorBankMemberId || '999057'}</MmbId>
                           </ClrSysMmbId>
                       </FinInstnId>
                   </DbtrAgt>
               </OrgnlMndt>
           </OrgnlMndt>
       </UndrlygCxlDtls>
   </MndtCxlReq>
</ns2:Document>`;

  return xml.trim();
}

export function parseMandateXml(xml: string): Record<string, any> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false,
  });

  const parsed = parser.parse(xml);
  const doc = parsed['ns2:Document'] || parsed.Document || parsed;
  const rootKey = Object.keys(doc).find((k) => k.startsWith('Mndt'));
  const root = rootKey ? doc[rootKey] : {};

  const grpHdr = root.GrpHdr || {};
  const mndt = root.Mndt || root.UndrlygAccptncDtls?.OrgnlMndt || root.UndrlygAmdmntDtls?.Mndt || root.UndrlygCxlDtls?.OrgnlMndt || {};
  const orgnlMndt = mndt.OrgnlMndt || mndt;
  const amtObj = mndt.ColltnAmt;

  const cdtrAcct = orgnlMndt.CdtrAcct?.Id?.IBAN || orgnlMndt.CdtrAcct?.Id;
  const dbtrAcct = orgnlMndt.DbtrAcct?.Id?.IBAN || orgnlMndt.DbtrAcct?.Id;

  return {
    rawParsed: parsed,
    messageType: rootKey,
    msgId: grpHdr.MsgId,
    creDtTm: grpHdr.CreDtTm,
    mandateId: mndt.MndtId || mndt.OrgnlMndtId,
    creditorName: orgnlMndt.Cdtr?.Nm,
    creditorAccount: String(cdtrAcct || ''),
    creditorBank: orgnlMndt.CdtrAgt?.FinInstnId?.ClrSysMmbId?.MmbId,
    debtorName: orgnlMndt.Dbtr?.Nm,
    debtorAccount: String(dbtrAcct || ''),
    debtorBank: orgnlMndt.DbtrAgt?.FinInstnId?.ClrSysMmbId?.MmbId,
    accepted: root.UndrlygAccptncDtls?.AccptncRslt?.Accptd === 'true' || root.UndrlygAccptncDtls?.AccptncRslt?.Accptd === true,
    cancellationReason: root.UndrlygCxlDtls?.CxlRsn?.Rsn?.Cd,
    amendmentReason: root.UndrlygAmdmntDtls?.AmdmntRsn?.Rsn?.Cd,
    amount: amtObj ? parseFloat(amtObj['#text'] || amtObj || '0') : undefined,
  };
}
