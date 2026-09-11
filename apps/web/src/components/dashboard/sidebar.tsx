'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderGit2,
  Boxes,
  AlertTriangle,
  GitPullRequest,
  FileCheck2,
  Activity,
  Settings,
  ShieldCheck,
  ChevronDown,
  Layers,
} from 'lucide-react';

const mainNavItems = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Repositories', href: '/dashboard/repositories', icon: FolderGit2, badge: '2' },
  { name: 'API Inventory', href: '/dashboard/inventory', icon: Boxes, badge: '9' },
  { name: 'Findings', href: '/dashboard/findings', icon: AlertTriangle, badge: '1', badgeColor: 'bg-rose-500/20 text-rose-300' },
  { name: 'Migrations', href: '/dashboard/migrations', icon: FileCheck2 },
  { name: 'Pull Requests', href: '/dashboard/pull-requests', icon: GitPullRequest, badge: '1', badgeColor: 'bg-emerald-500/20 text-emerald-300' },
];

const secondaryNavItems = [
  { name: 'Activity', href: '/dashboard/activity', icon: Activity },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#0d0e14] border-r border-[#1f2333] flex flex-col justify-between shrink-0 h-screen sticky top-0">
      <div className="p-4">
        {/* Brand Header */}
        <Link href="/" className="flex items-center gap-2.5 px-2 py-2 mb-6 group">
          <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:bg-sky-500/20 transition-all shadow-sm shadow-sky-500/10">
            <Layers className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-zinc-100 flex items-center gap-1.5">
              APIProof
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.2 bg-zinc-800 text-zinc-400 border border-zinc-700/60 rounded font-mono font-medium">v0.7</span>
            </span>
            <span className="text-[11px] text-zinc-400">Change Intelligence Engine</span>
          </div>
        </Link>

        {/* Primary Nav */}
        <div className="space-y-1">
          <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
            Platform
          </div>
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#151722]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-sky-400' : 'text-zinc-400'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                      item.badgeColor || 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Secondary Nav */}
        <div className="mt-8 space-y-1">
          <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
            Workspace
          </div>
          {secondaryNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#151722]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-sky-400' : 'text-zinc-400'}`} />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Account / Workspace Switcher */}
      <div className="p-3 border-t border-[#1f2333]">
        <button className="w-full flex items-center justify-between p-2 rounded-lg bg-[#141620] hover:bg-[#1a1d2b] border border-[#232738] transition-all group">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-indigo-500 to-sky-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              R
            </div>
            <div className="flex flex-col text-left truncate">
              <span className="text-xs font-medium text-zinc-200 truncate">ravitejabolla756-sys</span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 inline" /> GitHub App Active
              </span>
            </div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-300 shrink-0" />
        </button>
      </div>
    </aside>
  );
}
