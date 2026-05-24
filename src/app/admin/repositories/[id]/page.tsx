"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Library } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useAdminRepository } from "@/hooks/useAdminRepositories";
import { cn } from "@/lib/utils";

interface RepositorySourceLink {
  id: string;
  callNumber: string | null;
  source: {
    id: string;
    xref: string;
    title: string | null;
    author: string | null;
    abbreviation: string | null;
    _count: {
      individualSources: number;
      familySources: number;
      eventSources: number;
      attributeSources: number;
    };
  };
}

interface RepositoryDetail {
  id: string;
  xref: string;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  sourceRepositories: RepositorySourceLink[];
}

function totalCitations(counts: RepositorySourceLink["source"]["_count"]): number {
  return counts.individualSources + counts.familySources + counts.eventSources + counts.attributeSources;
}

function locationString(repo: RepositoryDetail): string {
  return [repo.address, repo.city, repo.state, repo.country].filter(Boolean).join(", ");
}

export default function AdminRepositoryDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { data, isLoading, error } = useAdminRepository(id);
  const repo = data?.repository as RepositoryDetail | undefined;

  const back = (
    <Link
      href="/admin/repositories"
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4 inline-flex gap-1.5")}
    >
      <ArrowLeft className="size-4" />
      Repositories
    </Link>
  );

  if (!id) return <div>{back}<p className="text-sm text-muted-foreground">Missing id.</p></div>;
  if (isLoading) return <div>{back}<p className="text-sm text-muted-foreground">Loading…</p></div>;
  if (error || !repo) return <div>{back}<p className="text-sm text-muted-foreground">Repository not found.</p></div>;

  const location = locationString(repo);
  const sourceLinks = repo.sourceRepositories ?? [];

  return (
    <div className="space-y-8 pb-16">
      {back}

      <header className="space-y-2 border-b border-base-content/[0.08] pb-6">
        <div className="flex items-center gap-3">
          <Library className="size-8 shrink-0 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight text-base-content">
            {repo.name ?? repo.xref ?? "Repository"}
          </h1>
        </div>
        <p className="font-mono text-xs text-muted-foreground">{repo.xref}</p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        {location ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
            <p className="text-sm">{location}</p>
          </div>
        ) : null}

        {repo.phone || repo.email || repo.website ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
            <div className="space-y-0.5 text-sm">
              {repo.phone ? <p>{repo.phone}</p> : null}
              {repo.email ? <a href={`mailto:${repo.email}`} className="text-primary underline-offset-2 hover:underline">{repo.email}</a> : null}
              {repo.website ? (
                <p>
                  <a href={repo.website} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
                    {repo.website}
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-lg font-semibold">Sources held by this repository</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {sourceLinks.length === 0
              ? "No sources are linked to this repository yet."
              : `This repository contains or references ${sourceLinks.length} ${sourceLinks.length === 1 ? "source" : "sources"}.`}
          </p>
        </div>

        {sourceLinks.length > 0 ? (
          <ul className="space-y-2">
            {sourceLinks.map((link) => {
              const s = link.source;
              const label = s.title?.trim() || s.abbreviation?.trim() || s.xref;
              const citations = totalCitations(s._count);
              return (
                <li
                  key={link.id}
                  className="flex flex-col gap-1 rounded-lg border border-base-content/[0.08] bg-base-content/[0.02] px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <Link
                      href={`/admin/sources/${s.id}/edit`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {label}
                    </Link>
                    {s.author ? (
                      <p className="text-xs text-muted-foreground">{s.author}</p>
                    ) : null}
                    {link.callNumber ? (
                      <p className="text-xs text-muted-foreground">Call number: {link.callNumber}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-block rounded-full bg-base-content/[0.06] px-2 py-0.5 text-xs text-muted-foreground">
                      {citations} {citations === 1 ? "citation" : "citations"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
