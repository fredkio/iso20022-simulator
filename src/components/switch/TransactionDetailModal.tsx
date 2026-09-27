'use client';

import React, { useState, useEffect } from 'react';
import { CanonicalPayment, IsoStoredMessage, TransactionEvent, ValidationLayerResult, JournalEntry } from '@/types';
import {
  X,
  FileCode,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  Landmark,
  ArrowRight,
  Copy,
  Check,
  Search,
  BookOpen,
  DollarSign,
  Share2,
} from 'lucide-react';

interface TransactionDetailModalProps {
  uetr: string | null;
  onClose: () => void;
}

export default function TransactionDetailModal({ uetr, onClose }: TransactionDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ISO_FIELDS' | 'XML' | 'EVENTS' | 'VALIDATION' | 'LEDGER' | 'JOURNEY'>('OVERVIEW');
  const [data, setData] = useState<{
    transaction: CanonicalPayment;
    isoMessages: IsoStoredMessage[];
    events: TransactionEvent[];
    validations: ValidationLayerResult[];
    journalEntries: JournalEntry[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedXmlMsg, setSelectedXmlMsg] = useState<string>('pacs.008');

  useEffect(() => {
    if (!uetr) return;
    setLoading(true);
    fetch(`/api/switch/transactions/${uetr}/trace`)
      .then((res) => res.json())
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [uetr]);

  if (!uetr) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const acmt023 = data?.isoMessages.find((m) => m.messageType.includes('acmt.023'));
  const acmt024 = data?.isoMessages.find((m) => m.messageType.includes('acmt.024'));
  const pacs008 = data?.isoMessages.find((m) => m.messageType.includes('pacs.008'));
  const pacs002 = data?.isoMessages.find((m) => m.messageType.includes('pacs.002'));

  let currentXml = pacs008?.rawXml;
  if (selectedXmlMsg === 'acmt.023') currentXml = acmt023?.rawXml;
  else if (selectedXmlMsg === 'acmt.024') currentXml = acmt024?.rawXml;
  else if (selectedXmlMsg === 'pacs.002') currentXml = pacs002?.rawXml;
  else if (selectedXmlMsg === 'pacs.008') currentXml = pacs008?.rawXml;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/70 rounded-t-xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-500">UETR:</span>
              <span className="font-mono text-sm font-bold text-slate-900">{uetr}</span>
              {data?.transaction && (
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    data.transaction.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {data.transaction.status}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive Switch Transaction Trace & Multi-Layer ISO 20022 Audit Inspector
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-200 px-6 bg-white overflow-x-auto text-xs font-medium">
          {[
            { id: 'OVERVIEW', label: 'Overview', icon: BookOpen },
            { id: 'ISO_FIELDS', label: 'ISO Fields Inspector', icon: Layers },
            { id: 'XML', label: 'Verbatim ISO XML', icon: FileCode },
            { id: 'EVENTS', label: `Events Timeline (${data?.events.length || 0})`, icon: Clock },
            { id: 'VALIDATION', label: 'Validation Layers (6)', icon: CheckCircle2 },
            { id: 'LEDGER', label: 'Double-Entry Ledger', icon: DollarSign },
            { id: 'JOURNEY', label: 'Message Journey', icon: Share2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 py-3 px-3.5 border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-slate-900 text-slate-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-white text-slate-800">
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <Clock className="h-8 w-8 mx-auto animate-spin mb-2" />
              <p className="text-sm">Retrieving transaction trace from Switch Store...</p>
            </div>
          ) : !data?.transaction ? (
            <div className="py-12 text-center text-slate-400">
              <p>Transaction records could not be found for this UETR.</p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'OVERVIEW' && (
                <div className="space-y-6">
                  {/* Top Summary Card */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Settled Amount</span>
                      <p className="text-xl font-bold text-slate-900">
                        {data.transaction.currency} {data.transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Local Instrument</span>
                      <p className="text-sm font-semibold text-slate-800 font-mono mt-0.5">
                        {data.transaction.localInstrument} (Instant Transfer)
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Switch Processing Latency</span>
                      <p className="text-sm font-semibold text-emerald-700 font-mono mt-0.5">
                        {data.transaction.latencyMs ? `${data.transaction.latencyMs} ms` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Charge Bearer</span>
                      <p className="text-sm font-semibold text-slate-800 font-mono mt-0.5">{data.transaction.chargeBearer} (Standard)</p>
                    </div>
                  </div>

                  {/* Flow Route Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-lg border border-slate-200 bg-white shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                        {data.transaction.originatingInstitution.code.slice(0, 3)}
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Debtor (Sender)</span>
                        <h4 className="font-bold text-slate-900 text-sm">{data.transaction.debtor.name}</h4>
                        <p className="text-xs text-slate-500 font-mono">
                          {data.transaction.originatingInstitution.name} • Acct: {data.transaction.debtor.accountNumber}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 py-2 sm:py-0 text-slate-400">
                      <span className="h-px w-12 bg-slate-200" />
                      <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        CENTRAL SWITCH
                      </span>
                      <ArrowRight className="h-4 w-4 text-emerald-600" />
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Creditor (Beneficiary)</span>
                        <h4 className="font-bold text-slate-900 text-sm">{data.transaction.creditor.name}</h4>
                        <p className="text-xs text-slate-500 font-mono">
                          {data.transaction.destinationInstitution.name} • Acct: {data.transaction.creditor.accountNumber}
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                        {data.transaction.destinationInstitution.code.slice(0, 3)}
                      </div>
                    </div>
                  </div>

                  {/* Canonical Identification Table */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Canonical Identifiers</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-semibold block">Instruction ID (InstrId)</span>
                        <span className="font-mono text-slate-800 font-medium break-all">{data.transaction.instructionId}</span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-semibold block">End-to-End ID (EndToEndId)</span>
                        <span className="font-mono text-slate-800 font-medium break-all">{data.transaction.endToEndId}</span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-semibold block">Clearing Tx ID (TxId)</span>
                        <span className="font-mono text-slate-800 font-medium break-all">{data.transaction.txId}</span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 font-semibold block">Status Reason Code</span>
                        <span className="font-mono text-slate-800 font-medium">
                          {data.transaction.statusReasonCode || 'ACTC (Accepted)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ISO FIELDS INSPECTOR */}
              {activeTab === 'ISO_FIELDS' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                    <p className="font-semibold">Educational ISO 20022 Data Dictionary</p>
                    <p className="text-[11px] mt-0.5">
                      Translates raw XML tags into standard financial domain nomenclature for business users and payment engineers.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Block A: Group Header */}
                    <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs">
                      <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3 flex items-center justify-between">
                        <span>Group Header (GrpHdr)</span>
                        <span className="text-[10px] font-mono text-slate-400">pacs.008.001.10</span>
                      </h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between"><dt className="text-slate-500">MsgId (Message ID):</dt><dd className="font-mono font-medium">{pacs008?.messageId}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">CreDtTm (Creation Timestamp):</dt><dd className="font-mono">{pacs008?.receivedAt}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">NbOfTxs (Number of Transactions):</dt><dd className="font-mono">1</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">SttlmMtd (Settlement Method):</dt><dd className="font-mono font-bold text-emerald-700">CLRG (Clearing System)</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">ClrSys (Clearing System):</dt><dd className="font-mono">NPS (National Payment Switch)</dd></div>
                      </dl>
                    </div>

                    {/* Block B: Payment Identification */}
                    <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs">
                      <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3">
                        Payment Identification (PmtId)
                      </h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between"><dt className="text-slate-500">UETR (End-to-End Tracking):</dt><dd className="font-mono font-bold text-slate-900 break-all">{data.transaction.uetr}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">InstrId (Instruction ID):</dt><dd className="font-mono break-all">{data.transaction.instructionId}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">EndToEndId:</dt><dd className="font-mono break-all">{data.transaction.endToEndId}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">TxId (Transaction ID):</dt><dd className="font-mono">{data.transaction.txId}</dd></div>
                      </dl>
                    </div>

                    {/* Block C: Settlement & Payment Type */}
                    <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs">
                      <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3">
                        Settlement & Instrument (PmtTpInf)
                      </h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between"><dt className="text-slate-500">IntrBkSttlmAmt (Settlement Amount):</dt><dd className="font-mono font-bold text-slate-900">₦{data.transaction.amount.toFixed(2)}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">Ccy (Currency):</dt><dd className="font-mono font-bold text-emerald-700">{data.transaction.currency}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">SvcLvl/Cd (Service Level):</dt><dd className="font-mono">INST (Instant Processing)</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">LclInstrm/Prtry (Local Instrument):</dt><dd className="font-mono">INST</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">CtgyPurp/Cd (Category Purpose):</dt><dd className="font-mono">CASH</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">ChrgBr (Charge Bearer):</dt><dd className="font-mono">SLEV (Following Service Level)</dd></div>
                      </dl>
                    </div>

                    {/* Block D: Debtor & Creditor Parties */}
                    <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs">
                      <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3">
                        Agents & Accounts (Dbtr / Cdtr)
                      </h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between"><dt className="text-slate-500">Dbtr/Nm (Debtor Name):</dt><dd className="font-semibold">{data.transaction.debtor.name}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">DbtrAcct (Debtor Account):</dt><dd className="font-mono">{data.transaction.debtor.accountNumber}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">DbtrAgt (Originating BIC):</dt><dd className="font-mono font-bold text-emerald-700">{data.transaction.originatingInstitution.code}</dd></div>
                        <div className="flex justify-between pt-1 border-t border-slate-100"><dt className="text-slate-500">Cdtr/Nm (Creditor Name):</dt><dd className="font-semibold">{data.transaction.creditor.name}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">CdtrAcct (Creditor Account):</dt><dd className="font-mono">{data.transaction.creditor.accountNumber}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500">CdtrAgt (Destination BIC):</dt><dd className="font-mono font-bold text-blue-700">{data.transaction.destinationInstitution.code}</dd></div>
                      </dl>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: VERBATIM ISO XML */}
              {activeTab === 'XML' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {acmt023 && (
                        <button
                          onClick={() => setSelectedXmlMsg('acmt.023')}
                          className={`px-2.5 py-1.5 rounded text-xs font-mono font-semibold transition-colors ${
                            selectedXmlMsg === 'acmt.023'
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          acmt.023 (Verification Req)
                        </button>
                      )}
                      {acmt024 && (
                        <button
                          onClick={() => setSelectedXmlMsg('acmt.024')}
                          className={`px-2.5 py-1.5 rounded text-xs font-mono font-semibold transition-colors ${
                            selectedXmlMsg === 'acmt.024'
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          acmt.024 (Verification Rpt)
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedXmlMsg('pacs.008')}
                        className={`px-2.5 py-1.5 rounded text-xs font-mono font-semibold transition-colors ${
                          selectedXmlMsg === 'pacs.008'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        pacs.008 (Credit Transfer)
                      </button>
                      {pacs002 && (
                        <button
                          onClick={() => setSelectedXmlMsg('pacs.002')}
                          className={`px-2.5 py-1.5 rounded text-xs font-mono font-semibold transition-colors ${
                            selectedXmlMsg === 'pacs.002'
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          pacs.002 (Payment Status)
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => currentXml && copyToClipboard(currentXml)}
                      className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 bg-white px-2.5 py-1.5 rounded shadow-xs"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy XML'}
                    </button>
                  </div>

                  <div className="relative rounded-lg bg-slate-950 p-4 text-emerald-400 font-mono text-xs overflow-x-auto max-h-[460px] border border-slate-800">
                    <pre className="whitespace-pre">
                      {currentXml || '<!-- No XML stored for this message -->'}
                    </pre>
                  </div>
                </div>
              )}

              {/* TAB 4: EVENTS TIMELINE */}
              {activeTab === 'EVENTS' && (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {data.events.map((evt) => (
                    <div key={evt.id} className="relative flex items-start gap-3 text-xs">
                      <span
                        className={`absolute -left-6 top-1 h-4 w-4 rounded-full border-2 border-white flex items-center justify-center ${
                          evt.status === 'SUCCESS'
                            ? 'bg-emerald-500'
                            : evt.status === 'ERROR'
                            ? 'bg-red-500'
                            : 'bg-blue-500'
                        }`}
                      />
                      <div className="flex-1 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="rounded bg-slate-200 text-slate-800 px-1.5 py-0.2 text-[9px] font-mono">
                              {evt.actor}
                            </span>
                            {evt.eventCode}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(evt.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-1">{evt.description}</p>
                        {evt.details && Object.keys(evt.details).length > 0 && (
                          <div className="mt-2 p-2 rounded bg-white border border-slate-100 font-mono text-[10px] text-slate-500 overflow-x-auto">
                            {JSON.stringify(evt.details)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 5: VALIDATION LAYERS */}
              {activeTab === 'VALIDATION' && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800">Switch 6-Layer Multi-Stage Gatekeeper</p>
                    <p className="text-[11px] mt-0.5">
                      Evaluates XML well-formedness, XSD schema conformity, scheme-specific business rules, participant authentication, idempotency, and routing resolution.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {data.validations.map((v, i) => (
                      <div
                        key={v.layer}
                        className="flex items-start justify-between p-3 rounded-lg border border-slate-200 bg-white"
                      >
                        <div className="flex items-start gap-3">
                          <span className="font-mono text-xs font-bold text-slate-400 mt-0.5">0{i + 1}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900 text-xs">{v.layer.replace(/_/g, ' ')}</h4>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  v.status === 'PASS'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {v.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">{v.summary}</p>
                            {v.details && (
                              <pre className="mt-1 font-mono text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 overflow-x-auto">
                                {JSON.stringify(v.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: DOUBLE-ENTRY LEDGER */}
              {activeTab === 'LEDGER' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                    <p className="font-semibold">Simulated Financial Consequences (Double-Entry Balanced Ledgers)</p>
                    <p className="text-[11px] mt-0.5">
                      Transactions execute balanced journal entries at each independent institution. Total Debits strictly equal Total Credits.
                    </p>
                  </div>

                  {data.journalEntries.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No ledger journal postings recorded for this transaction.</p>
                  ) : (
                    <div className="space-y-4">
                      {data.journalEntries.map((je) => (
                        <div key={je.id} className="border border-slate-200 rounded-lg p-4 bg-white shadow-xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                            <div>
                              <span className="font-bold text-slate-900 text-xs">{je.description}</span>
                              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                                Institution: {je.institutionId.toUpperCase()} • Ref: {je.reference}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">
                              {new Date(je.postedAt).toLocaleTimeString()}
                            </span>
                          </div>

                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                                <th className="pb-1">Direction</th>
                                <th className="pb-1">General Ledger Account</th>
                                <th className="pb-1 text-right">Debit (₦)</th>
                                <th className="pb-1 text-right">Credit (₦)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {je.lines.map((line) => (
                                <tr key={line.id}>
                                  <td className="py-1.5">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        line.direction === 'DEBIT' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {line.direction}
                                    </span>
                                  </td>
                                  <td className="py-1.5 text-slate-800">{line.ledgerAccountName}</td>
                                  <td className="py-1.5 text-right font-medium">
                                    {line.direction === 'DEBIT' ? line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                  </td>
                                  <td className="py-1.5 text-right font-medium">
                                    {line.direction === 'CREDIT' ? line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: MESSAGE JOURNEY */}
              {activeTab === 'JOURNEY' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs">
                    <h4 className="font-bold text-slate-900 mb-2">Message Lifecycle Correlation Graph</h4>
                    <p className="text-slate-600 mb-4">
                      Reconstructed sequence showing how customer business activity transformed into correlated ISO messages:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-center">
                      {/* Stage 1 */}
                      <div className="p-3 rounded-lg border border-slate-200 bg-white flex flex-col justify-between">
                        <span className="text-[10px] uppercase font-bold text-amber-600">Prerequisite Stage 1</span>
                        <p className="font-bold text-slate-900 mt-1">acmt.023.001.03</p>
                        <p className="text-[10px] text-slate-500 font-mono">IdVrfctnReq</p>
                        <span className="inline-block mt-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[9px] font-bold">
                          NAME ENQUIRY
                        </span>
                      </div>

                      {/* Stage 2 */}
                      <div className="p-3 rounded-lg border border-slate-200 bg-white flex flex-col justify-between">
                        <span className="text-[10px] uppercase font-bold text-blue-600">Prerequisite Stage 2</span>
                        <p className="font-bold text-slate-900 mt-1">acmt.024.001.03</p>
                        <p className="text-[10px] text-slate-500 font-mono">IdVrfctnRpt</p>
                        <span className="inline-block mt-2 px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[9px] font-bold">
                          {acmt024 ? 'VERIFIED' : 'PENDING'}
                        </span>
                      </div>

                      {/* Stage 3 */}
                      <div className="p-3 rounded-lg border border-slate-200 bg-white flex flex-col justify-between">
                        <span className="text-[10px] uppercase font-bold text-emerald-600">Clearing Stage 3</span>
                        <p className="font-bold text-slate-900 mt-1">pacs.008.001.10</p>
                        <p className="text-[10px] text-slate-500 font-mono">FIToFICstmrCdtTrf</p>
                        <span className="inline-block mt-2 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[9px] font-bold">
                          CREDIT TRANSFER
                        </span>
                      </div>

                      {/* Stage 4 */}
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-900 text-white flex flex-col justify-between">
                        <span className="text-[10px] uppercase font-bold text-emerald-400">Settlement Stage 4</span>
                        <p className="font-bold text-white mt-1">pacs.002.001.12</p>
                        <p className="text-[10px] text-slate-300 font-mono">FIToFIPmtStsRpt</p>
                        <span className="inline-block mt-2 px-2 py-0.5 rounded bg-emerald-800 text-emerald-200 font-mono text-[9px] font-bold">
                          STATUS: {pacs002?.parsedJson?.Document?.FIToFIPmtStsRpt?.TxInfAndSts?.TxSts || data.transaction.statusReasonCode || 'ACTC'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
