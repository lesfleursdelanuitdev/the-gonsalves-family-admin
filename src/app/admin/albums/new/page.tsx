"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { postJson } from "@/lib/infra/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const textareaClass = cn(
  "textarea textarea-bordered w-full min-h-[5.5rem] text-sm",
  "border-[color-mix(in_oklch,var(--color-base-content)_34%,var(--color-base-300))] app-light:border-[color-mix(in_oklch,var(--color-base-content)_26%,var(--color-base-300))]",
  "placeholder:text-base-content/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-50",
);

export default function AdminNewAlbumPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      toast.error("Name is required.");
      return;
    }
    setPending(true);
    try {
      await postJson<{ album: { id: string } }>("/api/admin/albums", {
        name: n,
        isPublic,
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "albums"] });
      toast.success("Album created.");
      router.push("/admin/albums");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create album.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href="/admin/albums"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex gap-1.5")}
      >
        <ArrowLeft className="size-4" />
        Albums
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New album</h1>
        <p className="text-muted-foreground">Create an album, then add media to it from the media editor.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-box border border-base-content/[0.08] bg-base-content/[0.02] p-6 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="album-name">Name</Label>
          <Input
            id="album-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Smith family photos"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="album-description">Description (optional)</Label>
          <textarea
            id="album-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short note about this album"
            rows={3}
            className={textareaClass}
          />
        </div>
        <div className="flex items-start gap-3 rounded-md border border-base-content/10 p-3">
          <Checkbox
            id="album-public"
            checked={isPublic}
            onCheckedChange={(v) => setIsPublic(v === true)}
          />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="album-public" className="cursor-pointer font-medium">
              Public album
            </Label>
            <p className="text-xs text-muted-foreground">
              Public names must be unique on your account. Leave unchecked for a personal album (duplicate names allowed).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create album"}
          </Button>
          <Link href="/admin/albums" className={cn(buttonVariants({ variant: "outline" }))}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
