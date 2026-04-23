"use client";

import { useEffect, useMemo } from "react";

/** Strict match only — broad strings caused false positives and reload loops. */
function looksLikeChunkFailure(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Error;
  const name = e.name ?? "";
  const msg = e.message ?? "";
  if (name === "ChunkLoadError") return true;
  return /^Loading chunk \d+ failed\b/i.test(msg);
}

const CHUNK_RECOVERY_PARAM = "__chunk_load";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunk = useMemo(() => looksLikeChunkFailure(error), [error]);

  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  useEffect(() => {
    if (!isChunk || typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has(CHUNK_RECOVERY_PARAM)) return;
    url.searchParams.set(CHUNK_RECOVERY_PARAM, "1");
    window.location.replace(url.toString());
  }, [isChunk]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
      <h1 className="font-heading text-xl font-semibold text-heading mb-4">
        Something went wrong
      </h1>
      <p className="font-body text-muted mb-6 text-center max-w-md">
        {isChunk ? (
          <>
            This usually happens after an update while an old tab was still open. We tried reloading once; if you still
            see this, use a hard refresh (Ctrl+Shift+R) or clear site data for this site.
          </>
        ) : (
          "A client-side error occurred. Try refreshing the page."
        )}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-primary px-6 py-3 font-body text-base font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
      >
        Try again
      </button>
      <a
        href="/"
        className="font-body mt-4 text-link underline hover:text-link-hover text-sm"
      >
        Return to home
      </a>
    </div>
  );
}
