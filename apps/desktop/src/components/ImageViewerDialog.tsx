import { convertFileSrc } from "@tauri-apps/api/core";
import {
  ArrowCounterClockwise as RotateCcw,
  X,
  MagnifyingGlassPlus as ZoomIn,
  MagnifyingGlassMinus as ZoomOut,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/lib/types";

interface Props {
  attachment: Attachment | null;
  onOpenChange: (open: boolean) => void;
}

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;

export function ImageViewerDialog({ attachment, onOpenChange }: Props) {
  const open = attachment !== null;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [open]);

  useEffect(() => {
    if (!dragging) return;
    function handleUp() {
      setDragging(false);
      dragStart.current = null;
    }
    window.addEventListener("mouseup", handleUp);
    return () => window.removeEventListener("mouseup", handleUp);
  }, [dragging]);

  function clampZoom(value: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const direction = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setZoom((current) => clampZoom(current + direction));
  }

  function onMouseDown(event: React.MouseEvent<HTMLImageElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    setDragging(true);
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  }

  function onMouseMove(event: React.MouseEvent<HTMLImageElement>) {
    const start = dragStart.current;
    if (!start) return;
    setPan({
      x: start.panX + (event.clientX - start.x),
      y: start.panY + (event.clientY - start.y),
    });
  }

  function zoomIn() {
    setZoom((current) => clampZoom(current + ZOOM_STEP));
  }

  function zoomOut() {
    setZoom((current) => clampZoom(current - ZOOM_STEP));
  }

  function reset() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="left-0 top-0 flex h-dvh max-h-none w-dvw max-w-none translate-x-0 translate-y-0 items-center justify-center overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-none sm:rounded-none"
        showCloseButton={false}
      >
        {attachment && (
          <figure className="relative flex h-full w-full items-center justify-center">
            <div
              className="flex h-full w-full items-center justify-center overflow-hidden px-4 pb-20 pt-4"
              onWheel={onWheel}
            >
              <img
                alt={attachment.originalName}
                className={cn(
                  "max-h-full max-w-full object-contain select-none",
                  zoom > 1
                    ? dragging
                      ? "cursor-grabbing"
                      : "cursor-grab"
                    : "",
                )}
                draggable={false}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                src={convertFileSrc(attachment.path)}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                }}
              />
            </div>
            <DialogClose
              aria-label="Close image viewer"
              className="fixed right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md ring-1 ring-border backdrop-blur transition-colors hover:bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <X className="h-4 w-4" />
            </DialogClose>
            <figcaption className="fixed bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-md bg-background/85 px-2 py-1 shadow-lg ring-1 ring-border/70 backdrop-blur">
              <Button
                aria-label="Zoom out"
                onClick={zoomOut}
                size="icon-sm"
                variant="ghost"
              >
                <ZoomOut />
              </Button>
              <span className="min-w-12 text-center font-mono text-xs text-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                aria-label="Zoom in"
                onClick={zoomIn}
                size="icon-sm"
                variant="ghost"
              >
                <ZoomIn />
              </Button>
              <Button
                aria-label="Reset zoom"
                onClick={reset}
                size="sm"
                variant="ghost"
              >
                <RotateCcw />
                Reset
              </Button>
            </figcaption>
            <DialogTitle className="sr-only">
              {attachment.originalName}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Use the mouse wheel or the zoom controls to scale the image. Click
              and drag to pan when zoomed in.
            </DialogDescription>
          </figure>
        )}
      </DialogContent>
    </Dialog>
  );
}
