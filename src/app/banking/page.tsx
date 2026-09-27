'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Send, ArrowUpRight, ArrowDownLeft, ShieldCheck, RefreshCw, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { INITIAL_PARTICIPANTS, INITIAL_ACCOUNTS, INITIAL_CUSTOMERS } from '@/core/seed-data';

interface BankAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  availableBalance: number;
  ledgerBalance: number;
  currency: string;
  status: string;
  customer?: {
    id: string;
    fullName: string;
    email: string;
  };
}

interface BankData {
  id: string;
  code: string;
  name: string;
  routingCode: string;
  status: string;
  brandColor: string;
  accentColor: string;
  accounts: BankAccount[];
}

const DEFAULT_BANKS: BankData[] = INITIAL_PARTICIPANTS.map((p) => {
  const accounts = INITIAL_ACCOUNTS.filter((a) => a.institutionId === p.id);
  return {
    ...p,
    accounts: accounts.map((acc) => {
      const customer = INITIAL_CUSTOMERS.find((c) => c.id === acc.customerId);
      return {
        ...acc,
        customer,
      };
    }),
  };
});

export default function CustomerBankingPage() {
  const [banks, setBanks] = useState<BankData[]>(DEFAULT_BANKS);
  const [selectedBankId, setSelectedBankId] = useState<string>('bank-a');
  const [selectedAccountNum, setSelectedAccountNum] = useState<string>('0112345678');
  
  // Transfer Form State
  const [destBankCode, setDestBankCode] = useState<string>('METRNG');
  const [creditorAccount, setCreditorAccount] = useState<string>('0334455667');
  const [creditorName, setCreditorName] = useState<string>('Adaeze Okafor');
  const [amount, setAmount] = useState<string>('50000');
  const [remittance, setRemittance] = useState<string>('Payment for services rendered');
  const [scenario, setScenario] = useState<string>('SUCCESS');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [verifyingName, setVerifyingName] = useState<boolean>(false);
  const [verifiedBeneficiary, setVerifiedBeneficiary] = useState<string | null>('Adaeze Okafor');
  const [enquiryError, setEnquiryError] = useState<string | null>(null);

  const [lastOutcome, setLastOutcome] = useState<{
    success: boolean;
    uetr?: string;
    error?: string;
    reasonCode?: string;
    amount?: number;
    beneficiary?: string;
  } | null>(null);

  const handleVerifyName = async (acct?: string, bank?: string) => {
    const acctToVerify = acct || creditorAccount;
    const bankToVerify = bank || destBankCode;
    if (!acctToVerify || !bankToVerify || !currentBank) return;

    setVerifyingName(true);
    setEnquiryError(null);
    try {
      const res = await fetch(`/api/banks/${currentBank.id}/name-enquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationBankCode: bankToVerify,
          accountNumber: acctToVerify,
        }),
      });
      const data = await res.json();
      if (data.success && data.verifiedName) {
        setVerifiedBeneficiary(data.verifiedName);
        setCreditorName(data.verifiedName);
      } else {
        setVerifiedBeneficiary(null);
        setEnquiryError(data.error || 'Account does not exist (AC01)');
      }
    } catch {
      setEnquiryError('Verification service unavailable');
    } finally {
      setVerifyingName(false);
    }
  };

  const fetchBanks = useCallback(async () => {
    try {
      const res = await fetch(`/api/banks?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.banks) {
        setBanks(data.banks);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const currentBank = banks.find((b) => b.id === selectedBankId) || banks[0];
  const currentAccount = currentBank?.accounts?.find((a) => a.accountNumber === selectedAccountNum) || currentBank?.accounts?.[0];

  // When changing bank, default to first account
  const handleSelectBank = (bankId: string) => {
    setSelectedBankId(bankId);
    const b = banks.find((item) => item.id === bankId);
    if (b && b.accounts && b.accounts.length > 0) {
      setSelectedAccountNum(b.accounts[0].accountNumber);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccount) return;

    setSubmitting(true);
    setLastOutcome(null);

    try {
      const res = await fetch(`/api/banks/${currentBank.id}/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debtorAccountNumber: currentAccount.accountNumber,
          destinationBankCode: destBankCode,
          creditorAccountNumber: creditorAccount,
          creditorName,
          amount: parseFloat(amount),
          currency: 'NGN',
          remittanceInfo: remittance,
          scenario,
        }),
      });

      const result = await res.json();
      setLastOutcome({
        success: result.success,
        uetr: result.uetr,
        error: result.error,
        reasonCode: result.reasonCode,
        amount: parseFloat(amount),
        beneficiary: creditorName,
      });

      // Refresh balances immediately
      await fetchBanks();
    } catch (err: any) {
      setLastOutcome({
        success: false,
        error: err.message || 'Network communication failure',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Institution Switcher Ribbon */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Select Simulated Banking Institution
            </h2>
            <p className="text-xs text-slate-400">
              Each bank acts as an independent entity routing interbank payments exclusively through the Switch.
            </p>
          </div>
          <button
            onClick={fetchBanks}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 border border-slate-200 rounded px-2 py-1"
          >
            <RefreshCw className="h-3 w-3" /> Refresh Balances
          </button>
        </div>

        {banks.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-slate-500 text-xs gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
            Loading active simulated institutions...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
            {banks.map((bank) => {
              const isSelected = bank.id === currentBank?.id;
              return (
                <button
                  key={bank.id}
                  onClick={() => handleSelectBank(bank.id)}
                  className={`flex flex-col p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: isSelected ? '#10B981' : bank.brandColor }}
                    />
                    <span className={`text-[10px] font-mono ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {bank.code}
                    </span>
                  </div>
                  <span className="font-bold text-xs mt-2 truncate">{bank.name}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                    Routing: {bank.routingCode}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Banking Interface */}
      {currentBank ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Account & Customer Dashboard */}
          <div className="lg:col-span-1 space-y-4">
            {/* Account Card */}
            <div
              className="rounded-xl p-5 text-white shadow-md relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${currentBank.brandColor || '#0f172a'}, #0f172a)`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold opacity-80">
                  {currentBank.name}
                </span>
                <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  {currentAccount?.accountType || 'SAVINGS'}
                </span>
              </div>

              <div className="mt-4">
                <p className="text-xs text-white/70">
                  Good Morning, {currentAccount?.customer?.fullName || 'Valued Customer'}
                </p>
                <div className="mt-1">
                  <span className="text-[11px] text-white/70 block">Available Balance</span>
                  <p className="text-2xl font-extrabold tracking-tight">
                    ₦{currentAccount?.availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex justify-between text-xs text-white/80">
                <div>
                  <span className="text-[10px] opacity-70 block">Account Number</span>
                  <span className="font-mono font-bold tracking-wider">{currentAccount?.accountNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] opacity-70 block">Ledger Balance</span>
                  <span className="font-mono">
                    ₦{currentAccount?.ledgerBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Account Switcher */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-xs">
              <h3 className="font-bold text-slate-800 mb-2">Switch Active Customer Account</h3>
              <div className="space-y-2">
                {currentBank.accounts?.map((acc) => (
                  <button
                    key={acc.accountNumber}
                    onClick={() => setSelectedAccountNum(acc.accountNumber)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                      acc.accountNumber === currentAccount?.accountNumber
                        ? 'border-slate-900 bg-slate-50 font-semibold'
                        : 'border-slate-100 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-slate-900">{acc.customer?.fullName}</span>
                      <span className="font-mono font-bold text-slate-900">
                        ₦{acc.availableBalance.toLocaleString()}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                      Acct: {acc.accountNumber} • {acc.accountType}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Initiate Interbank Transfer Form & History */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Initiate Interbank ISO 20022 Transfer</h3>
                  <p className="text-xs text-slate-500">
                    Dispatches a business payment instruction to {currentBank.name} Core $\to$ transforms into pacs.008 $\to$ Central Switch.
                  </p>
                </div>
                <Send className="h-5 w-5 text-slate-400" />
              </div>

              {/* Outcome Banner */}
              {lastOutcome && (
                <div
                  className={`mt-4 p-4 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                    lastOutcome.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {lastOutcome.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold text-sm">
                        {lastOutcome.success
                          ? `Payment of ₦${lastOutcome.amount?.toLocaleString()} Successfully Cleared!`
                          : `Transfer Rejected: ${lastOutcome.error}`}
                      </p>
                      {lastOutcome.reasonCode && (
                        <p className="font-mono text-[11px] mt-0.5">
                          ISO 20022 Reason Code: <strong>{lastOutcome.reasonCode}</strong>
                        </p>
                      )}
                      {lastOutcome.uetr && (
                        <p className="font-mono text-[10px] mt-1 text-slate-600 break-all">
                          UETR: {lastOutcome.uetr}
                        </p>
                      )}
                    </div>
                  </div>

                  {lastOutcome.uetr && (
                    <Link
                      href={`/switch`}
                      className="px-2.5 py-1 rounded bg-slate-900 text-white hover:bg-slate-800 font-medium text-[11px] shrink-0 flex items-center gap-1 shadow-xs"
                    >
                      Inspect in Switch <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}

              <form onSubmit={handleTransferSubmit} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Destination Bank */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Bank</label>
                    <select
                      value={destBankCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        setDestBankCode(code);
                        // Auto-fill beneficiary based on selected bank
                        const dest = banks.find((b) => b.code === code);
                        if (dest && dest.accounts && dest.accounts.length > 0) {
                          setCreditorAccount(dest.accounts[0].accountNumber);
                          setCreditorName(dest.accounts[0].customer?.fullName || 'Beneficiary');
                        }
                      }}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    >
                      {banks
                        .filter((b) => b.id !== currentBank.id)
                        .map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.name} ({b.code} - {b.routingCode})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Beneficiary Account with ACMT Name Enquiry */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">Beneficiary Account</label>
                      <button
                        type="button"
                        onClick={() => handleVerifyName()}
                        disabled={verifyingName}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 disabled:opacity-50"
                      >
                        {verifyingName ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin" /> Verifying via acmt.023...
                          </>
                        ) : (
                          'Verify via acmt.023'
                        )}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={creditorAccount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreditorAccount(val);
                          setVerifiedBeneficiary(null);
                        }}
                        placeholder="e.g. 0334455667"
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                        required
                      />
                    </div>
                    {verifiedBeneficiary && (
                      <p className="text-[11px] font-medium text-emerald-700 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        acmt.024.001.03 Verified: <strong>{verifiedBeneficiary}</strong>
                      </p>
                    )}
                    {enquiryError && (
                      <p className="text-[11px] font-medium text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {enquiryError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Beneficiary Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Beneficiary Name (from acmt.024)
                    </label>
                    <input
                      type="text"
                      value={creditorName}
                      onChange={(e) => setCreditorName(e.target.value)}
                      placeholder="e.g. Adaeze Okafor"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50"
                      required
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (NGN)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="1"
                      step="any"
                      placeholder="50000"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      required
                    />
                  </div>
                </div>

                {/* Purpose / Remittance */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Narrative / Remittance</label>
                  <input
                    type="text"
                    value={remittance}
                    onChange={(e) => setRemittance(e.target.value)}
                    placeholder="Consultancy fees / Invoice settlement"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                {/* Scenario Injector */}
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Simulation Scenario / Failure Injection
                  </label>
                  <select
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="SUCCESS">Standard Flow (Successful pacs.008 + pacs.002 ACTC)</option>
                    <option value="ACMT_TIMEOUT">ACMT Name Enquiry Timeout (20s SLA - No Debit TO01)</option>
                    <option value="SWITCH_TIMEOUT">PACS.008 Settlement Timeout (20s SLA - Auto Refund AB03)</option>
                    <option value="INSUFFICIENT_FUNDS">Insufficient Funds (Core reject AM04)</option>
                    <option value="INVALID_ACCOUNT">Invalid Account (Destination reject AC01)</option>
                    <option value="DEST_OFFLINE">Destination Bank Offline (Switch abort DS04)</option>
                    <option value="DUPLICATE_REPLAY">Duplicate Replay (Switch Idempotency reject AM05)</option>
                    <option value="MALFORMED_XML">Malformed XML (Switch Layer 1 reject ED05)</option>
                    <option value="SCHEME_RULE_FAILURE">Scheme Rule Failure (Unsupported Currency AG01)</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-lg bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Generating pacs.008 & Dispatching to Central Switch...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send ₦{parseFloat(amount || '0').toLocaleString()} to {creditorName} ({destBankCode})
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
