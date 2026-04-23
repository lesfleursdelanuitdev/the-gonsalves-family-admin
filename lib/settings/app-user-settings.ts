/** Persisted table/cards preference for DataViewer (matches `ViewMode` in the UI package). */
export type StoredDataViewerMode = "table" | "cards";

/** Fired on `window` when appearance or DataViewer defaults change so lists can re-resolve. */
export const APP_SETTINGS_CHANGED_EVENT = "gonsalves-app-settings-changed";

const DATA_VIEWER_DEFAULT_KEY = "gonsalves-dataviewer-default";
const DATA_VIEWER_PREFER_TABLE_MOBILE_KEY = "gonsalves-dataviewer-prefer-table-mobile";

export function readDataViewerGlobalDefault(): StoredDataViewerMode | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(DATA_VIEWER_DEFAULT_KEY);
  if (v === "table" || v === "cards") return v;
  return null;
}

export function dispatchAppSettingsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(APP_SETTINGS_CHANGED_EVENT));
}

export function writeDataViewerGlobalDefault(mode: StoredDataViewerMode): void {
  localStorage.setItem(DATA_VIEWER_DEFAULT_KEY, mode);
  dispatchAppSettingsChanged();
}

export function clearDataViewerGlobalDefault(): void {
  localStorage.removeItem(DATA_VIEWER_DEFAULT_KEY);
  dispatchAppSettingsChanged();
}

/** When true, do not force card layout on narrow viewports. */
export function readPreferTableOnMobile(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DATA_VIEWER_PREFER_TABLE_MOBILE_KEY) === "1";
}

export function writePreferTableOnMobile(prefer: boolean): void {
  localStorage.setItem(DATA_VIEWER_PREFER_TABLE_MOBILE_KEY, prefer ? "1" : "0");
  dispatchAppSettingsChanged();
}

/** Tailwind `sm` breakpoint is 640px; treat narrower as “mobile” for DataViewer. */
export const DATA_VIEWER_MOBILE_MEDIA = "(max-width: 639px)";
