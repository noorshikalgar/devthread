import {
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
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Folder as FolderModel, Release, Task } from "@/lib/types";
import { STATUS_BG, STATUS_DOT } from "@/lib/status";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
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

interface Props {
  tasks: Task[];
  folders: FolderModel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (folderId?: string | null) => Promise<void>;
  onCreateFolder: (name: string) => Promise<void>;
  onCopyFolder: (
    folder: FolderModel,
    format: "markdown" | "csv",
  ) => Promise<void> | void;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onMoveTask: (taskId: string, folderId: string | null) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onDeleteFolder: (
    folderId: string,
    mode: "cascade" | "unassign",
  ) => Promise<void>;
  newFolderDialogRef?: { current: (() => void) | null };
  onRemoveTaskRelease?: (taskId: string) => Promise<void>;
  onRemoveFolderRelease?: (folderId: string) => Promise<void>;
  onTagTaskRelease?: (taskId: string, name: string) => Promise<void>;
  onTagFolderRelease?: (folderId: string, name: string) => Promise<void>;
  releases?: Release[];
}

const UNCATEGORIZED = "__ungrouped__";

export function TaskSidebar({
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
  onTagTaskRelease,
  onTagFolderRelease,
  releases,
}: Props) {
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

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (!term) return true;
      return `${task.title} ${task.status} ${task.nextStep ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [tasks, query]);

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

  const hasAnyContent = filtered.length > 0 || folders.length > 0;
  const activeTasks = useMemo(
    () => filtered.filter((task) => task.status === "active"),
    [filtered],
  );

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card text-card-foreground">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Tasks
          </span>
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] text-foreground">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="New folder"
                onClick={openCreateFolderDialog}
                size="icon-sm"
                variant="ghost"
              >
                <FolderPlus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New folder</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="New task"
                disabled={creating}
                onClick={() => void handleCreate()}
                size="icon-sm"
                variant="ghost"
              >
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New task</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="border-b border-border/60 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search tasks"
            className="h-7 pl-7 text-xs"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks"
            value={query}
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
        <nav
          aria-label="Tasks"
          className="flex w-full min-w-0 flex-col overflow-hidden"
        >
          {!!activeTasks.length && (
            <section
              aria-label="Active tasks"
              className="flex min-w-0 flex-col overflow-hidden border-b border-border/60"
            >
              <button
                aria-expanded={openActiveTasks}
                className="flex min-w-0 items-center gap-1 px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                onClick={() => setOpenActiveTasks((open) => !open)}
                type="button"
              >
                <ChevronRight
                  className={cn(
                    "size-3 transition-transform duration-150 ease-out",
                    openActiveTasks && "rotate-90",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">Active tasks</span>
                <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-muted/70 px-1 font-mono text-[10px] text-muted-foreground">
                  {activeTasks.length}
                </span>
              </button>
              {openActiveTasks && (
                <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden px-2 pb-2">
                  {activeTasks.map((task) => (
                    <button
                      className={cn(
                        "min-w-0 rounded-sm border border-transparent px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                        selectedId === task.id &&
                          "border-border bg-accent/50 text-foreground",
                      )}
                      key={task.id}
                      onClick={() => onSelect(task.id)}
                      type="button"
                    >
                      <EllipsisTooltip
                        className="w-full truncate"
                        text={task.title}
                      />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="flex min-w-0 flex-col gap-2 overflow-hidden px-2 py-2">
            {folders.map((folder) => (
              <FolderGroup
                collapsed={collapsedFolderIds.has(folder.id)}
                folder={folder}
                folders={folders}
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
                onToggleFolder={toggleFolder}
                releases={releases}
                selectedId={selectedId}
                tasks={grouped.get(folder.id) ?? []}
              />
            ))}
            {grouped.get(UNCATEGORIZED)?.length ? (
              <FolderGroup
                folder={null}
                folders={folders}
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
                onToggleFolder={toggleFolder}
                releases={releases}
                selectedId={selectedId}
                tasks={grouped.get(UNCATEGORIZED) ?? []}
              />
            ) : null}
          </div>

          {!hasAnyContent && (
            <div className="flex flex-col items-center gap-2 px-2 py-8 text-center text-xs text-muted-foreground">
              <ListTodo className="size-5 opacity-60" />
              {query.trim() ? (
                <span>No tasks match “{query.trim()}”.</span>
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

function FolderGroup({
  folder,
  folders,
  tasks,
  selectedId,
  collapsed,
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
  releases,
}: {
  folder: FolderModel | null;
  folders: FolderModel[];
  tasks: Task[];
  selectedId: string | null;
  collapsed?: boolean;
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
  releases?: Release[];
}) {
  if (!tasks.length && !folder) return null;
  const grouped = Boolean(folder);
  const open = grouped ? !collapsed : true;
  const FolderIcon = open ? FolderOpen : Folder;
  return (
    <section className="flex min-w-0 flex-col gap-0.5 overflow-hidden">
      {folder && (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              aria-expanded={open}
              className="group/folder flex min-w-0 items-center gap-1 rounded px-1 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              onClick={() => onToggleFolder(folder.id)}
              type="button"
            >
              <ChevronRight
                className={cn(
                  "size-3 transition-transform duration-150 ease-out",
                  open && "rotate-90",
                )}
              />
              <FolderIcon className="size-3 transition-transform duration-150 ease-out group-hover/folder:scale-105" />
              <EllipsisTooltip
                className="min-w-0 flex-1 truncate"
                text={folder.name}
              />
              <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-muted/70 px-1 font-mono text-[10px] text-muted-foreground group-hover/folder:text-foreground">
                {tasks.length}
              </span>
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-44">
            <ContextMenuItem onSelect={() => void onCreate(folder.id)}>
              <Plus className="size-3.5 text-muted-foreground" />
              New task in folder
            </ContextMenuItem>
            <ContextMenuSeparator />
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
      {open && (
        <div
          className={cn(
            "flex min-w-0 flex-col gap-0.5 overflow-hidden",
            grouped && "relative ml-[12px] border-l border-border/80 pl-2 pt-1",
          )}
        >
          {tasks.map((task) => (
            <TaskRow
              folders={folders}
              grouped={grouped}
              key={task.id}
              onMove={onMove}
              onDeleteTask={onDeleteTask}
              onRemoveTaskRelease={onRemoveTaskRelease}
              onSelect={onSelect}
              onTagTaskRelease={onTagTaskRelease}
              releases={releases}
              selected={selectedId === task.id}
              task={task}
            />
          ))}
        </div>
      )}
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
}: {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
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
          <DialogTitle>Delete task?</DialogTitle>
          <DialogDescription>
            This removes the task and its timeline from the local workspace.
            Later we can add a safer archive-first flow for tasks you may want
            to keep.
          </DialogDescription>
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
            {deleting ? "Deleting..." : "Delete task"}
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
  onTagTaskRelease,
  onRemoveTaskRelease,
  releases,
}: {
  task: Task;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (taskId: string, folderId: string | null) => Promise<void>;
  onDeleteTask: (task: Task) => void;
  folders: FolderModel[];
  grouped: boolean;
  onTagTaskRelease?: (taskId: string, name: string) => Promise<void>;
  onRemoveTaskRelease?: (taskId: string) => Promise<void>;
  releases?: Release[];
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Button
          aria-current={selected ? "page" : undefined}
          className={cn(
            "group/task h-auto w-full min-w-0 justify-start gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left shadow-none",
            grouped &&
              "relative before:absolute before:left-[-7px] before:top-1/2 before:h-px before:w-1.5 before:bg-border/80",
            selected
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          )}
          onClick={() => onSelect(task.id)}
          variant="ghost"
        >
          <span
            aria-hidden
            className={cn(
              "mt-0.5 size-1.5 shrink-0 rounded-full",
              STATUS_DOT[task.status],
            )}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
            <EllipsisTooltip
              className="w-full truncate text-[13px] font-medium text-foreground select-text"
              text={task.title}
            />
            <span className="flex min-w-0 items-center text-[10px] text-muted-foreground">
              <span
                className={cn(
                  "inline-flex h-4 shrink-0 items-center rounded px-1 text-[9px] font-medium",
                  STATUS_BG[task.status],
                )}
              >
                {task.status}
              </span>
            </span>
          </span>
          <span
            aria-label={`Delete ${task.title}`}
            className="ml-auto hidden h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/task:flex group-hover/task:opacity-100"
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

function EllipsisTooltip({
  className,
  text,
}: {
  className?: string;
  text: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
            className,
          )}
        >
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent
        align="start"
        className="max-w-80 whitespace-normal break-words leading-5"
        side="top"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
