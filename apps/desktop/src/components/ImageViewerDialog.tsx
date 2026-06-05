import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Attachment } from "@/lib/types";

interface Props {
  attachment: Attachment | null;
  onOpenChange: (open: boolean) => void;
}

export function ImageViewerDialog({ attachment, onOpenChange }: Props) {
  const open = attachment !== null;
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex max-h-[calc(100vh-32px)] w-auto max-w-[calc(100vw-32px)] flex-col gap-3 border-0 bg-transparent p-0 shadow-none sm:max-w-[calc(100vw-32px)]"
        showCloseButton
      >
        {attachment && (
          <figure className="flex flex-col items-center gap-2">
            <img
              alt={attachment.originalName}
              className="max-h-[calc(100vh-120px)] max-w-[calc(100vw-32px)] rounded-md object-contain"
              src={convertFileSrc(attachment.path)}
            />
            <DialogTitle className="sr-only">
              {attachment.originalName}
            </DialogTitle>
            <DialogDescription className="rounded-md bg-background/80 px-3 py-1 text-center text-xs text-foreground backdrop-blur">
              {attachment.originalName}
            </DialogDescription>
          </figure>
        )}
      </DialogContent>
    </Dialog>
  );
}
