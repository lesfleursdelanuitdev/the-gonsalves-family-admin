"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, List, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useTheme, THEME_CONFIG, type AppTheme } from "@/providers/theme-provider";
import type { ViewMode } from "@/components/data-viewer";
import {
  clearDataViewerGlobalDefault,
  readDataViewerGlobalDefault,
  readPreferTableOnMobile,
  writeDataViewerGlobalDefault,
  writePreferTableOnMobile,
} from "@/lib/settings/app-user-settings";

type DataViewerDefaultChoice = "auto" | ViewMode;

const THEME_SWATCHES: Record<AppTheme, { bg: string; sidebar: string }> = {
  dark: { bg: "#252628", sidebar: "#1a1c1e" },
  parchment: { bg: "#f5eed8", sidebar: "#ede5cc" },
  verdure: { bg: "#f0f5f1", sidebar: "#d4e3d7" },
  stone: { bg: "#f0eee9", sidebar: "#d9d5cd" },
};

function ThemeSwatch({
  themeKey,
  active,
  onClick,
}: {
  themeKey: AppTheme;
  active: boolean;
  onClick: () => void;
}) {
  const { bg, sidebar } = THEME_SWATCHES[themeKey];
  const config = THEME_CONFIG[themeKey];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex flex-col items-start gap-2 rounded-lg border-2 p-3 text-left transition-all " +
        (active
          ? "border-primary bg-primary/5"
          : "border-base-content/10 hover:border-base-content/20 bg-base-200/40")
      }
    >
      <div
        className="w-full rounded overflow-hidden border border-base-content/10"
        style={{ height: 48, background: bg, display: "flex" }}
        aria-hidden
      >
        <div style={{ width: 28, background: sidebar, flexShrink: 0 }} />
        <div style={{ flex: 1, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              height: 6,
              width: "55%",
              borderRadius: 3,
              background: themeKey === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
            }}
          />
          <div
            style={{
              height: 5,
              width: "38%",
              borderRadius: 3,
              background: themeKey === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
            }}
          />
          <div
            style={{
              marginTop: 4,
              height: 10,
              width: "70%",
              borderRadius: 3,
              background: "#2f7d40",
              opacity: 0.5,
            }}
          />
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-base-content leading-tight">{config.label}</p>
        <p className="text-xs text-muted-foreground leading-snug mt-0.5">{config.description}</p>
      </div>
      {active && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Active</span>
      )}
    </button>
  );
}

export default function AdminSettingsPage() {
  const { theme, setTheme } = useTheme();
  const [dataViewerChoice, setDataViewerChoice] = useState<DataViewerDefaultChoice>("auto");
  const [preferTableOnMobile, setPreferTableOnMobile] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);

  useLayoutEffect(() => {
    const g = readDataViewerGlobalDefault();
    setDataViewerChoice(g ?? "auto");
    setPreferTableOnMobile(readPreferTableOnMobile());
    setPrefsReady(true);
  }, []);

  const setDataViewerDefault = (choice: DataViewerDefaultChoice) => {
    setDataViewerChoice(choice);
    if (choice === "auto") {
      clearDataViewerGlobalDefault();
    } else {
      writeDataViewerGlobalDefault(choice);
    }
  };

  const setMobileTablePreference = (checked: boolean) => {
    setPreferTableOnMobile(checked);
    writePreferTableOnMobile(checked);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-box bg-primary/10 text-primary">
          <Settings className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-base-content">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Preferences here use local storage. To change your sign-in password (no email), use{" "}
            <Link href="/admin/profile#change-password" className="link link-primary font-medium">
              Profile → Password
            </Link>
            .
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose your preferred theme. The sun/moon toggle in the top bar switches between Dark and Parchment. Full
            theme selection is available here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label className="text-base-content">Theme</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(THEME_CONFIG) as AppTheme[]).map((key) => (
              <ThemeSwatch
                key={key}
                themeKey={key}
                active={theme === key}
                onClick={() => setTheme(key)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data viewers</CardTitle>
          <CardDescription>
            List pages such as Individuals, Families, and Events. You can still override the view on each page with
            the table/cards toggle in the toolbar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-base-content">Default view</Label>
            <p className="text-xs text-muted-foreground">
              Used when you have not chosen a layout for that page. Auto follows each page&apos;s built-in default (for
              example Media opens in cards on desktop).
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Default data viewer layout">
              <Button
                type="button"
                size="sm"
                variant={dataViewerChoice === "auto" ? "default" : "outline"}
                disabled={!prefsReady}
                onClick={() => setDataViewerDefault("auto")}
              >
                Auto
              </Button>
              <Button
                type="button"
                size="sm"
                variant={dataViewerChoice === "table" ? "default" : "outline"}
                disabled={!prefsReady}
                onClick={() => setDataViewerDefault("table")}
              >
                <List className="mr-1.5 size-4" aria-hidden />
                List
              </Button>
              <Button
                type="button"
                size="sm"
                variant={dataViewerChoice === "cards" ? "default" : "outline"}
                disabled={!prefsReady}
                onClick={() => setDataViewerDefault("cards")}
              >
                <LayoutGrid className="mr-1.5 size-4" aria-hidden />
                Cards
              </Button>
            </div>
          </div>

          <div className="flex gap-3 rounded-lg border border-base-content/10 bg-base-200/30 p-4">
            <Checkbox
              id="prefer-table-mobile"
              checked={preferTableOnMobile}
              disabled={!prefsReady}
              onCheckedChange={(c) => setMobileTablePreference(!!c)}
              aria-labelledby="prefer-table-mobile-label"
            />
            <div className="min-w-0 space-y-1">
              <Label id="prefer-table-mobile-label" htmlFor="prefer-table-mobile" className="cursor-pointer text-base">
                Prefer list/table on small screens
              </Label>
              <p className="text-xs leading-snug text-muted-foreground">
                By default, narrow windows and phones use{" "}
                <strong className="font-medium text-base-content/80">card</strong> layout for readability. Turn this on
                to keep the <strong className="font-medium text-base-content/80">table</strong> layout on small screens
                as well.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
