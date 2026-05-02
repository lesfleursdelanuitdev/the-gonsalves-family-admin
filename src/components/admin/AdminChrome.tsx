"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useLayoutEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser, useLogout } from "@/hooks/useAuth";
import { useAdminUnreadMessageCount } from "@/hooks/useAdminMessages";
import { useAdminMessagesRealtime } from "@/hooks/useAdminMessagesRealtime";
import { Button } from "@/components/ui/button";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { AdminTreeSetupBanner } from "@/components/AdminTreeSetupBanner";
import {
  adminNavBottom,
  adminNavSections,
  isAdminNavActive,
  type AdminNavItem,
} from "@/config/admin-nav";

const DRAWER_ID = "admin-drawer";
const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useLayoutEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { collapsed, toggleCollapsed };
}

function closeAdminDrawer() {
  const el = document.getElementById(DRAWER_ID) as HTMLInputElement | null;
  if (el) el.checked = false;
}

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const p = pathname.replace(/\/$/, "") || "/";
  const isMessagesRoute = pathname.startsWith("/admin/messages");
  const isStoryEditorShell = p.startsWith("/admin/stories/") && p !== "/admin/stories";
  const { data: user, isLoading } = useCurrentUser();
  const logout = useLogout();
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  const unread = useAdminUnreadMessageCount();
  // Messages page opens its own SSE subscription; avoid duplicate EventSource connections.
  useAdminMessagesRealtime(Boolean(user) && !isLoading && !isMessagesRoute);

  return (
    <div className="drawer lg:drawer-open min-h-screen bg-base-100">
      <input id={DRAWER_ID} type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex min-h-screen flex-col">
        <AdminTopBar
          drawerId={DRAWER_ID}
          user={user}
          isLoading={isLoading}
          onLogout={() => logout.mutate()}
          logoutPending={logout.isPending}
          unreadDirectMessages={typeof unread.data === "number" ? unread.data : 0}
        />
        <main
          className={cn(
            "min-h-0 flex-1 bg-base-100",
            isMessagesRoute || isStoryEditorShell
              ? "flex flex-col overflow-hidden"
              : "overflow-auto p-4 md:p-6 lg:p-8",
          )}
        >
          {isMessagesRoute || isStoryEditorShell ? (
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4 md:px-6 md:pb-6 lg:px-8 lg:pb-8">
              {!isStoryEditorShell ? <AdminTreeSetupBanner /> : null}
              <div className="min-h-0 flex-1">{children}</div>
            </div>
          ) : (
            <>
              <AdminTreeSetupBanner />
              {children}
            </>
          )}
        </main>
      </div>
      <div className="drawer-side z-40 border-r border-base-content/[0.08]">
        <label
          htmlFor={DRAWER_ID}
          className="drawer-overlay lg:hidden"
          aria-label="Close menu"
        />
        <aside
          className={cn(
            "flex min-h-full max-w-[85vw] flex-col overflow-hidden bg-base-300 text-base-content transition-[width] duration-200 ease-out",
            collapsed ? "w-[4.25rem]" : "w-72"
          )}
        >
          <div
            className={cn(
              "shrink-0 border-b border-base-content/[0.08]",
              collapsed
                ? "flex flex-col items-center gap-3 px-2 py-4"
                : "flex items-center gap-2 px-3 py-4 sm:gap-3 sm:px-4 sm:py-5"
            )}
          >
            <div
              className={cn(
                "avatar avatar-placeholder shrink-0",
                collapsed && "order-2 mx-auto"
              )}
            >
              <div className="relative size-10 overflow-hidden rounded-box bg-base-200 shadow-inner">
                <Image
                  src="/images/crest.png"
                  alt=""
                  fill
                  className="object-contain p-0.5"
                  sizes="40px"
                />
              </div>
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold tracking-tight">
                  Gonsalves Family Tree
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wider text-base-content/50">
                  Admin
                </p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={toggleCollapsed}
              className={cn(
                "btn btn-square btn-ghost btn-sm shrink-0",
                collapsed && "order-1"
              )}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronsRight className="size-5" />
              ) : (
                <ChevronsLeft className="size-5" />
              )}
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2 sm:p-3">
            {adminNavSections.map((section) => (
              <div
                key={section.label ?? section.items[0]?.href ?? "nav-section"}
                className="flex flex-col gap-0.5"
              >
                {!collapsed && section.label ? (
                  <p className="select-none px-3 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-base-content/45 first:pt-0">
                    {section.label}
                  </p>
                ) : null}
                {section.items.map((item) => (
                  <SidebarNavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                    onNavigate={closeAdminDrawer}
                    unreadBadge={
                      item.href === "/admin/messages" && typeof unread.data === "number"
                        ? unread.data
                        : undefined
                    }
                  />
                ))}
              </div>
            ))}
          </nav>
          <nav className="flex flex-col gap-0.5 border-t border-base-content/[0.08] p-2 sm:p-3">
            {adminNavBottom.map((item) => (
              <SidebarNavLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={closeAdminDrawer}
              />
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}

function formatSidebarUnread(n: number): string {
  if (n > 99) return "99+";
  return String(n);
}

function SidebarNavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
  unreadBadge,
}: {
  item: AdminNavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
  /** Unread count for Messages link only. */
  unreadBadge?: number;
}) {
  const { href, label, icon: Icon } = item;
  const active = isAdminNavActive(href, pathname);
  const unread = unreadBadge && unreadBadge > 0 ? unreadBadge : 0;
  const aria =
    unread > 0 && href === "/admin/messages" ? `${label}, ${unread} unread` : label;

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-label={aria}
      onClick={onNavigate}
      className={cn(
        "flex items-center rounded-box text-sm font-medium transition-colors duration-150",
        collapsed
          ? "justify-center border-l-0 px-0 py-2.5"
          : "gap-3 border-l-2 py-2.5 pl-3 pr-2",
        active
          ? collapsed
            ? "bg-primary/15 text-primary"
            : "border-primary bg-primary/15 text-primary"
          : collapsed
            ? "text-base-content/70 hover:bg-base-200/60 hover:text-base-content"
            : "border-transparent text-base-content/70 hover:bg-base-200/60 hover:text-base-content"
      )}
    >
      <span className={cn("relative shrink-0", collapsed && unread > 0 && "inline-flex")}>
        <Icon
          className={cn("size-[1.125rem] sm:size-4", active ? "opacity-90" : "opacity-65")}
          aria-hidden
        />
        {collapsed && unread > 0 ? (
          <span
            className="absolute -right-1 -top-1 flex size-2 rounded-full bg-error shadow-sm"
            aria-hidden
          />
        ) : null}
      </span>
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 truncate transition-[opacity,width] duration-150",
          collapsed ? "sr-only w-0 opacity-0" : "opacity-100"
        )}
      >
        {label}
        {!collapsed && unread > 0 ? (
          <span className="badge badge-error badge-sm shrink-0 font-bold tabular-nums">
            {formatSidebarUnread(unread)}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
