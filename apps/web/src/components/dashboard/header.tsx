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
    <header className="h-16 min-w-0 max-w-full overflow-hidden bg-white/90 backdrop-blur-md border-b border-[#E8E8E5] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 font-sans">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden flex items-center gap-2 text-xs whitespace-nowrap">
        <Link href="/dashboard" className="text-[#686868] hover:text-[#111111] transition-colors font-medium">
          MY OWL
        </Link>
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-2">
            <span className="text-zinc-300">/</span>
            <Link
              href={crumb.href}
              className={`transition-colors ${
                i === breadcrumbs.length - 1 ? 'text-[#111111] font-semibold' : 'text-[#686868] hover:text-[#111111]'
              }`}
            >
              {crumb.name}
            </Link>
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-2 sm:gap-3">
        {/* Command Search Trigger */}
        <button
          type="button"
          aria-label="Search repos, findings, SDKs... ⌘K"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-3 bg-[#F6F6F4] hover:bg-zinc-200/60 border border-[#E8E8E5] rounded-xl px-3.5 py-1.5 text-xs text-[#686868] transition-colors shadow-2xs"
        >
          <Search aria-hidden="true" className="h-3.5 w-3.5 text-zinc-500" />
          <span className="hidden sm:inline">Search repos, findings, SDKs...</span>
          <kbd className="hidden sm:inline bg-white text-zinc-600 border border-[#E8E8E5] rounded px-1.5 py-0.5 text-[10px] font-mono ml-1 shadow-2xs">
            ⌘K
          </kbd>
        </button>

        {/* GitHub Connection Control */}
        {githubConnected ? (
          /* Connected state — still clickable to manage/reconnect */
          <button
            type="button"
            aria-label="Manage GitHub connection"
            id="github-connected-btn"
            onClick={onOpenConnectModal}
            title="GitHub connected — click to manage repositories"
            className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors shadow-2xs"
          >
            <Github aria-hidden="true" className="h-3.5 w-3.5 text-emerald-700" />
            <span className="hidden sm:inline">GitHub Connected</span>
            <CheckCircle2 aria-hidden="true" className="h-3 w-3 text-emerald-600" />
          </button>
        ) : (
          /* Not connected (or still loading — show connect button while unknown) */
          <Button
            id="github-connect-btn"
            aria-label="Connect GitHub"
            variant="outline"
            size="sm"
            onClick={onOpenConnectModal}
            icon={<Github aria-hidden="true" className="h-3.5 w-3.5 text-[#111111]" />}
            className="text-xs font-medium"
          >
            <span className="hidden sm:inline">Connect GitHub</span>
          </Button>
        )}
      </div>
    </header>
  );
}
