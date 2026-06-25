"use client";

import { useState, useEffect, useTransition, useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, Download, Trash2, Loader2 } from "lucide-react";

import {
  uploadAttachmentAction,
  getAttachmentSignedUrlAction,
  deleteAttachmentAction,
} from "@/server/actions/attachments";
import type { Attachment } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";

type AttachmentWithUploader = Attachment & { uploaderName: string };

type AttachmentPanelProps = {
  entity: string;
  entityId: string;
  initialAttachments: AttachmentWithUploader[];
  currentUserId: string;
  canAdminDelete: boolean;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPanel({
  entity,
  entityId,
  initialAttachments,
  currentUserId,
  canAdminDelete,
}: AttachmentPanelProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);
  const [state, formAction, isUploading] = useActionState(uploadAttachmentAction, null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      toast.success("File attached.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFileSizeError(null);
    } else if (state && !state.success) {
      toast.error(state.error);
    }
  }, [state, router]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.size > 10 * 1024 * 1024) {
      setFileSizeError("File must be 10 MB or smaller.");
      e.target.value = "";
    } else {
      setFileSizeError(null);
    }
  }

  function handleDownload(id: string) {
    startTransition(async () => {
      const result = await getAttachmentSignedUrlAction(id);
      if (result.success) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteAttachmentAction(id);
      if (result.success) {
        router.refresh();
        toast.success("Attachment deleted.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex items-end gap-3">
        <input type="hidden" name="entity" value={entity} />
        <input type="hidden" name="entityId" value={entityId} />
        <div className="flex-1 space-y-1.5">
          <label htmlFor="attachment-file" className="text-sm font-medium">
            Attach file (max 10 MB)
          </label>
          <input
            id="attachment-file"
            name="file"
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
          />
          {fileSizeError && (
            <p className="text-xs text-destructive">{fileSizeError}</p>
          )}
        </div>
        <Button type="submit" disabled={isUploading || !!fileSizeError} size="sm">
          {isUploading ? (
            <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Paperclip className="mr-2 size-3.5" aria-hidden="true" />
          )}
          {isUploading ? "Uploading…" : "Attach"}
        </Button>
      </form>

      {initialAttachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {initialAttachments.map((a) => {
            const canDelete = a.uploadedBy === currentUserId || canAdminDelete;
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(a.fileSize)} · {a.uploaderName} ·{" "}
                    {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Download ${a.fileName}`}
                    onClick={() => handleDownload(a.id)}
                    disabled={isPending}
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${a.fileName}`}
                      onClick={() => handleDelete(a.id)}
                      disabled={isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
