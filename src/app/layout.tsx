import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/layout/Navbar';

export const metadata: Metadata = {
  title: 'ISO 20022 Multi-Bank Clearing & Settlement Simulator',
  description: 'Multi-Bank Central Payment Switch & Core Banking Simulation Environment using pacs.008 & pacs.002 ISO 20022 messaging.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased flex flex-col">
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
          ISO 20022 Multi-Bank Transaction Simulation & Training Environment • Synthetic Data Only • Central Payment Switch
        </footer>
      </body>
    </html>
  );
}
