"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import type { IndividualDetailEvent } from "@/lib/detail/individual-detail-events";

function personLink(
  id: string | null | undefined,
  name: string | null | undefined,
  xref: string | null | undefined,
): ReactNode {
  const text = stripSlashesFromName(name) || xref || "Person";
  if (id) {
    return (
      <Link href={`/admin/individuals/${id}`} className="link link-primary font-medium">
        {text}
      </Link>
    );
  }
  return text;
}

export function IndividualAdminEventContext({ e }: { e: IndividualDetailEvent }): ReactNode {
  if (e.source === "individual") return null;
  const parts: ReactNode[] = [];
  if (e.spouseName || e.spouseXref) {
    parts.push(
      <Fragment key="sp">
        Related: {personLink(e.spouseIndividualId, e.spouseName, e.spouseXref)}
      </Fragment>,
    );
  }
  if (e.childName || e.childXref) {
    parts.push(
      <Fragment key="ch">
        Child/sibling: {personLink(e.childIndividualId, e.childName, e.childXref)}
      </Fragment>,
    );
  }
  if (!parts.length) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 ? " · " : ""}
          {p}
        </Fragment>
      ))}
    </p>
  );
}

/** Family timeline row from `GET /api/admin/families/[id]/events` */
export type FamilyAdminEventContextRow = IndividualDetailEvent & {
  source: string;
  memberId?: string | null;
  memberName?: string | null;
  husbandDisplayName?: string | null;
  wifeDisplayName?: string | null;
};

export function FamilyAdminEventContext({ e }: { e: FamilyAdminEventContextRow }): ReactNode {
  const parts: ReactNode[] = [];

  if (e.source === "member" && (e.memberName || e.memberId)) {
    parts.push(
      <Fragment key="mem">
        Member: {personLink(e.memberId, e.memberName, null)}
      </Fragment>,
    );
  }

  const et = String(e.eventType ?? "").toUpperCase();
  const partnerEvent = et === "MARR" || et === "DIV" || et === "ENGA";
  if (
    e.source === "familyRecord" &&
    partnerEvent &&
    (e.husbandIndividualId || e.wifeIndividualId)
  ) {
    const pair: ReactNode[] = [];
    if (e.husbandIndividualId) {
      pair.push(personLink(e.husbandIndividualId, e.husbandDisplayName, null));
    }
    if (e.wifeIndividualId) {
      pair.push(personLink(e.wifeIndividualId, e.wifeDisplayName, null));
    }
    if (pair.length) {
      parts.push(
        <span key="partners" className="inline-flex flex-wrap items-baseline gap-x-1">
          <span>Partners:</span>
          {pair.map((node, i) => (
            <Fragment key={i}>
              {i > 0 ? <span aria-hidden>·</span> : null}
              {node}
            </Fragment>
          ))}
        </span>,
      );
    }
  }

  if (e.source === "member" && (e.spouseName || e.spouseXref || e.childName || e.childXref)) {
    if (e.spouseName || e.spouseXref) {
      parts.push(
        <Fragment key="msp">
          Related: {personLink(e.spouseIndividualId, e.spouseName, e.spouseXref)}
        </Fragment>,
      );
    }
    if (e.childName || e.childXref) {
      parts.push(
        <Fragment key="mch">
          Child/sibling: {personLink(e.childIndividualId, e.childName, e.childXref)}
        </Fragment>,
      );
    }
  }

  if (!parts.length) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 ? " · " : ""}
          {p}
        </Fragment>
      ))}
    </p>
  );
}
