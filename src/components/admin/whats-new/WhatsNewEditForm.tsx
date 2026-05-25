"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { toast } from "sonner";
import { Globe, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fetchJson, putJson, ApiError } from "@/lib/infra/api";
import { WhatsNewRichTextEditor } from "./WhatsNewRichTextEditor";

interface WhatsNewPost {
  id: string;
  title: string;
  body: JSONContent;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  author: { id: string; name: string | null; username: string };
}

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export function WhatsNewEditForm({
  postId,
  mode,
}: {
  postId: string;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [post, setPost] = useState<WhatsNewPost | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState<JSONContent>(EMPTY_DOC);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchJson<{ post: WhatsNewPost }>(`/api/admin/whats-new/${encodeURIComponent(postId)}`)
      .then((data) => {
        setPost(data.post);
        setTitle(data.post.title === "Untitled update" && mode === "create" ? "" : data.post.title);
        setBody((data.post.body as JSONContent) ?? EMPTY_DOC);
        setPublished(data.post.status === "published");
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : "Could not load post.");
      })
      .finally(() => setLoading(false));
  }, [postId, mode]);

  const handleSave = async () => {
    if (!post) return;
    setSaving(true);
    setError(null);
    try {
      await putJson(`/api/admin/whats-new/${encodeURIComponent(postId)}`, {
        title: title.trim() || "Untitled update",
        body,
        status: published ? "published" : "draft",
      });
      toast.success(published ? "Published successfully." : "Saved as draft.");
      if (mode === "create") {
        router.replace(`/admin/whats-new/${encodeURIComponent(postId)}/edit`);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Could not save.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 py-8">
        <div className="h-9 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (error && !post) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-20">
      <div className="space-y-1.5">
        <Label htmlFor="wn-title">Title</Label>
        <Input
          id="wn-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. May update — new branches added"
          className="text-base font-medium"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Content</Label>
        <WhatsNewRichTextEditor
          editorKey={postId}
          value={body}
          onChange={setBody}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <Switch
            id="wn-publish"
            checked={published}
            onCheckedChange={setPublished}
          />
          <Label htmlFor="wn-publish" className="flex items-center gap-1.5 cursor-pointer">
            <Globe className="size-4 text-muted-foreground" />
            {published ? "Published — visible on the public site" : "Draft — not visible publicly"}
          </Label>
        </div>

        <div className="flex items-center gap-2">
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            onClick={() => void handleSave()}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Saving…" : published ? "Publish" : "Save draft"}
          </Button>
        </div>
      </div>

      {post?.author ? (
        <p className="text-xs text-muted-foreground">
          Author: {post.author.name ?? post.author.username}
          {post.publishedAt ? ` · Published ${new Date(post.publishedAt).toLocaleDateString()}` : ""}
        </p>
      ) : null}
    </div>
  );
}
