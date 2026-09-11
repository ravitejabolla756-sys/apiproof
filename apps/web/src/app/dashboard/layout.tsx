'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { CommandPalette } from '@/components/dashboard/command-palette';
import { ConnectRepoModal } from '@/components/dashboard/connect-repo-modal';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  useEffect(() => {
    const handleCustomOpen = () => setIsCommandPaletteOpen(true);
    window.addEventListener('open-command-palette', handleCustomOpen);
    return () => window.removeEventListener('open-command-palette', handleCustomOpen);
  }, []);

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
        />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>

      {/* Global Modals */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
      <ConnectRepoModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />
    </div>
  );
}
