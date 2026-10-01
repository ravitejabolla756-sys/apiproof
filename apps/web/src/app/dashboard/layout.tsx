'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { CommandPalette } from '@/components/dashboard/command-palette';
import { ConnectRepoModal } from '@/components/dashboard/connect-repo-modal';
import {
  GITHUB_CONNECTION_CHANGED_EVENT,
  GITHUB_CONNECTION_STORAGE_KEY,
  isGitHubConnectionChangedMessage,
  publishGitHubConnectionChanged,
} from '@/lib/github-connection-sync';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);

  const refreshGithubStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/github/repositories', { cache: 'no-store' });
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
    const params = new URLSearchParams(window.location.search);
    if (params.get('github') !== 'connected') return;

    publishGitHubConnectionChanged();
    window.history.replaceState(null, '', window.location.pathname);
    refreshGithubStatus();
  }, [refreshGithubStatus]);

  useEffect(() => {
    const refreshFromMessage = (message: unknown) => {
      if (isGitHubConnectionChangedMessage(message)) refreshGithubStatus();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== GITHUB_CONNECTION_STORAGE_KEY || !event.newValue) return;
      try {
        refreshFromMessage(JSON.parse(event.newValue));
      } catch {
        // Ignore malformed client storage and rely on the next refresh.
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(GITHUB_CONNECTION_CHANGED_EVENT);
      channel.addEventListener('message', (event) => refreshFromMessage(event.data));
    } catch {
      // Storage and visibility listeners below provide the fallback.
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshGithubStatus();
    };
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', refreshGithubStatus);

    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', refreshGithubStatus);
      channel?.close();
    };
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
