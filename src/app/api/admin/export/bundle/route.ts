import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { buildEnrichedDocumentForExport } from "@/lib/admin/build-enriched-document-for-export";
import { sanitizeExportBasename } from "@/lib/admin/export-filename";
import { startExportBundleZipStream } from "@/lib/admin/stream-export-bundle-zip";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

/** Large trees / many media files can take several minutes to stream. */
export const maxDuration = 300;

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  const { searchParams } = req.nextUrl;
  const basename = sanitizeExportBasename(
    searchParams.get("filename"),
    "tree-export",
  );

  const fileUuid = await getAdminFileUuid();
  const enriched = await buildEnrichedDocumentForExport(fileUuid);

  const pass = startExportBundleZipStream({ enriched, basename, treeId: fileUuid });
  const webStream = Readable.toWeb(pass) as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${basename}-bundle.zip"`,
      "Cache-Control": "no-store",
    },
  });
});
