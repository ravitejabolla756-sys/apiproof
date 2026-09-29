"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ApiProofLogo } from "@/components/ui/logo";
import {
  LayoutDashboard,
  GitBranch,
  Boxes,
  AlertTriangle,
  FileCheck2,
  GitPullRequest,
  Activity,
  Sliders,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openFindingsCount, setOpenFindingsCount] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [workspaceName, setWorkspaceName] = useState<string>('');

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/overview');
        if (res.ok) {
          const data = await res.json();
          if (typeof data.stats?.openFindings === 'number') {
            setOpenFindingsCount(data.stats.openFindings);
          }
          if (data.workspace?.name) {
            setWorkspaceName(data.workspace.name);
          }
          if (data.user?.email) {
            setUserEmail(data.user.email);
          }
        }
      } catch {
        // Ignore background stat fetch errors
      }
    }
    loadStats();
  }, [pathname]);

  const mainNav = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Repositories", href: "/dashboard/repositories", icon: GitBranch },
    { name: "API Inventory", href: "/dashboard/inventory", icon: Boxes },
    {
      name: "Findings",
      href: "/dashboard/findings",
      icon: AlertTriangle,
      badge: openFindingsCount !== null && openFindingsCount > 0 ? String(openFindingsCount) : undefined,
      risk: openFindingsCount !== null && openFindingsCount > 0,
    },
    { name: "Migrations", href: "/dashboard/migrations", icon: FileCheck2 },
    { name: "Pull Requests", href: "/dashboard/pull-requests", icon: GitPullRequest },
  ];

  const secondaryNav = [
    { name: "Activity", href: "/dashboard/activity", icon: Activity },
    { name: "Settings", href: "/dashboard/settings", icon: Sliders },
  ];

  async function handleLogout() {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch {
      // ignore
    }
    window.location.href = '/login';
  }

  return (
    <aside
      className={`relative flex flex-col border-r border-[#E8E8E5] bg-white transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#E8E8E5] font-sans">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-stone-100 border border-[#E8E8E5] flex items-center justify-center shrink-0">
            <ApiProofLogo className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#111111] tracking-tight">
                MY OWL
              </span>
              <span className="text-[10px] bg-[#F6F6F4] border border-[#E8E8E5] px-2 py-0.5 rounded-full text-zinc-600 font-medium">
                v0.7
              </span>
            </div>
          )}
        </Link>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-[#111111] hover:bg-[#F6F6F4] transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Primary Navigation */}
      <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto font-sans text-xs font-medium">
        <div className="space-y-1">
          {mainNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                  isActive
                    ? "bg-[#F4F0FA] text-[#111111] font-semibold border border-[#E4D9F5]"
                    : "text-[#686868] hover:text-[#111111] hover:bg-[#F6F6F4]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-purple-700" : "text-zinc-400"}`} />
                  {!collapsed && <span>{item.name}</span>}
                </div>

                {!collapsed && item.badge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="border-t border-[#E8E8E5] pt-4 space-y-1">
          {secondaryNav.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                  isActive
                    ? "bg-[#F4F0FA] text-[#111111] font-semibold border border-[#E4D9F5]"
                    : "text-[#686868] hover:text-[#111111] hover:bg-[#F6F6F4]"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-purple-700" : "text-zinc-400"}`} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Account Footer with Logout */}
      <div className="p-4 border-t border-[#E8E8E5] bg-white font-sans text-xs">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="truncate text-[11px] font-semibold text-[#111111]" title={workspaceName || 'Active Workspace'}>
                {workspaceName || 'Active Workspace'}
              </span>
              <span className="truncate font-mono text-[10px] text-[#888888]" title={userEmail}>
                {userEmail}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#686868] hover:text-rose-700 hover:bg-rose-50 transition-colors text-[11px] font-medium"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center p-1.5 rounded-lg text-zinc-400 hover:text-rose-700 hover:bg-rose-50 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
