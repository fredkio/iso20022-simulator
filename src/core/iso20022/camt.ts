import { XMLParser } from 'fast-xml-parser';

export interface Camt060Payload {
  msgId: string;
  creDtTm: string;
  senderBic: string;
  senderMemberId: string;
  reportingReqId: string;
  requestedMsgNameId?: string; // STATEMENT
  accountNumber: string;
  currency?: string;
  accountOwnerMemberId: string;
  accountServicerMemberId: string;
  fromDate: string;
  toDate: string;
  periodType?: string; // ALLL
  bvn?: string;
  accountTier?: string;
  mandateCode?: string;
  transactionLocation?: string;
  channelCode?: string;
}

export interface StatementEntry {
  amount: number;
  indicator: 'CRDT' | 'DBIT';
  status?: string;
  bookingDate: string;
  valueDate: string;
  reference: string;
  domain?: string;
  family?: string;
  subFamily?: string;
  instructedAgentBic?: string;
}

export interface Camt052_053Payload {
  msgId: string;
  creDtTm: string;
  recipientName: string;
  recipientBic?: string;
  originalQueryMsgId: string;
  originalQueryMsgNameId?: string; // camt.060.001.07
  originalQueryCreDtTm: string;
  reportId: string;
  fromDateTime: string;
  toDateTime: string;
  accountNumber: string;
  currency?: string;
  ownerCode: string;
  servicerMemberId: string;
  servicerBic?: string;
  openingBalance?: number;
  closingBalance: number;
  entries: StatementEntry[];
}

export function buildCamt060Xml(payload: Camt060Payload): string {
  const reqMsgNm = payload.requestedMsgNameId || 'STATEMENT';
  const ccy = payload.currency || 'NGN';
  const bvn = payload.bvn || '11111111145';
  const tier = payload.accountTier || '3';
  const location = payload.transactionLocation || '013223231333';
  const channel = payload.channelCode || '2';
  const mandate = payload.mandateCode || 'MNDT-RCUR-13482';

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:camt.060.001.07">
    <AcctRptgReq>
        <GrpHdr>
            <MsgId>${payload.msgId}</MsgId>
            <CreDtTm>${payload.creDtTm}</CreDtTm>
            <MsgSndr>
                <Agt>
                    <FinInstnId>
                        <BICFI>${payload.senderBic}</BICFI>
                        <ClrSysMmbId>
                            <MmbId>${payload.senderMemberId}</MmbId>
                        </ClrSysMmbId>
                    </FinInstnId>
                </Agt>
            </MsgSndr>
        </GrpHdr>
        <RptgReq>
            <Id>${payload.reportingReqId}</Id>
            <ReqdMsgNmId>${reqMsgNm}</ReqdMsgNmId>
            <Acct>
                <Id>
                    <IBAN>${payload.accountNumber}</IBAN>
                </Id>
                <Ccy>${ccy}</Ccy>
            </Acct>
            <AcctOwnr>
                <Agt>
                    <FinInstnId>
                        <BICFI>${payload.senderBic}</BICFI>
                        <ClrSysMmbId>
                            <MmbId>${payload.accountOwnerMemberId}</MmbId>
                        </ClrSysMmbId>
                    </FinInstnId>
                </Agt>
            </AcctOwnr>
            <AcctSvcr>
                <FinInstnId>
                    <BICFI>${payload.accountServicerMemberId}</BICFI>
                    <ClrSysMmbId>
                        <MmbId>${payload.accountServicerMemberId}</MmbId>
                    </ClrSysMmbId>
                </FinInstnId>
            </AcctSvcr>
            <RptgPrd>
                <FrToDt>
                    <FrDt>${payload.fromDate}</FrDt>
                    <ToDt>${payload.toDate}</ToDt>
                </FrToDt>
                <Tp>${payload.periodType || 'ALLL'}</Tp>
            </RptgPrd>
        </RptgReq>
        <SplmtryData>
            <PlcAndNm>AdditionalVerificationDetails</PlcAndNm>
            <Envlp>
                <CustomData>
                    <CreditorInfo>
                        <AccountDesignation>1</AccountDesignation>
                        <IdType>BVN</IdType>
                        <IdValue>${bvn}</IdValue>
                        <AccountTier>${tier}</AccountTier>
                    </CreditorInfo>
                    <TransactionInfo>
                        <TransactionLocation>${location}</TransactionLocation>
                        <ChannelCode>${channel}</ChannelCode>
                        <FixedCollectionAmount>false</FixedCollectionAmount>
                        <MandateCode>${mandate}</MandateCode>
                    </TransactionInfo>
                </CustomData>
            </Envlp>
        </SplmtryData>
    </AcctRptgReq>
</ns2:Document>`;

  return xml.trim();
}

export function parseCamt060Xml(xml: string): Record<string, any> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false,
  });

  const parsed = parser.parse(xml);
  const doc = parsed['ns2:Document'] || parsed.Document || parsed;
  const root = doc.AcctRptgReq;
  if (!root) throw new Error('Invalid camt.060 XML: AcctRptgReq missing');

  const grpHdr = root.GrpHdr || {};
  const rptg = root.RptgReq || {};
  const acct = rptg.Acct || {};
  const prd = rptg.RptgPrd?.FrToDt || {};

  return {
    rawParsed: parsed,
    msgId: grpHdr.MsgId,
    creDtTm: grpHdr.CreDtTm,
    senderMemberId: grpHdr.MsgSndr?.Agt?.FinInstnId?.ClrSysMmbId?.MmbId,
    reportingReqId: rptg.Id,
    requestedMsgNameId: rptg.ReqdMsgNmId,
    accountNumber: String(acct.Id?.IBAN || acct.Id || ''),
    currency: acct.Ccy || 'NGN',
    accountOwnerMemberId: rptg.AcctOwnr?.Agt?.FinInstnId?.ClrSysMmbId?.MmbId,
    accountServicerMemberId: rptg.AcctSvcr?.FinInstnId?.ClrSysMmbId?.MmbId,
    fromDate: prd.FrDt,
    toDate: prd.ToDt,
  };
}

export function buildCamt052Xml(payload: Camt052_053Payload): string {
  const ccy = payload.currency || 'NGN';
  const entriesXml = payload.entries.map((e) => `
            <Ntry>
                <Amt Ccy="${ccy}">${e.amount.toFixed(2)}</Amt>
                <CdtDbtInd>${e.indicator}</CdtDbtInd>
                <Sts>
                    <Prtry>${e.status || 'BOOK'}</Prtry>
                </Sts>
                <BookgDt>
                    <Dt>${e.bookingDate}</Dt>
                </BookgDt>
                <ValDt>
                    <Dt>${e.valueDate}</Dt>
                </ValDt>
                <AcctSvcrRef>${e.reference}</AcctSvcrRef>
                <BkTxCd>
                    <Domn>
                        <Cd>${e.domain || 'PMNT'}</Cd>
                        <Fmly>
                            <Cd>${e.family || 'RCDT'}</Cd>
                            <SubFmlyCd>${e.subFamily || 'ESCT'}</SubFmlyCd>
                        </Fmly>
                    </Domn>
                </BkTxCd>
                <NtryDtls>
                    <TxDtls>
                        <RltdAgts>
                            <InstdAgt>
                                <FinInstnId>
                                    <BICFI>${e.instructedAgentBic || 'DEBTBNGNLXXX'}</BICFI>
                                </FinInstnId>
                            </InstdAgt>
                        </RltdAgts>
                    </TxDtls>
                </NtryDtls>
            </Ntry>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:camt.052.001.12">
    <BkToCstmrAcctRpt>
        <GrpHdr>
            <MsgId>${payload.msgId}</MsgId>
            <CreDtTm>${payload.creDtTm}</CreDtTm>
            <MsgRcpt>
                <Nm>${payload.recipientName}</Nm>
                <Id>
                    <OrgId>
                        <AnyBIC>${payload.recipientBic || 'MSGRCPT'}</AnyBIC>
                    </OrgId>
                </Id>
            </MsgRcpt>
            <OrgnlBizQry>
                <MsgId>${payload.originalQueryMsgId}</MsgId>
                <MsgNmId>${payload.originalQueryMsgNameId || 'camt.060.001.07'}</MsgNmId>
                <CreDtTm>${payload.originalQueryCreDtTm}</CreDtTm>
            </OrgnlBizQry>
        </GrpHdr>
        <Rpt>
            <Id>${payload.reportId}</Id>
            <FrToDt>
                <FrDtTm>${payload.fromDateTime}</FrDtTm>
                <ToDtTm>${payload.toDateTime}</ToDtTm>
            </FrToDt>
            <Acct>
                <Id>
                    <IBAN>${payload.accountNumber}</IBAN>
                </Id>
                <Ccy>${ccy}</Ccy>
                <Ownr>
                    <Id>
                        <OrgId>
                            <Othr>
                                <SchmeNm>
                                    <Cd>${payload.ownerCode}</Cd>
                                    <Prtry>${payload.ownerCode}</Prtry>
                                </SchmeNm>
                            </Othr>
                        </OrgId>
                    </Id>
                </Ownr>
                <Svcr>
                    <FinInstnId>
                        <BICFI>${payload.servicerBic || payload.servicerMemberId}</BICFI>
                        <ClrSysMmbId>
                            <MmbId>${payload.servicerMemberId}</MmbId>
                        </ClrSysMmbId>
                    </FinInstnId>
                </Svcr>
            </Acct>
            <Bal>
                <Tp>
                    <CdOrPrtry>
                        <Prtry>CLRG</Prtry>
                    </CdOrPrtry>
                </Tp>
                <Amt Ccy="${ccy}">${payload.closingBalance.toFixed(2)}</Amt>
                <CdtDbtInd>CRDT</CdtDbtInd>
                <Dt>
                    <DtTm>${payload.toDateTime}</DtTm>
                </Dt>
            </Bal>
            ${entriesXml}
        </Rpt>
    </BkToCstmrAcctRpt>
</ns2:Document>`;

  return xml.trim();
}

export function buildCamt053Xml(payload: Camt052_053Payload): string {
  const ccy = payload.currency || 'NGN';
  const opBal = payload.openingBalance !== undefined ? payload.openingBalance : payload.closingBalance;

  const entriesXml = payload.entries.map((e) => `
            <Ntry>
                <Amt Ccy="${ccy}">${e.amount.toFixed(2)}</Amt>
                <CdtDbtInd>${e.indicator}</CdtDbtInd>
                <Sts>
                    <Cd>BOOK</Cd>
                    <Prtry>BOOK</Prtry>
                </Sts>
                <BookgDt>
                    <Dt>${e.bookingDate}</Dt>
                </BookgDt>
                <ValDt>
                    <Dt>${e.valueDate}</Dt>
                </ValDt>
                <AcctSvcrRef>${e.reference}</AcctSvcrRef>
                <BkTxCd>
                    <Domn>
                        <Cd>${e.domain || 'PMNT'}</Cd>
                        <Fmly>
                            <Cd>${e.family || (e.indicator === 'CRDT' ? 'RCDT' : 'DBDT')}</Cd>
                            <SubFmlyCd>${e.subFamily || 'ESCT'}</SubFmlyCd>
                        </Fmly>
                    </Domn>
                </BkTxCd>
                <NtryDtls>
                    <TxDtls>
                        <RltdAgts>
                            <InstdAgt>
                                <FinInstnId>
                                    <BICFI>${e.instructedAgentBic || 'DEBTBNGNLXXX'}</BICFI>
                                </FinInstnId>
                            </InstdAgt>
                        </RltdAgts>
                    </TxDtls>
                </NtryDtls>
            </Ntry>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:camt.053.001.12">
    <BkToCstmrStmt>
        <GrpHdr>
            <MsgId>${payload.msgId}</MsgId>
            <CreDtTm>${payload.creDtTm}</CreDtTm>
            <MsgRcpt>
                <Nm>${payload.recipientName}</Nm>
                <Id>
                    <OrgId>
                        <AnyBIC>${payload.recipientBic || 'MSGRCPT'}</AnyBIC>
                    </OrgId>
                </Id>
            </MsgRcpt>
            <OrgnlBizQry>
                <MsgId>${payload.originalQueryMsgId}</MsgId>
                <MsgNmId>${payload.originalQueryMsgNameId || 'camt.060.001.07'}</MsgNmId>
                <CreDtTm>${payload.originalQueryCreDtTm}</CreDtTm>
            </OrgnlBizQry>
        </GrpHdr>
        <Stmt>
            <Id>${payload.reportId}</Id>
            <FrToDt>
                <FrDtTm>${payload.fromDateTime}</FrDtTm>
                <ToDtTm>${payload.toDateTime}</ToDtTm>
            </FrToDt>
            <Acct>
                <Id>
                    <IBAN>${payload.accountNumber}</IBAN>
                </Id>
                <Ccy>${ccy}</Ccy>
                <Ownr>
                    <Id>
                        <OrgId>
                            <Othr>
                                <SchmeNm>
                                    <Cd>${payload.ownerCode}</Cd>
                                    <Prtry>${payload.ownerCode}</Prtry>
                                </SchmeNm>
                            </Othr>
                        </OrgId>
                    </Id>
                </Ownr>
                <Svcr>
                    <FinInstnId>
                        <BICFI>${payload.servicerBic || 'XYZBNGNLXXX'}</BICFI>
                        <ClrSysMmbId>
                            <MmbId>${payload.servicerMemberId}</MmbId>
                        </ClrSysMmbId>
                    </FinInstnId>
                </Svcr>
            </Acct>
            <Bal>
                <Tp>
                    <CdOrPrtry>
                        <Cd>OPBD</Cd>
                        <Prtry>CLRG</Prtry>
                    </CdOrPrtry>
                </Tp>
                <Amt Ccy="${ccy}">${opBal.toFixed(2)}</Amt>
                <CdtDbtInd>CRDT</CdtDbtInd>
                <Dt>
                    <DtTm>${payload.fromDateTime}</DtTm>
                </Dt>
            </Bal>
            <Bal>
                <Tp>
                    <CdOrPrtry>
                        <Cd>CLBD</Cd>
                        <Prtry>CLRG</Prtry>
                    </CdOrPrtry>
                </Tp>
                <Amt Ccy="${ccy}">${payload.closingBalance.toFixed(2)}</Amt>
                <CdtDbtInd>CRDT</CdtDbtInd>
                <Dt>
                    <DtTm>${payload.toDateTime}</DtTm>
                </Dt>
            </Bal>
            ${entriesXml}
        </Stmt>
    </BkToCstmrStmt>
</ns2:Document>`;

  return xml.trim();
}

export function parseCamt052Or053Xml(xml: string): Record<string, any> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false,
  });

  const parsed = parser.parse(xml);
  const doc = parsed['ns2:Document'] || parsed.Document || parsed;
  const root = doc.BkToCstmrAcctRpt || doc.BkToCstmrStmt;
  if (!root) throw new Error('Invalid camt XML: missing BkToCstmrAcctRpt or BkToCstmrStmt');

  const grpHdr = root.GrpHdr || {};
  const body = root.Rpt || root.Stmt || {};
  const acct = body.Acct || {};

  const bals = Array.isArray(body.Bal) ? body.Bal : (body.Bal ? [body.Bal] : []);
  const entries = Array.isArray(body.Ntry) ? body.Ntry : (body.Ntry ? [body.Ntry] : []);

  return {
    rawParsed: parsed,
    msgId: grpHdr.MsgId,
    creDtTm: grpHdr.CreDtTm,
    originalQueryMsgId: grpHdr.OrgnlBizQry?.MsgId,
    reportId: body.Id,
    accountNumber: String(acct.Id?.IBAN || acct.Id || ''),
    balances: bals.map((b: any) => ({
      type: b.Tp?.CdOrPrtry?.Cd || b.Tp?.CdOrPrtry?.Prtry,
      amount: parseFloat(b.Amt?.['#text'] || b.Amt || '0'),
      indicator: b.CdtDbtInd,
    })),
    entriesCount: entries.length,
  };
}

export function buildCamt052_053Xml(type: 'camt.052' | 'camt.053', payload: Camt052_053Payload): string {
  return type === 'camt.052' ? buildCamt052Xml(payload) : buildCamt053Xml(payload);
}
