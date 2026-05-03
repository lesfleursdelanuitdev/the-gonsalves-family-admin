"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { FamilySearchPicker } from "@/components/admin/FamilySearchPicker";
import { EventPicker } from "@/components/admin/EventPicker";
import { formatNoteEventPickerLabel } from "@/lib/forms/note-event-picker-label";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
import {
  useAdminOpenQuestion,
  useCreateOpenQuestion,
  usePatchOpenQuestion,
} from "@/hooks/useAdminOpenQuestions";
import { useAdminMedia } from "@/hooks/useAdminMedia";
import { useDebouncedValue, ADMIN_MODAL_DEBOUNCE_MS } from "@/hooks/useDebouncedValue";
import type { OpenQuestionEntityType } from "@/lib/admin/open-questions";
import { ApiError } from "@/lib/infra/api";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";

type LinkRow = { kind: OpenQuestionEntityType; id: string; label: string };

function hydrateLinksFromOpenQuestion(oq: Record<string, unknown>): LinkRow[] {
  const out: LinkRow[] = [];
  const inds = oq.individualLinks as { individual: { id: string; fullName?: string | null; xref?: string | null } }[];
  for (const row of inds ?? []) {
    const name = stripSlashesFromName(row.individual?.fullName ?? null);
    out.push({
      kind: "individual",
      id: row.individual.id,
      label: name || row.individual.xref || row.individual.id,
    });
  }
  const fams = oq.familyLinks as {
    family: {
      id: string;
      xref?: string | null;
      husband?: { fullName?: string | null } | null;
      wife?: { fullName?: string | null } | null;
    };
  }[];
  for (const row of fams ?? []) {
    const h = stripSlashesFromName(row.family?.husband?.fullName ?? null);
    const w = stripSlashesFromName(row.family?.wife?.fullName ?? null);
    const label = `${h} & ${w}`.replace(/^ & | & $/g, "").trim() || row.family.xref || row.family.id;
    out.push({ kind: "family", id: row.family.id, label });
  }
  const evs = oq.eventLinks as { event: { id: string; eventType: string; customType?: string | null } }[];
  for (const row of evs ?? []) {
    const et = row.event.eventType ?? "";
    const ct = (row.event.customType ?? "").trim();
    out.push({
      kind: "event",
      id: row.event.id,
      label: ct ? `${labelGedcomEventType(et)} (${ct})` : labelGedcomEventType(et),
    });
  }
  const meds = oq.mediaLinks as { media: { id: string; title?: string | null; xref?: string | null } }[];
  for (const row of meds ?? []) {
    const t = row.media.title?.trim() || row.media.xref || row.media.id;
    out.push({ kind: "media", id: row.media.id, label: t });
  }
  return out;
}

export type OpenQuestionFormProps =
  | {
      mode: "create";
      hideBackLink?: boolean;
      contextReturnHref?: string;
      /** Pre-fill one link (e.g. from entity edit page). */
      initialLink?: { entityType: OpenQuestionEntityType; entityId: string; label?: string };
    }
  | {
      mode: "edit";
      openQuestionId: string;
      hideBackLink?: boolean;
      contextReturnHref?: string;
    };

export function OpenQuestionForm(props: OpenQuestionFormProps) {
  const router = useRouter();
  const mode = props.mode;
  const openQuestionId = mode === "edit" ? props.openQuestionId : "";
  const { data, isLoading, error } = useAdminOpenQuestion(openQuestionId);
  const oq = data?.openQuestion as Record<string, unknown> | undefined;

  const [question, setQuestion] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"open" | "resolved" | "archived">("open");
  const [resolution, setResolution] = useState("");
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [resolvedAtDisplay, setResolvedAtDisplay] = useState<string | null>(null);
  const [resolvedByDisplay, setResolvedByDisplay] = useState<string | null>(null);

  const [showInd, setShowInd] = useState(false);
  const [showFam, setShowFam] = useState(false);
  const [showEv, setShowEv] = useState(false);
  const [showMediaSearch, setShowMediaSearch] = useState(false);
  const [mediaQ, setMediaQ] = useState("");
  const mediaQDebounced = useDebouncedValue(mediaQ, ADMIN_MODAL_DEBOUNCE_MS);

  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [eventLinkKind, setEventLinkKind] = useState<"individual" | "family">("individual");
  const [eventIndivGiven, setEventIndivGiven] = useState("");
  const [eventIndivLast, setEventIndivLast] = useState("");
  const [eventFamP1Given, setEventFamP1Given] = useState("");
  const [eventFamP1Last, setEventFamP1Last] = useState("");
  const [eventFamP2Given, setEventFamP2Given] = useState("");
  const [eventFamP2Last, setEventFamP2Last] = useState("");
  const { data: mediaData } = useAdminMedia({
    q: mediaQDebounced.trim() || undefined,
    limit: 12,
    offset: 0,
    scope: "family-tree",
  });

  const createMut = useCreateOpenQuestion();
  const patchMut = usePatchOpenQuestion();

  useEffect(() => {
    if (mode !== "edit" || !oq) return;
    setQuestion(String(oq.question ?? ""));
    setDetails(String(oq.details ?? ""));
    setStatus((oq.status as typeof status) ?? "open");
    setResolution(String(oq.resolution ?? ""));
    setLinks(hydrateLinksFromOpenQuestion(oq));
    const ra = oq.resolvedAt as string | undefined;
    setResolvedAtDisplay(ra ? new Date(ra).toLocaleString() : null);
    const rb = oq.resolvedBy as { name?: string | null; username?: string } | undefined;
    setResolvedByDisplay(rb?.name?.trim() || rb?.username || null);
  }, [mode, oq]);

  useEffect(() => {
    if (mode !== "create") return;
    if (!props.initialLink) return;
    const { entityType, entityId, label } = props.initialLink;
    setLinks((prev) => {
      if (prev.some((p) => p.kind === entityType && p.id === entityId)) return prev;
      const fallback =
        entityType === "individual"
          ? "Person"
          : entityType === "family"
            ? "Family"
            : entityType === "event"
              ? "Event"
              : "Media";
      return [...prev, { kind: entityType, id: entityId, label: label?.trim() || fallback }];
    });
  }, [mode, props]);

  const excludeIds = useMemo(() => {
    const m: Record<OpenQuestionEntityType, Set<string>> = {
      individual: new Set(),
      family: new Set(),
      event: new Set(),
      media: new Set(),
    };
    for (const l of links) m[l.kind].add(l.id);
    return m;
  }, [links]);

  const pushLink = useCallback((row: LinkRow) => {
    setLinks((prev) => {
      if (prev.some((p) => p.kind === row.kind && p.id === row.id)) return prev;
      return [...prev, row];
    });
  }, []);

  const removeLink = useCallback(
    async (row: LinkRow) => {
      if (mode === "edit") {
        try {
          await patchMut.mutateAsync({
            id: openQuestionId,
            body: { unlink: { entityType: row.kind, entityId: row.id } },
          });
        } catch (e) {
          const msg = e instanceof ApiError ? e.message : "Could not unlink";
          window.alert(msg);
          return;
        }
      }
      setLinks((prev) => prev.filter((p) => !(p.kind === row.kind && p.id === row.id)));
    },
    [mode, openQuestionId, patchMut],
  );

  const addLinkAfterPick = useCallback(
    async (row: LinkRow) => {
      if (mode === "edit") {
        try {
          await patchMut.mutateAsync({
            id: openQuestionId,
            body: { link: { entityType: row.kind, entityId: row.id } },
          });
        } catch (e) {
          const msg = e instanceof ApiError ? e.message : "Could not link";
          window.alert(msg);
          return;
        }
      }
      pushLink(row);
    },
    [mode, openQuestionId, patchMut, pushLink],
  );

  const handleSaveFields = async () => {
    if (mode === "create") {
      if (!question.trim()) {
        window.alert("Question is required.");
        return;
      }
      try {
        const res = await createMut.mutateAsync({
          question: question.trim(),
          details: details.trim() || null,
          initialLinks: links.map((l) => ({ entityType: l.kind, entityId: l.id })),
        });
        const id = (res.openQuestion as { id?: string }).id;
        if (id) {
          const ret =
            "contextReturnHref" in props && props.contextReturnHref?.startsWith("/admin/")
              ? props.contextReturnHref
              : `/admin/open-questions/${id}/edit`;
          router.push(ret);
        }
      } catch (e) {
        window.alert(e instanceof ApiError ? e.message : "Create failed");
      }
      return;
    }

    try {
      const body: Record<string, unknown> = {
        question: question.trim(),
        details: details.trim() || null,
        status,
      };
      if (status === "resolved") {
        if (!resolution.trim()) {
          window.alert("Resolution is required when status is Resolved.");
          return;
        }
        body.resolution = resolution.trim();
      } else {
        body.resolution = resolution.trim() || null;
      }
      await patchMut.mutateAsync({ id: openQuestionId, body });
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Save failed");
    }
  };

  const busy = createMut.isPending || patchMut.isPending;
  const returnHref =
    ("contextReturnHref" in props && props.contextReturnHref?.startsWith("/admin/")
      ? props.contextReturnHref
      : null) ?? "/admin/open-questions";

  if (mode === "edit" && openQuestionId && isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (mode === "edit" && (error || !oq)) {
    return <p className="text-sm text-destructive">Could not load this open question.</p>;
  }

  return (
    <div className="space-y-8">
      {!props.hideBackLink ? (
        <Link
          href={returnHref}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex gap-1.5")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Link>
      ) : null}

      <section className="space-y-4 rounded-xl border border-base-content/10 bg-base-200/15 p-4 sm:p-6">
        <h2 className="text-base font-semibold">Question</h2>
        <div className="space-y-2">
          <Label htmlFor="oq-question">Question</Label>
          <Input
            id="oq-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Where was this person born?"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oq-details">Details</Label>
          <textarea
            id="oq-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            placeholder="Optional context, evidence, or links to check."
            className="textarea textarea-bordered w-full min-h-[5.5rem] resize-y text-sm"
          />
        </div>
        {mode === "edit" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="oq-status">Status</Label>
              <select
                id="oq-status"
                className="select select-bordered w-full max-w-xs"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {resolvedAtDisplay ? <p>Resolved at: {resolvedAtDisplay}</p> : null}
              {resolvedByDisplay ? <p>Resolved by: {resolvedByDisplay}</p> : null}
            </div>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="oq-resolution">Resolution</Label>
          <textarea
            id="oq-resolution"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={status === "resolved" ? 5 : 3}
            className={cn(
              "textarea textarea-bordered w-full resize-y text-sm",
              status === "resolved" ? "min-h-[7rem] border-success/40 bg-success/5" : "min-h-[5.5rem]",
            )}
            placeholder={
              status === "resolved"
                ? "Explain how this was resolved (required when status is Resolved)."
                : "Optional; required when marking as Resolved."
            }
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-base-content/10 bg-base-200/15 p-4 sm:p-6">
        <h2 className="text-base font-semibold">Linked records</h2>
        <p className="text-sm text-muted-foreground">
          Link people, families, events, and media this question applies to.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Individuals</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowInd((v) => !v)}>
              <Plus className="size-4" aria-hidden />
              Add person
            </Button>
          </div>
          {links
            .filter((l) => l.kind === "individual")
            .map((l) => (
              <div
                key={`i-${l.id}`}
                className="flex items-center justify-between rounded-md border border-base-content/10 px-3 py-2"
              >
                <p className="text-sm">{l.label}</p>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => void removeLink(l)}
                >
                  ×
                </button>
              </div>
            ))}
          {showInd ? (
            <IndividualSearchPicker
              idPrefix={`oq-ind-${openQuestionId || "new"}`}
              excludeIds={excludeIds.individual}
              onPick={(ind) => {
                const name = stripSlashesFromName(ind.fullName);
                void addLinkAfterPick({
                  kind: "individual",
                  id: ind.id,
                  label: name || ind.xref || ind.id,
                });
                setShowInd(false);
              }}
            />
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Families</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowFam((v) => !v)}>
              <Plus className="size-4" aria-hidden />
              Add family
            </Button>
          </div>
          {links
            .filter((l) => l.kind === "family")
            .map((l) => (
              <div
                key={`f-${l.id}`}
                className="flex items-center justify-between rounded-md border border-base-content/10 px-3 py-2"
              >
                <p className="text-sm">{l.label}</p>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => void removeLink(l)}
                >
                  ×
                </button>
              </div>
            ))}
          {showFam ? (
            <FamilySearchPicker
              idPrefix={`oq-fam-${openQuestionId || "new"}`}
              excludeIds={excludeIds.family}
              onPick={(fam) => {
                void addLinkAfterPick({ kind: "family", id: fam.id, label: fam.xref || fam.id });
                setShowFam(false);
              }}
            />
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Events</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowEv((v) => !v)}>
              <Plus className="size-4" aria-hidden />
              Add event
            </Button>
          </div>
          {links
            .filter((l) => l.kind === "event")
            .map((l) => (
              <div
                key={`e-${l.id}`}
                className="flex items-center justify-between rounded-md border border-base-content/10 px-3 py-2"
              >
                <p className="text-sm">{l.label}</p>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => void removeLink(l)}
                >
                  ×
                </button>
              </div>
            ))}
          {showEv ? (
            <EventPicker
              idPrefix={`oq-ev-${openQuestionId || "new"}`}
              requireEventType={false}
              eventType={eventTypeFilter}
              onEventTypeChange={setEventTypeFilter}
              linkScope={eventLinkKind}
              onLinkScopeChange={setEventLinkKind}
              indGiven={eventIndivGiven}
              indLast={eventIndivLast}
              onIndGivenChange={setEventIndivGiven}
              onIndLastChange={setEventIndivLast}
              famP1Given={eventFamP1Given}
              famP1Last={eventFamP1Last}
              famP2Given={eventFamP2Given}
              famP2Last={eventFamP2Last}
              onFamP1GivenChange={setEventFamP1Given}
              onFamP1LastChange={setEventFamP1Last}
              onFamP2GivenChange={setEventFamP2Given}
              onFamP2LastChange={setEventFamP2Last}
              excludeEventIds={excludeIds.event}
              onPick={(ev) => {
                void addLinkAfterPick({
                  kind: "event",
                  id: ev.id,
                  label: formatNoteEventPickerLabel(ev),
                });
                setShowEv(false);
              }}
            />
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Media</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowMediaSearch((v) => !v)}>
              <Plus className="size-4" aria-hidden />
              Add media
            </Button>
          </div>
          {links
            .filter((l) => l.kind === "media")
            .map((l) => (
              <div
                key={`m-${l.id}`}
                className="flex items-center justify-between rounded-md border border-base-content/10 px-3 py-2"
              >
                <p className="text-sm">{l.label}</p>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => void removeLink(l)}
                >
                  ×
                </button>
              </div>
            ))}
          {showMediaSearch ? (
            <div className="space-y-2 rounded-md border border-base-content/10 p-3">
              <Input
                value={mediaQ}
                onChange={(e) => setMediaQ(e.target.value)}
                placeholder="Search media by title…"
              />
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {(mediaData?.media ?? []).map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="w-full rounded px-2 py-1.5 text-left hover:bg-base-content/[0.06]"
                      disabled={excludeIds.media.has(m.id)}
                      onClick={() => {
                        const label = m.title?.trim() || m.fileRef || m.id;
                        void addLinkAfterPick({ kind: "media", id: m.id, label });
                        setShowMediaSearch(false);
                        setMediaQ("");
                      }}
                    >
                      {m.title?.trim() || m.fileRef || m.id}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="btn-primary" disabled={busy} onClick={() => void handleSaveFields()}>
          {mode === "create" ? "Create" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(returnHref)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
