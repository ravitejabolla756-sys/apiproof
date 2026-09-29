'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { CommandPalette } from '@/components/dashboard/command-palette';
import { ConnectRepoModal } from '@/components/dashboard/connect-repo-modal';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);

  const refreshGithubStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/github/repositories');
      if (res.ok) {
        const data = await res.json();
        setGithubConnected(Boolean(data.connected));
      } else {
        setGithubConnected(false);
      }
    } catch {
      setGithubConnected(false);
    }
  }, []);

  useEffect(() => {
    refreshGithubStatus();
  }, [refreshGithubStatus]);

  useEffect(() => {
    const handleCustomOpen = () => setIsCommandPaletteOpen(true);
    window.addEventListener('open-command-palette', handleCustomOpen);
    return () => window.removeEventListener('open-command-palette', handleCustomOpen);
  }, []);

  return (
    <div className="min-h-screen bg-[#F6F6F4] text-[#111111] flex font-sans selection:bg-[#111111] selection:text-white">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          githubConnected={githubConnected}
        />
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1440px] w-full mx-auto space-y-6">
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
        onSuccess={refreshGithubStatus}
      />
    </div>
  );
}
