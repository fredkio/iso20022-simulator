import { NextRequest, NextResponse } from 'next/server';
import { ISO_REGISTRY } from '@/core/iso20022/registry';
import { buildAcmt023Xml, buildAcmt024Xml } from '@/core/iso20022/acmt';
import { buildPacs008Xml } from '@/core/iso20022/pacs008';
import { buildPacs002Xml } from '@/core/iso20022/pacs002';
import { buildPacs003Xml } from '@/core/iso20022/pacs003';
import { buildPacs028Xml } from '@/core/iso20022/pacs028';
import { buildCamt060Xml, buildCamt052_053Xml } from '@/core/iso20022/camt';
import { buildPain009Xml, buildPain012Xml, buildPain010Xml, buildPain011Xml } from '@/core/iso20022/mandates';
import { buildPain013Xml, buildPain014Xml } from '@/core/iso20022/rtp';
import { buildPain008Xml, buildPain002Xml } from '@/core/iso20022/direct-debit';

function getSampleXmlForType(type: string): string {
  const nowIso = new Date().toISOString();
  const today = nowIso.split('T')[0];

  switch (type) {
    case 'acmt.023.001.04':
      return buildAcmt023Xml({
        msgId: `MSG023${Date.now()}`,
        creDtTm: nowIso,
        senderBic: 'NAIJANG',
        receiverBic: 'METRNG',
        verificationId: `VRF${Date.now()}`,
        accountNumber: '0334455667',
      });

    case 'acmt.024.001.04':
      return buildAcmt024Xml({
        msgId: `MSG024${Date.now()}`,
        creDtTm: nowIso,
        senderBic: 'METRNG',
        receiverBic: 'NAIJANG',
        originalVerificationId: `VRF${Date.now()}`,
        isVerified: true,
        reasonCode: 'VALID',
        reasonDescription: 'Account verified successfully',
        accountNumber: '0334455667',
        verifiedPartyName: 'Adaeze Okafor - Savings',
        destinationBic: 'METRNG',
        bvn: '2211232344',
        accountTier: '1',
        riskRating: 'R000000000000000000B9',
      });

    case 'pacs.008.001.12':
      return buildPacs008Xml({
        msgId: `MSG008${Date.now()}`,
        creDtTm: nowIso,
        numberOfTransactions: 1,
        settlementDate: today,
        settlementAmount: 25000,
        currency: 'NGN',
        instructingAgentBic: 'NAIJANG',
        instructedAgentBic: 'METRNG',
        instructionId: `INST${Date.now()}`,
        endToEndId: `E2E${Date.now()}`,
        transactionId: `TX${Date.now()}`,
        uetr: 'c4a1b2c3-d4e5-4f6a-8b9c-0d1e2f3a4b5c',
        amount: 25000,
        debtorName: 'Fred Okon - Savings',
        debtorAccount: '0112345678',
        debtorAgentBic: 'NAIJANG',
        creditorName: 'Adaeze Okafor - Savings',
        creditorAccount: '0334455667',
        creditorAgentBic: 'METRNG',
        remittanceInformation: 'Monthly invoice payment',
      });

    case 'pacs.002.001.12':
      return buildPacs002Xml({
        msgId: `MSG002${Date.now()}`,
        creDtTm: nowIso,
        senderBic: 'METRNG',
        receiverBic: 'NAIJANG',
        originalMsgId: `MSG008${Date.now()}`,
        originalMsgNameId: 'pacs.008.001.12',
        originalEndToEndId: `E2E${Date.now()}`,
        originalTxId: `TX${Date.now()}`,
        originalUetr: 'c4a1b2c3-d4e5-4f6a-8b9c-0d1e2f3a4b5c',
        groupStatus: 'ACSC',
        transactionStatus: 'ACSC',
        instgAgtMemberId: '033',
        instdAgtMemberId: '011',
      });

    case 'pacs.003.001.11':
      return buildPacs003Xml({
        msgId: `MSG003${Date.now()}`,
        creDtTm: nowIso,
        amount: 15000,
        currency: 'NGN',
        settlementDate: today,
        creditorBankBic: 'METRNG',
        creditorBankMemberId: '033',
        debtorBankBic: 'NAIJANG',
        debtorBankMemberId: '011',
        instructionId: `INST003${Date.now()}`,
        endToEndId: `E2E003${Date.now()}`,
        txId: `TX003${Date.now()}`,
        mandateId: 'MNDT-RCUR-001',
        creditorName: 'Adaeze Okafor',
        creditorAccount: '0334455667',
        debtorName: 'Fred Okon',
        debtorAccount: '0112345678',
        narration: 'Monthly Utility Direct Debit',
      });

    case 'pacs.028.001.06':
      return buildPacs028Xml({
        msgId: `MSG028${Date.now()}`,
        creDtTm: nowIso,
        instgAgtMemberId: '011',
        instdAgtMemberId: '033',
        originalMsgId: `MSG008${Date.now()}`,
        originalMsgNameId: 'pacs.008.001.12',
        originalCreDtTm: nowIso,
        statusRequestId: `STSRQ${Date.now()}`,
        originalTxId: `TX${Date.now()}`,
        settlementDate: today,
      });

    case 'camt.060.001.07':
      return buildCamt060Xml({
        msgId: `MSG060${Date.now()}`,
        creDtTm: nowIso,
        senderBic: 'NAIJANG',
        senderMemberId: '011',
        reportingReqId: `RPTREQ${Date.now()}`,
        requestedMsgNameId: 'STATEMENT',
        accountNumber: '0112345678',
        accountOwnerMemberId: '011',
        accountServicerMemberId: '011',
        fromDate: today,
        toDate: today,
      });

    case 'camt.052.001.12':
      return buildCamt052_053Xml('camt.052', {
        msgId: `MSG052${Date.now()}`,
        creDtTm: nowIso,
        recipientName: 'Instructing Agent',
        originalQueryMsgId: `MSG060${Date.now()}`,
        originalQueryCreDtTm: nowIso,
        reportId: `RPT052${Date.now()}`,
        fromDateTime: nowIso,
        toDateTime: nowIso,
        accountNumber: '0112345678',
        currency: 'NGN',
        ownerCode: 'bank-a',
        servicerMemberId: '011',
        openingBalance: 2400000,
        closingBalance: 2385000,
        entries: [
          {
            amount: 15000,
            indicator: 'DBIT',
            bookingDate: today,
            valueDate: today,
            reference: 'INT-CLR-001',
          },
        ],
      });

    case 'camt.053.001.12':
      return buildCamt052_053Xml('camt.053', {
        msgId: `MSG053${Date.now()}`,
        creDtTm: nowIso,
        recipientName: 'Instructing Agent',
        originalQueryMsgId: `MSG060${Date.now()}`,
        originalQueryCreDtTm: nowIso,
        reportId: `STMT053${Date.now()}`,
        fromDateTime: nowIso,
        toDateTime: nowIso,
        accountNumber: '0112345678',
        currency: 'NGN',
        ownerCode: 'bank-a',
        servicerMemberId: '011',
        openingBalance: 2400000,
        closingBalance: 2385000,
        entries: [
          {
            amount: 15000,
            indicator: 'DBIT',
            bookingDate: today,
            valueDate: today,
            reference: 'EOD-SETTLEMENT-01',
          },
        ],
      });

    case 'pain.009.001.08':
      return buildPain009Xml({
        msgId: `MSG009${Date.now()}`,
        creDtTm: nowIso,
        mandateId: `MNDT-${Date.now()}`,
        sequenceType: 'RCUR',
        frequency: 'MNTH',
        firstCollectionDate: today,
        collectionAmount: 30000,
        currency: 'NGN',
        creditorName: 'Adaeze Okafor',
        creditorAccount: '0334455667',
        creditorBankBic: 'METRNG',
        creditorBankMemberId: '033',
        debtorName: 'Fred Okon',
        debtorAccount: '0112345678',
        debtorBankBic: 'NAIJANG',
        debtorBankMemberId: '011',
      });

    case 'pain.012.001.08':
      return buildPain012Xml({
        msgId: `MSG012${Date.now()}`,
        creDtTm: nowIso,
        originalMsgId: `MSG009${Date.now()}`,
        originalCreDtTm: nowIso,
        originalMandateId: `MNDT-1001`,
        accepted: true,
        reasonDescription: 'Mandate accepted by Debtor Agent',
        mandateDetails: {
          mandateId: 'MNDT-1001',
          creditorName: 'Adaeze Okafor',
          creditorAccount: '0334455667',
          creditorBankMemberId: '033',
          debtorName: 'Fred Okon',
          debtorAccount: '0112345678',
          debtorBankMemberId: '011',
          collectionAmount: 30000,
        },
      });

    case 'pain.010.001.08':
      return buildPain010Xml({
        msgId: `MSG010${Date.now()}`,
        creDtTm: nowIso,
        mandateId: 'MNDT-1001',
        frequency: 'WEEK',
        collectionAmount: 35000,
        currency: 'NGN',
        creditorName: 'Adaeze Okafor',
        creditorAccount: '0334455667',
        creditorBankMemberId: '033',
        debtorName: 'Fred Okon',
        debtorAccount: '0112345678',
        debtorBankMemberId: '011',
        amendmentReasonCode: 'MD01',
      });

    case 'pain.011.001.08':
      return buildPain011Xml({
        msgId: `MSG011${Date.now()}`,
        creDtTm: nowIso,
        mandateId: 'MNDT-1001',
        creditorName: 'Adaeze Okafor',
        creditorAccount: '0334455667',
        creditorBankMemberId: '033',
        debtorName: 'Fred Okon',
        debtorAccount: '0112345678',
        debtorBankMemberId: '011',
        cancellationReasonCode: 'CNCL',
      });

    case 'pain.013.001.11':
      return buildPain013Xml({
        msgId: `MSG013${Date.now()}`,
        creDtTm: nowIso,
        initiatingPartyName: 'Adaeze Okafor',
        initiatingPartyOrgId: 'RC999888',
        paymentInfoId: `PMTINFO${Date.now()}`,
        requiredExecutionDateTime: nowIso,
        debtorName: 'Fred Okon',
        debtorAccount: '0112345678',
        debtorBankBic: 'NAIJANG',
        debtorBankMemberId: '011',
        creditorName: 'Adaeze Okafor',
        creditorAccount: '0334455667',
        creditorBankBic: 'METRNG',
        creditorBankMemberId: '033',
        endToEndId: `E2ERTP${Date.now()}`,
        amount: 18500,
        currency: 'NGN',
        purpose: 'E-commerce Checkout',
      });

    case 'pain.014.001.11':
      return buildPain014Xml({
        msgId: `MSG014${Date.now()}`,
        creDtTm: nowIso,
        initiatingPartyName: 'Fred Okon',
        creditorName: 'Adaeze Okafor',
        creditorAccount: '0334455667',
        debtorName: 'Fred Okon',
        debtorAccount: '0112345678',
        debtorBankBic: 'NAIJANG',
        debtorBankMemberId: '011',
        creditorBankBic: 'METRNG',
        creditorBankMemberId: '033',
        originalMsgId: `MSG013${Date.now()}`,
        originalCreDtTm: nowIso,
        originalEndToEndId: `E2ERTP123`,
        status: 'ACCP',
      });

    case 'pain.008.001.11':
      return buildPain008Xml({
        msgId: `MSG008DD${Date.now()}`,
        creDtTm: nowIso,
        initiatingPartyName: 'Adaeze Okafor',
        paymentInfoId: `PMTINFO${Date.now()}`,
        amount: 12000,
        currency: 'NGN',
        requestedCollectionDate: today,
        creditorName: 'Adaeze Okafor',
        creditorAccount: '0334455667',
        creditorBankBic: 'METRNG',
        creditorBankMemberId: '033',
        instructionId: `INSTDD${Date.now()}`,
        endToEndId: `E2EDD${Date.now()}`,
        mandateId: 'MNDT-CLUB-99',
        debtorBankBic: 'NAIJANG',
        debtorBankMemberId: '011',
        debtorName: 'Fred Okon',
        debtorAccount: '0112345678',
        remittanceInfo: 'Gym Membership Fee',
      });

    case 'pain.002.001.14':
      return buildPain002Xml({
        msgId: `MSG002P${Date.now()}`,
        creDtTm: nowIso,
        initiatingPartyName: 'Adaeze Okafor',
        originalMsgId: `MSG008DD${Date.now()}`,
        groupStatus: 'ACSC',
        statusId: `STS${Date.now()}`,
        originalEndToEndId: `E2EDD123`,
        transactionStatus: 'ACSC',
      });

    default:
      return '';
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type');

  if (type) {
    const xml = getSampleXmlForType(type);
    if (!xml) {
      return NextResponse.json({ error: `No sample available for type ${type}` }, { status: 404 });
    }
    return NextResponse.json({ messageType: type, xml });
  }

  // Return all samples
  const allSamples = ISO_REGISTRY.map((def) => ({
    messageType: def.fullIdentifier,
    name: def.businessName,
    category: def.businessDomain,
    direction: def.direction,
    pairedWith: def.requestResponseRelationship?.pairedResponseType || def.requestResponseRelationship?.pairedRequestType,
    xml: getSampleXmlForType(def.fullIdentifier),
  }));

  return NextResponse.json({ samples: allSamples });
}
