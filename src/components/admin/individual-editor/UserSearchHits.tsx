"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import { cn } from "@/lib/utils";

type UserHit = { user: { id: string; username: string; email: string; name: string | null } };

const STABLE_EMPTY_USER_HITS: UserHit[] = [];

export function UserSearchHits({
  query,
  onPick,
  excludeUserIds,
}: {
  query: string;
  onPick: (id: string, label: string) => void;
  /** Users already linked to this individual (edit mode). */
  excludeUserIds?: ReadonlySet<string>;
}) {
  const q = query.trim();
  const { data, isFetching } = useQuery({
    queryKey: ["admin", "users", "picker", q],
    queryFn: () => fetchJson<{ users: UserHit[] }>(`/api/admin/users?limit=15&q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
  });

  if (q.length < 2) {
    return <p className="text-xs text-muted-foreground">Type at least 2 characters to search users.</p>;
  }
  if (isFetching) return <p className="text-xs text-muted-foreground">Searching…</p>;
  const rows = data?.users != null ? data.users : STABLE_EMPTY_USER_HITS;
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No users found.</p>;
  return (
    <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-base-content/10 bg-base-100 p-2 text-sm">
      {rows.map(({ user: u }) => {
        const excluded = excludeUserIds?.has(u.id) ?? false;
        return (
          <li key={u.id}>
            <button
              type="button"
              disabled={excluded}
              className={cn(
                "w-full rounded px-2 py-1.5 text-left hover:bg-base-200",
                excluded && "cursor-not-allowed opacity-50",
              )}
              onClick={() => {
                if (!excluded) onPick(u.id, u.name?.trim() || u.username);
              }}
            >
              <span className="font-medium">{u.name || u.username}</span>
              <span className="block text-xs text-muted-foreground">
                {u.username} · {u.email}
              </span>
            </button>
            {excluded ? (
              <p className="px-2 pb-1 text-xs text-muted-foreground">Already linked to this individual.</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
