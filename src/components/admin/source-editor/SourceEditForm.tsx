"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminEditorMobileFormHeader } from "@/components/admin/editor-shell/AdminEditorMobileFormHeader";
import { AdminEditorMobileSectionSelect } from "@/components/admin/editor-shell/AdminEditorMobileSectionSelect";
import { AdminEditorResponsiveSection } from "@/components/admin/editor-shell/AdminEditorResponsiveSection";
import { AdminEditorSidebarNav } from "@/components/admin/editor-shell/AdminEditorSidebarNav";
import { AdminEditorStickySaveBar } from "@/components/admin/editor-shell/AdminEditorStickySaveBar";
import { PersonEditorLayout } from "@/components/admin/individual-editor/PersonEditorLayout";
import { SourceCitationsPanel } from "@/components/admin/source-editor/SourceCitationsPanel";
import { SOURCE_EDITOR_NAV, type SourceEditorSectionId } from "@/components/admin/source-editor/source-editor-nav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMediaQueryMinLg } from "@/hooks/useMediaQueryMinLg";
import { useCreateSource, useUpdateSource } from "@/hooks/useAdminSources";

const FORM_ID = "source-edit-form";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function sourceHeadline(source: Record<string, unknown>): string {
  const title = str(source.title).trim();
  if (title) return title;
  const xref = str(source.xref).trim();
  if (xref) return xref;
  return "Source";
}

function sourceMainSummary(title: string, author: string): string {
  const t = title.trim();
  const a = author.trim();
  if (t && a) return `${t} · ${a}`;
  if (t) return t;
  if (a) return a;
  return "No title or author yet";
}

function sourceRepositorySummary(repoXref: string, callNumber: string): string {
  const r = repoXref.trim();
  const c = callNumber.trim();
  if (r && c) return `${r} · ${c}`;
  if (r) return r;
  if (c) return `Call number: ${c}`;
  return "No repository fields filled in";
}

function citationCount(source: Record<string, unknown>): number {
  const ind = Array.isArray(source.individualSources) ? source.individualSources.length : 0;
  const fam = Array.isArray(source.familySources) ? source.familySources.length : 0;
  const ev = Array.isArray(source.eventSources) ? source.eventSources.length : 0;
  const notes = Array.isArray(source.sourceNotes) ? source.sourceNotes.length : 0;
  const media = Array.isArray(source.sourceMedia) ? source.sourceMedia.length : 0;
  return ind + fam + ev + notes + media;
}

function citationsSummary(source: Record<string, unknown>): string {
  const n = citationCount(source);
  if (n === 0) return "Nothing linked yet";
  if (n === 1) return "1 citation";
  return `${n} citations`;
}

function recordSummary(xref: string): string {
  const x = xref.trim();
  return x ? `GEDCOM ${x}` : "Identifiers";
}

const EMPTY_SOURCE_FOR_CREATE: Record<string, unknown> = {
  individualSources: [],
  familySources: [],
  eventSources: [],
  sourceNotes: [],
  sourceMedia: [],
};

export type SourceEditFormProps =
  | { mode: "create" }
  | { mode: "edit"; sourceId: string; initialSource: Record<string, unknown> };

export function SourceEditForm(props: SourceEditFormProps) {
  const router = useRouter();
  const isDesktop = useMediaQueryMinLg();
  const isCreate = props.mode === "create";
  const sourceId = props.mode === "edit" ? props.sourceId : "";
  const initialSource = props.mode === "edit" ? props.initialSource : EMPTY_SOURCE_FOR_CREATE;
  const updateSource = useUpdateSource();
  const createSource = useCreateSource();

  const [title, setTitle] = useState(() => str(initialSource.title));
  const [author, setAuthor] = useState(() => str(initialSource.author));
  const [abbreviation, setAbbreviation] = useState(() => str(initialSource.abbreviation));
  const [publication, setPublication] = useState(() => str(initialSource.publication));
  const [text, setText] = useState(() => str(initialSource.text));
  const [repositoryXref, setRepositoryXref] = useState(() => str(initialSource.repositoryXref));
  const [callNumber, setCallNumber] = useState(() => str(initialSource.callNumber));

  const [activeSection, setActiveSection] = useState<SourceEditorSectionId>("source-main");
  const [mobileExpanded, setMobileExpanded] = useState<string | null>("source-main");

  useEffect(() => {
    if (isCreate) return;
    setTitle(str(initialSource.title));
    setAuthor(str(initialSource.author));
    setAbbreviation(str(initialSource.abbreviation));
    setPublication(str(initialSource.publication));
    setText(str(initialSource.text));
    setRepositoryXref(str(initialSource.repositoryXref));
    setCallNumber(str(initialSource.callNumber));
  }, [initialSource, isCreate]);

  const headline = useMemo(() => (isCreate ? "New source" : sourceHeadline(initialSource)), [initialSource, isCreate]);
  const xrefDisplay = str(initialSource.xref);

  const goToSection = useCallback((id: SourceEditorSectionId) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const onMobileToggle = useCallback((key: string) => {
    setMobileExpanded((cur) => (cur === key ? null : key));
  }, []);

  useEffect(() => {
    if (!isDesktop || typeof IntersectionObserver === "undefined") return;
    const idList = SOURCE_EDITOR_NAV.map((n) => n.id);
    const obs = new IntersectionObserver(
      (entries) => {
        let best: SourceEditorSectionId | null = null;
        let bestRatio = 0;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = e.target.id;
          if (!idList.includes(id)) continue;
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio;
            best = id as SourceEditorSectionId;
          }
        }
        if (best != null && bestRatio >= 0.12) setActiveSection(best);
      },
      { root: null, rootMargin: "-10% 0px -45% 0px", threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1] },
    );
    for (const id of idList) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [isDesktop]);

  const mainSummary = useMemo(() => sourceMainSummary(title, author), [title, author]);
  const repositorySummary = useMemo(
    () => sourceRepositorySummary(repositoryXref, callNumber),
    [repositoryXref, callNumber],
  );
  const citeSummary = useMemo(() => citationsSummary(initialSource), [initialSource]);
  const idsSummary = useMemo(
    () => (isCreate ? "XREF assigned when you save" : recordSummary(xrefDisplay)),
    [isCreate, xrefDisplay],
  );

  const cancelHref = "/admin/sources";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const titleTrim = title.trim();
    if (!titleTrim) {
      toast.error("Add a title for this source.");
      return;
    }
    try {
      if (isCreate) {
        const res = (await createSource.mutateAsync({
          title: titleTrim,
          author: strOrNull(author),
          abbreviation: strOrNull(abbreviation),
          publication: strOrNull(publication),
          text: strOrNull(text),
          repositoryXref: strOrNull(repositoryXref),
          callNumber: strOrNull(callNumber),
        })) as { source?: Record<string, unknown> };
        const newId = res?.source && typeof res.source.id === "string" ? res.source.id : "";
        if (!newId) throw new Error("Server did not return a new source id.");
        toast.success("Source created.");
        router.replace(`/admin/sources/${newId}/edit`);
        return;
      }
      await updateSource.mutateAsync({
        id: sourceId,
        title: strOrNull(title),
        author: strOrNull(author),
        abbreviation: strOrNull(abbreviation),
        publication: strOrNull(publication),
        text: strOrNull(text),
        repositoryXref: strOrNull(repositoryXref),
        callNumber: strOrNull(callNumber),
      });
      toast.success("Source saved.");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(isCreate ? `Could not create source: ${msg}` : `Could not save: ${msg}`);
    }
  };

  const mainBody = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="source-title">
          Title{isCreate ? <span className="text-destructive"> *</span> : null}
        </Label>
        <Input id="source-title" value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="e.g. Parish register, 1880–1910" required={isCreate} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="source-author">Author / agency</Label>
        <Input id="source-author" value={author} onChange={(ev) => setAuthor(ev.target.value)} placeholder="Who produced this source" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="source-abbrev">Short title (abbreviation)</Label>
        <Input id="source-abbrev" value={abbreviation} onChange={(ev) => setAbbreviation(ev.target.value)} placeholder="Short label for citations" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="source-publication">Publication details</Label>
        <textarea
          id="source-publication"
          value={publication}
          onChange={(ev) => setPublication(ev.target.value)}
          rows={3}
          placeholder="Publisher, year, volume, edition…"
          className="flex min-h-[5rem] w-full max-w-2xl rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="source-text">Transcription or full reference text</Label>
        <textarea
          id="source-text"
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          rows={6}
          placeholder="Optional longer text (GEDCOM TEXT)"
          className="flex min-h-[8rem] w-full max-w-2xl rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  );

  const repositoryBody = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Use these fields when the GEDCOM points at a repository record by xref, or when you only have a call number.
      </p>
      <div className="space-y-2">
        <Label htmlFor="source-repo-xref">Repository xref (GEDCOM)</Label>
        <Input id="source-repo-xref" value={repositoryXref} onChange={(ev) => setRepositoryXref(ev.target.value)} placeholder="e.g. @R12@" className="font-mono text-sm" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="source-call-number">Call number / shelf mark</Label>
        <Input id="source-call-number" value={callNumber} onChange={(ev) => setCallNumber(ev.target.value)} placeholder="Archive reference" />
      </div>
    </div>
  );

  const citationsBody = (
    <SourceCitationsPanel isCreate={isCreate} sourceId={sourceId} source={initialSource} />
  );

  const recordBody = isCreate ? (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        When you create this source, the server assigns the next GEDCOM 5.5 source xref for this tree (for example <span className="font-mono text-foreground">@S12@</span>
        ). You do not enter the xref yourself.
      </p>
      <p className="text-muted-foreground">
        After saving, use Linked citations on this page to attach people, families, events, and media—or attach from those records’ screens.
      </p>
    </div>
  ) : (
    <div className="space-y-3 text-sm">
      <div>
        <Label className="text-muted-foreground">GEDCOM xref</Label>
        <p className="mt-1 rounded-md border border-base-content/10 bg-base-content/[0.02] px-3 py-2 font-mono text-xs">{xrefDisplay || "—"}</p>
        <p className="mt-1 text-xs text-muted-foreground">XREF is allocated by the server and is not editable here.</p>
      </div>
      <div>
        <Label className="text-muted-foreground">Internal record id</Label>
        <p className="mt-1 truncate rounded-md border border-base-content/10 bg-base-content/[0.02] px-3 py-2 font-mono text-[11px] text-muted-foreground" title={sourceId}>
          {sourceId}
        </p>
      </div>
    </div>
  );

  const sections = (desktop: boolean) => (
    <>
      <AdminEditorResponsiveSection
        id="source-main"
        sectionKey="source-main"
        title="Publication"
        description="How this source is described when cited in the tree."
        icon={SOURCE_EDITOR_NAV[0]!.icon}
        summary={mainSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {mainBody}
      </AdminEditorResponsiveSection>
      <AdminEditorResponsiveSection
        id="source-repository"
        sectionKey="source-repository"
        title="Repository"
        description="Archive, library, or film locator."
        icon={SOURCE_EDITOR_NAV[1]!.icon}
        summary={repositorySummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {repositoryBody}
      </AdminEditorResponsiveSection>
      <AdminEditorResponsiveSection
        id="source-citations"
        sectionKey="source-citations"
        title="Linked citations"
        description="Where this source is used in your data."
        icon={SOURCE_EDITOR_NAV[2]!.icon}
        summary={citeSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {citationsBody}
      </AdminEditorResponsiveSection>
      <AdminEditorResponsiveSection
        id="source-record"
        sectionKey="source-record"
        title="Record ids"
        description="Technical identifiers for support and imports."
        icon={SOURCE_EDITOR_NAV[3]!.icon}
        summary={idsSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {recordBody}
      </AdminEditorResponsiveSection>
    </>
  );

  return (
    <form id={FORM_ID} onSubmit={handleSubmit} className="w-full pb-32">
      {isDesktop ? (
        <PersonEditorLayout
          sidebarNavAriaLabel="Source editor sections"
          mobileNav={
            <AdminEditorMobileSectionSelect
              items={SOURCE_EDITOR_NAV}
              value={activeSection}
              onChange={(id) => goToSection(id as SourceEditorSectionId)}
              labelId="source-editor-section-jump"
            />
          }
          sidebar={
            <AdminEditorSidebarNav
              items={SOURCE_EDITOR_NAV}
              activeId={activeSection}
              onSelect={(id) => goToSection(id as SourceEditorSectionId)}
            />
          }
        >
          {sections(true)}
        </PersonEditorLayout>
      ) : (
        <div className="space-y-3">
          <AdminEditorMobileFormHeader
            title={isCreate ? headline : `Edit · ${headline}`}
            backHref={cancelHref}
            backLabel="Sources"
          />
          {sections(false)}
        </div>
      )}

      <AdminEditorStickySaveBar
        pending={isCreate ? createSource.isPending : updateSource.isPending}
        cancelHref={cancelHref}
        formId={FORM_ID}
        saveLabel={isCreate ? "Create source" : "Save source"}
        savingLabel={isCreate ? "Creating…" : "Saving…"}
        pendingHint={isCreate ? "Creating your source…" : "Saving your changes…"}
      />
    </form>
  );
}
