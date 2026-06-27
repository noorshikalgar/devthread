import {
  ArchiveRestore,
  Check,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  ListTodo,
  Pencil,
  Pin,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Folder as FolderModel, Release, Task, TaskStatus } from "@/lib/types";
import { STATUS_DOT, STATUS_LABEL } from "@/lib/status";
import { hasComposerDraft } from "@/lib/composerDraftStore";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { copyTaskSummary } from "@/lib/taskSummary";
import { cn } from "@/lib/utils";

// Common shape shared by every mode. Mode-specific behaviour
// (folders, restore button, drag/drop, etc.) is opt-in via the
// discriminated `mode` union below.
interface CommonProps {
  tasks: Task[];
  folders: FolderModel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  releases?: Release[];
}

interface ActiveModeProps extends CommonProps {
  mode: "active";
  onCreate: (folderId?: string | null) => Promise<void>;
  onCreateFolder: (name: string) => Promise<void>;
  onCopyFolder: (
    folder: FolderModel,
    format: "markdown" | "csv",
  ) => Promise<void> | void;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onMoveTask: (taskId: string, folderId: string | null) => Promise<void>;
  onDeleteFolder: (
    folderId: string,
    mode: "cascade" | "unassign",
  ) => Promise<void>;
  newFolderDialogRef?: { current: (() => void) | null };
  onRemoveTaskRelease?: (taskId: string) => Promise<void>;
  onRemoveFolderRelease?: (folderId: string) => Promise<void>;
  onTogglePin?: (taskId: string) => void;
  pinnedTaskIds?: string[];
  onTagTaskRelease?: (taskId: string, name: string) => Promise<void>;
  onTagFolderRelease?: (folderId: string, name: string) => Promise<void>;
}

interface ArchiveModeProps extends CommonProps {
  mode: "archive";
  onRestoreTask: (task: Task) => Promise<void>;
  // Optional custom title in the header. Defaults to "Archive".
  title?: string;
  // Placeholder for the search input. Defaults to "Search archive".
  searchPlaceholder?: string;
}

type Props = ActiveModeProps | ArchiveModeProps;

const UNCATEGORIZED = "__ungrouped__";
const SEARCH_INPUT_MAX_LENGTH = 80;
// "active" is deliberately excluded — the Active tasks section above
// already covers that filter, so a chip for it would be redundant.
const STATUS_FILTER_OPTIONS: TaskStatus[] = [
  "planned",
  "blocked",
  "paused",
  "done",
];
const SEARCH_MESSAGE_MAX_LENGTH = 28;

// Subscribe to composer-draft store changes so the sidebar
// re-renders the status-dot ring when a draft is created or
// cleared. Returns the current "task has draft" status for a
// given taskId; callers pass it down to TaskStatusDot.
function useComposerDrafts() {
  const [, force] = useState(0);
  useEffect(() => {
    const handler = () => force((value) => value + 1);
    window.addEventListener("devthread:composer-drafts", handler);
    return () =>
      window.removeEventListener("devthread:composer-drafts", handler);
  }, []);
  return { hasDraft: hasComposerDraft };
}

export function TaskSidebar(props: Props) {
  // The header, search input, scroll area, and task row shape are
  // shared across both modes. Mode-specific bits (folder grouping,
  // status dot vs checkbox, hover buttons, bulk action) are gated
  // on `props.mode` so we never need duplicated sub-components.
  if (props.mode === "archive") {
    return <ArchiveSidebar {...props} />;
  }
  return <ActiveSidebar {...props} />;
}

function ActiveSidebar({
  tasks,
  folders,
  selectedId,
  onSelect,
  onCopyFolder,
  onCreate,
  onCreateFolder,
  onRenameFolder,
  onMoveTask,
  onDeleteTask,
  onDeleteFolder,
  newFolderDialogRef,
  onRemoveTaskRelease,
  onRemoveFolderRelease,
  onTogglePin,
  pinnedTaskIds = [],
  onTagTaskRelease,
  onTagFolderRelease,
  releases,
}: ActiveModeProps) {
  const { hasDraft } = useComposerDrafts();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(
    new Set(),
  );
  const [folderDialog, setFolderDialog] = useState<FolderDialogState | null>(
    null,
  );
  const [folderToDelete, setFolderToDelete] = useState<FolderModel | null>(
    null,
  );

  useEffect(() => {
    if (!newFolderDialogRef) return;
    newFolderDialogRef.current = openCreateFolderDialog;
    return () => {
      newFolderDialogRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newFolderDialogRef]);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [openActiveTasks, setOpenActiveTasks] = useState(true);
  const [openPinnedTasks, setOpenPinnedTasks] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const searchTerm = query.trim();
  const isSearching = searchTerm.length > 0;

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (!term) return true;
      return `${task.title} ${task.status} ${task.nextStep ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [tasks, searchTerm, statusFilter]);

  const grouped = useMemo(() => {
    const byFolder = new Map<string, Task[]>();
    for (const folder of folders) byFolder.set(folder.id, []);
    byFolder.set(UNCATEGORIZED, []);
    for (const task of filtered) {
      const key = task.folderId ?? UNCATEGORIZED;
      const bucket = byFolder.get(key) ?? byFolder.get(UNCATEGORIZED)!;
      bucket.push(task);
    }
    return byFolder;
  }, [filtered, folders]);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      await onCreate();
    } finally {
      setCreating(false);
    }
  }

  async function handleMove(taskId: string, folderId: string | null) {
    await onMoveTask(taskId, folderId);
  }

  function toggleFolder(folderId: string) {
    setCollapsedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function openCreateFolderDialog() {
    setFolderDialog({
      id: null,
      mode: "create",
      name: "",
      error: "",
      saving: false,
    });
  }

  function openRenameFolderDialog(folder: FolderModel) {
    setFolderDialog({
      id: folder.id,
      mode: "rename",
      name: folder.name,
      error: "",
      saving: false,
    });
  }

  async function submitFolderDialog(name: string) {
    if (!folderDialog || folderDialog.saving) return;
    const normalized = name.trim();
    if (!normalized) {
      setFolderDialog({ ...folderDialog, error: "Folder name is required." });
      return;
    }
    setFolderDialog({ ...folderDialog, name, error: "", saving: true });
    try {
      if (folderDialog.mode === "create") {
        await onCreateFolder(normalized);
      } else if (folderDialog.id) {
        await onRenameFolder(folderDialog.id, normalized);
      }
      setFolderDialog(null);
    } catch (cause) {
      setFolderDialog({
        ...folderDialog,
        name,
        error: String(cause),
        saving: false,
      });
    }
  }

  const hasAnyContent =
    filtered.length > 0 || (!isSearching && folders.length > 0);
  const activeTasks = useMemo(
    () => filtered.filter((task) => task.status === "active"),
    [filtered],
  );
  const pinnedTasks = useMemo(() => {
    if (isSearching || !pinnedTaskIds.length) return [];
    const byId = new Map(tasks.map((task) => [task.id, task]));
    return pinnedTaskIds
      .map((id) => byId.get(id))
      .filter((task): task is Task => Boolean(task));
  }, [isSearching, pinnedTaskIds, tasks]);
  const noResultsQuery = formatSearchMessageQuery(searchTerm);

  return (
    <aside className="flex h-full w-full flex-col bg-card/95 text-card-foreground">
      <div className="px-3.5 pb-4 pt-4">
        <div className="relative">
          {query ? (
            <button
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={() => setQuery("")}
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
            aria-label="Search tasks"
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className="h-9 rounded-md border-border/80 bg-background/35 pl-3 pr-8 text-sm text-foreground shadow-inner shadow-black/5 placeholder:text-muted-foreground/75 focus-visible:border-ring/70"
            maxLength={SEARCH_INPUT_MAX_LENGTH}
            name="devthread-task-search"
            onChange={(event) =>
              setQuery(event.target.value.slice(0, SEARCH_INPUT_MAX_LENGTH))
            }
            placeholder="Search tasks..."
            spellCheck={false}
            value={query}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {(["all", ...STATUS_FILTER_OPTIONS] as const).map((status) => {
            const active = statusFilter === status;
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors duration-fast",
                  active
                    ? "border-transparent bg-secondary text-secondary-foreground"
                    : "border-border/70 text-muted-foreground hover:border-ring/40 hover:text-foreground",
                )}
                key={status}
                onClick={() => setStatusFilter(status)}
                type="button"
              >
                {status !== "all" && (
                  <span
                    aria-hidden
                    className={cn("size-1.5 rounded-full", STATUS_DOT[status])}
                  />
                )}
                {status === "all" ? "All" : STATUS_LABEL[status]}
              </button>
            );
          })}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
        <nav
          aria-label="Tasks"
          className="flex w-full min-w-0 flex-col overflow-hidden"
        >
          {!isSearching && !!activeTasks.length && (
            <section
              aria-label="Active tasks"
              className="flex min-w-0 flex-col overflow-hidden px-3.5 pb-3"
            >
              <button
                aria-expanded={openActiveTasks}
                className="flex min-w-0 items-center gap-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 transition-colors duration-fast hover:text-foreground"
                onClick={() => setOpenActiveTasks((open) => !open)}
                type="button"
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform duration-base ease-emphasized",
                    openActiveTasks && "rotate-90",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">
                  {`Active tasks · ${activeTasks.length}`}
                </span>
              </button>
              <div
                aria-hidden={!openActiveTasks}
                className={cn(
                  "grid min-w-0 transition-[grid-template-rows,opacity,transform] duration-150 ease-out motion-reduce:transition-none",
                  openActiveTasks
                    ? "grid-rows-[1fr] translate-y-0 opacity-100"
                    : "pointer-events-none grid-rows-[0fr] -translate-y-0.5 opacity-0",
                )}
              >
                <div
                  className={cn(
                    "flex min-w-0 flex-col gap-px overflow-hidden pt-1",
                  )}
                >
                  {activeTasks.map((task) => (
                    <button
                      className={cn(
                        "flex h-6 min-w-0 items-center gap-2 rounded px-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground",
                        selectedId === task.id &&
                          "bg-accent/70 text-foreground",
                      )}
                      key={task.id}
                      onClick={() => onSelect(task.id)}
                      type="button"
                    >
                      <TaskStatusDot
                        hasDraft={hasDraft(task.id)}
                        status={task.status}
                      />
                      <span className="w-full truncate text-sm font-normal text-current">
                        {task.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {!isSearching && !!pinnedTasks.length && (
            <section
              aria-label="Pinned tasks"
              className="flex min-w-0 flex-col overflow-hidden px-3.5 pb-3"
            >
              <button
                aria-expanded={openPinnedTasks}
                className="flex min-w-0 items-center gap-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 transition-colors duration-fast hover:text-foreground"
                onClick={() => setOpenPinnedTasks((open) => !open)}
                type="button"
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform duration-base ease-emphasized",
                    openPinnedTasks && "rotate-90",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">
                  {`Pinned tasks · ${pinnedTasks.length}`}
                </span>
              </button>
              <div
                aria-hidden={!openPinnedTasks}
                className={cn(
                  "grid min-w-0 transition-[grid-template-rows,opacity,transform] duration-150 ease-out motion-reduce:transition-none",
                  openPinnedTasks
                    ? "grid-rows-[1fr] translate-y-0 opacity-100"
                    : "pointer-events-none grid-rows-[0fr] -translate-y-0.5 opacity-0",
                )}
              >
                <div className="flex min-w-0 flex-col gap-px overflow-hidden pt-1">
                  {pinnedTasks.map((task) => (
                    <TaskRow
                      compact
                      folders={folders}
                      grouped={false}
                      hasDraft={hasDraft(task.id)}
                      isPinned={pinnedTaskIds.includes(task.id)}
                      key={task.id}
                      onMove={handleMove}
                      onDeleteTask={setTaskToDelete}
                      onRemoveTaskRelease={onRemoveTaskRelease}
                      onSelect={onSelect}
                      onTagTaskRelease={onTagTaskRelease}
                      onTogglePin={onTogglePin}
                      releases={releases}
                      selected={selectedId === task.id}
                      task={task}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          <div className="flex min-w-0 flex-col gap-px overflow-hidden px-3.5 pb-3">
            <div className="flex items-center justify-between gap-2 px-0.5 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                {`${isSearching ? "Search results" : "All Tasks"} · ${filtered.length}`}
              </span>
              {!isSearching && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label="New folder"
                        className="size-6 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                        onClick={openCreateFolderDialog}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <FolderPlus className="size-3.5" strokeWidth={1.75} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>New folder</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label="New task"
                        className="size-6 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                        disabled={creating}
                        onClick={() => void handleCreate()}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Plus className="size-3.5" strokeWidth={1.75} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>New task</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
            {isSearching
              ? filtered.map((task) => (
                  <TaskRow
                    folders={folders}
                    grouped={false}
                    hasDraft={hasDraft(task.id)}
                    key={task.id}
                    onMove={handleMove}
                    onDeleteTask={setTaskToDelete}
                    onRemoveTaskRelease={onRemoveTaskRelease}
                    onSelect={onSelect}
                    onTagTaskRelease={onTagTaskRelease}
                    onTogglePin={onTogglePin}
                    isPinned={pinnedTaskIds.includes(task.id)}
                    releases={releases}
                    selected={selectedId === task.id}
                    task={task}
                    variant="active"
                  />
                ))
              : folders.map((folder) => (
                  <FolderGroup
                    collapsed={collapsedFolderIds.has(folder.id)}
                    folder={folder}
                    folders={folders}
                    hasDraft={hasDraft}
                    key={folder.id}
                    onCopyFolder={onCopyFolder}
                    onCreate={onCreate}
                    onDeleteFolder={setFolderToDelete}
                    onMove={handleMove}
                    onDeleteTask={setTaskToDelete}
                    onRemoveFolderRelease={onRemoveFolderRelease}
                    onRemoveTaskRelease={onRemoveTaskRelease}
                    onRenameFolder={openRenameFolderDialog}
                    onSelect={onSelect}
                    onTagFolderRelease={onTagFolderRelease}
                    onTagTaskRelease={onTagTaskRelease}
                    onTogglePin={onTogglePin}
                    pinnedTaskIds={pinnedTaskIds}
                    onToggleFolder={toggleFolder}
                    releases={releases}
                    selectedId={selectedId}
                    tasks={grouped.get(folder.id) ?? []}
                  />
                ))}
            {!isSearching && grouped.get(UNCATEGORIZED)?.length ? (
              <FolderGroup
                folder={null}
                folders={folders}
                hasDraft={hasDraft}
                onCopyFolder={onCopyFolder}
                onCreate={onCreate}
                onDeleteFolder={setFolderToDelete}
                onMove={handleMove}
                onDeleteTask={setTaskToDelete}
                onRemoveFolderRelease={onRemoveFolderRelease}
                onRemoveTaskRelease={onRemoveTaskRelease}
                onRenameFolder={openRenameFolderDialog}
                onSelect={onSelect}
                onTagFolderRelease={onTagFolderRelease}
                onTagTaskRelease={onTagTaskRelease}
                onTogglePin={onTogglePin}
                pinnedTaskIds={pinnedTaskIds}
                onToggleFolder={toggleFolder}
                releases={releases}
                selectedId={selectedId}
                tasks={grouped.get(UNCATEGORIZED) ?? []}
              />
            ) : null}
          </div>

          {!hasAnyContent && (
            <div className="flex flex-col items-center gap-3 px-2 py-10 text-center text-xs text-muted-foreground animate-in fade-in-0 duration-base">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted/60">
                <ListTodo className="size-4 opacity-70" strokeWidth={1.75} />
              </div>
              {searchTerm ? (
                <span className="max-w-full truncate">
                  No tasks match “{noResultsQuery}”.
                </span>
              ) : (
                <>
                  <span>No tasks yet.</span>
                  <Button
                    onClick={() => void handleCreate()}
                    size="sm"
                    variant="link"
                  >
                    Create the first one
                  </Button>
                </>
              )}
            </div>
          )}
        </nav>
      </ScrollArea>

      <FolderDialog
        dialog={folderDialog}
        onOpenChange={(open) => {
          if (!open) setFolderDialog(null);
        }}
        onSubmit={submitFolderDialog}
      />
      <DeleteTaskDialog
        onConfirm={async () => {
          if (!taskToDelete) return;
          await onDeleteTask(taskToDelete.id);
          setTaskToDelete(null);
        }}
        onOpenChange={(open) => {
          if (!open) setTaskToDelete(null);
        }}
        task={taskToDelete}
      />
      <DeleteFolderDialog
        folder={folderToDelete}
        onConfirm={async (mode) => {
          if (!folderToDelete) return;
          await onDeleteFolder(folderToDelete.id, mode);
          setFolderToDelete(null);
        }}
        onOpenChange={(open) => {
          if (!open) setFolderToDelete(null);
        }}
        taskCount={
          folderToDelete
            ? tasks.filter((task) => task.folderId === folderToDelete.id).length
            : 0
        }
      />
    </aside>
  );
}

function ArchiveSidebar({
  tasks,
  folders,
  selectedId,
  onSelect,
  onDeleteTask,
  onRestoreTask,
  title = "Archive",
  searchPlaceholder = "Search archive",
}: ArchiveModeProps) {
  const [query, setQuery] = useState("");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const searchTerm = query.trim();

  const folderNames = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders],
  );

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return tasks.filter((task) => {
      if (!term) return true;
      return `${task.title} ${folderNames.get(task.folderId ?? "") ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [folderNames, searchTerm, tasks]);

  // Keep the selected task valid: if the user restores/deletes the
  // currently selected task, fall back to the first row in the list.
  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((task) => task.id === selectedId)) return;
    onSelect(filtered[0]!.id);
  }, [filtered, onSelect, selectedId]);

  const noResultsQuery = formatSearchMessageQuery(searchTerm);

  async function restoreOne(task: Task) {
    if (busy) return;
    setBusy(true);
    try {
      await onRestoreTask(task);
      setCheckedIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  async function restoreMany() {
    if (busy || !checkedIds.size) return;
    setBusy(true);
    try {
      const selected = tasks.filter((task) => checkedIds.has(task.id));
      await Promise.all(selected.map((task) => onRestoreTask(task)));
      setCheckedIds(new Set());
    } finally {
      setBusy(false);
    }
  }

  function toggleChecked(id: string) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <aside className="flex h-full w-full flex-col bg-card/95 text-card-foreground">
      <div className="flex items-center justify-end gap-2 px-3.5 pb-3 pt-4">
        <div className="flex shrink-0 items-center gap-1">
          <Button
            aria-label="Restore selected"
            className="h-7 px-2 text-xs"
            disabled={!checkedIds.size || busy}
            onClick={() => void restoreMany()}
            size="sm"
            type="button"
            variant="outline"
          >
            <ArchiveRestore className="mr-1 size-3.5" strokeWidth={1.75} />
            Restore selected
          </Button>
        </div>
      </div>

      <div className="px-3.5 pb-4">
        <div className="relative">
          {query ? (
            <button
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={() => setQuery("")}
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
            aria-label={searchPlaceholder}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className="h-9 rounded-md border-border/80 bg-background/35 pl-3 pr-8 text-sm text-foreground shadow-inner shadow-black/5 placeholder:text-muted-foreground/75 focus-visible:border-ring/70"
            maxLength={SEARCH_INPUT_MAX_LENGTH}
            name="devthread-archive-search"
            onChange={(event) =>
              setQuery(event.target.value.slice(0, SEARCH_INPUT_MAX_LENGTH))
            }
            placeholder={searchPlaceholder}
            spellCheck={false}
            value={query}
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
        <nav
          aria-label="Archive"
          className="flex w-full min-w-0 flex-col gap-px overflow-hidden px-3.5 pb-3"
        >
          {filtered.map((task) => (
            <ArchiveRow
              busy={busy}
              checked={checkedIds.has(task.id)}
              key={task.id}
              onDelete={() => setTaskToDelete(task)}
              onRestore={() => void restoreOne(task)}
              onSelect={() => onSelect(task.id)}
              onToggleChecked={() => toggleChecked(task.id)}
              selected={selectedId === task.id}
              task={task}
            />
          ))}
          {!filtered.length && (
            <div className="flex flex-col items-center gap-2 px-2 py-8 text-center text-xs text-muted-foreground">
              <ListTodo className="size-5 opacity-60" strokeWidth={1.75} />
              {searchTerm ? (
                <span className="max-w-full truncate">
                  No archived tasks match “{noResultsQuery}”.
                </span>
              ) : (
                <span>No archived tasks yet.</span>
              )}
            </div>
          )}
        </nav>
      </ScrollArea>

      <DeleteTaskDialog
        description="This permanently removes the archived task and its timeline from the local workspace."
        onConfirm={async () => {
          if (!taskToDelete) return;
          await onDeleteTask(taskToDelete.id);
          setCheckedIds((current) => {
            const next = new Set(current);
            next.delete(taskToDelete.id);
            return next;
          });
          setTaskToDelete(null);
        }}
        onOpenChange={(open) => {
          if (!open) setTaskToDelete(null);
        }}
        task={taskToDelete}
        title="Delete archived task?"
      />
    </aside>
  );
}

function FolderGroup({
  folder,
  folders,
  tasks,
  selectedId,
  collapsed,
  hasDraft,
  onSelect,
  onCopyFolder,
  onCreate,
  onRenameFolder,
  onDeleteFolder,
  onToggleFolder,
  onMove,
  onDeleteTask,
  onRemoveFolderRelease,
  onRemoveTaskRelease,
  onTagFolderRelease,
  onTagTaskRelease,
  onTogglePin,
  pinnedTaskIds = [],
  releases,
}: {
  folder: FolderModel | null;
  folders: FolderModel[];
  tasks: Task[];
  selectedId: string | null;
  collapsed?: boolean;
  hasDraft: (taskId: string) => boolean;
  onSelect: (id: string) => void;
  onCopyFolder: (
    folder: FolderModel,
    format: "markdown" | "csv",
  ) => Promise<void> | void;
  onCreate: (folderId?: string | null) => Promise<void>;
  onRenameFolder: (folder: FolderModel) => void;
  onDeleteFolder: (folder: FolderModel) => void;
  onToggleFolder: (folderId: string) => void;
  onMove: (taskId: string, folderId: string | null) => Promise<void>;
  onDeleteTask: (task: Task) => void;
  onRemoveFolderRelease?: (folderId: string) => Promise<void>;
  onRemoveTaskRelease?: (taskId: string) => Promise<void>;
  onTagFolderRelease?: (folderId: string, name: string) => Promise<void>;
  onTagTaskRelease?: (taskId: string, name: string) => Promise<void>;
  onTogglePin?: (taskId: string) => void;
  pinnedTaskIds?: string[];
  releases?: Release[];
}) {
  if (!tasks.length && !folder) return null;
  const grouped = Boolean(folder);
  const open = grouped ? !collapsed : true;
  const FolderIcon = open ? FolderOpen : Folder;
  return (
    <section className="flex min-w-0 flex-col gap-px overflow-hidden">
      {folder && (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                "group/folder flex h-7 min-w-0 items-center rounded text-sm transition-colors hover:bg-accent/45",
                open
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <button
                aria-expanded={open}
                className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 text-left"
                onClick={() => onToggleFolder(folder.id)}
                type="button"
              >
                <FolderIcon
                  className={cn(
                    "size-3.5 shrink-0 transition-colors duration-150 ease-out group-hover/folder:text-foreground",
                    open ? "text-foreground/80" : "text-muted-foreground/90",
                  )}
                  strokeWidth={1.75}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="min-w-0 flex-1 truncate text-left">
                      {folder.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    align="start"
                    className="max-w-80 whitespace-nowrap text-ellipsis"
                    side="top"
                  >
                    {folder.name}
                  </TooltipContent>
                </Tooltip>
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label="New task in this folder"
                    className="mr-1 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover/folder:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onCreate(folder.id);
                    }}
                    type="button"
                  >
                    <Plus className="size-3.5" strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>New task in {folder.name}</TooltipContent>
              </Tooltip>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-44">
            <ContextMenuSub>
              <ContextMenuSubTrigger
                disabled={tasks.length === 0}
                title={
                  tasks.length === 0
                    ? "Folder is empty"
                    : `Copy ${tasks.length} task${tasks.length === 1 ? "" : "s"}`
                }
              >
                <Copy className="size-3.5 text-muted-foreground" />
                Copy
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                <ContextMenuItem
                  disabled={tasks.length === 0}
                  onSelect={() => {
                    void onCopyFolder(folder, "markdown");
                  }}
                >
                  <FileText className="size-3.5 text-muted-foreground" />
                  Copy as Markdown
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={tasks.length === 0}
                  onSelect={() => {
                    void onCopyFolder(folder, "csv");
                  }}
                >
                  <FileSpreadsheet className="size-3.5 text-muted-foreground" />
                  Copy as CSV
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            {onTagFolderRelease && releases && releases.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger
                  title={
                    folder.releaseName
                      ? `Release: ${folder.releaseName}`
                      : "Tag this folder with a release"
                  }
                >
                  <Tag className="size-3.5 text-muted-foreground" />
                  {folder.releaseName
                    ? `Release ${folder.releaseName}`
                    : "Tag for release"}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-48">
                  {releases.map((r) => (
                    <ContextMenuItem
                      key={r.name}
                      onSelect={() =>
                        void onTagFolderRelease(folder.id, r.name)
                      }
                    >
                      <Tag className="size-3.5 text-muted-foreground" />
                      <span className="truncate">
                        {r.version ? `${r.name} (${r.version})` : r.name}
                      </span>
                    </ContextMenuItem>
                  ))}
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={() => void onRemoveFolderRelease?.(folder.id)}
                  >
                    <X className="size-3.5 text-muted-foreground" />
                    Remove release tag
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => onRenameFolder(folder)}>
              <Pencil className="size-3.5 text-muted-foreground" />
              Rename folder
            </ContextMenuItem>
            {tasks.length === 0 ? (
              <ContextMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDeleteFolder(folder)}
                title="Delete this empty folder"
              >
                <Trash2 className="size-3.5" />
                Delete folder
              </ContextMenuItem>
            ) : (
              <ContextMenuSub>
                <ContextMenuSubTrigger
                  title={`Delete folder (${tasks.length} task${tasks.length === 1 ? "" : "s"})`}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                  Delete folder
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-56">
                  <ContextMenuItem
                    onSelect={() => onDeleteFolder(folder)}
                    title="Remove the folder and keep its tasks in the Uncategorized bucket"
                  >
                    <FolderMinus className="size-3.5 text-muted-foreground" />
                    Delete folder only
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => onDeleteFolder(folder)}
                    title="Permanently delete the folder and all its tasks (and their timelines)"
                  >
                    <Trash2 className="size-3.5" />
                    Delete folder and tasks
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}
          </ContextMenuContent>
        </ContextMenu>
      )}
      <div
        aria-hidden={grouped ? !open : undefined}
        className={cn(
          "grid min-w-0 transition-[grid-template-rows,opacity,transform] duration-150 ease-out motion-reduce:transition-none",
          open
            ? "grid-rows-[1fr] translate-y-0 opacity-100"
            : "pointer-events-none grid-rows-[0fr] -translate-y-0.5 opacity-0",
          grouped && "ml-4",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col gap-px overflow-hidden",
            grouped && "pt-0.5",
          )}
        >
          {tasks.length === 0 && grouped ? (
            <div className="h-6 truncate px-1.5 text-xs leading-6 text-muted-foreground/70">
              No tasks in this folder
            </div>
          ) : (
            tasks.map((task) => (
              <TaskRow
                folders={folders}
                grouped={grouped}
                hasDraft={hasDraft(task.id)}
                key={task.id}
                onMove={onMove}
                onDeleteTask={onDeleteTask}
                onRemoveTaskRelease={onRemoveTaskRelease}
                onSelect={onSelect}
                onTagTaskRelease={onTagTaskRelease}
                onTogglePin={onTogglePin}
                isPinned={pinnedTaskIds.includes(task.id)}
                releases={releases}
                selected={selectedId === task.id}
                task={task}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

interface FolderDialogState {
  id: string | null;
  mode: "create" | "rename";
  name: string;
  error: string;
  saving: boolean;
}

function FolderDialog({
  dialog,
  onOpenChange,
  onSubmit,
}: {
  dialog: FolderDialogState | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    setName(dialog?.name ?? "");
  }, [dialog]);

  if (!dialog) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(name);
  }

  const title = dialog.mode === "create" ? "New folder" : "Rename folder";
  const action = dialog.mode === "create" ? "Create" : "Rename";

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Name the folder that will group related tasks.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              autoFocus
              id="folder-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Frontend polish"
              value={name}
            />
            {dialog.error && (
              <p className="text-xs text-destructive">{dialog.error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={dialog.saving || !name.trim()} type="submit">
              {dialog.saving ? `${action}…` : action}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTaskDialog({
  task,
  onOpenChange,
  onConfirm,
  title = "Delete task?",
  description = "This removes the task and its timeline from the local workspace. Later we can add a safer archive-first flow for tasks you may want to keep.",
  confirmLabel = "Delete task",
}: {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!task) setDeleting(false);
  }, [task]);

  if (!task) return null;

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          {task.title}
        </div>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={deleting}
            onClick={() => {
              setDeleting(true);
              void onConfirm().finally(() => setDeleting(false));
            }}
            type="button"
            variant="destructive"
          >
            {deleting ? "Deleting..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteFolderDialog({
  folder,
  taskCount,
  onOpenChange,
  onConfirm,
}: {
  folder: FolderModel | null;
  taskCount: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (mode: "cascade" | "unassign") => Promise<void>;
}) {
  const [deleting, setDeleting] = useState<"cascade" | "unassign" | null>(null);

  useEffect(() => {
    if (!folder) setDeleting(null);
  }, [folder]);

  if (!folder) return null;

  const busy = deleting !== null;
  const run = (mode: "cascade" | "unassign") => {
    setDeleting(mode);
    void onConfirm(mode).finally(() => setDeleting(null));
  };

  const isEmpty = taskCount === 0;

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete folder?</DialogTitle>
          <DialogDescription>
            {isEmpty
              ? "This folder is empty and can be safely removed."
              : `This folder contains ${taskCount} task${taskCount === 1 ? "" : "s"}. Choose what should happen to them.`}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          {folder.name}
        </div>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          {isEmpty ? (
            <Button
              disabled={busy}
              onClick={() => run("cascade")}
              type="button"
              variant="destructive"
            >
              <Trash2 className="mr-1.5 size-3.5" />
              {deleting === "cascade" ? "Deleting..." : "Delete folder"}
            </Button>
          ) : (
            <>
              <Button
                disabled={busy}
                onClick={() => run("unassign")}
                type="button"
                variant="outline"
              >
                <FolderMinus className="mr-1.5 size-3.5" />
                {deleting === "unassign" ? "Removing..." : "Delete folder only"}
              </Button>
              <Button
                disabled={busy}
                onClick={() => run("cascade")}
                type="button"
                variant="destructive"
              >
                <Trash2 className="mr-1.5 size-3.5" />
                {deleting === "cascade"
                  ? "Deleting..."
                  : "Delete folder and tasks"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskRow({
  task,
  selected,
  onSelect,
  onMove,
  onDeleteTask,
  folders,
  grouped,
  hasDraft,
  onTagTaskRelease,
  onRemoveTaskRelease,
  onTogglePin,
  releases,
  variant = "active",
  isPinned = false,
  compact = false,
}: {
  task: Task;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (taskId: string, folderId: string | null) => Promise<void>;
  onDeleteTask: (task: Task) => void;
  folders: FolderModel[];
  grouped: boolean;
  hasDraft: boolean;
  onTagTaskRelease?: (taskId: string, name: string) => Promise<void>;
  onRemoveTaskRelease?: (taskId: string) => Promise<void>;
  onTogglePin?: (taskId: string) => void;
  releases?: Release[];
  variant?: "active" | "archive";
  isPinned?: boolean;
  compact?: boolean;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Button
          aria-current={selected ? "page" : undefined}
          className={cn(
            "group/task w-full min-w-0 justify-start gap-2 overflow-hidden rounded px-1.5 text-left text-sm shadow-none",
            compact ? "h-6" : "h-7",
            selected
              ? "bg-accent/70 text-foreground"
              : "text-muted-foreground hover:bg-accent/45 hover:text-foreground",
          )}
          onClick={() => onSelect(task.id)}
          variant="ghost"
        >
          <TaskStatusDot hasDraft={hasDraft} status={task.status} />
          <span className="w-full flex-1 truncate text-sm font-normal text-current select-text">
            {task.title}
          </span>
          <span
            aria-label={`Delete ${task.title}`}
            className="ml-auto hidden size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/task:flex group-hover/task:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteTask(task);
            }}
            role="button"
            tabIndex={0}
          >
            <Trash2 className="size-3.5" />
          </span>
        </Button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onSelect={() => {
            void copyTaskSummary(task).then(() =>
              toast.success("Task summary copied"),
            );
          }}
        >
          <Copy className="size-3.5 text-muted-foreground" />
          Copy summary
        </ContextMenuItem>
        {onTogglePin && (
          <ContextMenuItem onSelect={() => onTogglePin(task.id)}>
            <Pin className="size-3.5 rotate-45 text-muted-foreground" />
            {isPinned ? "Unpin task" : "Pin task"}
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Folder className="size-3.5 text-muted-foreground" />
            Move to
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {folders.length === 0 && (
              <ContextMenuItem disabled>No folders yet</ContextMenuItem>
            )}
            {folders.map((folder) => (
              <ContextMenuItem
                disabled={folder.id === task.folderId}
                key={folder.id}
                onSelect={() => void onMove(task.id, folder.id)}
              >
                <Folder className="size-3.5 text-muted-foreground" />
                <span className="truncate">{folder.name}</span>
              </ContextMenuItem>
            ))}
            {task.folderId && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => void onMove(task.id, null)}>
                  Remove from folder
                </ContextMenuItem>
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        {onTagTaskRelease && releases && releases.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger
              title={
                task.releaseName
                  ? `Release: ${task.releaseName}`
                  : "Tag this task with a release"
              }
            >
              <Tag className="size-3.5 text-muted-foreground" />
              {task.releaseName
                ? `Release ${task.releaseName}`
                : "Tag for release"}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              {releases.map((r) => (
                <ContextMenuItem
                  key={r.name}
                  onSelect={() => void onTagTaskRelease(task.id, r.name)}
                >
                  <Tag className="size-3.5 text-muted-foreground" />
                  <span className="truncate">
                    {r.version ? `${r.name} (${r.version})` : r.name}
                  </span>
                </ContextMenuItem>
              ))}
              <ContextMenuSeparator />
              <ContextMenuItem
                onSelect={() => void onRemoveTaskRelease?.(task.id)}
              >
                <X className="size-3.5 text-muted-foreground" />
                Remove release tag
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => onDeleteTask(task)}
        >
          <Trash2 className="size-3.5" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Archive-mode row: a checkbox drives multi-select, the row body
// opens the task in the read-only view, and on hover two icon
// buttons surface (restore + delete) since those are the only
// state-changing actions available in archive. Mirrors the
// TaskRow shape: single line, no subtitle, status row is the
// only context.
function ArchiveRow({
  task,
  selected,
  checked,
  busy,
  onSelect,
  onToggleChecked,
  onRestore,
  onDelete,
}: {
  task: Task;
  selected: boolean;
  checked: boolean;
  busy: boolean;
  onSelect: () => void;
  onToggleChecked: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group/row flex h-7 min-w-0 items-center gap-2 rounded px-1.5 text-left text-sm transition-colors",
        selected
          ? "bg-accent/70 text-foreground"
          : "text-muted-foreground hover:bg-accent/45 hover:text-foreground",
      )}
    >
      <span className="relative grid size-3.5 shrink-0 place-items-center cursor-pointer">
        <input
          aria-label={`Select ${task.title}`}
          checked={checked}
          className="peer size-3.5 cursor-pointer appearance-none rounded-[3px] border border-border bg-background/60 transition-colors checked:border-primary checked:bg-primary hover:border-ring/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onChange={onToggleChecked}
          onClick={(event) => event.stopPropagation()}
          type="checkbox"
        />
        {checked && (
          <Check
            aria-hidden
            className="pointer-events-none absolute size-3 text-primary-foreground"
            strokeWidth={3}
          />
        )}
      </span>
      <button
        className="min-w-0 flex-1 text-left"
        onClick={onSelect}
        title={`Archived ${formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}`}
        type="button"
      >
        <span className="block w-full truncate text-sm font-normal text-current">
          {task.title}
        </span>
      </button>
      <div className="hidden shrink-0 items-center gap-0.5 group-hover/row:flex group-focus-within/row:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={`Restore ${task.title}`}
              className="size-6 text-muted-foreground hover:text-foreground"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onRestore();
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ArchiveRestore className="size-3.5" strokeWidth={1.75} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Restore to active</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={`Delete ${task.title}`}
              className="size-6 text-muted-foreground hover:text-destructive"
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete permanently</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function TaskStatusDot({
  status,
  hasDraft,
}: {
  status: Task["status"];
  hasDraft?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        STATUS_DOT[status],
        hasDraft &&
          "ring-2 ring-offset-1 ring-offset-background ring-amber-400/80",
      )}
    />
  );
}

function formatSearchMessageQuery(query: string) {
  if (query.length <= SEARCH_MESSAGE_MAX_LENGTH) return query;
  return `${query.slice(0, SEARCH_MESSAGE_MAX_LENGTH)}...`;
}
