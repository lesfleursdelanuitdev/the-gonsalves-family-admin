"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Sun,
  UserCircle,
} from "lucide-react";
import { DARK_MODE_ENABLED, useTheme } from "@/providers/theme-provider";
import type { AuthUser } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const BRAND_TITLE = "Gonsalves Family Admin";
const CREST_SRC = "/images/crest.png";
const UTILITY_BAR_ID = "admin-utility-bar";

function closeDrawer(drawerId: string) {
  const el = document.getElementById(drawerId) as HTMLInputElement | null;
  if (el) el.checked = false;
}

function initialsFromUser(user: AuthUser) {
  const raw = (user.name || user.username || "?").trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase() || "?";
}

const squareGhostBtn =
  "btn btn-ghost btn-sm size-9 shrink-0 rounded-lg border-0 text-base-content/80 hover:bg-base-200/80";
const circleGhostBtn =
  "btn btn-ghost btn-sm size-9 shrink-0 rounded-full border-0 text-base-content/80 hover:bg-base-200/80";

type Props = {
  drawerId: string;
  user: AuthUser | null | undefined;
  isLoading: boolean;
  onLogout: () => void;
  logoutPending: boolean;
  /** Tree-scoped unread direct messages for the signed-in user (navbar badge). */
  unreadDirectMessages?: number;
};

function formatUnreadBadge(n: number): string {
  if (n < 1) return "";
  if (n > 99) return "99+";
  return String(n);
}

export function AdminTopBar({
  drawerId,
  user,
  isLoading,
  onLogout,
  logoutPending,
  unreadDirectMessages = 0,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { isDark, toggleTheme } = useTheme();
  const close = () => closeDrawer(drawerId);
  const [mobileUtilitiesOpen, setMobileUtilitiesOpen] = useState(false);

  useEffect(() => {
    setMobileUtilitiesOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-base-content/[0.08] bg-base-100/90 shadow-sm shadow-black/10 backdrop-blur-md">
      <div className="flex h-[52px] items-center gap-2 px-2 sm:px-3 lg:hidden">
        <label htmlFor={drawerId} className={cn(squareGhostBtn)} aria-label="Open menu">
          <Menu className="size-5" />
        </label>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:gap-2.5">
          <div
            className="relative size-8 shrink-0 overflow-hidden rounded-lg bg-base-200/80 text-primary shadow-inner ring-1 ring-base-content/[0.06]"
            aria-hidden
          >
            <Image src={CREST_SRC} alt="" fill className="object-contain p-1" sizes="32px" />
          </div>
          <span className="truncate text-sm font-semibold tracking-tight text-base-content">
            {BRAND_TITLE}
          </span>
        </div>

        <button
          type="button"
          className={cn(
            squareGhostBtn,
            mobileUtilitiesOpen && "bg-base-200/80 text-base-content"
          )}
          aria-label={mobileUtilitiesOpen ? "Hide toolbar" : "Show toolbar"}
          aria-expanded={mobileUtilitiesOpen}
          aria-controls={UTILITY_BAR_ID}
          onClick={() => setMobileUtilitiesOpen((o) => !o)}
        >
          <MoreHorizontal className="size-5" />
        </button>
      </div>

      <div
        id={UTILITY_BAR_ID}
        className={cn(
          "min-h-11 items-center justify-end gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-3",
          "border-t border-base-content/[0.06] lg:min-h-[3.25rem] lg:flex lg:border-t-0 lg:px-5 lg:py-2",
          mobileUtilitiesOpen ? "flex" : "hidden lg:flex"
        )}
      >
        {DARK_MODE_ENABLED ? (
          <button
            type="button"
            className={circleGhostBtn}
            onClick={() => toggleTheme()}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="size-[1.15rem]" /> : <Moon className="size-[1.15rem]" />}
          </button>
        ) : null}

        <Link
          href="/admin/messages"
          className={cn(circleGhostBtn, "relative")}
          aria-label={
            unreadDirectMessages > 0
              ? `Messages, ${unreadDirectMessages} unread`
              : "Messages"
          }
          onClick={() => {
            close();
            setMobileUtilitiesOpen(false);
          }}
        >
          <MessageSquare className="size-[1.15rem]" />
          {unreadDirectMessages > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-error-content shadow-sm"
              aria-hidden
            >
              {formatUnreadBadge(unreadDirectMessages)}
            </span>
          ) : null}
        </Link>

        {isLoading ? (
          <span className="skeleton h-9 w-[8.5rem] shrink-0 rounded-full" />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "btn btn-ghost h-9 min-h-9 gap-2 rounded-full border border-base-content/[0.08] px-2 pr-2.5 normal-case hover:bg-base-200/70"
              )}
              aria-label="Account menu"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {initialsFromUser(user)}
              </span>
              <span className="hidden max-w-[7rem] truncate text-sm font-medium sm:inline">
                {user.name || user.username}
              </span>
              <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="truncate font-semibold text-base-content">
                    {user.name || user.username}
                  </span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setMobileUtilitiesOpen(false);
                  router.push("/admin/profile");
                }}
              >
                <UserCircle className="size-4 opacity-70" aria-hidden />
                Edit profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={logoutPending}
                onClick={() => {
                  setMobileUtilitiesOpen(false);
                  onLogout();
                }}
              >
                <LogOut className="size-4" aria-hidden />
                {logoutPending ? "Signing out…" : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
