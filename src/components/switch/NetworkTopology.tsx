'use client';

import React, { useState } from 'react';
import { Participant, ParticipantStatus, CanonicalPayment } from '@/types';
import { Server, ShieldCheck, Power, AlertTriangle } from 'lucide-react';

interface NetworkTopologyProps {
  participants: Participant[];
  latestTransaction?: CanonicalPayment | null;
  onStatusChange: (code: string, status: ParticipantStatus) => void;
}

export default function NetworkTopology({
  participants,
  latestTransaction,
  onStatusChange,
}: NetworkTopologyProps) {
  const [selectedBank, setSelectedBank] = useState<Participant | null>(null);

  // Switch center coordinates
  const centerX = 260;
  const centerY = 190;
  const radius = 135;

  // Compute angles for 5 banks around circle
  const nodePositions = participants.map((p, idx) => {
    const angle = (idx * (2 * Math.PI) / participants.length) - Math.PI / 2;
    return {
      participant: p,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  const isOrig = (code: string) => latestTransaction?.originatingInstitution.code === code;
  const isDest = (code: string) => latestTransaction?.destinationInstitution.code === code;
  const isTxActive = latestTransaction && latestTransaction.status !== 'COMPLETED' && latestTransaction.status !== 'REJECTED';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900">Interbank Network Topology</h2>
          <p className="text-xs text-slate-500">Real-time Star Topology routing all interbank traffic through Central Switch</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Online</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> Offline</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Degraded</span>
        </div>
      </div>

      <div className="relative mt-2 flex flex-col lg:flex-row items-center justify-between gap-6">
        {/* SVG Network Map */}
        <div className="w-full max-w-[520px] aspect-[4/3] relative flex items-center justify-center">
          <svg viewBox="0 0 520 380" className="w-full h-full select-none overflow-visible">
            <defs>
              <linearGradient id="activeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#059669" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Connecting Spoke Lines */}
            {nodePositions.map(({ participant, x, y }) => {
              const activeLeg = isOrig(participant.code) || isDest(participant.code);
              const isOffline = participant.status === 'OFFLINE';

              return (
                <g key={`line-${participant.code}`}>
                  <line
                    x1={centerX}
                    y1={centerY}
                    x2={x}
                    y2={y}
                    stroke={isOffline ? '#fca5a5' : activeLeg ? '#059669' : '#cbd5e1'}
                    strokeWidth={activeLeg ? 3 : 1.5}
                    strokeDasharray={isOffline ? '4 4' : activeLeg ? '6 4' : 'none'}
                    className={activeLeg ? 'animate-pulse' : ''}
                  />

                  {/* Animated pulse packet along active leg */}
                  {activeLeg && (
                    <circle r="4" fill="#10B981" filter="url(#glow)">
                      <animateMotion
                        path={
                          isOrig(participant.code)
                            ? `M ${x} ${y} L ${centerX} ${centerY}`
                            : `M ${centerX} ${centerY} L ${x} ${y}`
                        }
                        dur="1.2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* Central Switch Hub Node */}
            <g transform={`translate(${centerX}, ${centerY})`}>
              <circle r="42" fill="#0f172a" className="shadow-lg" />
              <circle r="36" fill="#1e293b" stroke="#334155" strokeWidth="2" />
              <circle r="48" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" className="animate-spin origin-center" style={{ animationDuration: '16s' }} />
              <text y="-8" textAnchor="middle" fill="#10B981" fontSize="10" fontWeight="bold">CENTRAL</text>
              <text y="7" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">SWITCH</text>
              <text y="20" textAnchor="middle" fill="#94a3b8" fontSize="8">NPS ENGINE</text>
            </g>

            {/* Bank Nodes */}
            {nodePositions.map(({ participant, x, y }) => {
              const active = isOrig(participant.code) || isDest(participant.code);
              const isSelected = selectedBank?.code === participant.code;
              const isOffline = participant.status === 'OFFLINE';

              return (
                <g
                  key={`node-${participant.code}`}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer group"
                  onClick={() => setSelectedBank(participant)}
                >
                  {/* Active Ripple */}
                  {active && (
                    <circle r="32" fill={participant.brandColor} opacity="0.2" className="animate-ping" />
                  )}

                  {/* Outer circle */}
                  <circle
                    r="28"
                    fill={isSelected ? '#0f172a' : '#ffffff'}
                    stroke={isOffline ? '#ef4444' : isSelected ? '#0f172a' : participant.brandColor}
                    strokeWidth={isSelected ? 3 : 2}
                    className="transition-all duration-200 group-hover:scale-105"
                  />

                  {/* Inner node icon/text */}
                  <text
                    y="-4"
                    textAnchor="middle"
                    fill={isSelected ? '#ffffff' : '#0f172a'}
                    fontSize="9.5"
                    fontWeight="bold"
                  >
                    {participant.code}
                  </text>
                  <text
                    y="8"
                    textAnchor="middle"
                    fill={isSelected ? '#94a3b8' : '#64748b'}
                    fontSize="7.5"
                  >
                    {participant.routingCode}
                  </text>

                  {/* Status indicator dot */}
                  <circle
                    cx="18"
                    cy="-18"
                    r="5"
                    fill={
                      participant.status === 'ONLINE'
                        ? '#10b981'
                        : participant.status === 'OFFLINE'
                        ? '#ef4444'
                        : '#f59e0b'
                    }
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />

                  {/* Label badge */}
                  <rect
                    x="-42"
                    y="32"
                    width="84"
                    height="18"
                    rx="4"
                    fill="#f8fafc"
                    stroke="#e2e8f0"
                  />
                  <text
                    y="44"
                    textAnchor="middle"
                    fill="#334155"
                    fontSize="8.5"
                    fontWeight="600"
                  >
                    {participant.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Participant Management Drawer */}
        <div className="w-full lg:w-72 border border-slate-100 rounded-lg p-4 bg-slate-50/70 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="font-semibold text-slate-800">Participant Controls</span>
            <span className="text-[10px] text-slate-400">Click node to inspect</span>
          </div>

          {selectedBank ? (
            <div className="mt-3 space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">{selectedBank.name}</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedBank.status === 'ONLINE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedBank.status === 'OFFLINE'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedBank.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Code: <code className="font-mono text-slate-700">{selectedBank.code}</code> | Routing: <code className="font-mono text-slate-700">{selectedBank.routingCode}</code>
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Simulated Endpoint</span>
                <p className="font-mono text-[11px] text-slate-700 bg-white p-1 rounded border border-slate-200 mt-0.5 truncate">
                  {selectedBank.endpoint}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Supported ISO Messages</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedBank.supportedMessages.map((m) => (
                    <span key={m} className="bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[9px]">
                      {m.split('.')[0]}.{m.split('.')[1]}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Override Status</span>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  <button
                    onClick={() => {
                      onStatusChange(selectedBank.code, 'ONLINE');
                      setSelectedBank({ ...selectedBank, status: 'ONLINE' });
                    }}
                    className={`py-1 rounded text-[10px] font-medium border transition-colors ${
                      selectedBank.status === 'ONLINE'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Online
                  </button>
                  <button
                    onClick={() => {
                      onStatusChange(selectedBank.code, 'OFFLINE');
                      setSelectedBank({ ...selectedBank, status: 'OFFLINE' });
                    }}
                    className={`py-1 rounded text-[10px] font-medium border transition-colors ${
                      selectedBank.status === 'OFFLINE'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Offline
                  </button>
                  <button
                    onClick={() => {
                      onStatusChange(selectedBank.code, 'DEGRADED');
                      setSelectedBank({ ...selectedBank, status: 'DEGRADED' });
                    }}
                    className={`py-1 rounded text-[10px] font-medium border transition-colors ${
                      selectedBank.status === 'DEGRADED'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Degraded
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400">
              <Server className="h-8 w-8 mx-auto stroke-1 opacity-50 mb-1" />
              <p>Click any bank node on the network map to view details and control participant availability.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
