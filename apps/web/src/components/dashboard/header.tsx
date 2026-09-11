'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Search, Bell, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onOpenCommandPalette: () => void;
  onOpenConnectModal: () => void;
}

export function Header({ onOpenCommandPalette, onOpenConnectModal }: HeaderProps) {
  const pathname = usePathname();

  const getBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 1 && segments[0] === 'dashboard') {
      return [{ name: 'Dashboard', href: '/dashboard' }];
    }
    return segments.map((seg, idx) => {
      const href = '/' + segments.slice(0, idx + 1).join('/');
      let formatted = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
      if (seg === 'bavio-ai-v1') formatted = 'Bavio-Ai-v1';
      if (seg === 'apiproof-github-fixture') formatted = 'apiproof-github-fixture';
      if (seg === 'stripe-subscription-coupon-removed') formatted = 'stripe-subscription-coupon-removed';
      return { name: formatted, href };
    });
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="h-14 bg-[#090a0f]/90 backdrop-blur-md border-b border-[#1f2333] px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs">
        <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-200 transition-colors">
          APIProof
        </Link>
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-2">
            <span className="text-zinc-400">/</span>
            <Link
              href={crumb.href}
              className={`transition-colors ${
                i === breadcrumbs.length - 1 ? 'text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {crumb.name}
            </Link>
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Command Search Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-3 bg-[#12141c] hover:bg-[#181b26] border border-[#1f2333] hover:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-400 transition-all shadow-sm group"
        >
          <Search className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-300" />
          <span>Search repos, findings, SDKs...</span>
          <kbd className="bg-zinc-800 text-zinc-400 border border-zinc-700/60 rounded px-1.5 py-0.5 text-[10px] font-mono font-medium ml-2">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg bg-[#12141c] hover:bg-[#181b26] border border-[#1f2333] text-zinc-400 hover:text-zinc-200 transition-all">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
        </button>

        {/* Connect GitHub Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenConnectModal}
          icon={<Github className="h-3.5 w-3.5 text-zinc-300" />}
          className="bg-[#12141c]"
        >
          <span>Connect GitHub</span>
        </Button>
      </div>
    </header>
  );
}
