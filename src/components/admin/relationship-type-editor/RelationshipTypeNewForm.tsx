"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ArrowLeft, ArrowLeftRight, ChevronDown, ChevronUp, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/infra/api";
import { useCreateRelationshipType } from "@/hooks/useAdminRelationshipTypes";

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function keyFromLabel(label: string): string {
  return normalizeKey(label.replace(/\s+/g, "_"));
}

// ─── types ──────────────────────────────────────────────────────────────────

interface RoleDraft {
  id: string; // stable local id for React keys
  label: string;
  key: string;
  keyManuallyEdited: boolean;
  reciprocalId: string; // local id of the reciprocal role ("self" for symmetric self-reference)
}

interface FormState {
  label: string;
  key: string;
  keyManuallyEdited: boolean;
  description: string;
  isSymmetric: boolean;
  gedcomRelaAtoB: string;
  gedcomRelaBtoA: string;
  roles: RoleDraft[];
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function initialState(): FormState {
  const aId = makeId();
  const bId = makeId();
  return {
    label: "",
    key: "",
    keyManuallyEdited: false,
    description: "",
    isSymmetric: false,
    gedcomRelaAtoB: "",
    gedcomRelaBtoA: "",
    roles: [
      { id: aId, label: "", key: "", keyManuallyEdited: false, reciprocalId: bId },
      { id: bId, label: "", key: "", keyManuallyEdited: false, reciprocalId: aId },
    ],
  };
}

function symmetricState(): FormState {
  const selfId = makeId();
  return {
    label: "",
    key: "",
    keyManuallyEdited: false,
    description: "",
    isSymmetric: true,
    gedcomRelaAtoB: "",
    gedcomRelaBtoA: "",
    roles: [{ id: selfId, label: "", key: "", keyManuallyEdited: false, reciprocalId: selfId }],
  };
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-base-content/10 bg-card/60 p-5 shadow-sm sm:p-6", className)}>
      {children}
    </section>
  );
}

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-destructive">{message}</p>;
}

function DirectionalityCard({
  selected,
  value,
  title,
  description,
  detail,
  onClick,
}: {
  selected: boolean;
  value: boolean;
  title: string;
  description: string;
  detail: string;
  onClick: () => void;
}) {
  void value;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border px-4 py-4 text-left transition-colors",
        selected
          ? "border-primary/45 bg-primary/10 ring-1 ring-primary/20"
          : "border-base-content/12 bg-base-100/60 hover:border-base-content/22",
      )}
      aria-pressed={selected}
    >
      <p className={cn("text-sm font-semibold", selected ? "text-primary" : "text-foreground")}>{title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      <p className="mt-2 text-xs text-muted-foreground/75">{detail}</p>
    </button>
  );
}

// ─── roles editor ────────────────────────────────────────────────────────────

function RoleRow({
  role,
  allRoles,
  isSymmetric,
  isOnly,
  onUpdate,
  onRemove,
}: {
  role: RoleDraft;
  allRoles: RoleDraft[];
  isSymmetric: boolean;
  isOnly: boolean;
  onUpdate: (patch: Partial<RoleDraft>) => void;
  onRemove: () => void;
}) {
  const reciprocalRole = allRoles.find((r) => r.id === role.reciprocalId);
  const reciprocalLabel = reciprocalRole
    ? reciprocalRole.id === role.id
      ? "This role (self-referential)"
      : reciprocalRole.label.trim() || `Role (key: ${reciprocalRole.key || "—"})`
    : "—";

  return (
    <div className="rounded-lg border border-base-content/10 bg-base-100/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`role-label-${role.id}`}>Display label</Label>
          <FieldHint>What this person is called in this relationship, e.g. <em>Godparent</em> or <em>Godchild</em>. Shown next to the person's name in the relationship panel.</FieldHint>
          <Input
            id={`role-label-${role.id}`}
            value={role.label}
            onChange={(e) => {
              const lbl = e.target.value;
              onUpdate({
                label: lbl,
                key: role.keyManuallyEdited ? role.key : keyFromLabel(lbl),
              });
            }}
            placeholder={isSymmetric ? "e.g. Partner" : "e.g. Godparent"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`role-key-${role.id}`}>
            Key <span className="ml-1 text-xs font-normal text-muted-foreground">(auto-generated)</span>
          </Label>
          <FieldHint>Stable identifier for this role used in exports and the API. Lowercase letters, numbers, and underscores only. Auto-filled from the label.</FieldHint>
          <Input
            id={`role-key-${role.id}`}
            value={role.key}
            onChange={(e) => onUpdate({ key: e.target.value, keyManuallyEdited: true })}
            onBlur={() => onUpdate({ key: normalizeKey(role.key) })}
            placeholder="e.g. godparent"
            className="font-mono text-sm"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeftRight className="size-4 shrink-0" aria-hidden />
          <span>
            Counterpart:{" "}
            <span className={cn("font-medium", reciprocalRole ? "text-foreground" : "text-destructive")}>
              {reciprocalLabel}
            </span>
          </span>
        </div>
        {!isSymmetric && !isOnly ? (
          <button
            type="button"
            onClick={onRemove}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-8 gap-1.5 text-muted-foreground hover:text-destructive",
            )}
            aria-label="Remove role"
          >
            <Trash2 className="size-3.5" />
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ─── main form ───────────────────────────────────────────────────────────────

export function RelationshipTypeNewForm({ backHref = "/admin/relationship-types" }: { backHref?: string }) {
  const router = useRouter();
  const createType = useCreateRelationshipType();

  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [gedcomOpen, setGedcomOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const updateForm = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors({});
  }, []);

  const setSymmetric = useCallback((sym: boolean) => {
    setForm(sym ? symmetricState() : initialState());
    setErrors({});
  }, []);

  const updateRole = useCallback((id: string, patch: Partial<RoleDraft>) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    setErrors({});
  }, []);

  const addRole = useCallback(() => {
    const newId = makeId();
    setForm((prev) => ({
      ...prev,
      roles: [...prev.roles, { id: newId, label: "", key: "", keyManuallyEdited: false, reciprocalId: newId }],
    }));
  }, []);

  const removeRole = useCallback((id: string) => {
    setForm((prev) => {
      const remaining = prev.roles.filter((r) => r.id !== id);
      // If the removed role was someone's reciprocal, clear that link
      return {
        ...prev,
        roles: remaining.map((r) => (r.reciprocalId === id ? { ...r, reciprocalId: r.id } : r)),
      };
    });
  }, []);

  const setRoleReciprocal = useCallback((roleId: string, reciprocalId: string) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.map((r) => (r.id === roleId ? { ...r, reciprocalId } : r)),
    }));
    setErrors({});
  }, []);

  const validate = useCallback((): boolean => {
    const errs: Partial<Record<string, string>> = {};
    const key = normalizeKey(form.key);
    const label = form.label.trim();
    if (!label) errs.label = "Label is required.";
    if (!key) errs.key = "Key is required.";

    const roleRows = form.roles.map((r) => ({
      ...r,
      key: normalizeKey(r.key || keyFromLabel(r.label)),
      label: r.label.trim(),
    }));

    for (const [i, role] of roleRows.entries()) {
      if (!role.label) errs[`role-label-${role.id}`] = "Role label is required.";
      if (!role.key) errs[`role-key-${role.id}`] = "Role key is required.";
      const others = roleRows.filter((_, j) => j !== i);
      if (others.some((o) => o.key === role.key)) {
        errs[`role-key-${role.id}`] = "Role keys must be unique.";
      }
    }

    if (Object.keys(errs).length) {
      setErrors(errs);
      return false;
    }
    return true;
  }, [form]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      setSubmitting(true);
      try {
        const roleRows = form.roles.map((r) => ({
          key: normalizeKey(r.key || keyFromLabel(r.label)),
          label: r.label.trim(),
          reciprocalRoleKey: (() => {
            const recip = form.roles.find((x) => x.id === r.reciprocalId);
            if (!recip) return null;
            const recipKey = normalizeKey(recip.key || keyFromLabel(recip.label));
            return recipKey || null;
          })(),
        }));

        await createType.mutateAsync({
          key: normalizeKey(form.key),
          label: form.label.trim(),
          description: form.description.trim() || null,
          isSymmetric: form.isSymmetric,
          gedcomRelaAtoB: form.gedcomRelaAtoB.trim() || null,
          gedcomRelaBtoA: form.gedcomRelaBtoA.trim() || null,
          roles: roleRows,
        });
        toast.success(`Created "${form.label.trim()}".`);
        router.push(backHref);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not create relationship type.");
      } finally {
        setSubmitting(false);
      }
    },
    [form, validate, createType, router, backHref],
  );

  return (
    <div className="w-full space-y-6">
      {/* Page header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-base-content/10 pb-5">
        <div className="space-y-1">
          <Link
            href={backHref}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-1 inline-flex gap-1.5 px-0")}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Relationship types
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">New relationship type</h1>
          <p className="text-sm text-muted-foreground">
            Define how two people are related — the roles they hold and how they refer to each other.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }))}>
            Cancel
          </Link>
          <button
            type="submit"
            form="relationship-type-form"
            className={cn(buttonVariants())}
            disabled={submitting}
          >
            {submitting ? "Creating…" : "Create type"}
          </button>
        </div>
      </header>

      <form id="relationship-type-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* ── Section 1: Identity ── */}
        <SectionCard>
          <SectionHeader
            icon={Link2}
            title="Type identity"
            description="The name and machine key for this relationship type. These appear in the UI, exports, and the API."
          />
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rt-label">Label</Label>
                <FieldHint>The human-readable name shown in the UI when editors pick or view this relationship type. Use a noun that describes the connection, e.g. <em>Godparenthood</em> or <em>Legal guardianship</em>.</FieldHint>
                <Input
                  id="rt-label"
                  value={form.label}
                  onChange={(e) => {
                    const lbl = e.target.value;
                    updateForm({
                      label: lbl,
                      key: form.keyManuallyEdited ? form.key : keyFromLabel(lbl),
                    });
                  }}
                  placeholder="e.g. Godparenthood"
                  aria-invalid={!!errors.label}
                  autoFocus
                />
                <FieldError message={errors.label ?? null} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rt-key">
                  Key <span className="ml-1 text-xs font-normal text-muted-foreground">(auto-generated)</span>
                </Label>
                <FieldHint>A stable machine identifier used in exports and the API. Must be lowercase letters, numbers, and underscores only — no spaces. Auto-filled from the label; edit only if you need a specific value.</FieldHint>
                <Input
                  id="rt-key"
                  value={form.key}
                  onChange={(e) => updateForm({ key: e.target.value, keyManuallyEdited: true })}
                  onBlur={() => updateForm({ key: normalizeKey(form.key) })}
                  placeholder="e.g. godparenthood"
                  className="font-mono text-sm"
                  aria-invalid={!!errors.key}
                />
                <FieldError message={errors.key ?? null} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt-description">Description <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
              <FieldHint>Explain when editors should use this relationship type and how it differs from similar ones. This text is shown as a tooltip or hint when someone picks a relationship type from the dropdown.</FieldHint>
              <textarea
                id="rt-description"
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                rows={2}
                className="flex min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="When should editors use this relationship type? Any notes about how it differs from similar types."
              />
            </div>
          </div>
        </SectionCard>

        {/* ── Section 2: Directionality ── */}
        <SectionCard>
          <SectionHeader
            icon={ArrowLeftRight}
            title="Directionality"
            description="Does this relationship look the same from both sides, or does each person hold a distinct role?"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <DirectionalityCard
              selected={!form.isSymmetric}
              value={false}
              title="Directional"
              description="Each person holds a different role."
              detail="Example: Godparenthood — one person is the godparent, the other is the godchild."
              onClick={() => setSymmetric(false)}
            />
            <DirectionalityCard
              selected={form.isSymmetric}
              value={true}
              title="Symmetric"
              description="Both people hold the same role."
              detail="Example: Business partnership — both parties are simply 'Partner'."
              onClick={() => setSymmetric(true)}
            />
          </div>
        </SectionCard>

        {/* ── Section 3: Roles ── */}
        <SectionCard>
          <SectionHeader
            icon={Link2}
            title="Roles"
            description={
              form.isSymmetric
                ? "Symmetric relationships use a single role — both people hold it equally."
                : "Define the two roles in this relationship. Each role must name its counterpart so the app knows how to display both sides."
            }
          />

          {form.isSymmetric ? (
            /* Symmetric: single role, clearly labelled */
            <div className="space-y-3">
              {form.roles.map((role) => (
                <div key={role.id} className="rounded-lg border border-base-content/10 bg-base-100/40 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`role-label-${role.id}`}>Role label</Label>
                      <FieldHint>What both people in this relationship are called, e.g. <em>Partner</em> or <em>Colleague</em>. Since the relationship is symmetric, both parties share this label.</FieldHint>
                      <Input
                        id={`role-label-${role.id}`}
                        value={role.label}
                        onChange={(e) => {
                          const lbl = e.target.value;
                          updateRole(role.id, {
                            label: lbl,
                            key: role.keyManuallyEdited ? role.key : keyFromLabel(lbl),
                          });
                        }}
                        placeholder="e.g. Partner"
                      />
                      <FieldError message={errors[`role-label-${role.id}`] ?? null} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`role-key-${role.id}`}>
                        Role key <span className="text-xs font-normal text-muted-foreground">(auto-generated)</span>
                      </Label>
                      <FieldHint>Stable machine identifier for this role. Lowercase, underscores only. Auto-filled from the label.</FieldHint>
                      <Input
                        id={`role-key-${role.id}`}
                        value={role.key}
                        onChange={(e) => updateRole(role.id, { key: e.target.value, keyManuallyEdited: true })}
                        onBlur={() => updateRole(role.id, { key: normalizeKey(role.key) })}
                        placeholder="e.g. partner"
                        className="font-mono text-sm"
                      />
                      <FieldError message={errors[`role-key-${role.id}`] ?? null} />
                    </div>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowLeftRight className="size-3.5 shrink-0" aria-hidden />
                    Both parties hold this role — it is its own counterpart.
                  </p>
                </div>
              ))}
            </div>
          ) : (
            /* Directional: role list with counterpart picker */
            <div className="space-y-3">
              {form.roles.length === 2 ? (
                /* Two-role layout: show them as a pair */
                <div className="space-y-2">
                  {form.roles.map((role) => (
                    <RoleRow
                      key={role.id}
                      role={role}
                      allRoles={form.roles}
                      isSymmetric={false}
                      isOnly={false}
                      onUpdate={(patch) => updateRole(role.id, patch)}
                      onRemove={() => removeRole(role.id)}
                    />
                  ))}
                  <p className="text-xs text-muted-foreground">
                    The counterpart is automatically set — each role in a two-role relationship is the other&apos;s counterpart.
                  </p>
                </div>
              ) : (
                /* Multi-role: show with explicit counterpart dropdowns */
                <div className="space-y-2">
                  {form.roles.map((role) => (
                    <div key={role.id} className="rounded-lg border border-base-content/10 bg-base-100/40 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`role-label-${role.id}`}>Display label</Label>
                          <FieldHint>What a person holding this role is called, e.g. <em>Godparent</em>. Shown next to their name in the relationship panel.</FieldHint>
                          <Input
                            id={`role-label-${role.id}`}
                            value={role.label}
                            onChange={(e) => {
                              const lbl = e.target.value;
                              updateRole(role.id, {
                                label: lbl,
                                key: role.keyManuallyEdited ? role.key : keyFromLabel(lbl),
                              });
                            }}
                            placeholder="e.g. Godparent"
                          />
                          <FieldError message={errors[`role-label-${role.id}`] ?? null} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`role-key-${role.id}`}>
                            Key <span className="text-xs font-normal text-muted-foreground">(auto)</span>
                          </Label>
                          <FieldHint>Stable machine identifier. Lowercase, underscores only. Auto-filled from the label.</FieldHint>
                          <Input
                            id={`role-key-${role.id}`}
                            value={role.key}
                            onChange={(e) => updateRole(role.id, { key: e.target.value, keyManuallyEdited: true })}
                            onBlur={() => updateRole(role.id, { key: normalizeKey(role.key) })}
                            placeholder="e.g. godparent"
                            className="font-mono text-sm"
                          />
                          <FieldError message={errors[`role-key-${role.id}`] ?? null} />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <ArrowLeftRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <Label htmlFor={`role-recip-${role.id}`} className="text-sm">Counterpart</Label>
                          <select
                            id={`role-recip-${role.id}`}
                            value={role.reciprocalId}
                            onChange={(e) => setRoleReciprocal(role.id, e.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {form.roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.label.trim() || `Role (${r.key || "unnamed"})`}
                                {r.id === role.id ? " (self)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRole(role.id)}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "h-8 gap-1.5 text-muted-foreground hover:text-destructive",
                          )}
                          aria-label="Remove role"
                        >
                          <Trash2 className="size-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {form.roles.length !== 2 ? (
                <button
                  type="button"
                  onClick={addRole}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                >
                  <Plus className="size-4" />
                  Add role
                </button>
              ) : null}
            </div>
          )}
        </SectionCard>

        {/* ── Section 4: GEDCOM (collapsible) ── */}
        <section className="rounded-xl border border-base-content/10 bg-card/60 shadow-sm">
          <button
            type="button"
            onClick={() => setGedcomOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left"
            aria-expanded={gedcomOpen}
          >
            <div>
              <p className="text-sm font-semibold">GEDCOM mapping</p>
              <p className="text-xs text-muted-foreground">Optional — only needed if you import/export GEDCOM files with custom RELA tags.</p>
            </div>
            {gedcomOpen
              ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              : <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            }
          </button>
          {gedcomOpen ? (
            <div className="border-t border-base-content/10 px-5 pb-5 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rt-gedcom-atob">RELA tag — A to B</Label>
                  <FieldHint>The GEDCOM <code>RELA</code> tag value written when person A holds the primary role toward person B (e.g. <code>godparent</code>). Only fill this if your GEDCOM files use a custom RELA tag for this relationship type.</FieldHint>
                  <Input
                    id="rt-gedcom-atob"
                    value={form.gedcomRelaAtoB}
                    onChange={(e) => updateForm({ gedcomRelaAtoB: e.target.value })}
                    placeholder="e.g. godparent"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rt-gedcom-btoa">RELA tag — B to A</Label>
                  <FieldHint>The GEDCOM <code>RELA</code> tag value written when person B holds the reciprocal role toward person A (e.g. <code>godchild</code>). Leave blank if A-to-B covers both directions.</FieldHint>
                  <Input
                    id="rt-gedcom-btoa"
                    value={form.gedcomRelaBtoA}
                    onChange={(e) => updateForm({ gedcomRelaBtoA: e.target.value })}
                    placeholder="e.g. godchild"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Mobile sticky footer */}
        <div className="flex justify-end gap-2 sm:hidden">
          <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }))}>Cancel</Link>
          <button type="submit" className={cn(buttonVariants())} disabled={submitting}>
            {submitting ? "Creating…" : "Create type"}
          </button>
        </div>
      </form>
    </div>
  );
}
