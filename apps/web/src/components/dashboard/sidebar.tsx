"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ApiProofLogo } from "@/components/ui/logo";
import { signOutSession } from "@/lib/session-logout";
import {
  parseWorkspaceContextSelection,
  readWorkspaceContextError,
  workspaceContextErrorMessage,
} from "@/lib/workspace-context-contract";
import {
  LayoutDashboard,
  GitBranch,
  Boxes,
  AlertTriangle,
  ShieldCheck,
  Network,
  ClipboardCheck,
  FileCheck2,
  GitPullRequest,
  Activity,
  Sliders,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserRound,
  Bell,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openFindingsCount, setOpenFindingsCount] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [workspaceName, setWorkspaceName] = useState<string>('');
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const logoutPending = useRef(false);

  useEffect(() => {
    async function loadStats() {
      try {
        const [overviewResponse, workspacesResponse] = await Promise.all([
          fetch('/api/overview', { cache: 'no-store' }),
          fetch('/api/workspaces', { cache: 'no-store' }),
        ]);
        if (overviewResponse.ok) {
          const data = await overviewResponse.json();
          if (typeof data.stats?.openFindings === 'number') setOpenFindingsCount(data.stats.openFindings);
          if (data.workspace?.name) setWorkspaceName(data.workspace.name);
          if (data.user?.email) setUserEmail(data.user.email);
        }
        if (workspacesResponse.ok) {
          const data = await workspacesResponse.json() as { workspaces?: unknown; activeWorkspaceId?: unknown };
          if (Array.isArray(data.workspaces)) {
            const available = data.workspaces.filter((workspace): workspace is { id: string; name: string; role: string } => (
              typeof workspace === 'object' && workspace !== null
              && typeof (workspace as { id?: unknown }).id === 'string'
              && typeof (workspace as { name?: unknown }).name === 'string'
              && typeof (workspace as { role?: unknown }).role === 'string'
            ));
            setWorkspaces(available);
          }
          if (typeof data.activeWorkspaceId === 'string') setActiveWorkspaceId(data.activeWorkspaceId);
        }
      } catch {
        // Ignore background stat fetch errors
      }
    }
    loadStats();
  }, [pathname]);

  async function switchWorkspace(workspaceId: string) {
    if (!workspaceId || workspaceId === activeWorkspaceId || switchingWorkspace) return;
    setSwitchingWorkspace(true);
    setWorkspaceError(null);
    try {
      const response = await fetch('/api/workspace/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      const data: unknown = await response.json();
      const selection = parseWorkspaceContextSelection(data);
      if (!response.ok || !selection) {
        const error = readWorkspaceContextError(data);
        throw new Error(workspaceContextErrorMessage(response.status, error?.code ?? null));
      }
      setActiveWorkspaceId(selection.workspace.id);
      setWorkspaceName(selection.workspace.name);
      window.location.reload();
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Workspace could not be selected.');
      setSwitchingWorkspace(false);
    }
  }

  const mainNav = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Repositories", href: "/dashboard/repositories", icon: GitBranch },
    { name: "API Inventory", href: "/dashboard/inventory", icon: Boxes },
    { name: "Compatibility", href: "/dashboard/compatibility", icon: ShieldCheck },
    { name: "Providers", href: "/dashboard/providers", icon: Network },
    { name: "Rule Review", href: "/dashboard/rules/pending", icon: ClipboardCheck },
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
    { name: "Notifications", href: "/dashboard/notifications", icon: Bell },
    { name: "Settings", href: "/dashboard/settings", icon: Sliders },
    { name: "Account", href: "/dashboard/settings/account", icon: UserRound },
  ];

  async function handleLogout() {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setIsSigningOut(true);
    setLogoutError(null);
    try {
      await signOutSession((signal) => fetch('/api/auth', {
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      }));
      window.location.replace('/login');
    } catch {
      setLogoutError('Sign out failed. Your session may still be active. Please try again.');
    } finally {
      logoutPending.current = false;
      setIsSigningOut(false);
    }
  }

  return (
    <aside
      className={`relative flex w-full shrink-0 flex-col border-b border-[#E8E8E5] bg-white transition-all duration-200 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r ${
        collapsed ? "md:w-16" : "md:w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#E8E8E5] font-sans">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <ApiProofLogo className="h-6 w-auto shrink-0 transition-transform hover:scale-105" variant="dark" />
          <div className={`flex items-center gap-2 ${collapsed ? "md:hidden" : ""}`}>
              <span className="text-sm font-semibold text-[#111111] tracking-tight">
                MY OWL
              </span>
              <span className="text-[10px] bg-[#F6F6F4] border border-[#E8E8E5] px-2 py-0.5 rounded-full text-zinc-600 font-medium">
                v0.7
              </span>
          </div>
        </Link>

        <button
          onClick={() => setCollapsed(!collapsed)}
          type="button"
          aria-label={collapsed ? 'Expand dashboard navigation' : 'Collapse dashboard navigation'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand dashboard navigation' : 'Collapse dashboard navigation'}
          className="hidden md:block p-1.5 rounded-lg text-zinc-400 hover:text-[#111111] hover:bg-[#F6F6F4] transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Primary Navigation */}
      <div className="flex-1 px-2 py-2 md:px-3 md:py-4 space-y-2 md:space-y-5 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto font-sans text-xs font-medium">
        <div className="flex flex-wrap gap-1 md:block md:space-y-1">
          {mainNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center justify-between px-2.5 py-2 md:px-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-[#F4F0FA] text-[#111111] font-semibold border border-[#E4D9F5]"
                    : "text-[#686868] hover:text-[#111111] hover:bg-[#F6F6F4]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-purple-700" : "text-zinc-400"}`} />
                  <span className={collapsed ? "md:hidden" : ""}>{item.name}</span>
                </div>

                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold ${collapsed ? "md:hidden" : ""}`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-1 border-t border-[#E8E8E5] pt-2 md:block md:pt-4 md:space-y-1">
          {secondaryNav.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-3 px-2.5 py-2 md:px-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-[#F4F0FA] text-[#111111] font-semibold border border-[#E4D9F5]"
                    : "text-[#686868] hover:text-[#111111] hover:bg-[#F6F6F4]"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-purple-700" : "text-zinc-400"}`} />
                <span className={collapsed ? "md:hidden" : ""}>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Account Footer with Logout */}
      <div className="flex flex-col p-2 md:block md:p-4 border-t border-[#E8E8E5] bg-white font-sans text-xs">
        <div className="flex items-center justify-between">
            <div className={`flex flex-col min-w-0 pr-2 ${collapsed ? "md:hidden" : ""}`}>
              <span className="truncate text-[11px] font-semibold text-[#111111]" title={workspaceName || 'Active Workspace'}>
                {workspaceName || 'Active Workspace'}
              </span>
              <span className="truncate font-mono text-[10px] text-[#888888]" title={userEmail}>
                {userEmail}
              </span>
            </div>
            <button
              onClick={handleLogout}
              type="button"
              disabled={isSigningOut}
              aria-label="Sign out"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#686868] hover:text-rose-700 hover:bg-rose-50 transition-colors text-[11px] font-medium"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className={collapsed ? "md:hidden" : ""}>{isSigningOut ? 'Signing out…' : 'Sign Out'}</span>
            </button>
        </div>
        {!collapsed && workspaces.length > 1 && (
          <div className="mt-3 space-y-1">
            <label htmlFor="workspace-switcher" className="sr-only">Active workspace</label>
            <select
              id="workspace-switcher"
              value={activeWorkspaceId}
              disabled={switchingWorkspace}
              aria-busy={switchingWorkspace ? 'true' : undefined}
              onChange={(event) => void switchWorkspace(event.target.value)}
              className="min-h-10 w-full min-w-0 rounded-lg border border-[#D9D9D4] bg-white px-2 text-xs text-[#333333] outline-none focus-visible:ring-2 focus-visible:ring-[#0050F8]"
            >
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.role}</option>)}
            </select>
            {workspaceError && <p role="alert" className="break-words text-[11px] text-rose-700">{workspaceError}</p>}
          </div>
        )}
        {logoutError && <p role="alert" className="mt-2 text-[11px] text-rose-700">{logoutError}</p>}
      </div>
    </aside>
  );
}
