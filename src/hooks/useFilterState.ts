"use client";

import { useState, useMemo, useCallback } from "react";

export interface UseFilterStateReturn<TFilter, TQueryOpts> {
  draft: TFilter;
  applied: TFilter;
  queryOpts: TQueryOpts;
  updateDraft: (key: keyof TFilter, value: string) => void;
  apply: () => void;
  clear: () => void;
  /** Replace both draft and applied (e.g. hydrate from URL). */
  replace: (next: TFilter) => void;
}

export function useFilterState<TFilter extends object, TQueryOpts>(
  defaults: TFilter,
  toQueryOpts: (applied: TFilter) => TQueryOpts,
): UseFilterStateReturn<TFilter, TQueryOpts> {
  const [draft, setDraft] = useState<TFilter>({ ...defaults });
  const [applied, setApplied] = useState<TFilter>({ ...defaults });

  const queryOpts = useMemo(() => toQueryOpts(applied), [applied, toQueryOpts]);

  const updateDraft = useCallback(
    (key: keyof TFilter, value: string) => {
      setDraft((d) => ({ ...d, [key]: value }));
    },
    [],
  );

  const apply = useCallback(() => {
    setApplied({ ...draft });
  }, [draft]);

  const clear = useCallback(() => {
    setDraft({ ...defaults });
    setApplied({ ...defaults });
  }, [defaults]);

  const replace = useCallback((next: TFilter) => {
    setDraft({ ...next });
    setApplied({ ...next });
  }, []);

  return { draft, applied, queryOpts, updateDraft, apply, clear, replace };
}
