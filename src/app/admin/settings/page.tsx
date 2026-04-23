"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, List, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/providers/theme-provider";
import type { ViewMode } from "@/components/data-viewer";
import {
  clearDataViewerGlobalDefault,
  readDataViewerGlobalDefault,
  readPreferTableOnMobile,
  writeDataViewerGlobalDefault,
  writePreferTableOnMobile,
} from "@/lib/settings/app-user-settings";

type DataViewerDefaultChoice = "auto" | ViewMode;

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
            Light uses the lemonade theme; dark uses business. Matches the sun/moon control in the top bar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label className="text-base-content">Color mode</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("light")}
            >
              Light
            </Button>
            <Button
              type="button"
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("dark")}
            >
              Dark
            </Button>
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
              Used when you have not chosen a layout for that page. “Auto” follows each page’s built-in default (for
              example Media opens in cards on desktop).
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label="Default data viewer layout"
            >
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
                By default, narrow windows and phones use <strong className="font-medium text-base-content/80">card</strong>{" "}
                layout for readability. Turn this on to keep the{" "}
                <strong className="font-medium text-base-content/80">table</strong> layout on small screens as well.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
