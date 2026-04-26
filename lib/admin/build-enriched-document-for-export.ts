/**
 * Builds an EnrichedDocument-shaped JSON payload for ligneous-gedcom-lib-api
 * POST /api/v1/export. Logic mirrors ligneous-frontend/lib/export/gedcom-export.js;
 * keep both in sync when junctions or field names change.
 */
import { prisma } from "@/lib/database/prisma";

function buildIdIndex<T extends { id: string }>(arr: T[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < arr.length; i++) {
    map[arr[i].id] = i;
  }
  return map;
}

/** JSON keys use snake_case to match Go json tags on enricher types. */
export async function buildEnrichedDocumentForExport(
  fileUuid: string,
): Promise<Record<string, unknown>> {
  const where = { fileUuid };

  const [
    dates,
    places,
    surnames,
    givenNames,
    events,
    notes,
    sources,
    repositories,
    media,
    individuals,
    families,
    individualEvents,
    familyEvents,
    individualNotes,
    familyNotes,
    eventNotes,
    sourceNotes,
    individualSources,
    familySources,
    eventSources,
    individualNameForms,
    familySurnames,
    individualMedia,
    familyMedia,
    sourceMedia,
    eventMedia,
    sourceRepositories,
    parentChild,
    familyChildren,
    spouses,
  ] = await Promise.all([
    prisma.gedcomDate.findMany({ where, orderBy: { id: "asc" } }),
    prisma.gedcomPlace.findMany({ where, orderBy: { id: "asc" } }),
    prisma.gedcomSurname.findMany({ where, orderBy: { id: "asc" } }),
    prisma.gedcomGivenName.findMany({ where, orderBy: { id: "asc" } }),
    prisma.gedcomEvent.findMany({ where, orderBy: { id: "asc" } }),
    prisma.gedcomNote.findMany({ where, orderBy: { id: "asc" } }),
    prisma.gedcomSource.findMany({ where, orderBy: { id: "asc" } }),
    prisma.gedcomRepository.findMany({ where, orderBy: { id: "asc" } }),
    prisma.gedcomMedia.findMany({ where, orderBy: { id: "asc" } }),
    prisma.gedcomIndividual.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        individualOccupations: { include: { occupation: true } },
        individualNationalities: { include: { nationality: true } },
      },
    }),
    prisma.gedcomFamily.findMany({ where, orderBy: { id: "asc" } }),
    prisma.gedcomIndividualEvent.findMany({ where }),
    prisma.gedcomFamilyEvent.findMany({ where }),
    prisma.gedcomIndividualNote.findMany({ where }),
    prisma.gedcomFamilyNote.findMany({ where }),
    prisma.gedcomEventNote.findMany({ where }),
    prisma.gedcomSourceNote.findMany({ where }),
    prisma.gedcomIndividualSource.findMany({ where }),
    prisma.gedcomFamilySource.findMany({ where }),
    prisma.gedcomEventSource.findMany({ where }),
    prisma.gedcomIndividualNameForm.findMany({
      where,
      include: {
        givenNames: { include: { givenName: true } },
        surnames: { include: { surname: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.gedcomFamilySurname.findMany({ where }),
    prisma.gedcomIndividualMedia.findMany({ where }),
    prisma.gedcomFamilyMedia.findMany({ where }),
    prisma.gedcomSourceMedia.findMany({ where }),
    prisma.gedcomEventMedia.findMany({ where }),
    prisma.gedcomSourceRepository.findMany({ where }),
    prisma.gedcomParentChild.findMany({ where }),
    prisma.gedcomFamilyChild.findMany({ where }),
    prisma.gedcomSpouse.findMany({ where }),
  ]);

  const dateIndex = buildIdIndex(dates);
  const placeIndex = buildIdIndex(places);
  const surnameIndex = buildIdIndex(surnames);
  const givenNameIndex = buildIdIndex(givenNames);
  const eventIndex = buildIdIndex(events);
  const noteIndex = buildIdIndex(notes);
  const sourceIndex = buildIdIndex(sources);
  const repoIndex = buildIdIndex(repositories);
  const mediaIndex = buildIdIndex(media);

  const indiIdToXref: Record<string, string> = {};
  for (const indi of individuals) indiIdToXref[indi.id] = indi.xref;
  const famIdToXref: Record<string, string> = {};
  for (const fam of families) famIdToXref[fam.id] = fam.xref;
  const eventOwnerMap: Record<string, { xref: string; type: string }> = {};
  for (const ie of individualEvents) {
    eventOwnerMap[ie.eventId] = { xref: indiIdToXref[ie.individualId] ?? "", type: "INDI" };
  }
  for (const fe of familyEvents) {
    eventOwnerMap[fe.eventId] = { xref: famIdToXref[fe.familyId] ?? "", type: "FAM" };
  }

  return {
    Individuals: individuals.map((indi) => {
      const occValues = (indi.individualOccupations ?? [])
        .map((io) => io.valueOverride || io.occupation?.value || "")
        .filter(Boolean);
      const natValues = (indi.individualNationalities ?? [])
        .map((n) => n.nationality?.value || "")
        .filter(Boolean);
      const occupationValues = occValues.length > 0 ? occValues : indi.occupation ? [indi.occupation] : [];
      const nationalityValues = natValues.length > 0 ? natValues : indi.nationality ? [indi.nationality] : [];
      return {
        id: indi.id,
        xref: indi.xref,
        full_name: indi.fullName ?? "",
        full_name_lower: indi.fullNameLower ?? "",
        sex: indi.sex ?? "",
        gender: indi.gender ?? "",
        birth_date_index: indi.birthDateId ? (dateIndex[indi.birthDateId] ?? -1) : -1,
        birth_place_index: indi.birthPlaceId ? (placeIndex[indi.birthPlaceId] ?? -1) : -1,
        death_date_index: indi.deathDateId ? (dateIndex[indi.deathDateId] ?? -1) : -1,
        death_place_index: indi.deathPlaceId ? (placeIndex[indi.deathPlaceId] ?? -1) : -1,
        occupation_values: occupationValues,
        nationality_values: nationalityValues,
        religion: indi.religion ?? "",
      };
    }),

    Families: families.map((fam) => ({
      id: fam.id,
      xref: fam.xref,
      husband_xref: fam.husbandXref ?? "",
      wife_xref: fam.wifeXref ?? "",
      marriage_date_index: fam.marriageDateId ? (dateIndex[fam.marriageDateId] ?? -1) : -1,
      marriage_place_index: fam.marriagePlaceId ? (placeIndex[fam.marriagePlaceId] ?? -1) : -1,
      children_count: fam.childrenCount ?? 0,
    })),

    Dates: dates.map((d) => ({
      id: d.id,
      original: d.original ?? "",
      type: d.dateType ?? "UNKNOWN",
      calendar: d.calendar ?? "GREGORIAN",
      year: d.year ?? 0,
      month: d.month ?? 0,
      day: d.day ?? 0,
      end_year: d.endYear ?? 0,
      end_month: d.endMonth ?? 0,
      end_day: d.endDay ?? 0,
      hash: d.hash ?? "",
    })),

    Places: places.map((p) => ({
      id: p.id,
      original: p.original ?? "",
      name: p.name ?? "",
      county: p.county ?? "",
      state: p.state ?? "",
      country: p.country ?? "",
      latitude: p.latitude != null ? Number(p.latitude) : 0,
      longitude: p.longitude != null ? Number(p.longitude) : 0,
      hash: p.hash ?? "",
    })),

    Surnames: surnames.map((s) => ({
      id: s.id,
      value: s.surname,
      lower: s.surnameLower,
      frequency: s.frequency ?? 0,
    })),

    GivenNames: givenNames.map((g) => ({
      id: g.id,
      value: g.givenName,
      lower: g.givenNameLower,
      frequency: g.frequency ?? 0,
    })),

    Events: events.map((evt, idx) => {
      const owner = eventOwnerMap[evt.id];
      return {
        id: evt.id,
        index: idx,
        event_type: evt.eventType ?? "",
        custom_type: evt.customType ?? "",
        date_index: evt.dateId ? (dateIndex[evt.dateId] ?? -1) : -1,
        place_index: evt.placeId ? (placeIndex[evt.placeId] ?? -1) : -1,
        value: evt.value ?? "",
        cause: evt.cause ?? "",
        agency: evt.agency ?? "",
        owner_xref: owner?.xref ?? "",
        owner_type: owner?.type ?? "",
        sort_order: evt.sortOrder ?? 0,
      };
    }),

    Notes: notes.map((n) => ({
      id: n.id,
      xref: n.xref ?? "",
      content: n.content ?? "",
      is_top_level: n.isTopLevel ?? false,
    })),

    Sources: sources.map((s) => ({
      id: s.id,
      xref: s.xref ?? "",
      title: s.title ?? "",
      author: s.author ?? "",
      abbreviation: s.abbreviation ?? "",
      publication: s.publication ?? "",
      text: s.text ?? "",
      repository_xref: s.repositoryXref ?? "",
      call_number: s.callNumber ?? "",
    })),

    Repositories: repositories.map((r) => ({
      id: r.id,
      xref: r.xref ?? "",
      name: r.name ?? "",
      address: r.address ?? "",
      city: r.city ?? "",
      state: r.state ?? "",
      country: r.country ?? "",
      phone: r.phone ?? "",
      email: r.email ?? "",
      website: r.website ?? "",
    })),

    Media: media.map((m) => ({
      id: m.id,
      xref: m.xref ?? "",
      file: m.fileRef ?? "",
      form: m.form ?? "",
      title: m.title ?? "",
      description: m.description ?? "",
    })),

    IndividualEvents: individualEvents.map((ie) => ({
      individual_xref: indiIdToXref[ie.individualId] ?? "",
      event_index: eventIndex[ie.eventId] ?? -1,
      role: ie.role ?? "principal",
    })),

    FamilyEvents: familyEvents.map((fe) => ({
      family_xref: famIdToXref[fe.familyId] ?? "",
      event_index: eventIndex[fe.eventId] ?? -1,
    })),

    IndividualNotes: individualNotes.map((n) => ({
      individual_xref: indiIdToXref[n.individualId] ?? "",
      note_index: noteIndex[n.noteId] ?? -1,
    })),

    FamilyNotes: familyNotes.map((n) => ({
      family_xref: famIdToXref[n.familyId] ?? "",
      note_index: noteIndex[n.noteId] ?? -1,
    })),

    EventNotes: eventNotes.map((n) => ({
      event_index: eventIndex[n.eventId] ?? -1,
      note_index: noteIndex[n.noteId] ?? -1,
    })),

    SourceNotes: sourceNotes.map((n) => ({
      source_index: sourceIndex[n.sourceId] ?? -1,
      note_index: noteIndex[n.noteId] ?? -1,
    })),

    IndividualSources: individualSources.map((s) => ({
      individual_xref: indiIdToXref[s.individualId] ?? "",
      source_index: sourceIndex[s.sourceId] ?? -1,
      page: s.page ?? "",
      quality: s.quality ?? 0,
      citation_text: s.citationText ?? "",
    })),

    FamilySources: familySources.map((s) => ({
      family_xref: famIdToXref[s.familyId] ?? "",
      source_index: sourceIndex[s.sourceId] ?? -1,
      page: s.page ?? "",
      quality: s.quality ?? 0,
      citation_text: s.citationText ?? "",
    })),

    EventSources: eventSources.map((s) => ({
      event_index: eventIndex[s.eventId] ?? -1,
      source_index: sourceIndex[s.sourceId] ?? -1,
      page: s.page ?? "",
      quality: s.quality ?? 0,
      citation_text: s.citationText ?? "",
    })),

    NameForms: individualNameForms.map((nf) => ({
      id: nf.id,
      individual_xref: indiIdToXref[nf.individualId] ?? "",
      name_type: nf.nameType ?? "birth",
      is_primary: nf.isPrimary ?? false,
      sort_order: nf.sortOrder ?? 0,
    })),

    NameFormGivenNames: individualNameForms.flatMap((nf, nfIdx) =>
      [...(nf.givenNames ?? [])]
        .sort((a, b) => (a.position ?? 1) - (b.position ?? 1))
        .map((gfn) => ({
          name_form_index: nfIdx,
          given_name_index: givenNameIndex[gfn.givenNameId] ?? -1,
          position: gfn.position ?? 1,
        })),
    ),

    NameFormSurnames: individualNameForms.flatMap((nf, nfIdx) =>
      [...(nf.surnames ?? [])]
        .sort((a, b) => (a.position ?? 1) - (b.position ?? 1))
        .map((sfn) => ({
          name_form_index: nfIdx,
          surname_index: surnameIndex[sfn.surnameId] ?? -1,
          position: sfn.position ?? 1,
        })),
    ),

    FamilySurnames: familySurnames.map((s) => ({
      family_xref: famIdToXref[s.familyId] ?? "",
      surname_index: surnameIndex[s.surnameId] ?? -1,
      is_primary: s.isPrimary ?? false,
    })),

    IndividualMedia: individualMedia.map((m) => ({
      individual_xref: indiIdToXref[m.individualId] ?? "",
      media_index: mediaIndex[m.mediaId] ?? -1,
    })),

    FamilyMedia: familyMedia.map((m) => ({
      family_xref: famIdToXref[m.familyId] ?? "",
      media_index: mediaIndex[m.mediaId] ?? -1,
    })),

    SourceMedia: sourceMedia.map((m) => ({
      source_index: sourceIndex[m.sourceId] ?? -1,
      media_index: mediaIndex[m.mediaId] ?? -1,
    })),

    EventMedia: eventMedia.map((m) => ({
      event_index: eventIndex[m.eventId] ?? -1,
      media_index: mediaIndex[m.mediaId] ?? -1,
    })),

    SourceRepositories: sourceRepositories.map((r) => ({
      source_index: sourceIndex[r.sourceId] ?? -1,
      repository_index: repoIndex[r.repositoryId] ?? -1,
      call_number: r.callNumber ?? "",
    })),

    ParentChild: parentChild.map((pc) => ({
      parent_xref: indiIdToXref[pc.parentId] ?? "",
      child_xref: indiIdToXref[pc.childId] ?? "",
      family_xref: pc.familyId ? (famIdToXref[pc.familyId] ?? "") : "",
      parent_type: pc.parentType ?? "",
      relationship_type: pc.relationshipType ?? "biological",
      pedigree: pc.pedigree ?? "",
    })),

    FamilyChildren: familyChildren.map((fc) => ({
      family_xref: famIdToXref[fc.familyId] ?? "",
      child_xref: fc.childXref || (fc.childId ? (indiIdToXref[fc.childId] ?? "") : "") || "",
      birth_order: fc.birthOrder ?? 0,
    })),

    Spouses: spouses.map((sp) => ({
      individual_xref: indiIdToXref[sp.individualId] ?? "",
      spouse_xref: indiIdToXref[sp.spouseId] ?? "",
      family_xref: sp.familyId ? (famIdToXref[sp.familyId] ?? "") : "",
    })),

    Stats: {
      individuals: individuals.length,
      families: families.length,
      dates: dates.length,
      places: places.length,
      surnames: surnames.length,
      given_names: givenNames.length,
      events: events.length,
      notes: notes.length,
      sources: sources.length,
      repositories: repositories.length,
      media: media.length,
      event_media: eventMedia.length,
    },
  };
}
