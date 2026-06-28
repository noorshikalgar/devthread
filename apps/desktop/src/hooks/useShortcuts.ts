import { useEffect, useRef } from "react";

function isDialogOpen(): boolean {
  return Array.from(document.querySelectorAll('[role="dialog"]')).some(
    (el) => el.getAttribute("data-state") !== "closed",
  );
}

export interface ShortcutConfig {
  isTaskOpen: boolean;
  onTogglePalette: () => void;
  onToggleSettings: () => void;
  onNewTask: () => void;
  onNewFolder: () => void;
  onToggleSidebar: () => void;
  onToggleArchive: () => void;
  onOpenWorklog: () => void;
  onOpenReleases: () => void;
  onEditTitle: () => void;
  onOpenLogTime: () => void;
  onCopyMarkdown: () => void;
  onCopyCsv: () => void;
  onArchiveToggle: () => void;
  onDeleteTask: () => void;
  onToggleComposerVisibility: () => void;
  onFocusSearch: () => void;
  onNextTask: () => void;
  onPrevTask: () => void;
}

export function useShortcuts(config: ShortcutConfig) {
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    function handle(event: KeyboardEvent) {
      const c = configRef.current;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (isDialogOpen()) return;

      if (!event.shiftKey && !event.altKey) {
        switch (event.key.toLowerCase()) {
          case "f":
            if (c.isTaskOpen) {
              event.preventDefault();
              c.onFocusSearch();
            }
            return;
        }
        switch (event.key.toLowerCase()) {
          case "k":
            event.preventDefault();
            c.onTogglePalette();
            return;
          case ",":
            event.preventDefault();
            c.onToggleSettings();
            return;
          case "n":
            event.preventDefault();
            c.onNewTask();
            return;
          case "b":
            event.preventDefault();
            c.onToggleSidebar();
            return;
          case "e":
            if (c.isTaskOpen) {
              event.preventDefault();
              c.onEditTitle();
            }
            return;
          case "l":
            if (c.isTaskOpen) {
              event.preventDefault();
              c.onOpenLogTime();
            }
            return;
        }
        if (event.key === "Backspace" && c.isTaskOpen) {
          event.preventDefault();
          c.onArchiveToggle();
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          c.onNextTask();
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          c.onPrevTask();
          return;
        }
      }

      if (event.shiftKey && !event.altKey) {
        switch (event.key.toLowerCase()) {
          case "n":
            event.preventDefault();
            c.onNewFolder();
            return;
          case "a":
            event.preventDefault();
            c.onToggleArchive();
            return;
          case "w":
            event.preventDefault();
            c.onOpenWorklog();
            return;
          case "r":
            event.preventDefault();
            c.onOpenReleases();
            return;
          case "c":
            if (c.isTaskOpen) {
              event.preventDefault();
              c.onCopyMarkdown();
            }
            return;
          case "e":
            if (c.isTaskOpen) {
              event.preventDefault();
              c.onCopyCsv();
            }
            return;
          case "p":
            event.preventDefault();
            c.onToggleComposerVisibility();
            return;
          case "backspace":
            if (c.isTaskOpen) {
              event.preventDefault();
              c.onDeleteTask();
            }
            return;
        }
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
}
