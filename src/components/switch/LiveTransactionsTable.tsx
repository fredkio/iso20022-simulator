'use client';

import React from 'react';
import { CanonicalPayment } from '@/types';
import { Eye, ArrowUpRight, ArrowDownLeft, Search } from 'lucide-react';

interface LiveTransactionsTableProps {
  transactions: CanonicalPayment[];
  onSelectTransaction: (uetr: string) => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
}

export default function LiveTransactionsTable({
  transactions,
  onSelectTransaction,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: LiveTransactionsTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Live Switch Transactions & Messages Stream</h2>
          <p className="text-xs text-slate-500">Real-time stream of all ISO 20022 messages (clearing, balance & statement enquiries, mandates, RTP, and status reports)</p>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search UETR, Acct, Name, camt.060..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-md border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-100">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
            <tr>
              <th className="py-2.5 px-3">UETR / ID</th>
              <th className="py-2.5 px-3">Originating (From)</th>
              <th className="py-2.5 px-3">Destination (To)</th>
              <th className="py-2.5 px-3">Amount</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Latency</th>
              <th className="py-2.5 px-3 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                  No transactions or messages found. Initiate transfers in Banking Portal or dispatch any ISO message in Protocol Lab.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => onSelectTransaction(tx.uetr)}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3 font-mono text-[11px]">
                    <span className="font-semibold text-slate-900 block truncate max-w-[130px]" title={tx.uetr}>
                      {tx.uetr.slice(0, 8)}...{tx.uetr.slice(-4)}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-sans">
                      {new Date(tx.initiatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-medium text-slate-900 block">{tx.debtor.name}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {tx.originatingInstitution.name} ({tx.debtor.accountNumber || tx.debtor.name})
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-medium text-slate-900 block">{tx.creditor.name}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {tx.destinationInstitution.name} ({tx.creditor.accountNumber || tx.destinationInstitution.code})
                    </span>
                  </td>

                  <td className="py-3 px-3 font-mono font-bold text-slate-900">
                    {tx.amount > 0 ? (
                      `₦${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    ) : (
                      <span className="text-slate-400 font-normal">—</span>
                    )}
                  </td>

                  <td className="py-3 px-3">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                        tx.messageType?.startsWith('pain.008') || tx.localInstrument === 'DD'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : tx.messageType?.startsWith('pacs.003')
                          ? 'bg-purple-100 text-purple-900 border border-purple-300'
                          : tx.messageType?.startsWith('camt.060')
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : tx.messageType?.startsWith('camt.052') || tx.messageType?.startsWith('camt.053')
                          ? 'bg-sky-100 text-sky-900 border border-sky-300'
                          : tx.messageType?.startsWith('acmt.023') || tx.messageType?.startsWith('acmt.024')
                          ? 'bg-teal-100 text-teal-900 border border-teal-300'
                          : tx.messageType?.startsWith('pain.009') || tx.messageType?.startsWith('pain.010') || tx.messageType?.startsWith('pain.011') || tx.messageType?.startsWith('pain.012')
                          ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                          : tx.messageType?.startsWith('pain.013') || tx.messageType?.startsWith('pain.014')
                          ? 'bg-violet-100 text-violet-900 border border-violet-300'
                          : tx.messageType?.startsWith('pacs.028')
                          ? 'bg-orange-100 text-orange-900 border border-orange-300'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {tx.messageType || (tx.localInstrument === 'DD' ? 'pain.008' : 'pacs.008')}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tx.status === 'REJECTED' || tx.status === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800 animate-pulse'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-mono text-xs text-slate-600">
                    {tx.latencyMs ? `${tx.latencyMs}ms` : '-'}
                  </td>

                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTransaction(tx.uetr);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      title="Inspect complete ISO trace"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
