import {
  Braces,
  Calendar,
  Check,
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
  Tag,
  Trash2,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useRef, useState } from "react";
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
  entries: ReadonlyArray<{ label: string; syntax: string; description: string }>;
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
    <div
      className={cn(
        "group flex min-w-0 items-center gap-2 rounded-md border border-transparent px-3 py-1.5 hover:bg-accent/60",
        selected && "bg-accent/40",
      )}
    >
      <label
        aria-label={selected ? "Remove from release" : "Add to release"}
        className="flex shrink-0 cursor-pointer items-center"
      >
        <input
          checked={selected}
          className="size-3.5 accent-primary"
          onChange={onToggle}
          type="checkbox"
        />
      </label>
      <span
        className="mt-0.5 size-1.5 shrink-0 rounded-full"
        aria-hidden
        style={{ backgroundColor: STATUS_DOT[task.status] }}
      />
      <div className="min-w-0 flex-1 truncate">
        <span className="truncate text-xs font-medium">{task.title}</span>
        <span className="ml-1.5 text-[10px] text-muted-foreground">
          {folderName} · {task.status}
        </span>
      </div>
      <button
        aria-label={`Open task: ${task.title}`}
        className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100"
        data-testid="open-task-link"
        onClick={onOpen}
        title="Open this task"
        type="button"
      >
        <ExternalLink className="size-3" />
        Open
      </button>
    </div>
  );
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
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [tagSelected, setTagSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [templateDraft, setTemplateDraft] = useState("");
  const [templateDirty, setTemplateDirty] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [previewTab, setPreviewTab] = useState<
    "preview" | "source" | "editor"
  >("preview");
  const [placeholderOpen, setPlaceholderOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "notes">("tasks");
  const [tasksSearch, setTasksSearch] = useState("");
  const [tasksUseRegex, setTasksUseRegex] = useState(false);
  const [tasksSearchInvalid, setTasksSearchInvalid] = useState(false);
  const [notesPane, setNotesPane] = useState<"editor" | "preview">("editor");
  const [isWideLayout, setIsWideLayout] = useState(true);
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
      setSelectedName(releases[0].name);
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
    const stored = window.localStorage.getItem(
      "devthread:release-active-tab",
    );
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

  const dialogTasks = useMemo(
    () => tasks.filter((t) => t.status !== "archived"),
    [tasks],
  );

  const currentlyTaggedIds = useMemo(
    () => new Set(taggedTasks.map((t) => t.id)),
    [taggedTasks],
  );

  // Tasks tab: candidate set is every non-archived task, with a search/regex
  // filter on title + folder. The filter is applied to BOTH selected and
  // available sections so a search acts like "show me only matches here".
  const candidateTasks = useMemo(
    () => tasks.filter((t) => t.status !== "archived"),
    [tasks],
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
    () =>
      candidateTasks
        .filter((t) => !currentlyTaggedIds.has(t.id))
        .filter((t) => tasksMatcher(t.title)),
    [candidateTasks, currentlyTaggedIds, tasksMatcher],
  );

  const filteredDialogTasks = useMemo(() => {
    const term = tagSearch.trim().toLowerCase();
    if (!term) return dialogTasks;
    return dialogTasks.filter((t) => {
      const folderName = t.folderId
        ? folderNames.get(t.folderId)?.toLowerCase() ?? ""
        : "";
      return (
        t.title.toLowerCase().includes(term) || folderName.includes(term)
      );
    });
  }, [dialogTasks, tagSearch, folderNames]);

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
  }, [
    selectedRelease,
    templateDraft,
    taskTableMd,
    taggedTasks,
    folderNames,
  ]);

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

  async function handleAddTagged() {
    if (!selectedRelease || busy) return;
    setBusy(true);
    try {
      const toTag: string[] = [];
      const toUntag: string[] = [];
      for (const taskId of tagSelected) {
        if (!currentlyTaggedIds.has(taskId)) toTag.push(taskId);
      }
      for (const taskId of currentlyTaggedIds) {
        if (!tagSelected.has(taskId)) toUntag.push(taskId);
      }
      if (!toTag.length && !toUntag.length) {
        setTagDialogOpen(false);
        setTagSelected(new Set());
        setTagSearch("");
        return;
      }
      await Promise.all([
        ...toTag.map((taskId) => onTagTask(taskId, selectedRelease.name)),
        ...toUntag.map((taskId) => onRemoveTaskTag(taskId)),
      ]);
      setTagDialogOpen(false);
      setTagSelected(new Set());
      setTagSearch("");
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

  function toggleTagSelected(taskId: string) {
    setTagSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  const releasesSorted = useMemo(
    () => [...releases].sort((a, b) => b.name.localeCompare(a.name)),
    [releases],
  );

  return (
    <section className="grid min-h-0 flex-1 grid-cols-[minmax(260px,340px)_minmax(0,1fr)] bg-background">
      {/* Left panel: release list */}
      <div className="flex min-h-0 flex-col border-r border-border bg-card/60">
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-sm font-semibold">Releases</h1>
              <p className="text-xs text-muted-foreground">
                {releases.length} {releases.length === 1 ? "release" : "releases"}
              </p>
            </div>
            <Button
              onClick={() => setNewDialogOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Plus className="size-3.5" />
              New
            </Button>
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-2">
            {releasesSorted.map((release) => {
              const selected = selectedRelease?.name === release.name;
              const isReleased = !!release.releasedAt;
              return (
                <button
                  className={cn(
                    "flex w-full min-w-0 flex-col gap-0.5 rounded-md border border-transparent px-3 py-2.5 text-left hover:bg-accent/60",
                    selected && "border-border bg-accent text-accent-foreground",
                  )}
                  key={release.name}
                  onClick={() => setSelectedName(release.name)}
                  type="button"
                >
                  <span className="truncate text-sm font-medium">
                    {release.name}
                  </span>
                  {release.version && (
                    <span className="truncate text-[11px] text-muted-foreground">
                      {release.version}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {isReleased
                      ? formatDate(release.releasedAt!)
                      : "Draft · not yet released"}
                  </span>
                </button>
              );
            })}
            {!releasesSorted.length && (
              <div className="px-3 py-10 text-center text-xs text-muted-foreground">
                No releases yet.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel: release detail */}
      <div className="flex min-h-0 flex-col">
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
                  disabled={!taggedTasks.length}
                  onClick={() => void copySummary()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Copy className="size-3.5" />
                  Copy
                </Button>
                <Button
                  onClick={() => setTagDialogOpen(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Tag className="size-3.5" />
                  Add tasks
                </Button>
                <Button
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
                  onClick={() => setDeleteDialogOpen(true)}
                  size="icon-sm"
                  title="Delete release"
                  type="button"
                  variant="ghost"
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
                <div
                  className="flex items-end gap-1"
                  role="tablist"
                >
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

                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Selected for this release
                        </h3>
                        <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {filteredSelectedTasks.length}/{taggedTasks.length}
                        </span>
                      </div>
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
                              onToggle={() => void handleRemoveTag(task.id)}
                              selected
                              task={task}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-md border border-dashed border-border bg-card/30 px-3 py-4 text-center text-[11px] text-muted-foreground">
                          {taggedTasks.length === 0
                            ? "No tasks tagged yet. Use the checkboxes below or the Add tasks button."
                            : "No selected tasks match the search."}
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Other tasks
                        </h3>
                        <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {filteredAvailableTasks.length}/
                          {candidateTasks.length - taggedTasks.length}
                        </span>
                      </div>
                      {filteredAvailableTasks.length > 0 ? (
                        <ScrollArea className="max-h-[420px]">
                          <div className="space-y-1 pr-2">
                            {filteredAvailableTasks.map((task) => (
                              <TasksTabRow
                                folderName={
                                  folderNames.get(task.folderId ?? "") ??
                                  "No folder"
                                }
                                key={task.id}
                                onOpen={() => onSelectTask(task.id)}
                                onToggle={() => void onTagTask(task.id, selectedRelease.name)}
                                selected={false}
                                task={task}
                              />
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <p className="rounded-md border border-dashed border-border bg-card/30 px-3 py-4 text-center text-[11px] text-muted-foreground">
                          {tasksSearch.trim() || tasksUseRegex
                            ? "No tasks match the search."
                            : "Every task is already in this release."}
                        </p>
                      )}
                    </div>
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
                            <Popover
                              onOpenChange={setHelpOpen}
                              open={helpOpen}
                            >
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
                                    via the {" "}
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
                Version <span className="text-muted-foreground">(optional)</span>
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
              Update the optional version label for this release. Leave empty
              to remove it.
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

      {/* Add tasks to release dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setTagDialogOpen(false);
            setTagSelected(new Set());
            setTagSearch("");
          } else {
            // Pre-select tasks already tagged with this release
            setTagSelected(new Set(currentlyTaggedIds));
          }
        }}
        open={tagDialogOpen}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {currentlyTaggedIds.size > 0
                ? `Manage tasks in ${selectedRelease?.name}`
                : `Add tasks to ${selectedRelease?.name}`}
            </DialogTitle>
            <DialogDescription>
              {currentlyTaggedIds.size > 0
                ? "Select or deselect tasks to update this release's tagging."
                : "Select tasks to tag for this release."}
            </DialogDescription>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search tasks"
              className="h-8 pl-7 text-xs"
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="Search tasks by title or folder"
              value={tagSearch}
            />
          </div>
          <ScrollArea className="h-80">
            <div className="space-y-0.5 pr-2">
              {filteredDialogTasks.map((task) => {
                const folderName = task.folderId
                  ? folderNames.get(task.folderId)
                  : null;
                const alreadyTagged = currentlyTaggedIds.has(task.id);
                return (
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:bg-accent/60",
                      tagSelected.has(task.id) && "border-border bg-accent",
                      alreadyTagged && "ring-1 ring-primary/30",
                    )}
                    key={task.id}
                  >
                    <input
                      checked={tagSelected.has(task.id)}
                      className="size-3.5 shrink-0 accent-primary"
                      onChange={() => toggleTagSelected(task.id)}
                      type="checkbox"
                    />
                    <span
                      className="mt-0.5 size-1.5 shrink-0 rounded-full"
                      aria-hidden
                      style={{
                        backgroundColor: STATUS_DOT[task.status],
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {task.title}
                    </span>
                    {folderName && (
                      <span className="hidden max-w-[120px] truncate text-[11px] text-muted-foreground sm:inline">
                        {folderName}
                      </span>
                    )}
                    <span className="shrink-0 rounded border border-border bg-muted/50 px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {task.status}
                    </span>
                    {alreadyTagged && (
                      <span className="shrink-0 rounded border border-primary/40 bg-primary/10 px-1.5 text-[10px] uppercase tracking-wider text-primary">
                        tagged
                      </span>
                    )}
                  </label>
                );
              })}
              {!filteredDialogTasks.length && (
                <div className="px-3 py-10 text-center text-xs text-muted-foreground">
                  {tagSearch.trim()
                    ? "No tasks match this search."
                    : "No tasks yet. Create some in the Tasks view."}
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {tagSelected.size} of {filteredDialogTasks.length} task
              {filteredDialogTasks.length === 1 ? "" : "s"} selected
            </span>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setTagDialogOpen(false);
                  setTagSelected(new Set());
                  setTagSearch("");
                }}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              {(() => {
                const toTagCount = Array.from(tagSelected).filter(
                  (id) => !currentlyTaggedIds.has(id),
                ).length;
                const toUntagCount = Array.from(currentlyTaggedIds).filter(
                  (id) => !tagSelected.has(id),
                ).length;
                const noChanges =
                  toTagCount === 0 && toUntagCount === 0;
                const label = noChanges
                  ? "Save"
                  : toUntagCount > 0 && toTagCount > 0
                    ? "Update"
                    : toUntagCount > 0
                      ? `Remove (${toUntagCount})`
                      : `Add (${toTagCount})`;
                return (
                  <Button
                    disabled={busy || noChanges}
                    onClick={() => void handleAddTagged()}
                    type="button"
                    variant="default"
                  >
                    {label}
                  </Button>
                );
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
