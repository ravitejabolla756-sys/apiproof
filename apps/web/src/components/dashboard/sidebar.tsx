"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
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
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const mainNav = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Repositories", href: "/dashboard/repositories", icon: GitBranch },
    { name: "API Inventory", href: "/dashboard/inventory", icon: Boxes },
    { name: "Findings", href: "/dashboard/findings", icon: AlertTriangle, badge: "1", risk: true },
    { name: "Migrations", href: "/dashboard/migrations", icon: FileCheck2 },
    { name: "Pull Requests", href: "/dashboard/pull-requests", icon: GitPullRequest },
  ];

  const secondaryNav = [
    { name: "Activity", href: "/dashboard/activity", icon: Activity },
    { name: "Settings", href: "/dashboard/settings", icon: Sliders },
  ];

  return (
    <aside
      className={`relative flex flex-col border-r border-zinc-800/80 bg-zinc-950 transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-zinc-800/80 font-sans">
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div className="w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          </div>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-100 tracking-tight">
                APIProof
              </span>
              <span className="text-[10px] bg-zinc-900 border border-zinc-800 px-1.5 py-0.2 rounded text-zinc-400 font-medium">
                Demo
              </span>
            </div>
          )}
        </Link>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Primary Navigation */}
      <div className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto font-sans text-xs font-medium">
        <div className="space-y-0.5">
          {mainNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-zinc-100 font-semibold border border-zinc-800"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-400" : "text-zinc-500"}`} />
                  {!collapsed && <span>{item.name}</span>}
                </div>

                {!collapsed && item.badge && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/40 text-amber-300 border border-amber-800/50 font-sans">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="border-t border-zinc-800/60 pt-3 space-y-0.5">
          {secondaryNav.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-zinc-100 font-semibold border border-zinc-800"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-400" : "text-zinc-500"}`} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Account / Workspace Switcher Footer */}
      {!collapsed && (
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950 font-sans text-xs">
          <div className="flex items-center justify-between text-zinc-400 px-1">
            <span className="truncate font-mono text-[11px]">ravitejabolla756-sys</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="GitHub connected" />
          </div>
        </div>
      )}
    </aside>
  );
}
