"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Search, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCreateUser,
  useUpdateUserRole,
  useCreateUserLink,
  type CreateUserResponse,
} from "@/hooks/useAdminUsers";
import { useAdminIndividuals, type AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import { ApiError } from "@/lib/infra/api";
import { formatDisplayNameFromNameForms } from "@/lib/gedcom/display-name";

type RoleValue = "owner" | "maintainer" | "contributor" | "none";

const ROLES: { value: RoleValue; label: string; description: string }[] = [
  { value: "none", label: "None", description: "No tree role" },
  { value: "contributor", label: "Contributor", description: "Can author content" },
  { value: "maintainer", label: "Maintainer", description: "Can manage content and add contributors" },
  { value: "owner", label: "Owner", description: "Full control of the tree" },
];

const initialForm = {
  username: "",
  email: "",
  password: "",
  name: "",
  role: "none" as RoleValue,
  individualXref: "",
  individualName: "",
};

export default function NewUserPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [individualSearch, setIndividualSearch] = useState("");
  const createUser = useCreateUser();
  const updateRole = useUpdateUserRole();
  const createLink = useCreateUserLink();

  const { data: individualsData } = useAdminIndividuals({
    q: individualSearch.trim() || undefined,
    limit: 20,
    offset: 0,
  });
  const individuals = useMemo(() => {
    const list = (individualsData?.individuals ?? []) as AdminIndividualListItem[];
    return list.map((ind) => ({
      id: ind.id,
      xref: ind.xref ?? "",
      displayName: formatDisplayNameFromNameForms(ind.individualNameForms, ind.fullName),
    }));
  }, [individualsData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const role = form.role;
    const individualXref = form.individualXref.trim() || undefined;

    createUser.mutate(
      {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim() || undefined,
      },
      {
        onSuccess: async (data: CreateUserResponse) => {
          const userId = data.user.id;
          try {
            if (role && role !== "none") {
              await updateRole.mutateAsync({ id: userId, role });
            }
            if (individualXref) {
              await createLink.mutateAsync({ userId, individualXref });
            }
            router.push("/admin/users");
          } catch (err) {
            createUser.reset();
            updateRole.reset();
            createLink.reset();
            console.error("Role/link setup failed:", err);
          }
        },
      }
    );
  };

  const errorMessage =
    createUser.error?.message ||
    updateRole.error?.message ||
    createLink.error?.message;
  const errorStatus =
    createUser.error instanceof ApiError
      ? createUser.error.status
      : updateRole.error instanceof ApiError
        ? updateRole.error.status
        : createLink.error instanceof ApiError
          ? createLink.error.status
          : undefined;
  const isPending = createUser.isPending || updateRole.isPending || createLink.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/users"
          aria-label="Back to users"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add user</h1>
          <p className="text-muted-foreground">
            Create a new account. Username and email must be unique.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md space-y-6">
        {errorMessage && (
          <p className="text-sm text-destructive">
            {errorMessage}
            {errorStatus != null && ` (${errorStatus})`}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="add-user-username">Username *</Label>
          <Input
            id="add-user-username"
            required
            autoComplete="username"
            value={form.username}
            onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
            placeholder="jane"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-user-email">Email *</Label>
          <Input
            id="add-user-email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="jane@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-user-password">Password *</Label>
          <div className="relative">
            <Input
              id="add-user-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="••••••••"
              className="pr-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((p) => !p)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-user-name">Display name (optional)</Label>
          <Input
            id="add-user-name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Jane Doe"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="add-user-role">Tree role</Label>
          <select
            id="add-user-role"
            value={form.role}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, role: e.target.value as RoleValue }))
            }
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label} — {r.description}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Link to individual (optional)</Label>
          {form.individualXref ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="flex-1">
                {form.individualName || form.individualXref} ({form.individualXref})
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Clear link"
                onClick={() =>
                  setForm((prev) => ({ ...prev, individualXref: "", individualName: "" }))
                }
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={individualSearch}
                  onChange={(e) => setIndividualSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <ul className="max-h-[100px] overflow-auto rounded-lg border border-border">
                {individuals.length === 0 && (
                  <li className="px-3 py-2 text-sm text-muted-foreground">
                    {individualSearch.trim() ? "No individuals found." : "Type to search individuals."}
                  </li>
                )}
                {individuals.map((ind) => (
                  <li key={ind.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          individualXref: ind.xref,
                          individualName: ind.displayName,
                        }))
                      }
                    >
                      {ind.displayName} ({ind.xref})
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin/users"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Cancel
          </Link>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create user"}
          </Button>
        </div>
      </form>
    </div>
  );
}
