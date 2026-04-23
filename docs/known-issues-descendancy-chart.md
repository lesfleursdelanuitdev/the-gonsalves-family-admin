# Known Issues with Descendancy Chart

This document tracks known limitations and planned work for the descendancy chart (tree viewer).

---

## 1. Non–birth children in unions

**Issue:** If a person is a child in a union but **not a birth child** (e.g. adopted, foster, other pedigree), we do not fully support that for:

- **Show siblings** (`showSiblings`)
- **Show parents** (`showParents` / `parents`)

Behavior and data for non-birth children in these flows are incomplete or incorrect.

**Planned:** Extend support for non-birth children in sibling and parent views (data, API, and UI).

---

## 2. Show parents endpoint

**Issue:** For the **Show parents** action (`parents`), we will need to add a **new API endpoint** (similar to the sibling-view endpoint). Currently there is no dedicated parents-view endpoint; the action may be using descendancy or other data in a way that doesn’t fully match the desired behavior.

**Planned:** Design and implement a parents-view (or equivalent) endpoint and wire the Show parents action to it.

---

## 3. Centering on spouse after open

**Issue:** Centering the view on a spouse **after opening** that spouse (single-spouse open from the spouse drawer) is **buggy**. Pan/zoom may not land correctly on the newly opened spouse card.

**Context:** We added “pan to opened spouse” and “pan to partner on close” using `centerOnPerson` and a pending-center effect; the open-spouse case still has edge cases or timing/layout issues.

**Planned:** Debug and fix the open-spouse centering (and any related close-spouse centering edge cases).

---

## 4. Tutorial option

**Issue:** We need to add a **tutorial option** for the descendancy chart (e.g. first-time or “how to use” guidance).

**Planned:** Define tutorial content and add a way to trigger it (e.g. menu item, first-visit prompt, or help panel).

---

## Summary

| # | Area | Issue | Status |
|---|------|--------|--------|
| 1 | Data / flows | Non–birth children not fully supported for showSiblings / showParents | Known |
| 2 | API | New endpoint needed for Show parents | Planned |
| 3 | UX | Centering on spouse after open is buggy | Known |
| 4 | UX | Tutorial option needed | Planned |
