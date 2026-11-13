'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Search, Github, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onOpenCommandPalette: () => void;
  onOpenConnectModal: () => void;
  /** null = still loading; true = connected; false = not connected */
  githubConnected?: boolean | null;
}

export function Header({ onOpenCommandPalette, onOpenConnectModal, githubConnected }: HeaderProps) {
  const pathname = usePathname();

  const getBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 1 && segments[0] === 'dashboard') {
      return [{ name: 'Overview', href: '/dashboard' }];
    }
    return segments.map((seg, idx) => {
      const href = '/' + segments.slice(0, idx + 1).join('/');
      let formatted = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
      if (seg === 'bavio-ai-v1') formatted = 'Repository';
      if (seg === 'apiproof-github-fixture') formatted = 'apiproof-github-fixture';
      if (seg === 'stripe-subscription-coupon-removed') formatted = 'stripe-subscription-coupon-removed';
      return { name: formatted, href };
    });
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="min-h-16 h-auto bg-white/90 backdrop-blur-md border-b border-[#E8E8E5] px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30 font-sans">
      {/* Breadcrumbs */}
      <nav className="min-w-0 shrink flex items-center gap-2 overflow-hidden text-xs">
        <Link href="/dashboard" className="text-[#686868] hover:text-[#111111] transition-colors font-medium">
          MY OWL
        </Link>
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex min-w-0 items-center gap-2">
            <span className="text-zinc-300">/</span>
            <Link
              href={crumb.href}
              className={`transition-colors ${
                i === breadcrumbs.length - 1 ? 'min-w-0 truncate text-[#111111] font-semibold' : 'min-w-0 truncate text-[#686868] hover:text-[#111111]'
              }`}
            >
              {crumb.name}
            </Link>
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Command Search Trigger */}
        <button
          onClick={onOpenCommandPalette}
          aria-label="Search dashboard"
          title="Search dashboard"
          className="flex min-h-10 items-center gap-2 rounded-xl border border-[#E8E8E5] bg-[#F6F6F4] px-2.5 py-1.5 text-xs text-[#686868] shadow-2xs transition-colors hover:bg-zinc-200/60 sm:gap-3 sm:px-3.5"
        >
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <span className="hidden sm:inline">Search repos, findings, SDKs...</span>
          <kbd className="hidden sm:inline bg-white text-zinc-600 border border-[#E8E8E5] rounded px-1.5 py-0.5 text-[10px] font-mono ml-1 shadow-2xs">
            ⌘K
          </kbd>
        </button>

        {/* GitHub Connection Control */}
        {githubConnected ? (
          /* Connected state — still clickable to manage/reconnect */
          <button
            id="github-connected-btn"
            onClick={onOpenConnectModal}
            title="GitHub connected — click to manage repositories"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-medium text-emerald-800 shadow-2xs transition-colors hover:bg-emerald-100 sm:px-3.5"
          >
            <Github className="h-3.5 w-3.5 text-emerald-700" />
            <span className="hidden sm:inline">GitHub Connected</span>
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          </button>
        ) : (
          /* Not connected (or still loading — show connect button while unknown) */
          <Button
            id="github-connect-btn"
            variant="outline"
            size="sm"
            onClick={onOpenConnectModal}
            aria-label="Connect GitHub"
            title="Connect GitHub"
            icon={<Github className="h-3.5 w-3.5 text-[#111111]" />}
            className="min-h-10 px-2.5 text-xs font-medium sm:px-3"
          >
            <span className="hidden sm:inline">Connect GitHub</span>
          </Button>
        )}
      </div>
    </header>
  );
}
