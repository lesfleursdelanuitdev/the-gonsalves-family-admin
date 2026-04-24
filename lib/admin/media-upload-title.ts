/** Default media title from an uploaded file’s original name (basename without extension). */
export function titleFromUploadedFilename(originalName: string): string {
  const base = originalName.trim().replace(/^.*[/\\]/, "");
  const noExt = base.replace(/\.[^.]+$/, "");
  return (noExt || base || "Uploaded media").trim();
}
