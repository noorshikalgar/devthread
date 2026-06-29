import {
  Warning as AlertTriangle,
  BracketsCurly as Braces,
  Calendar,
  Check,
  CaretRight as ChevronRight,
  Copy,
  ArrowSquareOut as ExternalLink,
  FileText,
  ListChecks,
  PushPin as Pin,
  PushPinSlash as PinOff,
  Plus,
  Asterisk as Regex,
  MagnifyingGlass as Search,
  Trash as Trash2,
  X,
} from "@phosphor-icons/react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import {
  buildReleaseContext,
  RELEASE_TEMPLATE_PLACEHOLDERS,
  renderReleaseTemplate,
} from "@/lib/releaseTemplate";
import { formatTaskTable, type TaskTableRow } from "@/lib/taskTable";
import { STATUS_DOT } from "@/lib/status";
import type { Folder, Release, ReleaseStatus, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

const RELEASE_SIDEBAR_WIDTH_KEY = "devthread:release-sidebar-width";
const RELEASE_SIDEBAR_TAB_KEY = "devthread:release-sidebar-tab";
const PINNED_RELEASES_KEY = "devthread:pinned-releases";
const DEFAULT_RELEASE_SIDEBAR_WIDTH = 320;
const MIN_RELEASE_SIDEBAR_WIDTH = 240;
const MAX_RELEASE_SIDEBAR_WIDTH = 420;
const RELEASE_STATUS_ORDER: ReleaseStatus[] = [
  "draft",
  "pre_release",
  "released",
];
const RELEASE_STATUS_LABEL: Record<ReleaseStatus, string> = {
  draft: "Draft",
  pre_release: "Pre-release",
  released: "Released",
};
const RELEASE_STATUS_DOT: Record<ReleaseStatus, string> = {
  draft: "bg-muted-foreground/50",
  pre_release: "bg-warning",
  released: "bg-success",
};

function loadPinnedReleaseNames(): string[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(PINNED_RELEASES_KEY) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter((name): name is string => typeof name === "string")
      : [];
  } catch {
    return [];
  }
}

function PlaceholderButton({
  snippet,
  description,
  onClick,
}: {
  snippet: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
      onClick={onClick}
      type="button"
    >
      <span className="font-mono text-[11px] text-foreground">
        {snippet.length > 40 ? `${snippet.slice(0, 40)}…` : snippet}
      </span>
      <span className="text-[10px] text-muted-foreground">{description}</span>
    </button>
  );
}

function ReleaseSidebarRow({
  dimmed = false,
  isPinned,
  onDelete,
  onPin,
  onSelect,
  release,
  selected,
}: {
  dimmed?: boolean;
  isPinned: boolean;
  onDelete: (release: Release) => void;
  onPin: (name: string) => void;
  onSelect: (name: string) => void;
  release: Release;
  selected: boolean;
}) {
  const row = (
    <button
      aria-current={selected ? "page" : undefined}
      className={cn(
        "group/release flex h-7 w-full min-w-0 items-center gap-2 rounded px-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground",
        selected && "bg-accent/70 text-foreground",
        dimmed &&
          "text-muted-foreground/65 hover:bg-accent/35 hover:text-muted-foreground",
        dimmed && selected && "bg-accent/45 text-muted-foreground",
      )}
      onClick={() => onSelect(release.name)}
      type="button"
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          dimmed ? "bg-muted-foreground/35" : RELEASE_STATUS_DOT[release.releaseStatus],
        )}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-normal text-current">
        {release.name}
        {release.version && (
          <span className="ml-1.5 text-xs text-muted-foreground/70">
            {release.version}
          </span>
        )}
      </span>
      <span className="hidden shrink-0 text-[10px] text-muted-foreground/70 group-hover/release:hidden sm:inline">
        {RELEASE_STATUS_LABEL[release.releaseStatus]}
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        <span
          aria-label={isPinned ? `Unpin ${release.name}` : `Pin ${release.name}`}
          className={cn(
            "hidden size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/release:flex group-hover/release:opacity-100 focus-visible:flex focus-visible:opacity-100",
            isPinned && "flex opacity-80 text-primary",
          )}
          onClick={(event) => {
            event.stopPropagation();
            onPin(release.name);
          }}
          role="button"
          tabIndex={0}
        >
          {isPinned ? (
            <PinOff className="size-3.5" />
          ) : (
            <Pin className="size-3.5" />
          )}
        </span>
        <span
          aria-label={`Delete ${release.name}`}
          className="hidden size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/release:flex group-hover/release:opacity-100 focus-visible:flex focus-visible:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(release);
          }}
          role="button"
          tabIndex={0}
        >
          <Trash2 className="size-3.5" />
        </span>
      </span>
    </button>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onSelect(release.name)}>
          <ExternalLink />
          Open
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onPin(release.name)}>
          {isPinned ? <PinOff /> : <Pin />}
          {isPinned ? "Unpin release" : "Pin release"}
        </ContextMenuItem>
        <ContextMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onSelect={() => onDelete(release)}
        >
          <Trash2 />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface HelpSectionProps {
  title: string;
  entries: ReadonlyArray<{
    label: string;
    syntax: string;
    description: string;
  }>;
}

function HelpSection({ title, entries }: HelpSectionProps) {
  return (
    <div>
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="space-y-1">
        {entries.map((entry) => (
          <div className="rounded px-2 py-1.5" key={entry.syntax}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-foreground">
                {entry.syntax}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {entry.label}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground/90">
              {entry.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TasksTabRowProps {
  disabled?: boolean;
  folderName: string;
  onOpen: () => void;
  onToggle: () => void;
  selected: boolean;
  task: Task;
}

const RELEASE_STATUS_BADGE: Record<Task["status"], string> = {
  planned: "border-border bg-muted/50 text-muted-foreground",
  active: "border-success/35 bg-success/10 text-success",
  blocked: "border-destructive/35 bg-destructive/10 text-destructive",
  paused: "border-info/35 bg-info/10 text-info",
  done: "border-border bg-muted/30 text-muted-foreground/70",
  archived: "border-border bg-muted/20 text-muted-foreground/50",
};

function TruncatedTaskTitle({ title }: { title: string }) {
  const titleRef = useRef<HTMLSpanElement>(null);
  const [tooltip, setTooltip] = useState<string | undefined>();

  useEffect(() => {
    const element = titleRef.current;
    if (!element) return;

    const updateTooltip = () => {
      setTooltip(element.scrollWidth > element.clientWidth ? title : undefined);
    };

    updateTooltip();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateTooltip);
      return () => window.removeEventListener("resize", updateTooltip);
    }

    const observer = new ResizeObserver(updateTooltip);
    observer.observe(element);
    return () => observer.disconnect();
  }, [title]);

  return (
    <span
      className="min-w-0 flex-1 truncate text-sm font-normal text-current"
      ref={titleRef}
      title={tooltip}
    >
      {title}
    </span>
  );
}

function TasksTabRow({
  disabled = false,
  folderName,
  onOpen,
  onToggle,
  selected,
  task,
}: TasksTabRowProps) {
  const row = (
    <div
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      aria-label={selected ? "Remove from release" : "Add to release"}
      className={cn(
        "group flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded border border-transparent px-2 text-muted-foreground transition-colors hover:border-border/60 hover:bg-accent/60 hover:text-foreground",
        selected && "bg-accent/60 text-foreground",
        disabled &&
          "cursor-default opacity-75 hover:bg-transparent hover:text-muted-foreground",
      )}
      onClick={() => {
        if (!disabled) onToggle();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      role="checkbox"
      tabIndex={disabled ? -1 : 0}
    >
      <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
        <span
          aria-hidden
          className={cn(
            "block size-3.5 rounded border border-border bg-background/70 transition-colors",
            !disabled && "group-hover:border-primary/70",
            selected && "border-primary bg-primary",
          )}
        />
        <Check
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 text-primary-foreground transition-opacity",
            selected ? "opacity-100" : "opacity-0",
          )}
          weight="bold"
        />
      </span>
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          STATUS_DOT[task.status],
        )}
        aria-hidden
      />
      <TruncatedTaskTitle title={task.title} />
      <span className="h-3 w-px shrink-0 bg-border/80" aria-hidden />
      <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <span className="max-w-32 truncate rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {folderName}
        </span>
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize",
            RELEASE_STATUS_BADGE[task.status],
          )}
        >
          {task.status}
        </span>
      </span>
      <button
        aria-label={`Open task: ${task.title}`}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100"
        data-testid="open-task-link"
        onClick={(e) => {
          // Don't let the row's own onClick also toggle selection.
          e.stopPropagation();
          onOpen();
        }}
        title="Open this task"
        type="button"
      >
        <ExternalLink className="size-3" />
      </button>
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onOpen}>
          <ExternalLink />
          Open task
        </ContextMenuItem>
        <ContextMenuItem disabled={disabled} onSelect={onToggle}>
          {selected ? <X /> : <Check />}
          {selected ? "Remove from release" : "Add to release"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function releaseMatchesSearch(release: Release, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return `${release.name} ${
    getReleaseStatus(release) === "released" ? "released published" : "draft"
  }`
    .toLowerCase()
    .includes(term);
}

function getReleaseStatus(release: Release): ReleaseStatus {
  return release.releaseStatus ?? (release.releasedAt ? "released" : "draft");
}

function formatSectionCount(count: number) {
  return String(count).padStart(2, "0");
}

interface ReleaseViewProps {
  folders: Folder[];
  onReleasesChanged: () => Promise<void>;
  onRemoveTaskTag: (taskId: string) => Promise<void>;
  onSelectTask: (id: string) => void;
  onTagTask: (taskId: string, name: string) => Promise<void>;
  releases: Release[];
  requestedReleaseName?: string | null;
  onRequestedReleaseNameHandled?: () => void;
  sidebarOpen?: boolean;
  tasks: Task[];
}

export function ReleaseView({
  folders,
  onReleasesChanged,
  onRemoveTaskTag,
  onSelectTask,
  onTagTask,
  releases,
  requestedReleaseName,
  onRequestedReleaseNameHandled,
  sidebarOpen = true,
  tasks,
}: ReleaseViewProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  useEffect(() => {
    if (!requestedReleaseName) return;
    setSelectedName(requestedReleaseName);
    const target = releases.find(
      (release) => release.name === requestedReleaseName,
    );
    if (target) {
      setSidebarTab(getReleaseStatus(target) === "released" ? "released" : "drafts");
    }
    onRequestedReleaseNameHandled?.();
  }, [requestedReleaseName, releases, onRequestedReleaseNameHandled]);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [releaseToDelete, setReleaseToDelete] = useState<Release | null>(null);
  const [confirmReleaseOpen, setConfirmReleaseOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [templateDraft, setTemplateDraft] = useState("");
  const [templateDirty, setTemplateDirty] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [placeholderOpen, setPlaceholderOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "notes">("tasks");
  const [notesPane, setNotesPane] = useState<"editor" | "preview">("editor");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [releaseSearch, setReleaseSearch] = useState("");
  const [sidebarTab, setSidebarTabState] = useState<"drafts" | "released">(
    () =>
      localStorage.getItem(RELEASE_SIDEBAR_TAB_KEY) === "released"
        ? "released"
        : "drafts",
  );
  function setSidebarTab(tab: "drafts" | "released") {
    setSidebarTabState(tab);
    localStorage.setItem(RELEASE_SIDEBAR_TAB_KEY, tab);
  }
  const [pinnedExpanded, setPinnedExpanded] = useState(true);
  const [pinnedReleaseNames, setPinnedReleaseNames] = useState<string[]>(
    loadPinnedReleaseNames,
  );
  const [selectedTasksExpanded, setSelectedTasksExpanded] = useState(false);
  const [availableTasksExpanded, setAvailableTasksExpanded] = useState(true);
  const [tasksSearch, setTasksSearch] = useState("");
  const [tasksUseRegex, setTasksUseRegex] = useState(false);
  const [tasksSearchInvalid, setTasksSearchInvalid] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clampReleaseSidebarWidth(
      Number(localStorage.getItem(RELEASE_SIDEBAR_WIDTH_KEY)),
    ),
  );
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const templateEditorRef = useRef<ReactCodeMirrorRef>(null);
  const newNameRef = useRef<HTMLInputElement>(null);
  const tasksSearchInputRef = useRef<HTMLInputElement>(null);

  async function reloadReleases() {
    try {
      await onReleasesChanged();
    } catch (cause) {
      toast.error(String(cause));
    }
  }

  useEffect(() => {
    if (!releases.length) {
      setSelectedName(null);
      return;
    }
    if (!selectedName || !releases.some((r) => r.name === selectedName)) {
      setSelectedName(
        (releases.find((release) => !release.releasedAt) ?? releases[0]).name,
      );
    }
  }, [releases, selectedName]);

  useEffect(() => {
    setPinnedReleaseNames((current) => {
      const releaseNames = new Set(releases.map((release) => release.name));
      const next = current.filter((name) => releaseNames.has(name));
      if (next.length === current.length) return current;
      localStorage.setItem(PINNED_RELEASES_KEY, JSON.stringify(next));
      return next;
    });
  }, [releases]);

  useEffect(() => {
    void reloadReleases();
    // Re-fetch releases from the backend whenever this view mounts so the
    // saved template (notes) is always loaded fresh, even if the App-level
    // releases state went stale (e.g. after navigating to a task and back).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRelease = useMemo(
    () => releases.find((r) => r.name === selectedName) ?? null,
    [releases, selectedName],
  );

  useEffect(() => {
    setTemplateDraft(selectedRelease?.descriptionMarkdown ?? "");
    setTemplateDirty(false);
    setNameDraft(selectedRelease?.name ?? "");
    setEditingName(false);
  }, [selectedRelease?.name]);

  useEffect(() => {
    if (selectedRelease && getReleaseStatus(selectedRelease) === "released") {
      setNotesPane("preview");
    }
  }, [selectedRelease]);

  // Restore the last-used tab so the user lands where they left off.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("devthread:release-active-tab");
    if (stored === "tasks" || stored === "notes") {
      setActiveTab(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("devthread:release-active-tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!selectedRelease || !templateDirty || savingTemplate) return;
    const timer = window.setTimeout(() => {
      void saveTemplate({ quiet: true });
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRelease?.name, templateDraft, templateDirty, savingTemplate]);

  // Validate regex input as the user types so we can show an error chip and
  // keep the available/selected lists unfiltered (rather than blanking out).
  useEffect(() => {
    if (!tasksUseRegex || !tasksSearch.trim()) {
      setTasksSearchInvalid(false);
      return;
    }
    try {
      new RegExp(tasksSearch, "i");
      setTasksSearchInvalid(false);
    } catch {
      setTasksSearchInvalid(true);
    }
  }, [tasksSearch, tasksUseRegex]);

  const folderNames = useMemo(
    () => new Map(folders.map((f) => [f.id, f.name])),
    [folders],
  );

  const taggedTasks = useMemo(
    () => tasks.filter((t) => t.releaseName === selectedName),
    [tasks, selectedName],
  );

  // Tasks tab: candidate set is every non-archived task. Search only filters
  // unassigned tasks because selected tasks should remain stable context.
  const candidateTasks = useMemo(
    () => tasks.filter((t) => t.status !== "archived"),
    [tasks],
  );
  const unassignedTasks = useMemo(
    () => candidateTasks.filter((t) => !t.releaseName),
    [candidateTasks],
  );

  const tasksMatcher = useMemo(() => {
    const term = tasksSearch.trim();
    if (!term) return (_title: string) => true;
    if (tasksUseRegex) {
      try {
        const expr = new RegExp(term, "i");
        return (title: string) => expr.test(title);
      } catch {
        return (_title: string) => true;
      }
    }
    const lower = term.toLowerCase();
    return (title: string) => title.toLowerCase().includes(lower);
  }, [tasksSearch, tasksUseRegex]);

  const filteredSelectedTasks = useMemo(() => taggedTasks, [taggedTasks]);
  const filteredAvailableTasks = useMemo(
    () => unassignedTasks.filter((t) => tasksMatcher(t.title)),
    [tasksMatcher, unassignedTasks],
  );
  const selectedReleaseStatus = selectedRelease
    ? getReleaseStatus(selectedRelease)
    : "draft";
  const releaseLocked = selectedReleaseStatus === "released";
  const effectiveNotesPane = releaseLocked ? "preview" : notesPane;
  const incompleteTaskCount = taggedTasks.filter(
    (task) => task.status !== "done",
  ).length;
  const canPublishRelease = taggedTasks.length > 0 && incompleteTaskCount === 0;
  const releaseBlockedReason =
    taggedTasks.length === 0
      ? "Release blocked: no tasks selected"
      : incompleteTaskCount > 0
        ? `Release blocked: ${incompleteTaskCount} task${
            incompleteTaskCount === 1 ? "" : "s"
          } not done`
        : null;
  const releaseStatusHint =
    selectedReleaseStatus === "released"
      ? selectedRelease?.releasedAt
        ? `Published ${formatDate(selectedRelease.releasedAt)}`
        : "Published and locked"
      : selectedReleaseStatus === "pre_release"
        ? "Final review"
        : "Collecting tasks";

  useEffect(() => {
    if (releaseLocked) {
      setSelectedTasksExpanded(true);
    }
  }, [releaseLocked]);

  const tableRows = useMemo<TaskTableRow[]>(
    () => taggedTasks.map((task) => ({ task })),
    [taggedTasks],
  );

  const taskTableMd = useMemo(
    () => formatTaskTable(tableRows, folderNames),
    [tableRows, folderNames],
  );

  const fullSummaryMd = useMemo(() => {
    if (!selectedRelease) return "";
    const ctx = buildReleaseContext({
      release: selectedRelease,
      notes: templateDraft,
      taskTableMd,
      tasks: taggedTasks,
      folderNames,
    });
    return renderReleaseTemplate(templateDraft, ctx);
  }, [selectedRelease, templateDraft, taskTableMd, taggedTasks, folderNames]);
  const editorExtensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      EditorView.theme(
        {
          "&": {
            backgroundColor: "hsl(var(--background))",
            color: "hsl(var(--foreground))",
            height: "100%",
            fontSize: "14px",
            userSelect: "text",
          },
          "&.cm-editor": {
            backgroundColor: "hsl(var(--background))",
            userSelect: "text",
          },
          ".cm-scroller": {
            backgroundColor: "hsl(var(--background))",
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            lineHeight: "1.5rem",
            userSelect: "text",
          },
          ".cm-content": {
            backgroundColor: "transparent",
            caretColor: "hsl(var(--primary))",
            color: "hsl(var(--foreground))",
            minHeight: "100%",
            padding: "20px 16px 20px 8px",
            userSelect: "text",
            WebkitUserSelect: "text",
          },
          ".cm-line": {
            padding: "0 2px",
          },
          ".cm-gutters": {
            backgroundColor: "hsl(var(--card))",
            borderRight: "1px solid hsl(var(--border) / 0.7)",
            color: "hsl(var(--muted-foreground) / 0.65)",
          },
          ".cm-gutter": {
            backgroundColor: "hsl(var(--card))",
          },
          ".cm-lineNumbers .cm-gutterElement": {
            minWidth: "2.25rem",
            padding: "0 8px 0 6px",
          },
          ".cm-activeLine, .cm-activeLineGutter": {
            backgroundColor: "transparent",
          },
          ".cm-cursor": {
            borderLeftColor: "hsl(var(--primary))",
          },
          ".cm-selectionBackground, .cm-selectionLayer .cm-selectionBackground":
            {
              backgroundColor: "rgba(75, 105, 165, 0.38) !important",
            },
          "&.cm-focused .cm-selectionBackground, &.cm-focused .cm-selectionLayer .cm-selectionBackground":
            {
              backgroundColor: "rgba(75, 105, 165, 0.55) !important",
            },
          ".cm-placeholder": {
            color: "hsl(var(--muted-foreground) / 0.7)",
          },
          "&.cm-focused": {
            outline: "none",
          },
        },
        { dark: true },
      ),
    ],
    [],
  );

  async function saveTemplate(options: { quiet?: boolean } = {}) {
    if (!selectedRelease || savingTemplate) return;
    setSavingTemplate(true);
    try {
      await api.updateRelease(selectedRelease.name, {
        descriptionMarkdown: templateDraft,
      });
      setTemplateDirty(false);
      await reloadReleases();
      if (!options.quiet) toast.success("Release notes saved");
    } catch (cause) {
      toast.error(String(cause));
    } finally {
      setSavingTemplate(false);
    }
  }

  async function copyReleaseMarkdown() {
    try {
      await navigator.clipboard.writeText(fullSummaryMd);
      toast.success("Release notes copied");
    } catch (cause) {
      toast.error(String(cause));
    }
  }

  function insertPlaceholder(snippet: string) {
    const view = templateEditorRef.current?.view;
    if (!view) {
      setTemplateDraft((current) =>
        current.length > 0 ? `${current}\n${snippet}` : snippet,
      );
      setTemplateDirty(true);
      return;
    }
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: snippet },
      selection: { anchor: from + snippet.length },
    });
    setTemplateDraft(view.state.doc.toString());
    setTemplateDirty(true);
    view.focus();
  }

  async function handleCreate() {
    const name = newNameRef.current?.value.trim();
    if (!name) return;
    setBusy(true);
    try {
      await api.createRelease(name, null);
      setNewDialogOpen(false);
      await reloadReleases();
      setSelectedName(name);
    } catch (cause) {
      toast.error(String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    if (!selectedRelease || getReleaseStatus(selectedRelease) === "released") {
      return;
    }
    const nextName = nameDraft.trim();
    if (!nextName || nextName === selectedRelease.name) {
      setEditingName(false);
      setNameDraft(selectedRelease.name);
      return;
    }
    setBusy(true);
    try {
      await api.updateRelease(selectedRelease.name, { newName: nextName });
      await reloadReleases();
      setSelectedName(nextName);
      setEditingName(false);
    } catch (cause) {
      toast.error(String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!releaseToDelete) return;
    const deletedName = releaseToDelete.name;
    setBusy(true);
    try {
      await api.deleteRelease(deletedName);
      setReleaseToDelete(null);
      setPinnedReleaseNames((current) => {
        const next = current.filter((name) => name !== deletedName);
        localStorage.setItem(PINNED_RELEASES_KEY, JSON.stringify(next));
        return next;
      });
      await reloadReleases();
    } catch (cause) {
      toast.error(String(cause));
    } finally {
      setBusy(false);
    }
  }

  function togglePinnedRelease(name: string) {
    setPinnedReleaseNames((current) => {
      const next = current.includes(name)
        ? current.filter((item) => item !== name)
        : [name, ...current];
      localStorage.setItem(PINNED_RELEASES_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function updateReleaseStatus(nextStatus: ReleaseStatus) {
    if (!selectedRelease) return;
    if (nextStatus === "released" && !canPublishRelease) {
      toast.error("All selected tasks must be done before release.");
      return;
    }
    setBusy(true);
    try {
      await api.updateRelease(selectedRelease.name, {
        releaseStatus: nextStatus,
        releasedAt: nextStatus === "released" ? new Date().toISOString() : null,
      });
      await reloadReleases();
    } catch (cause) {
      toast.error(String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleReleaseStatusChange(nextStatus: ReleaseStatus) {
    if (!selectedRelease) return;
    const current = getReleaseStatus(selectedRelease);
    if (current === "released" || nextStatus === current) return;
    if (nextStatus === "released") {
      if (!canPublishRelease) {
        toast.error("All selected tasks must be done before release.");
        return;
      }
      setConfirmReleaseOpen(true);
      return;
    }
    await updateReleaseStatus(nextStatus);
  }

  async function handleRemoveTag(taskId: string) {
    try {
      await onRemoveTaskTag(taskId);
    } catch (cause) {
      toast.error(String(cause));
    }
  }

  function startSidebarResize(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    setResizingSidebar(true);

    function move(pointer: globalThis.MouseEvent) {
      const nextWidth = clampReleaseSidebarWidth(
        startWidth + pointer.clientX - startX,
      );
      setSidebarWidth(nextWidth);
      localStorage.setItem(RELEASE_SIDEBAR_WIDTH_KEY, String(nextWidth));
    }

    function stop() {
      setResizingSidebar(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    }

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  }

  const releasesSorted = useMemo(
    () => [...releases].sort((a, b) => b.name.localeCompare(a.name)),
    [releases],
  );
  const draftReleases = useMemo(
    () =>
      releasesSorted.filter(
        (release) => getReleaseStatus(release) !== "released",
      ),
    [releasesSorted],
  );
  const releasedReleases = useMemo(
    () =>
      releasesSorted.filter(
        (release) => getReleaseStatus(release) === "released",
      ),
    [releasesSorted],
  );
  const searchActive = releaseSearch.trim().length > 0;
  const pinnedReleases = useMemo(() => {
    if (searchActive || !pinnedReleaseNames.length) return [];
    const releasesByName = new Map(
      releases.map((release) => [release.name, release]),
    );
    return pinnedReleaseNames
      .map((name) => releasesByName.get(name))
      .filter((release): release is Release => Boolean(release));
  }, [pinnedReleaseNames, releases, searchActive]);
  const filteredDraftReleases = useMemo(
    () =>
      draftReleases.filter((release) =>
        releaseMatchesSearch(release, releaseSearch),
      ),
    [draftReleases, releaseSearch],
  );
  const filteredReleasedReleases = useMemo(
    () =>
      releasedReleases.filter((release) =>
        releaseMatchesSearch(release, releaseSearch),
      ),
    [releasedReleases, releaseSearch],
  );

  return (
    <section className="flex min-h-0 flex-1 bg-background">
      {/* Left panel: release list */}
      <div
        className={cn(
          "relative h-full shrink-0 overflow-hidden border-r border-border transition-[width] duration-200 ease-out",
          !sidebarOpen && "border-r-0",
          resizingSidebar && "select-none transition-none",
        )}
        style={{ width: sidebarOpen ? sidebarWidth : 0 }}
      >
        <aside
          aria-hidden={!sidebarOpen}
          className="flex h-full min-h-0 flex-col bg-card/95 text-card-foreground"
          style={{ width: sidebarWidth }}
        >
          <div className="px-3.5 pb-4 pt-5">
            <div className="relative">
              {releaseSearch ? (
                <button
                  aria-label="Clear release search"
                  className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  onClick={() => setReleaseSearch("")}
                  type="button"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <Search
                  className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/80"
                />
              )}
              <Input
                aria-label="Search releases"
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                className="h-9 rounded-md border-border/80 bg-background/35 pl-3 pr-8 text-sm text-foreground shadow-inner shadow-black/5 placeholder:text-muted-foreground/75 focus-visible:border-ring/70"
                maxLength={80}
                name="devthread-release-search"
                onChange={(event) =>
                  setReleaseSearch(event.target.value.slice(0, 80))
                }
                placeholder="Search releases..."
                spellCheck={false}
                value={releaseSearch}
              />
            </div>
          </div>
          <div className="px-3.5 pb-3">
            <div
              aria-label="Release list filter"
              className="flex h-7 items-center rounded-md bg-muted/45 p-0.5"
              role="group"
            >
              {(["drafts", "released"] as const).map((tab) => (
                <button
                  aria-pressed={sidebarTab === tab}
                  className={cn(
                    "h-6 flex-1 rounded px-2 text-[11px] font-medium text-muted-foreground transition-all duration-fast ease-emphasized",
                    sidebarTab === tab
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:text-foreground",
                  )}
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  type="button"
                >
                  {tab === "drafts" ? "Drafts" : "Released"}
                </button>
              ))}
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
            <nav
              aria-label="Releases"
              className="flex w-full min-w-0 flex-col overflow-hidden px-3.5 pb-3"
            >
              {sidebarTab === "drafts" ? (
                <>
                  {!searchActive && pinnedReleases.length > 0 && (
                    <section aria-label="Pinned releases" className="mb-3">
                      <button
                        aria-expanded={pinnedExpanded}
                        className="mb-1 flex h-7 w-full min-w-0 items-center gap-1.5 rounded px-0.5 text-left text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        onClick={() => setPinnedExpanded((open) => !open)}
                        type="button"
                      >
                        <ChevronRight
                          aria-hidden
                          className={cn(
                            "size-3.5 shrink-0 transition-transform",
                            pinnedExpanded && "rotate-90",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          Pinned releases
                        </span>
                      </button>
                      {pinnedExpanded && (
                        <div className="flex min-w-0 flex-col gap-px overflow-hidden">
                          {pinnedReleases.map((release) => (
                            <ReleaseSidebarRow
                              dimmed={getReleaseStatus(release) === "released"}
                              isPinned={pinnedReleaseNames.includes(release.name)}
                              key={release.name}
                              onDelete={setReleaseToDelete}
                              onPin={togglePinnedRelease}
                              onSelect={setSelectedName}
                              release={release}
                              selected={selectedRelease?.name === release.name}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                  <div className="flex items-center justify-between gap-2 px-0.5 pb-1">
                    <span className="truncate text-[11px] font-semibold text-foreground">
                      {searchActive ? "Draft results" : "All Drafts"}
                    </span>
                    <Button
                      aria-label="New release"
                      className="size-5 shrink-0 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                      onClick={() => setNewDialogOpen(true)}
                      size="icon-sm"
                      title="New release"
                      type="button"
                      variant="ghost"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex min-w-0 flex-col gap-px overflow-hidden">
                    {filteredDraftReleases.map((release) => (
                      <ReleaseSidebarRow
                        isPinned={pinnedReleaseNames.includes(release.name)}
                        key={release.name}
                        onDelete={setReleaseToDelete}
                        onPin={togglePinnedRelease}
                        onSelect={setSelectedName}
                        release={release}
                        selected={selectedRelease?.name === release.name}
                      />
                    ))}
                  </div>
                  {!filteredDraftReleases.length && (
                    <div className="flex flex-col items-center gap-2 px-2 py-8 text-center text-xs text-muted-foreground">
                      <Calendar
                        className="size-5 opacity-60"
                      />
                      <span>
                        {draftReleases.length
                          ? searchActive
                            ? `No draft releases match “${releaseSearch.trim()}”.`
                            : "No draft releases yet."
                          : "No draft releases yet."}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="px-0.5 pb-1 text-[11px] font-semibold text-foreground">
                    {searchActive ? "Released results" : "All Released"}
                  </div>
                  <div className="flex min-w-0 flex-col gap-px overflow-hidden">
                    {filteredReleasedReleases.map((release) => (
                      <ReleaseSidebarRow
                        dimmed
                        isPinned={pinnedReleaseNames.includes(release.name)}
                        key={release.name}
                        onDelete={setReleaseToDelete}
                        onPin={togglePinnedRelease}
                        onSelect={setSelectedName}
                        release={release}
                        selected={selectedRelease?.name === release.name}
                      />
                    ))}
                  </div>
                  {!filteredReleasedReleases.length && (
                    <div className="flex flex-col items-center gap-2 px-2 py-8 text-center text-xs text-muted-foreground">
                      <Calendar
                        className="size-5 opacity-60"
                      />
                      <span>
                        {releasedReleases.length
                          ? `No released releases match “${releaseSearch.trim()}”.`
                          : "No released releases yet."}
                      </span>
                    </div>
                  )}
                </>
              )}
            </nav>
          </ScrollArea>
        </aside>
        {sidebarOpen && (
          <button
            aria-label="Resize release sidebar"
            className="absolute right-0 top-0 z-20 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40 focus-visible:bg-primary/50 focus-visible:outline-none"
            onDoubleClick={() => {
              setSidebarWidth(DEFAULT_RELEASE_SIDEBAR_WIDTH);
              localStorage.setItem(
                RELEASE_SIDEBAR_WIDTH_KEY,
                String(DEFAULT_RELEASE_SIDEBAR_WIDTH),
              );
            }}
            onMouseDown={startSidebarResize}
            type="button"
          />
        )}
      </div>

      {/* Right panel: release detail */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selectedRelease ? (
          <>
            <div className="border-b border-border px-6 py-4">
              <div className="min-w-0 space-y-1.5">
                {editingName ? (
                  <Input
                    aria-label="Release name"
                    className="h-8 w-full text-base font-semibold"
                    disabled={busy}
                    onBlur={() => void handleRename()}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setNameDraft(selectedRelease.name);
                        setEditingName(false);
                      }
                    }}
                    value={nameDraft}
                  />
                ) : (
                  <button
                    className={cn(
                      "block w-full truncate text-left text-base font-semibold text-foreground",
                      !releaseLocked && "hover:text-primary",
                    )}
                    disabled={releaseLocked}
                    onClick={() => {
                      if (releaseLocked) return;
                      setEditingName(true);
                    }}
                    title={
                      releaseLocked
                        ? "Released releases are locked"
                        : "Rename release"
                    }
                    type="button"
                  >
                    {selectedRelease.name}
                  </button>
                )}
                <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  {releaseLocked ? (
                    <span
                      aria-label={`Release status: ${RELEASE_STATUS_LABEL[selectedReleaseStatus]}.`}
                      className="inline-flex h-6 shrink-0 cursor-default items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 text-[11px] text-foreground"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 rounded-full",
                          RELEASE_STATUS_DOT[selectedReleaseStatus],
                        )}
                      />
                      <span className="font-medium">
                        {RELEASE_STATUS_LABEL[selectedReleaseStatus]}
                      </span>
                    </span>
                  ) : (
                    <Popover onOpenChange={setStatusOpen} open={statusOpen}>
                      <PopoverTrigger asChild>
                        <button
                          aria-label={`Release status: ${RELEASE_STATUS_LABEL[selectedReleaseStatus]}. Click to change.`}
                          className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 text-[11px] text-foreground hover:bg-accent"
                          disabled={busy}
                          title={
                            !canPublishRelease
                              ? "Release requires all selected tasks to be done"
                              : undefined
                          }
                          type="button"
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "size-1.5 rounded-full",
                              RELEASE_STATUS_DOT[selectedReleaseStatus],
                            )}
                          />
                          <span className="font-medium">
                            {RELEASE_STATUS_LABEL[selectedReleaseStatus]}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-44 p-1">
                        <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Status
                        </p>
                        {RELEASE_STATUS_ORDER.map((status) => {
                          const active = selectedReleaseStatus === status;
                          const disabled =
                            status === "released" && !canPublishRelease;
                          return (
                            <button
                              className={cn(
                                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-0",
                                active && "bg-accent",
                                disabled &&
                                  "cursor-not-allowed opacity-45 hover:bg-transparent",
                              )}
                              disabled={disabled}
                              key={status}
                              onClick={() => {
                                setStatusOpen(false);
                                void handleReleaseStatusChange(status);
                              }}
                              title={
                                disabled
                                  ? "All selected tasks must be done before release"
                                  : undefined
                              }
                              type="button"
                            >
                              <span
                                aria-hidden
                                className={cn(
                                  "size-1.5 rounded-full",
                                  RELEASE_STATUS_DOT[status],
                                )}
                              />
                              {RELEASE_STATUS_LABEL[status]}
                            </button>
                          );
                        })}
                      </PopoverContent>
                    </Popover>
                  )}
                  <span aria-hidden>·</span>
                  <span className="truncate">
                    {selectedReleaseStatus === "released" && (
                      <Calendar className="mr-1 inline size-3 align-text-top" />
                    )}
                    {releaseStatusHint}
                  </span>
                  {selectedReleaseStatus === "pre_release" &&
                    releaseBlockedReason && (
                      <span className="inline-flex min-w-0 items-center gap-1 rounded border border-warning/25 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                        <AlertTriangle
                          aria-hidden
                          className="size-3 shrink-0"
                        />
                        <span className="truncate">{releaseBlockedReason}</span>
                      </span>
                    )}
                </div>
              </div>
            </div>

            {/* Tab bar + tab content */}
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card/30 px-6">
                <div className="flex h-full items-center gap-1" role="tablist">
                  <button
                    aria-controls="release-tab-panel-tasks"
                    aria-selected={activeTab === "tasks"}
                    className={cn(
                      "relative inline-flex h-full items-center gap-1.5 px-3 text-xs font-medium transition-colors",
                      "after:absolute after:inset-x-2 after:bottom-[-1px] after:h-0.5 after:rounded-full after:transition-colors",
                      activeTab === "tasks"
                        ? "text-foreground after:bg-primary"
                        : "text-muted-foreground hover:text-foreground after:bg-transparent",
                    )}
                    onClick={() => setActiveTab("tasks")}
                    role="tab"
                    type="button"
                  >
                    <ListChecks className="size-3.5" />
                    Tasks
                    {taggedTasks.length > 0 && (
                      <span
                        className={cn(
                          "rounded px-1.5 text-[10px] font-medium",
                          activeTab === "tasks"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {taggedTasks.length}
                      </span>
                    )}
                  </button>
                  <button
                    aria-controls="release-tab-panel-notes"
                    aria-selected={activeTab === "notes"}
                    className={cn(
                      "relative inline-flex h-full items-center gap-1.5 px-3 text-xs font-medium transition-colors",
                      "after:absolute after:inset-x-2 after:bottom-[-1px] after:h-0.5 after:rounded-full after:transition-colors",
                      activeTab === "notes"
                        ? "text-foreground after:bg-primary"
                        : "text-muted-foreground hover:text-foreground after:bg-transparent",
                    )}
                    onClick={() => setActiveTab("notes")}
                    role="tab"
                    type="button"
                  >
                    <FileText className="size-3.5" />
                    Notes
                    {templateDirty && (
                      <span
                        aria-label="Unsaved changes"
                        className="size-1.5 rounded-full bg-primary"
                      />
                    )}
                  </button>
                </div>
                <div className="ml-auto flex h-full items-center gap-1.5">
                  {activeTab === "notes" && (
                    <>
                      {!releaseLocked && effectiveNotesPane === "editor" && (
                        <Popover
                          onOpenChange={setPlaceholderOpen}
                          open={placeholderOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              aria-label="Insert release variable"
                              className="h-7 px-2 text-[11px]"
                              size="sm"
                              title="Insert release variable"
                              type="button"
                              variant="ghost"
                            >
                              <Braces className="size-3.5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72 p-1">
                            <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Insert variable
                            </p>
                            <div className="space-y-0.5">
                              {RELEASE_TEMPLATE_PLACEHOLDERS.map((p) => (
                                <PlaceholderButton
                                  description={p.description}
                                  key={p.snippet}
                                  onClick={() => {
                                    insertPlaceholder(p.snippet);
                                    setPlaceholderOpen(false);
                                  }}
                                  snippet={p.snippet}
                                />
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                      <Button
                        aria-label="Copy release notes markdown"
                        className="h-7 px-2 text-[11px]"
                        disabled={!fullSummaryMd.trim()}
                        onClick={() => void copyReleaseMarkdown()}
                        size="sm"
                        title="Copy markdown"
                        type="button"
                        variant="ghost"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      {!releaseLocked && (
                        <div className="inline-flex h-7 items-center rounded-md border border-border bg-card/40 p-0.5 text-[11px]">
                          <button
                            aria-pressed={notesPane === "editor"}
                            className={cn(
                              "inline-flex h-6 items-center gap-1.5 rounded px-2.5 transition-colors",
                              notesPane === "editor"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                            onClick={() => setNotesPane("editor")}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            aria-pressed={notesPane === "preview"}
                            className={cn(
                              "inline-flex h-6 items-center gap-1.5 rounded px-2.5 transition-colors",
                              notesPane === "preview"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                            onClick={() => setNotesPane("preview")}
                            type="button"
                          >
                            Preview
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {templateDirty && (
                    <span className="text-[11px] text-muted-foreground">
                      {savingTemplate ? "Saving" : "Unsaved"}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                {/* Tasks tab */}
                {activeTab === "tasks" && (
                  <ScrollArea className="flex-1">
                    <div className="px-6 pb-8 pt-5">
                      {!releaseLocked && (
                        <div className="mb-4">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              aria-label="Search available tasks"
                              aria-invalid={tasksSearchInvalid || undefined}
                              className="h-8 pl-7 pr-9 text-xs"
                              onChange={(e) => setTasksSearch(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape" && tasksSearch) {
                                  e.preventDefault();
                                  setTasksSearch("");
                                }
                              }}
                              placeholder={
                                tasksUseRegex
                                  ? "Regex pattern (case-insensitive)"
                                  : "Search available tasks…"
                              }
                              ref={tasksSearchInputRef}
                              value={tasksSearch}
                            />
                            <button
                              aria-label={
                                tasksUseRegex
                                  ? "Disable regex search"
                                  : "Enable regex search"
                              }
                              aria-pressed={tasksUseRegex}
                              className={cn(
                                "absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                                tasksUseRegex &&
                                  "bg-primary/15 text-primary hover:bg-primary/20",
                                tasksSearchInvalid && "text-destructive",
                              )}
                              onClick={() => setTasksUseRegex((v) => !v)}
                              title={
                                tasksUseRegex
                                  ? "Disable regex search"
                                  : "Enable regex search"
                              }
                              type="button"
                            >
                              <Regex className="size-3.5" />
                            </button>
                          </div>
                          {tasksSearchInvalid && (
                            <p className="mt-1 text-[10px] text-destructive">
                              Invalid regex pattern.
                            </p>
                          )}
                        </div>
                      )}

                      <section
                        aria-label="Selected For Release"
                        className="contents"
                      >
                        <div className="sticky top-0 z-30 flex h-9 w-full bg-background">
                          <button
                            aria-expanded={selectedTasksExpanded}
                            className="flex h-full w-full min-w-0 items-center gap-2 rounded px-1.5 text-left text-[13px] font-semibold text-foreground hover:bg-accent/20 hover:text-foreground"
                            onClick={() =>
                              setSelectedTasksExpanded((expanded) => !expanded)
                            }
                            type="button"
                          >
                            <ChevronRight
                              className={cn(
                                "size-4 transition-transform duration-150 ease-out",
                                selectedTasksExpanded && "rotate-90",
                              )}
                            />
                            <span className="truncate">
                              Selected For Release
                            </span>
                            <span className="text-xs font-medium text-muted-foreground/75">
                              {formatSectionCount(filteredSelectedTasks.length)}
                            </span>
                          </button>
                        </div>
                        <div
                          aria-hidden={!selectedTasksExpanded}
                          className={cn(
                            "grid min-w-0 transition-[grid-template-rows,opacity,transform] duration-150 ease-out motion-reduce:transition-none",
                            selectedTasksExpanded
                              ? "grid-rows-[1fr] translate-y-0 opacity-100"
                              : "pointer-events-none grid-rows-[0fr] -translate-y-0.5 opacity-0",
                          )}
                        >
                          <div className="min-w-0 overflow-hidden pt-1">
                            {filteredSelectedTasks.length > 0 ? (
                              <div className="space-y-1">
                                {filteredSelectedTasks.map((task) => (
                                  <TasksTabRow
                                    folderName={
                                      folderNames.get(task.folderId ?? "") ??
                                      "No folder"
                                    }
                                    key={task.id}
                                    onOpen={() => onSelectTask(task.id)}
                                    onToggle={() =>
                                      void handleRemoveTag(task.id)
                                    }
                                    selected
                                    disabled={releaseLocked}
                                    task={task}
                                  />
                                ))}
                              </div>
                            ) : (
                              <p className="px-6 py-5 text-center text-xs text-muted-foreground">
                                {taggedTasks.length === 0
                                  ? "No tasks tagged yet. Use the checkboxes below to add some."
                                  : "No selected tasks match the search."}
                              </p>
                            )}
                          </div>
                        </div>
                      </section>

                      {!releaseLocked && (
                        <section
                          aria-label="Available Tasks"
                          className="contents"
                        >
                          <div className="sticky top-9 z-20 flex h-9 w-full bg-background">
                            <button
                              aria-expanded={availableTasksExpanded}
                              className="flex h-full w-full min-w-0 items-center gap-2 rounded px-1.5 text-left text-[13px] font-semibold text-foreground hover:bg-accent/20 hover:text-foreground"
                              onClick={() =>
                                setAvailableTasksExpanded(
                                  (expanded) => !expanded,
                                )
                              }
                              type="button"
                            >
                              <ChevronRight
                                className={cn(
                                  "size-4 transition-transform duration-150 ease-out",
                                  availableTasksExpanded && "rotate-90",
                                )}
                              />
                              <span className="truncate">Available Tasks</span>
                              <span className="text-xs font-medium text-muted-foreground/75">
                                {formatSectionCount(
                                  filteredAvailableTasks.length,
                                )}
                              </span>
                            </button>
                          </div>
                          <div
                            aria-hidden={!availableTasksExpanded}
                            className={cn(
                              "grid min-w-0 transition-[grid-template-rows,opacity,transform] duration-150 ease-out motion-reduce:transition-none",
                              availableTasksExpanded
                                ? "grid-rows-[1fr] translate-y-0 opacity-100"
                                : "pointer-events-none grid-rows-[0fr] -translate-y-0.5 opacity-0",
                            )}
                          >
                            <div className="min-w-0 overflow-hidden pt-1">
                              {filteredAvailableTasks.length > 0 ? (
                                <div className="space-y-1">
                                  {filteredAvailableTasks.map((task) => (
                                    <TasksTabRow
                                      folderName={
                                        folderNames.get(task.folderId ?? "") ??
                                        "No folder"
                                      }
                                      key={task.id}
                                      onOpen={() => onSelectTask(task.id)}
                                      onToggle={() =>
                                        void onTagTask(
                                          task.id,
                                          selectedRelease.name,
                                        )
                                      }
                                      selected={false}
                                      disabled={releaseLocked}
                                      task={task}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <p className="px-6 py-5 text-center text-xs text-muted-foreground">
                                  {tasksSearch.trim() || tasksUseRegex
                                    ? "No tasks match the search."
                                    : "No unassigned tasks available."}
                                </p>
                              )}
                            </div>
                          </div>
                        </section>
                      )}
                    </div>
                  </ScrollArea>
                )}

                {/* Notes tab */}
                {activeTab === "notes" && (
                  <div className="flex min-h-0 flex-1 flex-col">
                    {effectiveNotesPane === "editor" ? (
                      <div className="min-h-0 flex-1 select-text overflow-hidden bg-background">
                        <CodeMirror
                          aria-label="Release notes"
                          basicSetup={{
                            bracketMatching: true,
                            closeBrackets: true,
                            foldGutter: false,
                            highlightActiveLine: false,
                            highlightActiveLineGutter: false,
                            lineNumbers: true,
                          }}
                          className="h-full select-text"
                          editable={!releaseLocked}
                          extensions={editorExtensions}
                          height="100%"
                          onChange={(value) => {
                            setTemplateDraft(value);
                            setTemplateDirty(true);
                          }}
                          readOnly={releaseLocked}
                          ref={templateEditorRef}
                          theme="dark"
                          value={templateDraft}
                        />
                      </div>
                    ) : (
                      <ScrollArea className="min-h-0 flex-1">
                        <div className="markdown px-6 py-5">
                          {fullSummaryMd.trim() ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {fullSummaryMd}
                            </ReactMarkdown>
                          ) : (
                            <p className="text-muted-foreground">
                              Empty release notes.
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            Select a release to view details
          </div>
        )}
      </div>

      {/* New release dialog */}
      <Dialog onOpenChange={setNewDialogOpen} open={newDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New release</DialogTitle>
            <DialogDescription>
              Group tasks under a named release.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label
                className="mb-1 block text-xs font-medium"
                htmlFor="new-release-name"
              >
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="new-release-name"
                placeholder="e.g. UI refresh"
                ref={newNameRef}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setNewDialogOpen(false)}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={busy}
                onClick={() => void handleCreate()}
                type="button"
                variant="default"
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Publish release confirmation */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setConfirmReleaseOpen(false);
        }}
        open={confirmReleaseOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish release?</DialogTitle>
            <DialogDescription>
              This will publish <strong>{selectedRelease?.name}</strong> and
              lock its tasks and notes. You cannot move it back to draft after
              release.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setConfirmReleaseOpen(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                await updateReleaseStatus("released");
                setConfirmReleaseOpen(false);
              }}
              type="button"
              variant="default"
            >
              Release
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete release confirmation */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setReleaseToDelete(null);
        }}
        open={!!releaseToDelete}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete release</DialogTitle>
            <DialogDescription>
              This will delete <strong>{releaseToDelete?.name}</strong> and its
              notes. Tagged tasks will stay in DevThread and will only be
              detached from this release.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setReleaseToDelete(null)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() => void handleDelete()}
              type="button"
              variant="destructive"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function clampReleaseSidebarWidth(value: number) {
  if (!Number.isFinite(value) || value <= 0)
    return DEFAULT_RELEASE_SIDEBAR_WIDTH;
  const viewportLimit =
    typeof window === "undefined"
      ? MAX_RELEASE_SIDEBAR_WIDTH
      : Math.min(
          MAX_RELEASE_SIDEBAR_WIDTH,
          Math.floor(window.innerWidth * 0.42),
        );
  return Math.min(Math.max(value, MIN_RELEASE_SIDEBAR_WIDTH), viewportLimit);
}
