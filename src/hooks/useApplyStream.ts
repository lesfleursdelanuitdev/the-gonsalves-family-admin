"use client";

import { useState, useRef, useCallback } from "react";

export type ApplyStreamState<TDone> =
  | { phase: "idle" }
  | { phase: "running"; processed: number; total: number; label: string }
  | { phase: "done"; result: TDone }
  | { phase: "error"; message: string };

/**
 * Connects to an SSE apply-stream endpoint and surfaces progress state.
 * The endpoint must emit `{ type: "start"|"progress"|"done"|"error", ... }` events.
 *
 * Generic TDone is the shape of the `done` event (varies by endpoint).
 */
export function useApplyStream<TDone>(url: string | null) {
  const [state, setState] = useState<ApplyStreamState<TDone>>({ phase: "idle" });
  const esRef = useRef<EventSource | null>(null);

  const start = useCallback(() => {
    if (!url) return;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setState({ phase: "running", processed: 0, total: 0, label: "Starting…" });

    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (e) => {
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(e.data as string) as Record<string, unknown>;
      } catch {
        return;
      }

      if (event.type === "start") {
        setState({
          phase: "running",
          processed: 0,
          total: (event.total as number) ?? 0,
          label: "Processing…",
        });
      } else if (event.type === "progress") {
        setState({
          phase: "running",
          processed: (event.processed as number) ?? 0,
          total: (event.total as number) ?? 0,
          label: (event.label as string) ?? "",
        });
      } else if (event.type === "done") {
        setState({ phase: "done", result: event as unknown as TDone });
        es.close();
        esRef.current = null;
      } else if (event.type === "error") {
        setState({ phase: "error", message: (event.message as string) ?? "Unknown error" });
        es.close();
        esRef.current = null;
      }
    };

    es.onerror = () => {
      setState((prev) =>
        prev.phase === "running"
          ? { phase: "error", message: "Stream connection lost" }
          : prev,
      );
      es.close();
      esRef.current = null;
    };
  }, [url]);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setState({ phase: "idle" });
  }, []);

  return { state, start, reset };
}
