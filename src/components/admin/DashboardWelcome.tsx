"use client";

import { useCurrentUser } from "@/hooks/useAuth";

export function DashboardWelcome() {
  const { data: user, isLoading } = useCurrentUser();
  const displayName = user?.name?.trim() || user?.username || null;

  if (isLoading) {
    return (
      <p className="text-base text-base-content/80" aria-hidden>
        <span className="skeleton inline-block h-5 w-[min(100%,22rem)] max-w-full rounded-md" />
      </p>
    );
  }

  if (!displayName) {
    return (
      <p className="text-base text-base-content/80">
        Welcome to the Gonsalves Family admin section.
      </p>
    );
  }

  return (
    <p className="text-base text-base-content/80">
      Welcome,{" "}
      <span className="font-semibold text-base-content">{displayName}</span>, to the Gonsalves Family admin
      section.
    </p>
  );
}
