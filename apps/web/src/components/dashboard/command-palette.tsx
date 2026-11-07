'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FolderGit2, Boxes, AlertTriangle, FileCheck2, GitPullRequest, Settings, ShieldCheck, X, ChevronRight } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RepositoryItem {
  id: string;
  name: string;
  full_name: string;
  status: string;
  findings_count: number;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  rulesCount: number;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      previousActiveElementRef.current?.focus();
      previousActiveElementRef.current = null;
      return;
    }

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    searchInputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    async function loadSearchData() {
      try {
        const [repoRes, invRes] = await Promise.all([
          fetch('/api/repositories'),
          fetch('/api/inventory'),
        ]);

        if (repoRes.ok) {
          const json = await repoRes.json();
          setRepositories(json.repositories || []);
        }
        if (invRes.ok) {
          const json = await invRes.json();
          setInventory(json.providers || []);
        }
      } catch {
        // Suppress search data load failures
      }
    }

    loadSearchData();
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
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

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input, button:not([disabled])');
    if (!focusable?.length) return;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!isOpen) return null;

  const navigate = (href: string) => {
    router.push(href);
    onClose();
  };

  const navItems = [
    { name: 'Repositories', href: '/dashboard/repositories', icon: FolderGit2 },
    { name: 'API Inventory', href: '/dashboard/inventory', icon: Boxes },
    { name: 'Findings', href: '/dashboard/findings', icon: AlertTriangle },
    { name: 'Rule Review', href: '/dashboard/rules/pending', icon: ShieldCheck },
    { name: 'Migrations', href: '/dashboard/migrations', icon: FileCheck2 },
    { name: 'Pull Requests', href: '/dashboard/pull-requests', icon: GitPullRequest },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const filteredRepos = repositories.filter(
    (r) => r.name.toLowerCase().includes(query.toLowerCase()) || r.full_name.toLowerCase().includes(query.toLowerCase())
  );

  const filteredInventory = inventory.filter(
    (inv) => inv.name.toLowerCase().includes(query.toLowerCase()) || inv.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-24 px-4 animate-in fade-in duration-150 font-sans">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        ref={dialogRef}
        onKeyDown={handleDialogKeyDown}
        className="bg-white border border-[#E8E8E5] w-full max-w-xl rounded-[24px] shadow-2xl overflow-hidden flex flex-col"
      >
        <h2 id="command-palette-title" className="sr-only">Search MY OWL</h2>
        {/* Search Header */}
        <div className="flex items-center px-4 border-b border-[#E8E8E5] bg-[#F6F6F4]">
          <Search className="h-4 w-4 text-zinc-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            aria-label="Search repositories and workspace navigation"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search repositories or SDK rules..."
            className="w-full bg-transparent border-0 px-3 py-3.5 text-xs text-[#111111] placeholder:text-zinc-400 focus:outline-none"
          />
          <button type="button" aria-label="Close search" onClick={onClose} className="p-1 text-zinc-400 hover:text-[#111111] rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4 text-xs">
          {/* Navigation Links */}
          <div>
            <div className="px-3 py-1 text-[10px] font-semibold text-[#686868] uppercase tracking-wider">
              Quick Navigation
            </div>
            <div className="space-y-0.5 mt-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => navigate(item.href)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#111111] hover:bg-[#F6F6F4] transition-all text-left group font-medium"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-purple-700" />
                      <span>{item.name}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-[#111111]" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Repositories */}
          {filteredRepos.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-semibold text-[#686868] uppercase tracking-wider">
                Workspace Repositories ({filteredRepos.length})
              </div>
              <div className="space-y-0.5 mt-1">
                {filteredRepos.map((repo) => (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => navigate(`/dashboard/repositories/${repo.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#111111] hover:bg-[#F6F6F4] transition-all text-left group font-medium"
                  >
                    <div className="flex items-center gap-2.5">
                      <FolderGit2 className="h-4 w-4 text-purple-700" />
                      <span className="font-mono font-medium">{repo.name}</span>
                    </div>
                    <span className="text-[11px] text-[#686868] font-mono">
                      {repo.findings_count > 0 ? `${repo.findings_count} findings` : 'Healthy'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Inventory */}
          {filteredInventory.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-semibold text-[#686868] uppercase tracking-wider">
                Registered SDK Providers ({filteredInventory.length})
              </div>
              <div className="space-y-0.5 mt-1">
                {filteredInventory.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => navigate('/dashboard/inventory')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#111111] hover:bg-[#F6F6F4] transition-all text-left group font-medium"
                  >
                    <div className="flex items-center gap-2.5">
                      <Boxes className="h-4 w-4 text-purple-700" />
                      <span>{inv.name}</span>
                      <span className="text-[10px] text-[#686868]">({inv.category})</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#EBF3FC] text-blue-800">
                      {inv.rulesCount} rules
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#F6F6F4] border-t border-[#E8E8E5] flex items-center justify-between text-[10px] text-[#686868] font-mono">
          <span>Navigate with ↑ ↓ and Enter</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
