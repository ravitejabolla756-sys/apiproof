"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Terminal,
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
  ShieldCheck,
  Building2,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const mainNav = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Repositories", href: "/dashboard/repositories", icon: GitBranch, badge: "2" },
    { name: "API Inventory", href: "/dashboard/inventory", icon: Boxes, badge: "9" },
    { name: "Findings", href: "/dashboard/findings", icon: AlertTriangle, badge: "1", risk: true },
    { name: "Migrations", href: "/dashboard/migrations", icon: FileCheck2, badge: "1" },
    { name: "Pull Requests", href: "/dashboard/pull-requests", icon: GitPullRequest, badge: "1" },
  ];

  const secondaryNav = [
    { name: "Activity", href: "/dashboard/activity", icon: Activity },
    { name: "Settings", href: "/dashboard/settings", icon: Sliders },
  ];

  return (
    <aside
      className={`relative flex flex-col border-r border-zinc-800/90 bg-zinc-950 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800/80 font-mono">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-zinc-950 shadow-sm shrink-0 font-bold">
            <Terminal className="w-4 h-4" />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold text-zinc-100 tracking-tight">
              API<span className="text-emerald-400">Proof</span>
            </span>
          )}
        </Link>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Primary Navigation */}
      <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto font-mono text-xs">
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-3 text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">
              Core Platform
            </div>
          )}
          {mainNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors group ${
                  isActive
                    ? "bg-zinc-900 text-emerald-400 font-bold border border-zinc-800"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                  {!collapsed && <span>{item.name}</span>}
                </div>

                {!collapsed && item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      item.risk
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Secondary Navigation */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-3 text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">
              System
            </div>
          )}
          {secondaryNav.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors group ${
                  isActive
                    ? "bg-zinc-900 text-emerald-400 font-bold border border-zinc-800"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Account / Workspace Switcher Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950 font-mono text-xs">
          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Acme Dev Org
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-[10px] text-zinc-500 flex items-center gap-1 font-sans">
              <ShieldCheck className="w-3 h-3 text-teal-400" /> App Installed & Scoped
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
