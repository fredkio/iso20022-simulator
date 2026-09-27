'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Participant, CanonicalPayment, ParticipantStatus } from '@/types';
import NetworkTopology from '@/components/switch/NetworkTopology';
import LiveTransactionsTable from '@/components/switch/LiveTransactionsTable';
import TransactionDetailModal from '@/components/switch/TransactionDetailModal';
import { Activity, CheckCircle2, AlertTriangle, ArrowUpDown, Server, ShieldCheck, Zap } from 'lucide-react';

export default function SwitchConsolePage() {
  const [metrics, setMetrics] = useState<{
    totalTransactions: number;
    completed: number;
    rejected: number;
    successRate: number;
    activeParticipants: number;
    offlineParticipants: number;
    totalVolume: number;
    avgLatency: number;
  }>({
    totalTransactions: 0,
    completed: 0,
    rejected: 0,
    successRate: 100,
    activeParticipants: 5,
    offlineParticipants: 0,
    totalVolume: 0,
    avgLatency: 0,
  });

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [transactions, setTransactions] = useState<CanonicalPayment[]>([]);
  const [selectedUetr, setSelectedUetr] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/switch/status?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.metrics) setMetrics(data.metrics);
      if (data.participants) setParticipants(data.participants);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const query = new URLSearchParams();
      if (searchTerm) query.set('search', searchTerm);
      if (statusFilter !== 'ALL') query.set('status', statusFilter);
      query.set('t', Date.now().toString());

      const res = await fetch(`/api/switch/transactions?${query.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.transactions) setTransactions(data.transactions);
    } catch (err) {
      console.error(err);
    }
  }, [searchTerm, statusFilter]);

  // Polling loop for real-time switch feed
  useEffect(() => {
    fetchStatus();
    fetchTransactions();
    const interval = setInterval(() => {
      fetchStatus();
      fetchTransactions();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchTransactions]);

  const handleStatusChange = async (code: string, status: ParticipantStatus) => {
    try {
      await fetch('/api/switch/participants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, status }),
      });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Institutional Metrics Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Transactions</span>
            <Activity className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-slate-900">{metrics.totalTransactions}</p>
          <span className="text-[10px] text-slate-500">pacs.008 instructions</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Settled Volume</span>
            <ArrowUpDown className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-slate-900">
            ₦{(metrics.totalVolume / 1000).toFixed(1)}k
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">Cleared at Switch</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Success Rate</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-emerald-700">{metrics.successRate}%</p>
          <span className="text-[10px] text-slate-500">{metrics.completed} successful</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Avg Latency</span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-slate-900">{metrics.avgLatency} ms</p>
          <span className="text-[10px] text-slate-500">End-to-end trip</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Banks</span>
            <Server className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-slate-900">{metrics.activeParticipants} / 5</p>
          <span className="text-[10px] text-emerald-600 font-medium">Online & routing</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Offline Banks</span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <p className="mt-1 text-xl font-extrabold text-slate-900">{metrics.offlineParticipants}</p>
          <span className="text-[10px] text-slate-500">Route failure (DS04)</span>
        </div>
      </div>

      {/* Interactive Network Diagram */}
      <NetworkTopology
        participants={participants}
        latestTransaction={transactions[0] || null}
        onStatusChange={handleStatusChange}
      />

      {/* Live Transaction Stream Table */}
      <LiveTransactionsTable
        transactions={transactions}
        onSelectTransaction={(uetr) => setSelectedUetr(uetr)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* 7-Tab Detailed Trace Modal */}
      {selectedUetr && (
        <TransactionDetailModal
          uetr={selectedUetr}
          onClose={() => setSelectedUetr(null)}
        />
      )}
    </div>
  );
}
