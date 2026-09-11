'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FolderGit2, Boxes, AlertTriangle, FileCheck2, GitPullRequest, Settings, X, ChevronRight } from 'lucide-react';
import { DEMO_REPOSITORIES, DEMO_INVENTORY } from '@/lib/demo-data';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open
          window.dispatchEvent(new CustomEvent('open-command-palette'));
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const navigate = (href: string) => {
    router.push(href);
    onClose();
  };

  const navItems = [
    { name: 'Repositories', href: '/dashboard/repositories', icon: FolderGit2, category: 'Pages' },
    { name: 'API Inventory', href: '/dashboard/inventory', icon: Boxes, category: 'Pages' },
    { name: 'Findings', href: '/dashboard/findings', icon: AlertTriangle, category: 'Pages' },
    { name: 'Migrations', href: '/dashboard/migrations', icon: FileCheck2, category: 'Pages' },
    { name: 'Pull Requests', href: '/dashboard/pull-requests', icon: GitPullRequest, category: 'Pages' },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings, category: 'Pages' },
  ];

  const filteredRepos = DEMO_REPOSITORIES.filter(
    (r) => r.name.toLowerCase().includes(query.toLowerCase()) || r.providers.some((p) => p.toLowerCase().includes(query.toLowerCase()))
  );

  const filteredInventory = DEMO_INVENTORY.filter(
    (inv) => inv.name.toLowerCase().includes(query.toLowerCase()) || inv.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24 px-4 animate-in fade-in duration-150">
      <div className="bg-[#12141c] border border-[#262b3d] w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Search Header */}
        <div className="flex items-center px-4 border-b border-[#1f2333] bg-[#0e1017]">
          <Search className="h-4 w-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search repositories or SDKs..."
            className="w-full bg-transparent border-0 px-3 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
            autoFocus
          />
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-200 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-4">
          {/* Navigation Links */}
          <div>
            <div className="px-3 py-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">
              Quick Navigation
            </div>
            <div className="space-y-0.5 mt-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-[#1c202e] hover:text-white transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-zinc-400 group-hover:text-sky-400" />
                      <span>{item.name}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-300" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Repositories */}
          {filteredRepos.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">
                Repositories ({filteredRepos.length})
              </div>
              <div className="space-y-0.5 mt-1">
                {filteredRepos.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => navigate(`/dashboard/repositories/${repo.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-[#1c202e] hover:text-white transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <FolderGit2 className="h-4 w-4 text-sky-400" />
                      <span className="font-mono font-medium">{repo.name}</span>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono">{repo.statusLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Inventory */}
          {filteredInventory.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">
                API Inventory ({filteredInventory.length})
              </div>
              <div className="space-y-0.5 mt-1">
                {filteredInventory.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => navigate('/dashboard/inventory')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-[#1c202e] hover:text-white transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Boxes className="h-4 w-4 text-amber-400" />
                      <span>{inv.name}</span>
                      <span className="text-[10px] text-zinc-400">({inv.category})</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${inv.status === 'reviewed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                      {inv.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#0a0b10] border-t border-[#1f2333] flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <span>Navigate with ↑ ↓ and Enter</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
