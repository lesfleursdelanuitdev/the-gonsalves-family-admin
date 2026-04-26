"use client";

import Link from "next/link";
import { UserSearchHits } from "@/components/admin/individual-editor/UserSearchHits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import type { IndividualUserLinkRow } from "@/hooks/useAdminIndividuals";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";

export type IndividualEditorIdentityTabPanelProps = {
  hidden: boolean;
  mode: "create" | "edit";
  sex: string;
  onSexChange: (sex: string) => void;
  xrefDisplay: string;
  userLinksLoading: boolean;
  userLinksErrMsg: string;
  userLinks: IndividualUserLinkRow[];
  userLinkBusy: boolean;
  onRemoveUserLink: (userId: string, linkId: string, display: string) => void | Promise<void>;
  linkedUserIds: ReadonlySet<string>;
  userSearch: string;
  onUserSearchChange: (q: string) => void;
  linkUserId: string | null;
  linkUserLabel: string;
  onClearLinkPick: () => void;
  onPickUserForLink: (id: string, label: string) => void;
  onAddUserLinkForEdit: () => void | Promise<void>;
};

export function IndividualEditorIdentityTabPanel({
  hidden,
  mode,
  sex,
  onSexChange,
  xrefDisplay,
  userLinksLoading,
  userLinksErrMsg,
  userLinks,
  userLinkBusy,
  onRemoveUserLink,
  linkedUserIds,
  userSearch,
  onUserSearchChange,
  linkUserId,
  linkUserLabel,
  onClearLinkPick,
  onPickUserForLink,
  onAddUserLinkForEdit,
}: IndividualEditorIdentityTabPanelProps) {
  return (
    <div
      id="individual-editor-panel-identity"
      role="tabpanel"
      aria-labelledby="individual-editor-tab-identity"
      hidden={hidden}
      className="space-y-8 pt-2"
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Identity</CardTitle>
          {mode === "create" ? (
            <p className="text-sm text-muted-foreground">
              A new XREF is assigned automatically when you save. Sex uses GEDCOM codes.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              XREF is system-assigned (shown for reference only). Sex and living follow GEDCOM rules.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === "edit" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>XREF</Label>
                <p className="font-mono text-sm">{xrefDisplay || "—"}</p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="indi-sex">Sex</Label>
              <select
                id="indi-sex"
                className={selectClassName}
                value={sex}
                onChange={(e) => onSexChange(e.target.value)}
              >
                <option value="">Unknown</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="U">Unknown (U)</option>
                <option value="X">Other (X)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {mode === "edit" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Linked accounts</CardTitle>
            <p className="text-sm text-muted-foreground">
              Website users linked to this person in the admin tree (by GEDCOM xref). Requires{" "}
              <code className="text-xs">ADMIN_TREE_ID</code>.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {userLinksLoading ? (
              <p className="text-sm text-muted-foreground">Loading linked accounts…</p>
            ) : userLinksErrMsg ? (
              <p className="text-sm text-destructive">{userLinksErrMsg}</p>
            ) : userLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No user accounts linked yet.</p>
            ) : (
              <ul className="space-y-3">
                {userLinks.map((row) => {
                  const u = row.user;
                  const display = stripSlashesFromName(u.name) || u.username || u.email || u.id;
                  return (
                    <li
                      key={row.linkId}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/admin/users/${u.id}`} className="link link-primary font-medium">
                            {display}
                          </Link>
                          {row.verified ? (
                            <span className="badge badge-outline badge-primary badge-sm font-normal">Verified</span>
                          ) : null}
                          {!u.isActive ? (
                            <span className="badge badge-ghost badge-sm font-normal">Inactive</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="font-mono">{u.username}</span>
                          {u.email ? ` · ${u.email}` : null}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-destructive"
                        disabled={userLinkBusy}
                        onClick={() => void onRemoveUserLink(u.id, row.linkId, display)}
                      >
                        Remove link
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="space-y-3 border-t border-base-content/10 pt-4">
              <h3 className="text-sm font-semibold text-base-content">Link another user</h3>
              <p className="text-xs text-muted-foreground">
                Uses this person&apos;s current XREF ({xrefDisplay.trim() || "—"}). Save identity changes first if the
                xref was updated elsewhere.
              </p>
              {linkUserId ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Selected: {linkUserLabel || linkUserId}</span>
                  <Button type="button" variant="ghost" size="sm" disabled={userLinkBusy} onClick={onClearLinkPick}>
                    Clear
                  </Button>
                  <Button type="button" size="sm" disabled={userLinkBusy} onClick={() => void onAddUserLinkForEdit()}>
                    {userLinkBusy ? "Linking…" : "Add link"}
                  </Button>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Search users</Label>
                <Input
                  value={userSearch}
                  onChange={(e) => onUserSearchChange(e.target.value)}
                  placeholder="Username, email, or display name…"
                  disabled={userLinkBusy}
                />
                <UserSearchHits
                  query={userSearch}
                  excludeUserIds={linkedUserIds}
                  onPick={onPickUserForLink}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {mode === "create" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Link user (optional)</CardTitle>
            <p className="text-sm text-muted-foreground">
              After save, creates a UserIndividualLink for the admin tree using the new xref. Requires{" "}
              <code className="text-xs">ADMIN_TREE_ID</code>.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {linkUserId ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Selected user: {linkUserLabel || linkUserId}</span>
                <Button type="button" variant="ghost" size="sm" onClick={onClearLinkPick}>
                  Clear
                </Button>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Search users</Label>
              <Input
                value={userSearch}
                onChange={(e) => onUserSearchChange(e.target.value)}
                placeholder="Username, email, or display name…"
              />
              <UserSearchHits query={userSearch} onPick={onPickUserForLink} />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
