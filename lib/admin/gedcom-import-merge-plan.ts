/**
 * Builds a UI-oriented import merge plan from a ligneous-gedcom-lib reconciliation MergePlan JSON.
 * MVP: individuals only; categorization is heuristic from confidence + score.
 */

export type ImportResolution =
  | "merge_into_existing"
  | "create_new"
  | "skip"
  | "review_later"
  | "mark_not_match";

export type ImportCandidateCategory =
  | "likely_existing"
  | "possible_match"
  | "new_record"
  | "conflict"
  | "validation_warning";

export type ImportMatchAlternative = {
  existingIndividualId: string;
  label: string;
  scorePct: number | null;
};

export type ImportMatchCandidate = {
  candidateId: string;
  category: ImportCandidateCategory;
  /** DB individual id when aligned or chosen */
  existingIndividualId: string | null;
  /** Import-side individual id (enriched) */
  importedIndividualId: string;
  existingDisplay: string;
  importedDisplay: string;
  confidencePct: number | null;
  scoreStage: number | null;
  /** When multiple DB rows compete (soft hints / possible match) */
  alternatives?: ImportMatchAlternative[];
  conflictField?: string;
  detail?: string;
};

export type LibApiPipelineStats = {
  individuals: number;
  families: number;
  events: number;
  notes: number;
  media: number;
};

export type ImportMergePlan = {
  importId: string;
  fileUuid: string;
  treeLabel: string;
  importFilename: string;
  candidates: ImportMatchCandidate[];
  defaultResolutions: Record<string, ImportResolution>;
  summary: {
    importedIndividuals: number;
    importedFamilies: number;
    importedEvents: number;
    importedNotes: number;
    importedMedia: number;
    likelyExisting: number;
    possibleMatches: number;
    newRecords: number;
    conflicts: number;
    warnings: number;
  };
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function pickIndi(doc: Record<string, unknown>, id: string): Record<string, unknown> | null {
  const inds = doc.individuals;
  if (!Array.isArray(inds)) return null;
  for (const row of inds) {
    const o = asRecord(row);
    if (o && typeof o.id === "string" && o.id === id) return o;
  }
  return null;
}

function birthYearFromIndi(doc: Record<string, unknown>, row: Record<string, unknown>): number | null {
  const idx = row.birth_date_index;
  if (typeof idx !== "number" || idx < 0) return null;
  const dates = doc.dates;
  if (!Array.isArray(dates) || dates[idx] === undefined) return null;
  const d = asRecord(dates[idx]);
  const y = d?.year;
  return typeof y === "number" ? y : null;
}

export function indiDisplayLine(doc: Record<string, unknown>, id: string): string {
  const row = pickIndi(doc, id);
  if (!row) return id;
  const name = typeof row.full_name === "string" ? row.full_name : "";
  const xref = typeof row.xref === "string" ? row.xref : "";
  const y = birthYearFromIndi(doc, row);
  const base = name || xref || id;
  if (y != null) return `${base} (b. ${y})`;
  return base;
}

function refId(ref: unknown, key: string): string | null {
  const o = asRecord(ref);
  if (!o) return null;
  const v = o[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function scoreFromCard(card: unknown): { score: number; stage: number | null } {
  const o = asRecord(card);
  const score = typeof o?.score === "number" ? o.score : 0;
  const stage = typeof o?.stage === "number" ? o.stage : null;
  return { score, stage };
}

function confidenceTier(conf: unknown): "certain" | "high" | "medium" | "low" | "" {
  if (conf === "certain") return "certain";
  if (conf === "high") return "high";
  if (conf === "medium") return "medium";
  if (conf === "low") return "low";
  return "";
}

function defaultResolutionForCategory(c: ImportCandidateCategory): ImportResolution {
  switch (c) {
    case "likely_existing":
      return "merge_into_existing";
    case "new_record":
      return "create_new";
    case "conflict":
    case "possible_match":
    case "validation_warning":
      return "review_later";
    default:
      return "review_later";
  }
}

function alignmentCategory(conf: unknown, score: number): ImportCandidateCategory {
  const tier = confidenceTier(conf);
  if (tier === "certain") return "likely_existing";
  if (tier === "high" && score >= 0.75) return "likely_existing";
  if (tier === "high" || tier === "medium" || tier === "low") return "possible_match";
  return "possible_match";
}

export function buildImportMergePlanFromMergePlan(input: {
  importId: string;
  fileUuid: string;
  treeLabel: string;
  importFilename: string;
  mergePlan: unknown;
  treeEnriched: Record<string, unknown>;
  importEnriched: Record<string, unknown>;
  stats: LibApiPipelineStats | null;
  validationErrorCount: number;
  validationWarningCount: number;
  newCandidateId: () => string;
}): ImportMergePlan {
  const mp = asRecord(input.mergePlan);
  const candidates: ImportMatchCandidate[] = [];
  const usedImportIds = new Set<string>();

  const push = (c: ImportMatchCandidate) => {
    candidates.push(c);
    usedImportIds.add(c.importedIndividualId);
  };

  // Conflicts first (strong signal for review)
  const conflicts = Array.isArray(mp?.conflicts) ? (mp.conflicts as unknown[]) : [];
  for (const raw of conflicts) {
    const c = asRecord(raw);
    if (!c || c.kind !== "individual") continue;
    const leftRef = c.leftRef;
    const rightRef = c.rightRef;
    const ex = refId(leftRef, "id");
    const im = refId(rightRef, "id");
    if (!ex || !im) continue;
    const cid = input.newCandidateId();
    push({
      candidateId: cid,
      category: "conflict",
      existingIndividualId: ex,
      importedIndividualId: im,
      existingDisplay: indiDisplayLine(input.treeEnriched, ex),
      importedDisplay: indiDisplayLine(input.importEnriched, im),
      confidencePct: null,
      scoreStage: null,
      conflictField: typeof c.fieldPath === "string" ? c.fieldPath : undefined,
      detail:
        typeof c.fieldPath === "string"
          ? `${String(c.fieldPath)}: existing ${String(c.leftValue ?? "")} vs import ${String(c.rightValue ?? "")}`
          : undefined,
    });
  }

  const align = asRecord(mp?.alignments);
  const indAlign = Array.isArray(align?.individuals) ? (align.individuals as unknown[]) : [];
  for (const raw of indAlign) {
    const a = asRecord(raw);
    if (!a || a.kind !== "individual") continue;
    const leftId = typeof a.leftId === "string" ? a.leftId : "";
    const rightId = typeof a.rightId === "string" ? a.rightId : "";
    if (!leftId || !rightId) continue;
    if (usedImportIds.has(rightId)) continue;
    const { score, stage } = scoreFromCard(a.scorecard);
    const cat = alignmentCategory(a.confidence, score);
    const cid = input.newCandidateId();
    push({
      candidateId: cid,
      category: cat,
      existingIndividualId: leftId,
      importedIndividualId: rightId,
      existingDisplay: indiDisplayLine(input.treeEnriched, leftId),
      importedDisplay: indiDisplayLine(input.importEnriched, rightId),
      confidencePct: Math.round(score * 1000) / 10,
      scoreStage: stage,
    });
  }

  const poss = Array.isArray(mp?.possibleMatches) ? (mp.possibleMatches as unknown[]) : [];
  for (const raw of poss) {
    const pm = asRecord(raw);
    if (!pm || pm.kind !== "individual") continue;
    const cands = Array.isArray(pm.candidates) ? pm.candidates : [];
    const alts: ImportMatchAlternative[] = [];
    for (const cr of cands) {
      const e = asRecord(cr);
      const lid = typeof e?.leftId === "string" ? e.leftId : "";
      if (!lid) continue;
      const sc = scoreFromCard(e?.scorecard).score;
      alts.push({
        existingIndividualId: lid,
        label: indiDisplayLine(input.treeEnriched, lid),
        scorePct: Math.round(sc * 1000) / 10,
      });
    }
    if (alts.length === 0) continue;
    const first = cands[0];
    const fr = asRecord(first);
    const rightId = typeof fr?.rightId === "string" ? fr.rightId : "";
    if (!rightId || usedImportIds.has(rightId)) continue;
    const cid = input.newCandidateId();
    const best = alts.reduce((a, b) => (b.scorePct != null && a.scorePct != null && b.scorePct > a.scorePct ? b : a), alts[0]);
    push({
      candidateId: cid,
      category: "possible_match",
      existingIndividualId: best.existingIndividualId,
      importedIndividualId: rightId,
      existingDisplay: best.label,
      importedDisplay: indiDisplayLine(input.importEnriched, rightId),
      confidencePct: best.scorePct,
      scoreStage: scoreFromCard(fr?.scorecard).stage,
      alternatives: alts.length > 1 ? alts : undefined,
    });
  }

  const unresolved = Array.isArray(mp?.unresolved) ? (mp.unresolved as unknown[]) : [];
  for (const raw of unresolved) {
    const u = asRecord(raw);
    if (!u || u.side !== "right" || u.entityType !== "individual") continue;
    const id = typeof u.entityId === "string" ? u.entityId : "";
    if (!id || usedImportIds.has(id)) continue;
    const hasHints = Array.isArray(u.hints) && u.hints.length > 0;
    const cid = input.newCandidateId();
    if (hasHints) {
      const alts: ImportMatchAlternative[] = [];
      for (const h of u.hints as unknown[]) {
        const hr = asRecord(h);
        const lid = typeof hr?.leftId === "string" ? hr.leftId : "";
        if (!lid) continue;
        const sc = scoreFromCard(hr?.scorecard).score;
        alts.push({
          existingIndividualId: lid,
          label: indiDisplayLine(input.treeEnriched, lid),
          scorePct: Math.round(sc * 1000) / 10,
        });
      }
      if (alts.length === 0) {
        push({
          candidateId: cid,
          category: "possible_match",
          existingIndividualId: null,
          importedIndividualId: id,
          existingDisplay: "— (see hint scorecards in raw merge plan)",
          importedDisplay: indiDisplayLine(input.importEnriched, id),
          confidencePct: null,
          scoreStage: null,
          detail: typeof u.reason === "string" ? u.reason : "soft hints without explicit candidate ids",
        });
      } else {
        const best = alts[0];
        push({
          candidateId: cid,
          category: "possible_match",
          existingIndividualId: best.existingIndividualId,
          importedIndividualId: id,
          existingDisplay: best.label,
          importedDisplay: indiDisplayLine(input.importEnriched, id),
          confidencePct: best.scorePct,
          scoreStage: null,
          alternatives: alts.length > 1 ? alts : undefined,
          detail: typeof u.reason === "string" ? u.reason : undefined,
        });
      }
    } else {
      push({
        candidateId: cid,
        category: "new_record",
        existingIndividualId: null,
        importedIndividualId: id,
        existingDisplay: "—",
        importedDisplay: indiDisplayLine(input.importEnriched, id),
        confidencePct: null,
        scoreStage: null,
      });
    }
  }

  const defaultResolutions: Record<string, ImportResolution> = {};
  for (const c of candidates) {
    defaultResolutions[c.candidateId] = defaultResolutionForCategory(c.category);
  }

  const st = input.stats;
  const summary = {
    importedIndividuals: st?.individuals ?? 0,
    importedFamilies: st?.families ?? 0,
    importedEvents: st?.events ?? 0,
    importedNotes: st?.notes ?? 0,
    importedMedia: st?.media ?? 0,
    likelyExisting: candidates.filter((c) => c.category === "likely_existing").length,
    possibleMatches: candidates.filter((c) => c.category === "possible_match").length,
    newRecords: candidates.filter((c) => c.category === "new_record").length,
    conflicts: candidates.filter((c) => c.category === "conflict").length,
    warnings: input.validationWarningCount + (input.validationErrorCount > 0 ? 1 : 0),
  };

  return {
    importId: input.importId,
    fileUuid: input.fileUuid,
    treeLabel: input.treeLabel,
    importFilename: input.importFilename,
    candidates,
    defaultResolutions,
    summary,
  };
}

export function effectiveResolution(
  candidateId: string,
  defaults: Record<string, ImportResolution>,
  overrides: Record<string, ImportResolution> | null | undefined,
): ImportResolution {
  const o = overrides?.[candidateId];
  if (o) return o;
  return defaults[candidateId] ?? "review_later";
}
