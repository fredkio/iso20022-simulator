import { XMLParser } from 'fast-xml-parser';

export interface Acmt023Payload {
  msgId: string;
  creDtTm: string;
  senderBic: string;
  senderMemberId?: string;
  senderName?: string;
  receiverBic: string;
  receiverMemberId?: string;
  creatorName?: string;
  verificationId: string;
  accountNumber: string;
  partyName?: string;
}

export interface Acmt024Payload {
  msgId: string;
  creDtTm: string;
  senderBic: string;
  senderMemberId?: string;
  receiverBic: string;
  receiverMemberId?: string;
  receiverName?: string;
  originalMsgId?: string;
  originalCreDtTm?: string;
  originalVerificationId: string;
  isVerified: boolean;
  reasonCode?: string; // e.g. 'VALID' or 'AC01' (Incorrect Account)
  reasonDescription?: string;
  accountNumber: string;
  verifiedPartyName?: string;
  destinationBic: string;
  // Supplementary / Domestic Data
  accountDesignation?: string;
  idType?: string;
  idValue?: string;
  bvn?: string;
  accountTier?: string;
  riskRating?: string;
}

export function buildAcmt023Xml(payload: Acmt023Payload): string {
  const senderMmb = payload.senderMemberId || payload.senderBic;
  const receiverMmb = payload.receiverMemberId || payload.receiverBic;

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:acmt.023.001.04">
    <IdVrfctnReq>
        <Assgnmt>
            <MsgId>${payload.msgId}</MsgId>
            <CreDtTm>${payload.creDtTm}</CreDtTm>
            <Cretr>
                <Pty>
                    <Nm>${payload.creatorName || payload.senderName || 'Initiating Institution'}</Nm>
                </Pty>
            </Cretr>
            <Assgnr>
                <Pty>
                    <Nm>${payload.senderName || 'Instructing Bank'}</Nm>
                </Pty>
                <Agt>
                    <FinInstnId>
                        <BICFI>${payload.senderBic}</BICFI>
                        <ClrSysMmbId>
                            <MmbId>${senderMmb}</MmbId>
                        </ClrSysMmbId>
                    </FinInstnId>
                </Agt>
            </Assgnr>
            <Assgne>
                <Agt>
                    <FinInstnId>
                        <BICFI>${payload.receiverBic}</BICFI>
                        <ClrSysMmbId>
                            <MmbId>${receiverMmb}</MmbId>
                        </ClrSysMmbId>
                    </FinInstnId>
                </Agt>
            </Assgne>
        </Assgnmt>
        <Vrfctn>
            <Id>${payload.verificationId}</Id>
            <PtyAndAcctId>
                <Pty>
                    <Nm>${payload.partyName || 'Customer'}</Nm>
                </Pty>
                <Acct>
                    <Id>
                        <IBAN>${payload.accountNumber}</IBAN>
                    </Id>
                </Acct>
            </PtyAndAcctId>
        </Vrfctn>
    </IdVrfctnReq>
</ns2:Document>`;

  return xml.trim();
}

export function parseAcmt023Xml(xml: string): Record<string, any> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false,
  });

  const parsed = parser.parse(xml);
  const doc = parsed['ns2:Document'] || parsed.Document || parsed;
  const req = doc.IdVrfctnReq;
  if (!req) {
    throw new Error('Invalid acmt.023 XML: IdVrfctnReq block missing');
  }

  // Support both 001.04 Assgnmt/Vrfctn and 001.03 GrpHdr/HdrAndData
  const assgnmt = req.Assgnmt || req.GrpHdr || {};
  const vrfctn = req.Vrfctn || req.HdrAndData || {};
  const ptyAcct = vrfctn.PtyAndAcctId || {};
  const acct = ptyAcct.Acct || vrfctn.Acct || {};
  const acctId = acct.Id?.IBAN || acct.Id?.Othr?.Id || acct.Id;

  return {
    rawParsed: parsed,
    msgId: assgnmt.MsgId,
    creDtTm: assgnmt.CreDtTm,
    senderBic: assgnmt.Assgnr?.Agt?.FinInstnId?.BICFI || assgnmt.MsgSndr?.FinInstnId?.ClrSysMmbId?.MmbId || 'UNKNOWN',
    senderMemberId: assgnmt.Assgnr?.Agt?.FinInstnId?.ClrSysMmbId?.MmbId,
    receiverBic: assgnmt.Assgne?.Agt?.FinInstnId?.BICFI || vrfctn.Assgne?.FinInstnId?.ClrSysMmbId?.MmbId || 'UNKNOWN',
    receiverMemberId: assgnmt.Assgne?.Agt?.FinInstnId?.ClrSysMmbId?.MmbId,
    verificationId: vrfctn.Id,
    accountNumber: String(acctId || ''),
    partyName: ptyAcct.Pty?.Nm || vrfctn.Pty?.Nm,
  };
}

export function buildAcmt024Xml(payload: Acmt024Payload): string {
  const isVrf = payload.isVerified;
  const reasonCode = payload.reasonCode || (isVrf ? 'VALID' : 'AC01');
  const bvn = payload.bvn || payload.idValue || '2211232346';
  const tier = payload.accountTier || '1';
  const risk = payload.riskRating || 'R000000000000000000B9';
  const senderMmb = payload.senderMemberId || payload.senderBic;
  const receiverMmb = payload.receiverMemberId || payload.receiverBic;

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:acmt.024.001.04">
    <IdVrfctnRpt>
        <Assgnmt>
            <MsgId>${payload.msgId}</MsgId>
            <CreDtTm>${payload.creDtTm}</CreDtTm>
            <Assgnr>
                <Agt>
                    <FinInstnId>
                        <BICFI>${payload.senderBic}</BICFI>
                        <ClrSysMmbId>
                            <MmbId>${senderMmb}</MmbId>
                        </ClrSysMmbId>
                    </FinInstnId>
                </Agt>
            </Assgnr>
            <Assgne>
                <Pty>
                    <Nm>${payload.receiverName || 'Instructing Bank'}</Nm>
                </Pty>
                <Agt>
                    <FinInstnId>
                        <BICFI>${payload.receiverBic}</BICFI>
                        <ClrSysMmbId>
                            <MmbId>${receiverMmb}</MmbId>
                        </ClrSysMmbId>
                    </FinInstnId>
                </Agt>
            </Assgne>
        </Assgnmt>
        <OrgnlAssgnmt>
            <MsgId>${payload.originalMsgId || payload.originalVerificationId}</MsgId>
            <CreDtTm>${payload.originalCreDtTm || payload.creDtTm}</CreDtTm>
        </OrgnlAssgnmt>
        <Rpt>
            <OrgnlId>${payload.originalVerificationId}</OrgnlId>
            <Vrfctn>${isVrf ? 'true' : 'false'}</Vrfctn>
            <OrgnlPtyAndAcctId>
                <Acct>
                    <Id>
                        <IBAN>${payload.accountNumber}</IBAN>
                    </Id>
                </Acct>
            </OrgnlPtyAndAcctId>
            <UpdtdPtyAndAcctId>
                <Pty>
                    <Nm>${isVrf ? (payload.verifiedPartyName || 'Verified Account Holder') : 'N/A'}</Nm>
                </Pty>
            </UpdtdPtyAndAcctId>
        </Rpt>
        <SplmtryData>
            <PlcAndNm>AdditionalVerificationDetails</PlcAndNm>
            <Envlp>
                <CustomData>
                    <CreditorInfo>
                        <AccountDesignation>${payload.accountDesignation || '1'}</AccountDesignation>
                        <IdType>${payload.idType || 'BVN'}</IdType>
                        <IdValue>${bvn}</IdValue>
                        <AccountTier>${tier}</AccountTier>
                    </CreditorInfo>
                    <TransactionInfo>
                        <RiskRating>${risk}</RiskRating>
                    </TransactionInfo>
                </CustomData>
            </Envlp>
        </SplmtryData>
    </IdVrfctnRpt>
    <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
        <SignedInfo>
            <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
            <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
            <Reference URI="">
                <Transforms>
                    <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
                </Transforms>
                <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                <DigestValue>BdfBxjNeWeWcwPAveVoTGMZVX8yhECzXCFF634bi9Ew=</DigestValue>
            </Reference>
        </SignedInfo>
        <SignatureValue>XFTKT70I3Dy6VIK0yFd0WZ6Af3cOXuprIU4/NtyqLx4/wEq+Kz3u60UVJgRMR+BEOnfcPOS9mfGa
nXCKqlkf9GIs7MM/OL8guex/jeHNVArAhpgMOUy1gh6SVLr3xLPq/jbbrCLPjie+qqOY07IDbcVK
VtnmgH2RM+iwgjC/iiCMFhjJj6cgaVl/XEDDyPG7cghMuswtHcxKHvgSTiF+6xYyhc3tWrMGrGfY
bZJAATcVAgxAQMEAzFAikO94UIItQnK7RzHlebFiAKucrot8JRTQbuGoVAuGM2zRRUZJF+OVINNG
AsbzewwaOMSRE/y5cjiVY7dzokbnDD7nI23b/g==</SignatureValue>
    </Signature>
</ns2:Document>`;

  return xml.trim();
}

export function parseAcmt024Xml(xml: string): Record<string, any> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false,
  });

  const parsed = parser.parse(xml);
  const doc = parsed['ns2:Document'] || parsed.Document || parsed;
  const rpt = doc.IdVrfctnRpt;
  if (!rpt) {
    throw new Error('Invalid acmt.024 XML: IdVrfctnRpt block missing');
  }

  // Support both 001.04 and 001.03
  const assgnmt = rpt.Assgnmt || rpt.GrpHdr || {};
  const report = rpt.Rpt || rpt.RptOrErr?.Rpt || {};
  const updated = report.UpdtdPtyAndAcctId || {};
  const orgnlPty = report.OrgnlPtyAndAcctId || {};
  const acctId = orgnlPty.Acct?.Id?.IBAN || orgnlPty.Acct?.Id?.Othr?.Id || updated.Acct?.Id?.Othr?.Id;

  // Supplementary data
  const splmtry = rpt.SplmtryData?.Envlp?.CustomData || {};
  const credInfo = splmtry.CreditorInfo || {};
  const txInfo = splmtry.TransactionInfo || {};

  const isVerified = report.Vrfctn === 'true' || report.Vrfctn === true;

  return {
    rawParsed: parsed,
    msgId: assgnmt.MsgId,
    creDtTm: assgnmt.CreDtTm,
    senderBic: assgnmt.Assgnr?.Agt?.FinInstnId?.BICFI || assgnmt.MsgSndr?.FinInstnId?.ClrSysMmbId?.MmbId || 'UNKNOWN',
    senderMemberId: assgnmt.Assgnr?.Agt?.FinInstnId?.ClrSysMmbId?.MmbId,
    receiverBic: assgnmt.Assgne?.Agt?.FinInstnId?.BICFI || 'UNKNOWN',
    receiverMemberId: assgnmt.Assgne?.Agt?.FinInstnId?.ClrSysMmbId?.MmbId,
    originalVerificationId: report.OrgnlId,
    isVerified,
    reasonCode: isVerified ? 'VALID' : (report.Rsn?.Cd || 'AC01'),
    accountNumber: String(acctId || ''),
    verifiedPartyName: updated.Pty?.Nm,
    hasSignature: Boolean(doc.Signature),
    bvn: credInfo.IdValue,
    accountTier: credInfo.AccountTier,
    riskRating: txInfo.RiskRating,
  };
}
