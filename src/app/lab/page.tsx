'use client';

import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Play,
  RotateCcw,
  FastForward,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Code,
  Send,
  Copy,
  Check,
  FileCode,
  Layers,
  RefreshCw,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

interface MessageSample {
  messageType: string;
  name: string;
  category: string;
  direction: string;
  pairedWith?: string;
  xml: string;
}

export default function SimulationLabPage() {
  const [activeTab, setActiveTab] = useState<'CLEARING' | 'STUDIO' | 'DIRECT_DEBIT'>('CLEARING');

  // Clearing Flow State
  const [banks, setBanks] = useState<any[]>([]);
  const [origBankId, setOrigBankId] = useState('bank-a');
  const [destBankCode, setDestBankCode] = useState('METRNG');
  const [amount, setAmount] = useState('50000');
  const [scenario, setScenario] = useState('SUCCESS');
  const [execMode, setExecMode] = useState<'LIVE' | 'STEP'>('LIVE');
  const [currentStep, setCurrentStep] = useState(0);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Message Studio State
  const [samples, setSamples] = useState<MessageSample[]>([]);
  const [selectedType, setSelectedType] = useState('acmt.023.001.04');
  const [xmlContent, setXmlContent] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [copiedResp, setCopiedResp] = useState(false);

  // Direct Debit 4-Stage Workflow State
  const [ddAmount, setDdAmount] = useState('15000');
  const [ddDebtorAccount, setDdDebtorAccount] = useState('0112345678');
  const [ddCreditorAccount, setDdCreditorAccount] = useState('9981122334');
  const [ddMandateId, setDdMandateId] = useState('MNDT-PWR-2025');
  const [ddScenario, setDdScenario] = useState('SUCCESS');
  const [ddExecuting, setDdExecuting] = useState(false);
  const [ddResult, setDdResult] = useState<any>(null);
  const [ddActiveXmlTab, setDdActiveXmlTab] = useState<'pain008' | 'pacs003' | 'pacs002' | 'pain002'>('pain008');

  const simulationSteps = [
    { title: 'Step 1: Customer Initiated', actor: 'Originating Bank', desc: 'Customer dispatches business transfer instruction' },
    { title: 'Step 2: Bank Core Validated', actor: 'Bank A Core', desc: 'Available balance verified and initial debit hold placed' },
    { title: 'Step 3: pacs.008 Generated', actor: 'ISO Engine', desc: 'Synthesizes canonical instruction into ISO 20022 pacs.008.001.12 XML' },
    { title: 'Step 4: Switch Received', actor: 'Central Switch', desc: 'Switch ingests inbound XML payload' },
    { title: 'Step 5: XSD & Scheme Validated', actor: 'Central Switch', desc: 'Validates XML well-formedness, official XSD schema, and NPS scheme rules' },
    { title: 'Step 6: Route Identified', actor: 'Routing Engine', desc: 'Participant Registry resolves active destination bank endpoint' },
    { title: 'Step 7: Destination Core Received', actor: 'Bank C Core', desc: 'Destination core parses pacs.008 and validates beneficiary account' },
    { title: 'Step 8: Account Credited', actor: 'Bank C Core', desc: 'Beneficiary account credited and double-entry ledger updated' },
    { title: 'Step 9: pacs.002 Generated', actor: 'Destination Core', desc: 'Produces pacs.002.001.12 Payment Status Report (ACSC / RJCT)' },
    { title: 'Step 10: Switch Correlated', actor: 'Central Switch', desc: 'Correlates pacs.002 to original pacs.008 via UETR in Message Store' },
    { title: 'Step 11: Originating Bank Received', actor: 'Bank A Core', desc: 'Originating Core receives settlement confirmation and clears hold' },
    { title: 'Step 12: Customer Notified', actor: 'Customer Channel', desc: 'Customer channel receives completion notification and updated balance' },
  ];

  useEffect(() => {
    fetch('/api/banks')
      .then((res) => res.json())
      .then((data) => {
        if (data.banks) setBanks(data.banks);
      })
      .catch(console.error);

    fetch('/api/switch/messages/sample')
      .then((res) => res.json())
      .then((data) => {
        if (data.samples) {
          setSamples(data.samples);
          const first = data.samples.find((s: MessageSample) => s.messageType === 'acmt.023.001.04') || data.samples[0];
          if (first) {
            setSelectedType(first.messageType);
            setXmlContent(first.xml);
          }
        }
      })
      .catch(console.error);
  }, []);

  const handleSelectMessageType = (type: string) => {
    setSelectedType(type);
    const found = samples.find((s) => s.messageType === type);
    if (found) {
      setXmlContent(found.xml);
    }
    setDispatchResult(null);
  };

  const handleResetXml = () => {
    const found = samples.find((s) => s.messageType === selectedType);
    if (found) {
      setXmlContent(found.xml);
    }
    setDispatchResult(null);
  };

  const handleCopyInput = () => {
    navigator.clipboard.writeText(xmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyResponse = () => {
    if (dispatchResult?.responseXml) {
      navigator.clipboard.writeText(dispatchResult.responseXml);
      setCopiedResp(true);
      setTimeout(() => setCopiedResp(false), 2000);
    }
  };

  const handleDispatchGeneric = async () => {
    setDispatching(true);
    setDispatchResult(null);

    try {
      const res = await fetch('/api/switch/messages/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml: xmlContent }),
      });

      const outcome = await res.json();
      setDispatchResult(outcome);
    } catch (err: any) {
      setDispatchResult({ success: false, error: err.message });
    } finally {
      setDispatching(false);
    }
  };

  const handleExecuteDirectDebit = async () => {
    setDdExecuting(true);
    setDdResult(null);

    const targetDebtorAcc = ddScenario === 'INVALID_ACCOUNT' ? '9999999999' : ddDebtorAccount;
    const targetAmt = ddScenario === 'INSUFFICIENT_FUNDS' ? 999999999 : parseFloat(ddAmount);

    try {
      const res = await fetch('/api/switch/direct-debit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debtorAccount: targetDebtorAcc,
          creditorAccount: ddCreditorAccount,
          amount: targetAmt,
          mandateId: ddMandateId,
          debtorBankCode: 'NAIJANG',
          billerBankCode: 'PSEUNG',
        }),
      });

      const outcome = await res.json();
      setDdResult(outcome);
    } catch (err: any) {
      setDdResult({ success: false, error: err.message });
    } finally {
      setDdExecuting(false);
    }
  };

  const handleRunSimulation = async () => {
    setExecuting(true);
    setResult(null);

    const orig = banks.find((b) => b.id === origBankId);
    const dest = banks.find((b) => b.code === destBankCode);

    const debtorAcct = orig?.accounts?.[0]?.accountNumber || '0112345678';
    const creditorAcct = dest?.accounts?.[0]?.accountNumber || '0334455667';
    const creditorName = dest?.accounts?.[0]?.customer?.fullName || 'Beneficiary';

    if (execMode === 'STEP') {
      setCurrentStep(1);
    }

    try {
      const res = await fetch(`/api/banks/${origBankId}/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debtorAccountNumber: debtorAcct,
          destinationBankCode: destBankCode,
          creditorAccountNumber: creditorAcct,
          creditorName,
          amount: parseFloat(amount),
          currency: 'NGN',
          remittanceInfo: `Simulated Lab Execution [${scenario}]`,
          scenario,
        }),
      });

      const outcome = await res.json();
      setResult(outcome);
      if (execMode === 'STEP') {
        setCurrentStep(12);
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setExecuting(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep < 12) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleResetStep = () => {
    setCurrentStep(0);
    setResult(null);
  };

  const activeDef = samples.find((s) => s.messageType === selectedType);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Terminal className="h-6 w-6 text-emerald-600" />
            Central Payment Simulation & ISO Message Lab
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Test 17 domestic ISO 20022 message types, inspect real-time XML processing, and simulate interbank clearing journeys.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('CLEARING')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              activeTab === 'CLEARING'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            End-to-End Clearing Flow
          </button>
          <button
            onClick={() => setActiveTab('STUDIO')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'STUDIO'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            ISO 20022 Message Studio (17 Formats)
          </button>
          <button
            onClick={() => setActiveTab('DIRECT_DEBIT')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'DIRECT_DEBIT'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Direct Debit (4-Stage Chain)
          </button>
        </div>
      </div>

      {/* ================= TAB 1: CLEARING SIMULATOR ================= */}
      {activeTab === 'CLEARING' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Play className="h-4 w-4 text-emerald-600" />
                  Interbank Credit Clearing Orchestrator
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Simulate any-to-any credit clearing scenarios, inject network faults, and inspect step-by-step state propagation.
                </p>
              </div>
              <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-mono font-semibold text-slate-700">
                pacs.008 & pacs.002 Flow
              </span>
            </div>

            {/* Configuration Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Originating Institution</label>
                <select
                  value={origBankId}
                  onChange={(e) => setOrigBankId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 p-2 text-xs text-slate-900 bg-white"
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Institution</label>
                <select
                  value={destBankCode}
                  onChange={(e) => setDestBankCode(e.target.value)}
                  className="w-full rounded-md border border-slate-200 p-2 text-xs text-slate-900 bg-white"
                >
                  {banks
                    .filter((b) => b.id !== origBankId)
                    .map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Settlement Amount (NGN)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-md border border-slate-200 p-2 text-xs font-mono font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Simulation Scenario</label>
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  className="w-full rounded-md border border-slate-200 p-2 text-xs text-slate-900 bg-white"
                >
                  <option value="SUCCESS">Standard Transfer (pacs.008 -&gt; pacs.002 ACSC)</option>
                  <option value="ACMT_TIMEOUT">ACMT Name Enquiry Timeout (20s SLA - No Debit TO01)</option>
                  <option value="SWITCH_TIMEOUT">PACS.008 Settlement Timeout (20s SLA - Auto Refund AB03)</option>
                  <option value="INSUFFICIENT_FUNDS">Insufficient Funds (Originating Core AM04)</option>
                  <option value="INVALID_ACCOUNT">Invalid Beneficiary Account (Destination Core AC01)</option>
                  <option value="DEST_OFFLINE">Destination Participant Offline (Switch DS04)</option>
                  <option value="DUPLICATE_REPLAY">Duplicate Replay (Switch Idempotency AM05)</option>
                  <option value="MALFORMED_XML">Malformed XML Structure (Switch Layer 1 GE01)</option>
                  <option value="SCHEME_RULE_FAILURE">Scheme Rule Failure (Unsupported Currency AG01)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Execution Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExecMode('LIVE')}
                    className={`py-2 px-3 rounded-md text-xs font-bold border transition-colors ${
                      execMode === 'LIVE'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    LIVE MODE (Automatic)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExecMode('STEP')}
                    className={`py-2 px-3 rounded-md text-xs font-bold border transition-colors ${
                      execMode === 'STEP'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    STEP MODE (Interactive)
                  </button>
                </div>
              </div>
            </div>

            {/* Execution Triggers */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunSimulation}
                  disabled={executing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors disabled:opacity-50"
                >
                  <Play className="h-4 w-4 fill-white" />
                  {executing ? 'Simulating Clearing Flow...' : 'Execute Clearing Instruction'}
                </button>

                {execMode === 'STEP' && currentStep > 0 && currentStep < 12 && (
                  <button
                    onClick={handleNextStep}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm"
                  >
                    <FastForward className="h-4 w-4" /> Next Step ({currentStep}/12)
                  </button>
                )}

                {currentStep > 0 && (
                  <button
                    onClick={handleResetStep}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                )}
              </div>

              {result?.uetr && (
                <Link
                  href={`/switch`}
                  className="flex items-center gap-1 text-xs font-bold text-slate-900 hover:text-emerald-700 underline"
                >
                  Inspect Result in Switch Operations Console <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>

          {/* Step by Step Visual Progression */}
          {execMode === 'STEP' && currentStep > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Interactive Step-by-Step Execution Pipeline</h3>
                <span className="text-xs font-mono font-bold text-emerald-700">
                  Stage: {currentStep} of 12 Completed
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {simulationSteps.map((step, idx) => {
                  const isPast = idx + 1 <= currentStep;
                  const isCurrent = idx + 1 === currentStep;

                  return (
                    <div
                      key={step.title}
                      className={`p-3 rounded-lg border text-xs transition-all ${
                        isCurrent
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-sm'
                          : isPast
                          ? 'border-slate-200 bg-slate-50/80 text-slate-700'
                          : 'border-slate-100 bg-white text-slate-400 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold">
                          {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                        </span>
                        <span className="rounded bg-white px-1.5 py-0.2 border border-slate-200 text-[9px] font-mono text-slate-600">
                          {step.actor}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs mt-1.5">{step.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-1">{step.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Outcome Output */}
          {result && (
            <div
              className={`rounded-xl border p-5 shadow-sm text-xs ${
                result.success
                  ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                  : 'border-red-200 bg-red-50/50 text-red-900'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-current/10">
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-bold text-sm">
                    Clearing Result: {result.success ? 'ACCEPTED & COMPLETED (ACSC)' : 'REJECTED (RJCT)'}
                  </span>
                </div>
                {result.reasonCode && (
                  <span className="font-mono font-bold bg-white/70 px-2 py-0.5 rounded border border-current/20">
                    Reason Code: {result.reasonCode}
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[11px]">
                <div>
                  <span className="opacity-70 block font-sans text-[10px]">UETR</span>
                  <span className="font-bold break-all">{result.uetr}</span>
                </div>
                <div>
                  <span className="opacity-70 block font-sans text-[10px]">Latency</span>
                  <span className="font-bold">{result.canonicalPayment?.latencyMs || 0} ms</span>
                </div>
                <div>
                  <span className="opacity-70 block font-sans text-[10px]">Error / Description</span>
                  <span>{result.error || 'pacs.002 ACSC status generated and settled successfully.'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: ISO 20022 MESSAGE STUDIO ================= */}
      {activeTab === 'STUDIO' && (
        <div className="space-y-6">
          {/* Message Selector & Metadata Banner */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Select ISO 20022 Domestic Message (17 Formats)</label>
                <select
                  value={selectedType}
                  onChange={(e) => handleSelectMessageType(e.target.value)}
                  className="rounded-lg border border-slate-300 p-2.5 text-xs font-semibold text-slate-900 bg-slate-50 w-full sm:w-96 focus:bg-white focus:outline-emerald-600"
                >
                  <optgroup label="1. Identification Verification (Name Enquiry)">
                    <option value="acmt.023.001.04">acmt.023.001.04 - Name Enquiry Request</option>
                    <option value="acmt.024.001.04">acmt.024.001.04 - Verification Report (Signature & BVN)</option>
                  </optgroup>
                  <optgroup label="2. Primary Credit Clearing & Status">
                    <option value="pacs.008.001.12">pacs.008.001.12 - Customer Credit Transfer</option>
                    <option value="pacs.002.001.12">pacs.002.001.12 - Payment Status Report (ACSC/RJCT)</option>
                    <option value="pacs.028.001.06">pacs.028.001.06 - Payment Status Request</option>
                  </optgroup>
                  <optgroup label="3. Direct Debit & Mandates Clearing">
                    <option value="pacs.003.001.11">pacs.003.001.11 - FI to FI Customer Direct Debit</option>
                    <option value="pain.008.001.11">pain.008.001.11 - Customer Direct Debit Initiation</option>
                    <option value="pain.002.001.14">pain.002.001.14 - Customer Payment Status Report</option>
                  </optgroup>
                  <optgroup label="4. Account Statements & Reporting">
                    <option value="camt.060.001.07">camt.060.001.07 - Account Reporting Request</option>
                    <option value="camt.052.001.12">camt.052.001.12 - Intra-day Account Report</option>
                    <option value="camt.053.001.12">camt.053.001.12 - End-of-Day Statement</option>
                  </optgroup>
                  <optgroup label="5. Mandate Lifecycle Management">
                    <option value="pain.009.001.08">pain.009.001.08 - Mandate Initiation Request</option>
                    <option value="pain.012.001.08">pain.012.001.08 - Mandate Acceptance Report</option>
                    <option value="pain.010.001.08">pain.010.001.08 - Mandate Amendment Request</option>
                    <option value="pain.011.001.08">pain.011.001.08 - Mandate Cancellation Request</option>
                  </optgroup>
                  <optgroup label="6. Request to Pay (RTP)">
                    <option value="pain.013.001.11">pain.013.001.11 - Creditor Payment Activation Request</option>
                    <option value="pain.014.001.11">pain.014.001.11 - Payment Activation Status Report</option>
                  </optgroup>
                </select>
              </div>

              {activeDef && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 font-mono font-bold border border-emerald-200">
                    {activeDef.messageType}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                    {activeDef.category}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                    Dir: {activeDef.direction}
                  </span>
                  {activeDef.pairedWith && (
                    <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-mono border border-purple-200">
                      Paired: {activeDef.pairedWith}
                    </span>
                  )}
                </div>
              )}
            </div>

            {activeDef && (
              <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                <span className="font-semibold text-slate-900">{activeDef.name}:</span> Complete domestic clearing definition including official namespace, ClrSysMmbId, and supplementary envelopes.
              </p>
            )}
          </div>

          {/* Interactive Code Editor & Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input XML Editor */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">Inbound XML Document Editor</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopyInput}
                    className="p-1.5 rounded hover:bg-slate-200 text-slate-600 text-xs flex items-center gap-1"
                    title="Copy XML"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={handleResetXml}
                    className="p-1.5 rounded hover:bg-slate-200 text-slate-600 text-xs flex items-center gap-1"
                    title="Reset to Template"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span className="text-[11px]">Reset Template</span>
                  </button>
                </div>
              </div>

              <div className="p-3 flex-1 flex flex-col">
                <textarea
                  value={xmlContent}
                  onChange={(e) => setXmlContent(e.target.value)}
                  className="w-full flex-1 min-h-[380px] p-3 text-xs font-mono bg-slate-950 text-emerald-400 rounded-lg border border-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed overflow-x-auto whitespace-pre resize-y"
                  spellCheck={false}
                />
              </div>

              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {xmlContent.split('\n').length} lines &bull; {xmlContent.length} bytes
                </span>
                <button
                  onClick={handleDispatchGeneric}
                  disabled={dispatching || !xmlContent.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {dispatching ? 'Dispatching to Switch...' : 'Dispatch Message to Central Switch'}
                </button>
              </div>
            </div>

            {/* Switch Processing Response Panel */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-slate-700" />
                  <span className="text-xs font-bold text-slate-800">Switch Processing & Auto-Response</span>
                </div>
                {dispatchResult?.responseXml && (
                  <button
                    onClick={handleCopyResponse}
                    className="p-1.5 rounded hover:bg-slate-200 text-slate-600 text-xs flex items-center gap-1"
                  >
                    {copiedResp ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    <span className="text-[11px]">{copiedResp ? 'Copied' : 'Copy Response'}</span>
                  </button>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col justify-start">
                {!dispatchResult && !dispatching && (
                  <div className="flex flex-col items-center justify-center my-auto py-16 text-center text-slate-400">
                    <Send className="h-10 w-10 stroke-1 mb-2 text-slate-300" />
                    <p className="text-xs font-medium">No active execution dispatched yet.</p>
                    <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                      Click &quot;Dispatch Message to Central Switch&quot; to ingest the XML payload, execute routing, update ledger, and observe ISO auto-responses.
                    </p>
                  </div>
                )}

                {dispatching && (
                  <div className="flex flex-col items-center justify-center my-auto py-16 text-center text-slate-600">
                    <RefreshCw className="h-8 w-8 animate-spin text-emerald-600 mb-2" />
                    <p className="text-xs font-bold">Validating & Ingesting ISO 20022 Payload...</p>
                    <p className="text-[11px] text-slate-400 mt-1">Performing XSD schema check, member resolution, and domestic routing</p>
                  </div>
                )}

                {dispatchResult && (
                  <div className="space-y-4">
                    {/* Status Badge Bar */}
                    <div
                      className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                        dispatchResult.success
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                          : 'border-red-200 bg-red-50 text-red-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {dispatchResult.success ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-bold">
                          {dispatchResult.success ? 'Message Ingested & Cleared' : 'Ingestion / Business Rejection'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        {dispatchResult.reasonCode && (
                          <span className="bg-white/80 px-2 py-0.5 rounded border border-current/20 text-[11px] font-bold">
                            {dispatchResult.reasonCode}
                          </span>
                        )}
                        {dispatchResult.responseMessageType && (
                          <span className="bg-emerald-700 text-white px-2 py-0.5 rounded text-[11px] font-bold">
                            Resp: {dispatchResult.responseMessageType}
                          </span>
                        )}
                      </div>
                    </div>

                    {dispatchResult.error && (
                      <p className="text-xs text-red-700 bg-red-50 p-2.5 rounded border border-red-200 font-mono">
                        {dispatchResult.error}
                      </p>
                    )}

                    {/* Response XML View */}
                    {dispatchResult.responseXml ? (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            <FileText className="h-3 w-3 text-emerald-600" />
                            Generated ISO Response Payload ({dispatchResult.responseMessageType})
                          </label>
                        </div>
                        <pre className="p-3 text-xs font-mono bg-slate-900 text-sky-300 rounded-lg border border-slate-800 max-h-72 overflow-y-auto overflow-x-auto whitespace-pre leading-relaxed">
                          {dispatchResult.responseXml}
                        </pre>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs">
                        Ingested message is an endpoint report or one-way notification; no downstream ISO response required.
                      </div>
                    )}

                    {/* Parsed JSON Inspection */}
                    {dispatchResult.parsed && Object.keys(dispatchResult.parsed).length > 0 && (
                      <details className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <summary className="font-bold text-slate-700 cursor-pointer select-none">
                          Inspect Canonical Parsed JSON Entity
                        </summary>
                        <pre className="mt-2 p-2 bg-white rounded border border-slate-200 font-mono text-[11px] text-slate-800 overflow-x-auto">
                          {JSON.stringify(dispatchResult.parsed, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: DIRECT DEBIT 4-STAGE CLEARING ================= */}
      {activeTab === 'DIRECT_DEBIT' && (
        <div className="space-y-6">
          {/* Architecture Banner */}
          <div className="p-4 bg-gradient-to-r from-sky-900 to-slate-900 text-white rounded-xl shadow-sm border border-sky-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30 rounded-full inline-block mb-1">
                  Canonical 4-Stage ISO 20022 Clearing
                </span>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-sky-400" />
                  Pseudo Institution Direct Debit Gateway Workflow
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Biller dispatches customer-to-bank <code className="text-sky-300">pain.008</code> to the Pseudo Institution (Apex Direct Debit Gateway), which transforms it into interbank <code className="text-sky-300">pacs.003</code> via the Central Switch. The Customer Bank debits the account, returns <code className="text-sky-300">pacs.002</code>, and the Pseudo Institution settles the biller and delivers <code className="text-sky-300">pain.002</code>.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button
                  onClick={handleExecuteDirectDebit}
                  disabled={ddExecuting}
                  className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {ddExecuting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Executing 4-Leg Clearing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Execute 4-Stage Workflow
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 4-Stage Visual Pipeline */}
            <div className="mt-4 pt-4 border-t border-sky-800/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className={`p-2.5 rounded-lg border ${ddResult ? 'bg-sky-950/60 border-sky-500/40' : 'bg-slate-800/40 border-slate-700/60'}`}>
                <div className="flex items-center justify-between font-bold text-sky-300 text-[11px] mb-1">
                  <span>LEG 1: INITIATION</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-sky-900/80 rounded">pain.008</span>
                </div>
                <p className="text-[11px] text-slate-300">Biller &rarr; Pseudo Inst</p>
                <p className="text-[10px] text-slate-400 mt-1">Customer direct debit mandate collection authority</p>
              </div>

              <div className={`p-2.5 rounded-lg border ${ddResult ? 'bg-sky-950/60 border-sky-500/40' : 'bg-slate-800/40 border-slate-700/60'}`}>
                <div className="flex items-center justify-between font-bold text-sky-300 text-[11px] mb-1">
                  <span>LEG 2: CLEARING</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-sky-900/80 rounded">pacs.003</span>
                </div>
                <p className="text-[11px] text-slate-300">Pseudo Inst &rarr; Switch &rarr; Debtor Bank</p>
                <p className="text-[10px] text-slate-400 mt-1">Interbank direct debit collection pull instruction</p>
              </div>

              <div className={`p-2.5 rounded-lg border ${ddResult ? 'bg-sky-950/60 border-sky-500/40' : 'bg-slate-800/40 border-slate-700/60'}`}>
                <div className="flex items-center justify-between font-bold text-sky-300 text-[11px] mb-1">
                  <span>LEG 3: DEBIT & STATUS</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-sky-900/80 rounded">pacs.002</span>
                </div>
                <p className="text-[11px] text-slate-300">Debtor Bank &rarr; Switch &rarr; Pseudo Inst</p>
                <p className="text-[10px] text-slate-400 mt-1">Customer account debited; ACSC settlement confirmed</p>
              </div>

              <div className={`p-2.5 rounded-lg border ${ddResult ? 'bg-sky-950/60 border-sky-500/40' : 'bg-slate-800/40 border-slate-700/60'}`}>
                <div className="flex items-center justify-between font-bold text-sky-300 text-[11px] mb-1">
                  <span>LEG 4: SETTLE & REPORT</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 bg-sky-900/80 rounded">pain.002</span>
                </div>
                <p className="text-[11px] text-slate-300">Pseudo Inst &rarr; Biller</p>
                <p className="text-[10px] text-slate-400 mt-1">Biller credited and customer payment report delivered</p>
              </div>
            </div>
          </div>

          {/* Workflow Parameters & Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b pb-2">
                <FileCode className="h-4 w-4 text-sky-600" />
                Workflow Parameters
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Initiating Creditor / Biller (Pseudo Inst)
                  </label>
                  <input
                    type="text"
                    disabled
                    value="PowerGrid Utilities (9981122334) @ PSEUNG"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-600 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Customer Debtor Account (Naija Bank)
                  </label>
                  <input
                    type="text"
                    value={ddDebtorAccount}
                    onChange={(e) => setDdDebtorAccount(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Mandate Reference Code
                  </label>
                  <input
                    type="text"
                    value={ddMandateId}
                    onChange={(e) => setDdMandateId(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Collection Amount (₦)
                  </label>
                  <input
                    type="number"
                    value={ddAmount}
                    onChange={(e) => setDdAmount(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded font-mono text-xs focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Simulation Scenario
                  </label>
                  <select
                    value={ddScenario}
                    onChange={(e) => setDdScenario(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800"
                  >
                    <option value="SUCCESS">Success (Active Mandate &amp; Sufficient Balance)</option>
                    <option value="INSUFFICIENT_FUNDS">Insufficient Funds (AM04 Rejection at Cust Bank)</option>
                    <option value="INVALID_ACCOUNT">Invalid Debtor Account (AC01 Rejection)</option>
                  </select>
                </div>

                <button
                  onClick={handleExecuteDirectDebit}
                  disabled={ddExecuting}
                  className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg transition-all shadow flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" />
                  Run Direct Debit Execution
                </button>
              </div>
            </div>

            {/* Result & XML Inspector */}
            <div className="lg:col-span-2 space-y-4">
              {ddResult ? (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2">
                      {ddResult.success ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-rose-600" />
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          {ddResult.success ? 'Direct Debit Clearing Completed (ACSC)' : 'Direct Debit Clearing Rejected'}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-mono">
                          Journey ID: {ddResult.businessJourneyId}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider ${
                        ddResult.success
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      Status: {ddResult.status || (ddResult.success ? 'ACSC' : 'RJCT')}
                    </span>
                  </div>

                  {/* XML Selector Tabs */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                        <button
                          onClick={() => setDdActiveXmlTab('pain008')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                            ddActiveXmlTab === 'pain008' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          1. pain.008 (Initiation)
                        </button>
                        <button
                          onClick={() => setDdActiveXmlTab('pacs003')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                            ddActiveXmlTab === 'pacs003' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          2. pacs.003 (Switch Clearing)
                        </button>
                        <button
                          onClick={() => setDdActiveXmlTab('pacs002')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                            ddActiveXmlTab === 'pacs002' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          3. pacs.002 (Bank Status)
                        </button>
                        <button
                          onClick={() => setDdActiveXmlTab('pain002')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                            ddActiveXmlTab === 'pain002' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          4. pain.002 (Biller Report)
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          const currentXml =
                            ddActiveXmlTab === 'pain008'
                              ? ddResult.pain008Xml
                              : ddActiveXmlTab === 'pacs003'
                              ? ddResult.pacs003Xml
                              : ddActiveXmlTab === 'pacs002'
                              ? ddResult.pacs002Xml
                              : ddResult.pain002Xml;
                          if (currentXml) navigator.clipboard.writeText(currentXml);
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        Copy XML
                      </button>
                    </div>

                    <pre className="p-3 text-xs font-mono bg-slate-900 text-sky-300 rounded-lg border border-slate-800 max-h-80 overflow-y-auto overflow-x-auto whitespace-pre leading-relaxed">
                      {ddActiveXmlTab === 'pain008' && ddResult.pain008Xml}
                      {ddActiveXmlTab === 'pacs003' && ddResult.pacs003Xml}
                      {ddActiveXmlTab === 'pacs002' && ddResult.pacs002Xml}
                      {ddActiveXmlTab === 'pain002' && ddResult.pain002Xml}
                    </pre>
                  </div>

                  {/* Audit Events Timeline */}
                  {ddResult.events && ddResult.events.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t">
                      <h5 className="text-[11px] font-bold text-slate-700">Audit Trail Events ({ddResult.events.length})</h5>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {ddResult.events.map((ev: any, idx: number) => (
                          <div key={idx} className="p-2 bg-slate-50 rounded border border-slate-100 flex items-start gap-2 text-[11px]">
                            <span className="font-mono text-[10px] px-1 bg-slate-200 rounded text-slate-700 shrink-0">
                              {ev.actor}
                            </span>
                            <div className="flex-1">
                              <span className="font-bold text-slate-800">{ev.eventCode}</span>: {ev.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-slate-500 text-xs">
                  Click &ldquo;Execute 4-Stage Workflow&rdquo; to simulate the Pseudo Institution clearing cycle and inspect each generated ISO 20022 message.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
