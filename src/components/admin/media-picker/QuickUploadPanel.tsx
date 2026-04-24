"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuickUploadPanel({
  disabled,
  busy,
  onFiles,
  className,
}: {
  disabled?: boolean;
  busy?: boolean;
  onFiles: (files: FileList | null) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn(className)}>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept="image/*,.pdf,.doc,.docx,application/pdf"
        multiple
        disabled={disabled || busy}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 sm:w-auto"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={18} className="shrink-0" aria-hidden />
        Quick upload
      </Button>
    </div>
  );
}
