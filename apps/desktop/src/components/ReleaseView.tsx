import {
  Braces,
  Calendar,
  Check,
  ChevronRight,
  Code,
  Copy,
  ExternalLink,
  FileText,
  Info,
  ListChecks,
  Pencil,
  Plus,
  Regex,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  defaultReleaseTemplate,
  RELEASE_TASK_FIELDS,
  RELEASE_TEMPLATE_BLOCKS,
  RELEASE_TEMPLATE_EXAMPLES,
  RELEASE_TEMPLATE_FILTERS,
  RELEASE_TEMPLATE_PLACEHOLDERS,
  RELEASE_TEMPLATE_TASK_VARIABLES,
  RELEASE_TEMPLATE_VARIABLES,
  renderReleaseTemplate,
} from "@/lib/releaseTemplate";
import { formatTaskTable, type TaskTableRow } from "@/lib/taskTable";
import { STATUS_DOT } from "@/lib/status";
import type { Folder, Release, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

const RELEASE_SIDEBAR_WIDTH_KEY = "devthread:release-sidebar-width";
const DEFAULT_RELEASE_SIDEBAR_WIDTH = 280;
const MIN_RELEASE_SIDEBAR_WIDTH = 240;
const MAX_RELEASE_SIDEBAR_WIDTH = 420;

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
  folderName: string;
  onOpen: () => void;
  onToggle: () => void;
  selected: boolean;
  task: Task;
}

function TasksTabRow({
  folderName,
  onOpen,
  onToggle,
  selected,
  task,
}: TasksTabRowProps) {
  return (
    <label
      className={cn(
        "group flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded border border-transparent px-2 text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground",
        selected && "bg-accent/60 text-foreground",
      )}
    >
      <span className="relative size-3.5 shrink-0">
        <input
          aria-label={selected ? "Remove from release" : "Add to release"}
          checked={selected}
          className="peer size-3.5 cursor-pointer appearance-none rounded border border-border bg-background/70 transition-colors checked:border-primary checked:bg-primary hover:border-primary/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onChange={onToggle}
          type="checkbox"
        />
        <Check
          aria-hidden
          className="pointer-events-none absolute left-0.5 top-0.5 size-2.5 text-primary-foreground opacity-0 peer-checked:opacity-100"
          strokeWidth={2.5}
        />
      </span>
      <span
        className="size-1.5 shrink-0 rounded-full"
        aria-hidden
        style={{ backgroundColor: STATUS_DOT[task.status] }}
      />
      <span className="min-w-0 flex-1 truncate">
        <span className="truncate text-sm font-normal text-current">
          {task.title}
        </span>
        <span className="ml-1.5 text-[10px] text-muted-foreground">
          {folderName} · {task.status}
        </span>
      </span>
      <button
        aria-label={`Open task: ${task.title}`}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100"
        data-testid="open-task-link"
        onClick={(e) => {
          // Don't let the surrounding <label> also fire its onChange.
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }}
        title="Open this task"
        type="button"
      >
        <ExternalLink className="size-3" />
      </button>
    </label>
  );
}

function releaseMatchesSearch(release: Release, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return `${release.name} ${release.version ?? ""} ${
    release.releasedAt ? "released published" : "draft"
  }`
    .toLowerCase()
    .includes(term);
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
  tasks: Task[];
}

export function ReleaseView({
  folders,
  onReleasesChanged,
  onRemoveTaskTag,
  onSelectTask,
  onTagTask,
  releases,
  tasks,
}: ReleaseViewProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [editVersionDialogOpen, setEditVersionDialogOpen] = useState(false);
  const [editVersion, setEditVersion] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [templateDraft, setTemplateDraft] = useState("");
  const [templateDirty, setTemplateDirty] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [previewTab, setPreviewTab] = useState<"preview" | "source" | "editor">(
    "preview",
  );
  const [placeholderOpen, setPlaceholderOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "notes">("tasks");
  const [releaseSearch, setReleaseSearch] = useState("");
  const [releasedExpanded, setReleasedExpanded] = useState(false);
  const [selectedTasksExpanded, setSelectedTasksExpanded] = useState(false);
  const [availableTasksExpanded, setAvailableTasksExpanded] = useState(true);
  const [tasksSearch, setTasksSearch] = useState("");
  const [tasksUseRegex, setTasksUseRegex] = useState(false);
  const [tasksSearchInvalid, setTasksSearchInvalid] = useState(false);
  const [notesPane, setNotesPane] = useState<"editor" | "preview">("editor");
  const [isWideLayout, setIsWideLayout] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clampReleaseSidebarWidth(
      Number(localStorage.getItem(RELEASE_SIDEBAR_WIDTH_KEY)),
    ),
  );
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const templateEditorRef = useRef<HTMLTextAreaElement>(null);
  const newVersionRef = useRef<HTMLInputElement>(null);
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
  }, [selectedRelease?.name]);

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

  // Watch the tab bar (or the right panel as a fallback) to decide whether
  // the notes tab has enough horizontal room to render editor + preview
  // side-by-side. Below ~720px the preview/editor become a toggle.
  useEffect(() => {
    if (typeof window === "undefined" || typeof ResizeObserver === "undefined")
      return;
    const target = tabBarRef.current;
    if (!target) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setIsWideLayout(width >= 720);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

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

  // Tasks tab: candidate set is every non-archived task, with a search/regex
  // filter on title + folder. The filter is applied to BOTH selected and
  // available sections so a search acts like "show me only matches here".
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

  const filteredSelectedTasks = useMemo(
    () => taggedTasks.filter((t) => tasksMatcher(t.title)),
    [taggedTasks, tasksMatcher],
  );
  const filteredAvailableTasks = useMemo(
    () => unassignedTasks.filter((t) => tasksMatcher(t.title)),
    [tasksMatcher, unassignedTasks],
  );

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

  async function copySummary() {
    if (!selectedRelease) return;
    try {
      await navigator.clipboard.writeText(fullSummaryMd);
      toast.success("Release summary copied");
    } catch (cause) {
      toast.error(String(cause));
    }
  }

  async function saveTemplate() {
    if (!selectedRelease || savingTemplate) return;
    setSavingTemplate(true);
    try {
      await api.updateRelease(selectedRelease.name, {
        descriptionMarkdown: templateDraft,
      });
      setTemplateDirty(false);
      await reloadReleases();
      toast.success("Template saved");
    } catch (cause) {
      toast.error(String(cause));
    } finally {
      setSavingTemplate(false);
    }
  }

  function insertPlaceholder(snippet: string) {
    const textarea = templateEditorRef.current;
    if (!textarea) {
      setTemplateDraft((current) =>
        current.length > 0 ? `${current}\n${snippet}` : snippet,
      );
      setTemplateDirty(true);
      return;
    }
    const start = textarea.selectionStart ?? templateDraft.length;
    const end = textarea.selectionEnd ?? templateDraft.length;
    const next =
      templateDraft.slice(0, start) + snippet + templateDraft.slice(end);
    setTemplateDraft(next);
    setTemplateDirty(true);
    // Restore the caret after React commits the new value.
    requestAnimationFrame(() => {
      const el = templateEditorRef.current;
      if (!el) return;
      const caret = start + snippet.length;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  async function handleCreate() {
    const name = newNameRef.current?.value.trim();
    const version = newVersionRef.current?.value.trim() || null;
    if (!name) return;
    setBusy(true);
    try {
      await api.createRelease(name, version);
      setNewDialogOpen(false);
      await reloadReleases();
      setSelectedName(name);
    } catch (cause) {
      toast.error(String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveVersion() {
    if (!selectedRelease) return;
    setBusy(true);
    try {
      const trimmed = editVersion?.trim();
      const newVersion = trimmed ? trimmed : null;
      await api.updateRelease(selectedRelease.name, { version: newVersion });
      setEditVersionDialogOpen(false);
      await reloadReleases();
    } catch (cause) {
      toast.error(String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!selectedRelease) return;
    setBusy(true);
    try {
      await api.deleteRelease(selectedRelease.name);
      setDeleteDialogOpen(false);
      await reloadReleases();
    } catch (cause) {
      toast.error(String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkReleased() {
    if (!selectedRelease) return;
    setBusy(true);
    try {
      const releasedAt = selectedRelease.releasedAt
        ? null
        : new Date().toISOString();
      await api.updateRelease(selectedRelease.name, { releasedAt });
      await reloadReleases();
    } catch (cause) {
      toast.error(String(cause));
    } finally {
      setBusy(false);
    }
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
    () => releasesSorted.filter((release) => !release.releasedAt),
    [releasesSorted],
  );
  const releasedReleases = useMemo(
    () => releasesSorted.filter((release) => release.releasedAt),
    [releasesSorted],
  );
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
  const searchActive = releaseSearch.trim().length > 0;

  return (
    <section className="flex min-h-0 flex-1 bg-background">
      {/* Left panel: release list */}
      <div
        className={cn(
          "relative h-full shrink-0 overflow-hidden border-r border-border",
          resizingSidebar && "select-none",
        )}
        style={{ width: sidebarWidth }}
      >
        <aside className="flex h-full min-h-0 flex-col bg-card/95 text-card-foreground">
          <div className="flex items-center justify-between gap-2 px-3.5 pb-3 pt-5">
            <div className="flex min-w-0 items-center gap-2 text-foreground/85">
              <Calendar
                className="size-4 shrink-0 text-current"
                strokeWidth={1.75}
              />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-medium text-current">
                  Releases
                </h1>
              </div>
            </div>
            <Button
              aria-label="New release"
              className="size-7 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
              onClick={() => setNewDialogOpen(true)}
              size="icon-sm"
              title="New release"
              type="button"
              variant="ghost"
            >
              <Plus strokeWidth={1.75} />
            </Button>
          </div>
          <div className="px-3.5 pb-4">
            <div className="relative">
              {releaseSearch ? (
                <button
                  aria-label="Clear release search"
                  className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  onClick={() => setReleaseSearch("")}
                  type="button"
                >
                  <X className="size-3.5" strokeWidth={1.75} />
                </button>
              ) : (
                <Search
                  className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/80"
                  strokeWidth={1.75}
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
          <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
            <nav
              aria-label="Releases"
              className="flex w-full min-w-0 flex-col overflow-hidden px-3.5 pb-3"
            >
              <div className="px-0.5 pb-1 text-[11px] font-semibold text-foreground">
                {searchActive ? "Draft results" : "All Drafts"}
              </div>
              <div className="flex min-w-0 flex-col gap-px overflow-hidden">
                {filteredDraftReleases.map((release) => {
                  const selected = selectedRelease?.name === release.name;
                  return (
                    <button
                      aria-current={selected ? "page" : undefined}
                      className={cn(
                        "group/release flex h-7 w-full min-w-0 items-center gap-2 rounded px-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground",
                        selected && "bg-accent/70 text-foreground",
                      )}
                      key={release.name}
                      onClick={() => setSelectedName(release.name)}
                      type="button"
                    >
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full bg-primary"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-normal text-current">
                        {release.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!filteredDraftReleases.length && (
                <div className="flex flex-col items-center gap-2 px-2 py-8 text-center text-xs text-muted-foreground">
                  <Calendar className="size-5 opacity-60" strokeWidth={1.75} />
                  <span>
                    {draftReleases.length
                      ? searchActive
                        ? `No draft releases match “${releaseSearch.trim()}”.`
                        : "No draft releases yet."
                      : "No draft releases yet."}
                  </span>
                </div>
              )}
            </nav>
          </ScrollArea>
          <div className="shrink-0 border-t border-border/80 px-3.5 py-2">
            <button
              aria-expanded={releasedExpanded}
              className="flex h-7 w-full min-w-0 items-center gap-1.5 rounded px-0.5 text-left text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={() => setReleasedExpanded((expanded) => !expanded)}
              type="button"
            >
              <ChevronRight
                aria-hidden
                className={cn(
                  "size-3.5 shrink-0 transition-transform",
                  releasedExpanded && "rotate-90",
                )}
                strokeWidth={1.75}
              />
              <span className="min-w-0 flex-1 truncate">Released</span>
            </button>
            {releasedExpanded && (
              <ScrollArea className="max-h-[260px] pt-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
                <div className="flex min-w-0 flex-col gap-px overflow-hidden pb-1">
                  {filteredReleasedReleases.map((release) => {
                    const selected = selectedRelease?.name === release.name;
                    return (
                      <button
                        aria-current={selected ? "page" : undefined}
                        className={cn(
                          "group/release flex h-7 w-full min-w-0 items-center gap-2 rounded px-1.5 text-left text-sm text-muted-foreground/65 transition-colors hover:bg-accent/35 hover:text-muted-foreground",
                          selected && "bg-accent/45 text-muted-foreground",
                        )}
                        key={release.name}
                        onClick={() => setSelectedName(release.name)}
                        type="button"
                      >
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full bg-muted-foreground/35"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-normal text-current">
                          {release.name}
                        </span>
                      </button>
                    );
                  })}
                  {!filteredReleasedReleases.length && (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      {releasedReleases.length
                        ? `No released releases match “${releaseSearch.trim()}”.`
                        : "No released releases yet."}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </aside>
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
      </div>

      {/* Right panel: release detail */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selectedRelease ? (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">
                  {selectedRelease.name}
                </h2>
                {selectedRelease.version && (
                  <p className="truncate text-sm text-muted-foreground">
                    {selectedRelease.version}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selectedRelease.releasedAt ? (
                    <>
                      <Calendar className="mr-1 inline size-3 align-text-top" />
                      Released {formatDate(selectedRelease.releasedAt)}
                    </>
                  ) : (
                    "Draft · not yet released"
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  aria-label="Copy release summary"
                  disabled={!taggedTasks.length}
                  onClick={() => void copySummary()}
                  size="icon-sm"
                  title="Copy release summary"
                  type="button"
                  variant="outline"
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button
                  aria-label="Edit version"
                  onClick={() => {
                    setEditVersion(selectedRelease.version);
                    setEditVersionDialogOpen(true);
                  }}
                  size="icon-sm"
                  title="Edit version"
                  type="button"
                  variant="ghost"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  aria-label="Delete release"
                  onClick={() => setDeleteDialogOpen(true)}
                  size="icon-sm"
                  title="Delete release"
                  type="button"
                  variant="outline"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Tab bar + tab content */}
            <div className="flex min-h-0 flex-1 flex-col">
              <div
                className="flex shrink-0 items-end gap-2 border-b border-border bg-card/30 px-6"
                ref={tabBarRef}
              >
                <div className="flex items-end gap-1" role="tablist">
                  <button
                    aria-controls="release-tab-panel-tasks"
                    aria-selected={activeTab === "tasks"}
                    className={cn(
                      "relative inline-flex h-9 items-center gap-1.5 px-3 text-xs font-medium transition-colors",
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
                      "relative inline-flex h-9 items-center gap-1.5 px-3 text-xs font-medium transition-colors",
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
                    Release notes
                    {templateDirty && (
                      <span
                        aria-label="Unsaved changes"
                        className="size-1.5 rounded-full bg-primary"
                      />
                    )}
                  </button>
                </div>
                <div className="ml-auto flex items-center gap-2 pb-1.5 pt-1.5">
                  {templateDirty && activeTab !== "notes" && (
                    <span className="hidden text-[11px] text-muted-foreground sm:inline">
                      Unsaved changes
                    </span>
                  )}
                  <Button
                    aria-label="Save release notes template"
                    className="h-7 px-2.5 text-[11px]"
                    data-testid="save-template-button"
                    disabled={!templateDirty || savingTemplate}
                    onClick={() => void saveTemplate()}
                    size="sm"
                    type="button"
                    variant={templateDirty ? "default" : "outline"}
                  >
                    <Save className="size-3.5" />
                    {savingTemplate ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                {/* Tasks tab */}
                {activeTab === "tasks" && (
                  <ScrollArea className="flex-1">
                    <div className="space-y-4 px-6 py-4 pb-8">
                      <div>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            aria-label="Search tasks"
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
                                : "Search by title…"
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

                      <section
                        aria-label="Selected For Release"
                        className="flex min-w-0 flex-col overflow-hidden"
                      >
                        <button
                          aria-expanded={selectedTasksExpanded}
                          className="flex min-w-0 items-center gap-2 py-1.5 text-left text-[13px] font-semibold text-foreground hover:text-foreground"
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
                          <span className="truncate">Selected For Release</span>
                          <span className="text-xs font-medium text-muted-foreground/75">
                            {formatSectionCount(filteredSelectedTasks.length)}
                          </span>
                        </button>
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

                      <section
                        aria-label="Available Tasks"
                        className="flex min-w-0 flex-col overflow-hidden"
                      >
                        <button
                          aria-expanded={availableTasksExpanded}
                          className="flex min-w-0 items-center gap-2 py-1.5 text-left text-[13px] font-semibold text-foreground hover:text-foreground"
                          onClick={() =>
                            setAvailableTasksExpanded((expanded) => !expanded)
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
                            {formatSectionCount(filteredAvailableTasks.length)}
                          </span>
                        </button>
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
                    </div>
                  </ScrollArea>
                )}

                {/* Notes tab */}
                {activeTab === "notes" && (
                  <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-4 pb-6">
                    {/* Editor / preview toggle for narrow layouts */}
                    {!isWideLayout && (
                      <div className="inline-flex h-7 w-fit items-center rounded-md border border-border bg-card/40 p-0.5 text-[11px]">
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
                          <Pencil className="size-3" />
                          Editor
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
                          <FileText className="size-3" />
                          Preview
                        </button>
                      </div>
                    )}

                    <div
                      className={cn(
                        "flex min-h-0 flex-1 gap-3",
                        isWideLayout ? "flex-row" : "flex-col",
                      )}
                    >
                      {/* Editor pane */}
                      {(isWideLayout || notesPane === "editor") && (
                        <div
                          className={cn(
                            "flex min-w-0 min-h-0 flex-col",
                            isWideLayout ? "flex-1" : "w-full",
                          )}
                        >
                          <div className="mb-1.5 flex items-center gap-1">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Editor
                            </h3>
                            <Popover onOpenChange={setHelpOpen} open={helpOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  aria-label="Template help"
                                  size="icon-sm"
                                  title="Template help"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Info className="size-3.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                align="start"
                                className="w-[420px] p-0"
                                sideOffset={4}
                              >
                                <div className="border-b border-border px-3 py-2">
                                  <p className="text-xs font-semibold">
                                    Template syntax
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    Hover over the editor for tooltips. Insert
                                    via the{" "}
                                    <span className="inline-flex items-center gap-0.5 align-middle">
                                      <Braces className="size-3" />
                                    </span>{" "}
                                    button.
                                  </p>
                                </div>
                                <ScrollArea className="h-[420px]">
                                  <div className="space-y-3 p-3 pr-1">
                                    <HelpSection
                                      entries={RELEASE_TEMPLATE_VARIABLES}
                                      title="Release variables"
                                    />
                                    <HelpSection
                                      entries={RELEASE_TEMPLATE_BLOCKS}
                                      title="Blocks"
                                    />
                                    <HelpSection
                                      entries={RELEASE_TEMPLATE_FILTERS}
                                      title="Filters"
                                    />
                                    <HelpSection
                                      entries={RELEASE_TEMPLATE_TASK_VARIABLES}
                                      title="Per-task variables (use inside #each)"
                                    />
                                    <div>
                                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Examples
                                      </p>
                                      <div className="space-y-2">
                                        {RELEASE_TEMPLATE_EXAMPLES.map((ex) => (
                                          <div
                                            className="rounded border border-border bg-muted/30 p-2"
                                            key={ex.title}
                                          >
                                            <p className="mb-1 text-[11px] font-medium">
                                              {ex.title}
                                            </p>
                                            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-foreground/90">
                                              {ex.template}
                                            </pre>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </ScrollArea>
                              </PopoverContent>
                            </Popover>
                            <Popover
                              onOpenChange={setPlaceholderOpen}
                              open={placeholderOpen}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  size="icon-sm"
                                  title="Insert placeholder"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Braces className="size-3.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                align="start"
                                className="w-80 p-1"
                                sideOffset={4}
                              >
                                <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Insert placeholder
                                </p>
                                <ScrollArea className="h-80">
                                  <div className="space-y-2 pr-1">
                                    <div>
                                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Release
                                      </p>
                                      <div className="space-y-0.5">
                                        {RELEASE_TEMPLATE_PLACEHOLDERS.map(
                                          (p) => (
                                            <PlaceholderButton
                                              description={p.description}
                                              key={p.snippet}
                                              onClick={() => {
                                                insertPlaceholder(p.snippet);
                                                setPlaceholderOpen(false);
                                              }}
                                              snippet={p.snippet}
                                            />
                                          ),
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Per-task field
                                      </p>
                                      <p className="px-2 pb-1 text-[10px] text-muted-foreground/80">
                                        Use inside{" "}
                                        <span className="font-mono">
                                          {"{{#each taskList}}"}
                                        </span>
                                      </p>
                                      <div className="space-y-0.5">
                                        {RELEASE_TASK_FIELDS.map((p) => (
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
                                    </div>
                                  </div>
                                </ScrollArea>
                                <div className="mt-1 flex items-center justify-between border-t border-border pt-1">
                                  <span className="px-2 text-[10px] text-muted-foreground">
                                    {RELEASE_TEMPLATE_PLACEHOLDERS.length +
                                      RELEASE_TASK_FIELDS.length}{" "}
                                    placeholders
                                  </span>
                                  <Button
                                    onClick={() => {
                                      setTemplateDraft(
                                        defaultReleaseTemplate(),
                                      );
                                      setTemplateDirty(true);
                                      setPlaceholderOpen(false);
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                  >
                                    <RotateCcw className="size-3" />
                                    Reset
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                            <div className="ml-auto flex items-center gap-1">
                              {!selectedRelease.releasedAt && (
                                <Button
                                  onClick={() => void handleMarkReleased()}
                                  size="icon-sm"
                                  title="Mark as released"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Check className="size-3.5 text-green-500" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <textarea
                            aria-label="Release notes template"
                            className="min-h-[260px] w-full flex-1 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            onChange={(e) => {
                              setTemplateDraft(e.target.value);
                              setTemplateDirty(true);
                            }}
                            placeholder={defaultReleaseTemplate()}
                            ref={templateEditorRef}
                            spellCheck={false}
                            value={templateDraft}
                          />
                        </div>
                      )}

                      {/* Preview pane */}
                      {(isWideLayout || notesPane === "preview") && (
                        <div
                          className={cn(
                            "flex min-w-0 min-h-0 flex-col",
                            isWideLayout ? "flex-1" : "w-full",
                          )}
                        >
                          <div className="mb-1.5 flex items-center gap-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Preview
                            </h3>
                            <div className="inline-flex h-6 items-center rounded-md border border-border bg-card/40 p-0.5 text-[10px]">
                              <button
                                aria-pressed={previewTab === "preview"}
                                className={cn(
                                  "inline-flex h-5 items-center gap-1 rounded px-1.5 transition-colors",
                                  previewTab === "preview"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                                onClick={() => setPreviewTab("preview")}
                                type="button"
                              >
                                <FileText className="size-3" />
                                Rendered
                              </button>
                              <button
                                aria-pressed={previewTab === "source"}
                                className={cn(
                                  "inline-flex h-5 items-center gap-1 rounded px-1.5 transition-colors",
                                  previewTab === "source"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                                onClick={() => setPreviewTab("source")}
                                type="button"
                              >
                                <Code className="size-3" />
                                Source
                              </button>
                            </div>
                          </div>
                          <div
                            className={cn(
                              "min-h-[260px] flex-1 overflow-auto rounded-md border border-border bg-card/40",
                              previewTab === "preview" ? "p-4" : "p-0",
                            )}
                          >
                            {previewTab === "preview" ? (
                              fullSummaryMd.trim() ? (
                                <div className="markdown">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {fullSummaryMd}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <p className="text-muted-foreground">
                                  Empty release notes.
                                </p>
                              )
                            ) : (
                              <pre className="h-full whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-foreground/90">
                                {fullSummaryMd || "_Empty release notes._"}
                              </pre>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
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
              Group tasks under a named milestone. Add an optional version label
              if you want to track changelog releases.
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
            <div>
              <label
                className="mb-1 block text-xs font-medium"
                htmlFor="new-release-version"
              >
                Version{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="new-release-version"
                placeholder="e.g. 0.3.0"
                ref={newVersionRef}
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

      {/* Edit version dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setEditVersionDialogOpen(false);
        }}
        open={editVersionDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit release version</DialogTitle>
            <DialogDescription>
              Update the optional version label for this release. Leave empty to
              remove it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              onChange={(e) => setEditVersion(e.target.value)}
              placeholder="e.g. 0.3.0"
              value={editVersion ?? ""}
            />
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setEditVersionDialogOpen(false)}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={busy}
                onClick={() => void handleSaveVersion()}
                type="button"
                variant="default"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete release confirmation */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setDeleteDialogOpen(false);
        }}
        open={deleteDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete release</DialogTitle>
            <DialogDescription>
              This will remove the release tag from all tasks tagged with{" "}
              <strong>{selectedRelease?.name}</strong>. The release and its
              association with tasks will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setDeleteDialogOpen(false)}
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
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_RELEASE_SIDEBAR_WIDTH;
  const viewportLimit =
    typeof window === "undefined"
      ? MAX_RELEASE_SIDEBAR_WIDTH
      : Math.min(
          MAX_RELEASE_SIDEBAR_WIDTH,
          Math.floor(window.innerWidth * 0.42),
        );
  return Math.min(Math.max(value, MIN_RELEASE_SIDEBAR_WIDTH), viewportLimit);
}
