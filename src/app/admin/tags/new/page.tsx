"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { postJson } from "@/lib/infra/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AdminNewTagPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
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
      await postJson<{ tag: { id: string } }>("/api/admin/tags", {
        name: n,
        ...(color.trim() ? { color: color.trim().slice(0, 7) } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "tags"] });
      toast.success("Tag created.");
      router.push("/admin/tags");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create tag.";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        href="/admin/tags"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex gap-1.5")}
      >
        <ArrowLeft className="size-4" />
        Tags
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New tag</h1>
        <p className="text-muted-foreground">Create a personal tag for organizing media in the tree.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-box border border-base-content/[0.08] bg-base-content/[0.02] p-6 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="tag-name">Name</Label>
          <Input
            id="tag-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cemetery"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tag-color">Color (optional)</Label>
          <Input
            id="tag-color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#3b82f6"
            className="font-mono text-sm"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">Hex color, up to 7 characters including #.</p>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create tag"}
          </Button>
          <Link href="/admin/tags" className={cn(buttonVariants({ variant: "outline" }))}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
