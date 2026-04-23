import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";

interface ResultCountProps {
  total: number;
  hasMore: boolean;
  shown: number;
  isLoading?: boolean;
}

export function ResultCount({ total, hasMore, shown, isLoading }: ResultCountProps) {
  if (isLoading || total === 0 && !hasMore) return null;
  return (
    <p className="text-sm text-muted-foreground">
      {hasMore
        ? `Showing ${shown.toLocaleString()} of ${total.toLocaleString()} matches (capped at ${ADMIN_LIST_MAX_LIMIT.toLocaleString()} per request)`
        : `${total.toLocaleString()} match${total === 1 ? "" : "es"}`}
    </p>
  );
}
