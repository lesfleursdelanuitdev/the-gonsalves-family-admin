import { notFound } from "next/navigation";
import { WhatsNewEditForm } from "@/components/admin/whats-new/WhatsNewEditForm";

export default async function AdminWhatsNewEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit update</h1>
        <p className="text-sm text-muted-foreground">Modify the content or publish status of this update.</p>
      </div>
      <WhatsNewEditForm postId={id} mode="edit" />
    </div>
  );
}
