/** Same key as `AdminChrome` sidebar collapse — keep in sync. */
export const ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY = "admin-sidebar-collapsed";

/** Fired on the window when the admin sidebar is expanded or collapsed (same tab). */
export const ADMIN_SIDEBAR_LAYOUT_CHANGED_EVENT = "gonsalves-admin-sidebar-layout-changed";

export type AdminSidebarLayoutChangedDetail = { collapsed: boolean };

export function readAdminSidebarCollapsedFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
