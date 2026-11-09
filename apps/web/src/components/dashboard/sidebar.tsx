"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ApiProofLogo } from "@/components/ui/logo";
import { signOutSession } from "@/lib/session-logout";
import { parseWorkspaceContext, parseWorkspaceSwitchResponse } from "@/lib/workspace-context-contract";
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
  UserRound,
  Bell,
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
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [workspaceLoadComplete, setWorkspaceLoadComplete] = useState(false);
  const [workspaceLoadRetrying, setWorkspaceLoadRetrying] = useState(false);
  const [workspaceSwitching, setWorkspaceSwitching] = useState(false);
  const [workspaceRetryId, setWorkspaceRetryId] = useState<string | null>(null);
  const [workspaceLoadError, setWorkspaceLoadError] = useState(false);
  const [workspaceLoadAttempt, setWorkspaceLoadAttempt] = useState(0);
  const [workspaceContextError, setWorkspaceContextError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const logoutPending = useRef(false);
  const workspaceErrorRef = useRef<HTMLParagraphElement>(null);
  const workspaceContextErrorRef = useRef<HTMLParagraphElement>(null);
  const logoutErrorRef = useRef<HTMLParagraphElement>(null);
  const workspaceRequestRef = useRef<Promise<NonNullable<ReturnType<typeof parseWorkspaceContext>>> | null>(null);

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

  useEffect(() => {
    let active = true;
    async function loadWorkspaces() {
      setWorkspaceLoadRetrying(true);
      setWorkspaceLoadComplete(false);
      try {
        const request = workspaceRequestRef.current ?? (workspaceRequestRef.current = (async () => {
          const response = await fetch('/api/workspaces', { cache: 'no-store' });
          if (!response.ok) throw new Error('Workspace list unavailable.');
          const data = parseWorkspaceContext(await response.json());
          if (!data) throw new Error('Workspace list unavailable.');
          return data;
        })());
        const data = await request;
        if (!active) return;
        setWorkspaces(data.workspaces);
        setActiveWorkspaceId(data.activeWorkspaceId ?? '');
        setWorkspaceLoadError(false);
        setWorkspaceLoadComplete(true);
      } catch {
        if (active) {
          setWorkspaceLoadError(true);
          setWorkspaceLoadComplete(true);
        }
      } finally {
        if (workspaceRequestRef.current) workspaceRequestRef.current = null;
        if (active) setWorkspaceLoadRetrying(false);
      }
    }
    void loadWorkspaces();
    return () => { active = false; };
  }, [workspaceLoadAttempt]);

  useEffect(() => {
    if (workspaceLoadError) workspaceErrorRef.current?.focus();
  }, [workspaceLoadError]);

  useEffect(() => {
    if (workspaceContextError) workspaceContextErrorRef.current?.focus();
  }, [workspaceContextError]);

  useEffect(() => {
    if (logoutError) logoutErrorRef.current?.focus();
  }, [logoutError]);

  async function switchWorkspace(workspaceId: string, preserveError = false) {
    if (!workspaceId || workspaceId === activeWorkspaceId || workspaceSwitching) return;
    setWorkspaceSwitching(true);
    setWorkspaceRetryId(workspaceId);
    if (!preserveError) setWorkspaceContextError(null);
    try {
      const response = await fetch('/api/workspace/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      if (!response.ok) throw new Error('Workspace could not be changed.');
      const payload = await response.json() as unknown;
      if (!parseWorkspaceSwitchResponse(payload, workspaceId)) throw new Error('Workspace could not be changed.');
      window.location.reload();
    } catch {
      setWorkspaceContextError('Workspace could not be changed. Please try again.');
      setWorkspaceSwitching(false);
    }
  }

  function handleWorkspaceChange(event: ChangeEvent<HTMLSelectElement>) {
    void switchWorkspace(event.target.value);
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
    { name: "Account", href: "/dashboard/settings/account", icon: UserRound },
    { name: "Notifications", href: "/dashboard/settings/notifications", icon: Bell },
    { name: "Settings", href: "/dashboard/settings", icon: Sliders },
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
      aria-label="Workspace navigation"
      className={`relative flex w-full shrink-0 flex-col border-b border-[#E8E8E5] bg-white transition-all duration-200 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r ${
        collapsed ? "md:w-16" : "md:w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#E8E8E5] font-sans">
        <Link href="/dashboard" aria-label="MY OWLv0.7 dashboard" className="inline-flex min-h-11 items-center gap-2.5 overflow-hidden">
          <ApiProofLogo alt="" className="h-6 w-auto shrink-0 transition-transform hover:scale-105" variant="dark" />
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
          type="button"
          aria-label={collapsed ? 'Expand workspace navigation' : 'Collapse workspace navigation'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          className="hidden min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-400 hover:text-[#111111] hover:bg-[#F6F6F4] transition-colors md:flex"
        >
          {collapsed ? <ChevronRight aria-hidden="true" className="w-4 h-4" /> : <ChevronLeft aria-hidden="true" className="w-4 h-4" />}
        </button>
      </div>

      {/* Primary Navigation */}
      <nav aria-label="Primary workspace navigation" className="flex-1 px-2 py-2 md:px-3 md:py-4 space-y-2 md:space-y-5 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto font-sans text-xs font-medium">
        <div className="flex flex-wrap gap-1 md:block md:space-y-1">
          {mainNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={collapsed ? item.name : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-11 shrink-0 items-center justify-between px-2.5 py-2 md:px-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-[#F4F0FA] text-[#111111] font-semibold border border-[#E4D9F5]"
                    : "text-[#686868] hover:text-[#111111] hover:bg-[#F6F6F4]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon aria-hidden="true" className={`w-4 h-4 shrink-0 ${isActive ? "text-purple-700" : "text-zinc-400"}`} />
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
                aria-label={collapsed ? item.name : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-11 shrink-0 items-center gap-3 px-2.5 py-2 md:px-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-[#F4F0FA] text-[#111111] font-semibold border border-[#E4D9F5]"
                    : "text-[#686868] hover:text-[#111111] hover:bg-[#F6F6F4]"
                }`}
              >
                <Icon aria-hidden="true" className={`w-4 h-4 shrink-0 ${isActive ? "text-purple-700" : "text-zinc-400"}`} />
                <span className={collapsed ? "md:hidden" : ""}>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Account Footer with Logout */}
      <div className="flex flex-col p-2 md:block md:p-4 border-t border-[#E8E8E5] bg-white font-sans text-xs">
        <div className={`mb-3 ${collapsed ? "md:hidden" : ""}`}>
          <label htmlFor="workspace-context" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#686868]">
            Workspace
          </label>
          <select
            id="workspace-context"
            aria-label="Active workspace"
            value={activeWorkspaceId}
            onChange={handleWorkspaceChange}
            disabled={workspaceSwitching || workspaces.length < 2}
            aria-busy={!workspaceLoadComplete || workspaceSwitching ? 'true' : undefined}
            className="min-h-11 w-full rounded-lg border border-[#E8E8E5] bg-white px-2 py-1.5 text-base text-[#111111] outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 disabled:cursor-default disabled:bg-[#F6F6F4]"
          >
            {workspaces.length === 0 && <option value="">{workspaceLoadError ? 'Workspace list unavailable' : workspaceLoadComplete ? 'No workspaces available' : 'Loading workspace…'}</option>}
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
          {!workspaceLoadComplete && <p role="status" aria-live="polite" aria-atomic="true" aria-busy="true" className="mt-1 text-[10px] text-[#686868]">Loading workspace list…</p>}
          {workspaceLoadError && <p ref={workspaceErrorRef} role="alert" aria-live="assertive" aria-atomic="true" tabIndex={-1} className="mt-1 text-[10px] text-rose-700 outline-none focus-visible:ring-2 focus-visible:ring-rose-900 focus-visible:ring-offset-2">Workspace list unavailable. <button type="button" onClick={() => setWorkspaceLoadAttempt((attempt) => attempt + 1)} disabled={workspaceLoadRetrying} aria-busy={workspaceLoadRetrying ? 'true' : undefined} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-70">{workspaceLoadRetrying ? 'Retrying workspace list…' : 'Try again'}</button></p>}
          {workspaceLoadComplete && !workspaceLoadError && workspaces.length === 0 && <p role="status" aria-live="polite" aria-atomic="true" className="mt-1 text-[10px] text-[#686868]">No workspaces are available.</p>}
          {workspaceSwitching && <p role="status" aria-live="polite" aria-atomic="true" className="mt-1 text-[10px] text-[#686868]">Switching workspace…</p>}
          {workspaceContextError && <p ref={workspaceContextErrorRef} role="alert" aria-live="assertive" aria-atomic="true" tabIndex={-1} className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-rose-700 outline-none focus-visible:ring-2 focus-visible:ring-rose-900 focus-visible:ring-offset-2"><span>{workspaceContextError}</span>{workspaceRetryId && <button type="button" onClick={() => void switchWorkspace(workspaceRetryId, true)} disabled={workspaceSwitching} aria-busy={workspaceSwitching ? 'true' : undefined} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-70">{workspaceSwitching ? 'Retrying workspace switch…' : 'Retry workspace switch'}</button>}</p>}
        </div>
        <div className="flex items-center justify-between">
            <div className={`flex flex-col min-w-0 pr-2 ${collapsed ? "md:hidden" : ""}`}>
              <span className="truncate text-[11px] font-semibold text-[#111111]" title={workspaceName || 'Active Workspace'}>
                {workspaceName || 'Active Workspace'}
              </span>
              <span className="truncate font-mono text-[10px] text-[#686868]" title={userEmail}>
                {userEmail}
              </span>
            </div>
            <button
              type="button"
              aria-label="Sign out of MY OWL"
              onClick={handleLogout}
              disabled={isSigningOut}
              aria-busy={isSigningOut ? 'true' : undefined}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[#686868] hover:text-rose-700 hover:bg-rose-50 transition-colors text-[11px] font-medium"
              title="Sign out"
            >
              <LogOut aria-hidden="true" className="w-3.5 h-3.5" />
              <span className={collapsed ? "md:hidden" : ""}>{isSigningOut ? 'Signing out…' : 'Sign Out'}</span>
            </button>
        </div>
        {logoutError && <p ref={logoutErrorRef} role="alert" aria-live="assertive" aria-atomic="true" tabIndex={-1} className="mt-2 text-[11px] text-rose-700 outline-none focus-visible:ring-2 focus-visible:ring-rose-900 focus-visible:ring-offset-2">{logoutError}</p>}
      </div>
    </aside>
  );
}
