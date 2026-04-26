export type ChildFamilySearchSlot = {
  id: string;
  p1Given: string;
  p1Last: string;
  p2Given: string;
  p2Last: string;
};

export function createChildFamilySearchSlot(): ChildFamilySearchSlot {
  return {
    id: crypto.randomUUID(),
    p1Given: "",
    p1Last: "",
    p2Given: "",
    p2Last: "",
  };
}

export type SpouseFamilySearchSlot = { id: string; partnerGiven: string; partnerLast: string };

export function createSpouseFamilySearchSlot(): SpouseFamilySearchSlot {
  return { id: crypto.randomUUID(), partnerGiven: "", partnerLast: "" };
}

export type SpouseNewFamilyExistingSearchSlot = { id: string; partnerGiven: string; partnerLast: string };

export function createSpouseNewFamilyExistingSearchSlot(): SpouseNewFamilyExistingSearchSlot {
  return { id: crypto.randomUUID(), partnerGiven: "", partnerLast: "" };
}
