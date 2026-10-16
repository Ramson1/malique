"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  Bell,
  LogOut,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
} from "lucide-react";
import { Sidebar } from "./sidebar";
import { PrintButton } from "./ui/print-button";
import { useAuth } from "@/lib/auth-context";
import { useCollapsed } from "@/lib/use-collapsed";
import { api } from "@/lib/api/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { collapsed, toggle } = useCollapsed();
  const [unread, setUnread] = useState(0);
  const { user, logout } = useAuth();
  const router = useRouter();

  // Live unread-messages count for the bell. Gracefully defaults to 0
  // until the messages module is available.
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await api.get<{ count: number }>("/admin/messages/unread-count");
        if (alive) setUnread(res?.count ?? 0);
      } catch {
        if (alive) setUnread(0);
      }
    }
    load();
    const id = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  async function handleLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen bg-slate-50 app-canvas overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggle}
        unreadMessages={unread}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white/80 backdrop-blur border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile open */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            {/* Desktop collapse toggle */}
            <button
              onClick={toggle}
              className="hidden lg:flex p-2 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="w-5 h-5 text-slate-600" />
              ) : (
                <PanelLeftClose className="w-5 h-5 text-slate-600" />
              )}
            </button>
            <div className="min-w-0">
              {title && (
                <h1 className="text-lg font-semibold text-navy-900 truncate">{title}</h1>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 truncate">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Print current page (visible on screen, hidden when printing) */}
            <PrintButton className="hidden sm:inline-flex no-print" />

            {/* Notifications */}
            <Link
              href="/dashboard/messages"
              className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Messages"
            >
              <Bell className="w-5 h-5 text-slate-500" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>

            {/* User dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 pr-3 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center">
                    <span className="text-xs font-semibold text-white">
                      {user?.firstName?.[0] || "A"}
                      {user?.lastName?.[0] || ""}
                    </span>
                  </div>
                )}
                <span className="hidden md:block text-sm font-medium text-slate-700">
                  {user?.firstName || "Admin"}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20 animate-fade-in">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-medium text-navy-900">
                        {user ? `${user.firstName} ${user.lastName}` : "Admin User"}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {user?.email || "admin@malique.com"}
                      </p>
                    </div>
                    <Link
                      href="/dashboard/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-navy-800 hover:bg-slate-50 transition-colors"
                    >
                      <UserRound className="w-4 h-4 text-slate-400" />
                      Profile &amp; Settings
                    </Link>
                    <Link
                      href="/dashboard/messages"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-navy-800 hover:bg-slate-50 transition-colors"
                    >
                      <Bell className="w-4 h-4 text-slate-400" />
                      Notifications
                      {unread > 0 && (
                        <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Print letterhead — only visible on printed sheets */}
        <div className="print-letterhead hidden print:block">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold tracking-wide text-navy-900">
              MALIQUE OIL &amp; GAS LTD — ADMIN PORTAL
            </span>
            <span className="text-xs text-slate-600">
              {title || "Dashboard"} · {new Date().toLocaleString()}
            </span>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>

        {/* Footer */}
        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-[11px] text-slate-400">
            &copy; {new Date().getFullYear()} Malique Oil and Gas Ltd. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
            <span>Designed &amp; Developed by</span>
            <a
              href="https://blackboxtech.online"
              target="_blank"
              rel="noopener noreferrer"
              title="Black-Box Tech — info@blackboxtech.online"
              className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-amber-600 transition-colors"
            >
              <img src="/blackbox-tech.jpg" alt="Black-Box Tech logo" className="w-3.5 h-3.5 rounded-sm" />
              Black-Box Tech
            </a>
            <span className="text-slate-300">&bull;</span>
            <a
              href="mailto:info@blackboxtech.online"
              className="hover:text-amber-600 transition-colors"
            >
              info@blackboxtech.online
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
