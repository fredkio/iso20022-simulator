'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, ArrowLeftRight, Landmark, RefreshCw, Activity, Terminal } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (!confirm('Reset simulation environment to default seed state? All balances and transactions will be reset.')) return;
    setResetting(true);
    try {
      await fetch('/api/switch/reset', { method: 'POST' });
      window.location.reload();
    } catch {
      alert('Failed to reset simulation state');
    } finally {
      setResetting(false);
    }
  };

  const navItems = [
    { label: 'Switch Console', href: '/switch', icon: Activity },
    { label: 'Customer Banking', href: '/banking', icon: Landmark },
    { label: 'Simulation Lab', href: '/lab', icon: Terminal },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-emerald-400 shadow-sm">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-slate-900">ISO 20022 Multi-Bank Switch</span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-800 uppercase">
                Sim / NPS Sandbox
              </span>
            </div>
            <p className="text-xs text-slate-500">Central Payment Switch & Real-time Clearing Simulator</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === '/switch' && pathname === '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Status & Reset Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Switch Online
          </div>

          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm disabled:opacity-50"
            title="Reset simulation database to initial balances"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resetting ? 'animate-spin' : ''}`} />
            Reset State
          </button>
        </div>
      </div>
    </header>
  );
}
