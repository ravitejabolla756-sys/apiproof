'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { CommandPalette } from '@/components/dashboard/command-palette';
import { ConnectRepoModal } from '@/components/dashboard/connect-repo-modal';
import { createSessionRevalidator, type SessionViewState } from '@/lib/session-revalidation';
import {
  GITHUB_CONNECTION_CHANGED_EVENT,
  GITHUB_CONNECTION_STORAGE_KEY,
  isGitHubConnectionChangedMessage,
  publishGitHubConnectionChanged,
  resolveGitHubConnectionStatus,
} from '@/lib/github-connection-sync';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [authState, setAuthState] = useState<SessionViewState>('checking');
  const githubStatusRequestId = useRef(0);
  const githubStatusController = useRef<AbortController | null>(null);

  useEffect(() => {
    const session = createSessionRevalidator({
      request: (signal) => fetch('/api/auth', { cache: 'no-store', signal }),
      onState: setAuthState,
      onExpired: () => {
          const from = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/login?from=${encodeURIComponent(from)}`);
      },
    });

    void session.validate();
    const interval = window.setInterval(() => { void session.validate(); }, 60_000);
    const onFocus = () => { void session.validate(); };
    window.addEventListener('focus', onFocus);
    return () => {
      session.dispose();
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const refreshGithubStatus = useCallback(async () => {
    const requestId = ++githubStatusRequestId.current;
    githubStatusController.current?.abort();
    const controller = new AbortController();
    githubStatusController.current = controller;
    try {
      const res = await fetch('/api/github/repositories', { cache: 'no-store', signal: controller.signal });
      const data = res.ok ? await res.json() as { connected?: unknown } : null;
      if (requestId !== githubStatusRequestId.current || controller.signal.aborted) return;
      setGithubConnected((previous) => resolveGitHubConnectionStatus(
        previous,
        res.ok ? { ok: true, connected: data?.connected } : { ok: false },
      ));
    } catch {
      // Preserve the last authoritative state during transient failures.
    } finally {
      if (requestId === githubStatusRequestId.current) githubStatusController.current = null;
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
    const onPageShow = () => refreshGithubStatus();
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', refreshGithubStatus);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', refreshGithubStatus);
      window.removeEventListener('pageshow', onPageShow);
      githubStatusRequestId.current += 1;
      githubStatusController.current?.abort();
      githubStatusController.current = null;
      channel?.close();
    };
  }, [refreshGithubStatus]);

  useEffect(() => {
    const handleCustomOpen = () => setIsCommandPaletteOpen(true);
    window.addEventListener('open-command-palette', handleCustomOpen);
    return () => window.removeEventListener('open-command-palette', handleCustomOpen);
  }, []);

  if (authState !== 'authenticated') {
    return (
      <div className="min-h-screen bg-[#F6F6F4] flex items-center justify-center p-6 text-center font-sans text-sm text-[#686868]">
        <div className="space-y-3">
          <p>{authState === 'checking' ? 'Checking your session…' : 'We could not validate your session.'}</p>
          {authState === 'unavailable' && (
            <button className="underline text-[#111111]" onClick={() => window.location.reload()}>
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F4] text-[#111111] flex flex-col md:flex-row font-sans selection:bg-[#111111] selection:text-white">
        <a
          href="#main-content"
          className="skip-link sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#111111] focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-[#0050F8] focus:ring-offset-2"
        >
          Skip to main content
        </a>
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          githubConnected={githubConnected}
        />
          <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1440px] w-full mx-auto space-y-6 focus:outline-none">
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
