import Link from "next/link";
import { formatDisplayNameFromNameForms, stripSlashesFromName } from "@/lib/gedcom/display-name";
import { SexIcon } from "@/components/admin/SexIcon";

interface LinkedIndividualLinkProps {
  ind: Record<string, unknown>;
}

export function LinkedIndividualLink({ ind }: LinkedIndividualLinkProps) {
  const indId = ind.id as string;
  const xref = (ind.xref as string) ?? "";
  const sex = ind.sex as string | null;
  const name =
    formatDisplayNameFromNameForms(
      ind.individualNameForms as Parameters<typeof formatDisplayNameFromNameForms>[0],
      ind.fullName as string,
    ) ||
    stripSlashesFromName(ind.fullName as string) ||
    xref ||
    indId;
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">
        <SexIcon sex={sex} />
      </span>
      <div className="min-w-0">
        <Link href={`/admin/individuals/${indId}`} className="link link-primary font-medium">
          {name}
        </Link>
        {xref ? <p className="font-mono text-xs text-muted-foreground">{xref}</p> : null}
      </div>
    </div>
  );
}
