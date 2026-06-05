import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  ListTodo,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Folder as FolderModel, Task } from "@/lib/types";
import { STATUS_BG, STATUS_DOT } from "@/lib/status";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
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
import { cn } from "@/lib/utils";

interface Props {
  tasks: Task[];
  folders: FolderModel[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => Promise<void>;
  onCreateFolder: (name: string) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onMoveTask: (taskId: string, folderId: string | null) => Promise<void>;
}

const UNCATEGORIZED = "__ungrouped__";

export function TaskSidebar({
  tasks,
  folders,
  selectedId,
  onSelect,
  onCreate,
  onCreateFolder,
  onRenameFolder,
  onMoveTask,
}: Props) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(
    new Set(),
  );
  const [folderDialog, setFolderDialog] = useState<FolderDialogState | null>(
    null,
  );

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

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card text-card-foreground">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tasks
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/80">
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
            placeholder="Search threads"
            value={query}
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
        <nav
          aria-label="Tasks"
          className="flex w-full min-w-0 flex-col gap-3 overflow-hidden p-3"
        >
          {folders.map((folder) => (
            <FolderGroup
              collapsed={collapsedFolderIds.has(folder.id)}
              folder={folder}
              folders={folders}
              key={folder.id}
              onMove={handleMove}
              onRenameFolder={openRenameFolderDialog}
              onSelect={onSelect}
              onToggleFolder={toggleFolder}
              selectedId={selectedId}
              tasks={grouped.get(folder.id) ?? []}
            />
          ))}
          {grouped.get(UNCATEGORIZED)?.length ? (
            <FolderGroup
              folder={null}
              folders={folders}
              onMove={handleMove}
              onRenameFolder={openRenameFolderDialog}
              onSelect={onSelect}
              onToggleFolder={toggleFolder}
              selectedId={selectedId}
              tasks={grouped.get(UNCATEGORIZED) ?? []}
            />
          ) : null}

          {!hasAnyContent && (
            <div className="flex flex-col items-center gap-2 px-2 py-8 text-center text-xs text-muted-foreground">
              <ListTodo className="size-5 opacity-60" />
              {query.trim() ? (
                <span>No threads match “{query.trim()}”.</span>
              ) : (
                <>
                  <span>No task threads yet.</span>
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

      <div className="flex h-9 items-center justify-between border-t border-border px-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <span>Dogfood milestone</span>
        <span>Local only</span>
      </div>

      <FolderDialog
        dialog={folderDialog}
        onOpenChange={(open) => {
          if (!open) setFolderDialog(null);
        }}
        onSubmit={submitFolderDialog}
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
  onRenameFolder,
  onToggleFolder,
  onMove,
}: {
  folder: FolderModel | null;
  folders: FolderModel[];
  tasks: Task[];
  selectedId: string | null;
  collapsed?: boolean;
  onSelect: (id: string) => void;
  onRenameFolder: (folder: FolderModel) => void;
  onToggleFolder: (folderId: string) => void;
  onMove: (taskId: string, folderId: string | null) => Promise<void>;
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
              <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
                {tasks.length}
              </span>
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-44">
            <ContextMenuItem onSelect={() => onRenameFolder(folder)}>
              <Pencil className="size-3.5 text-muted-foreground" />
              Rename folder
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}
      {open && (
        <div
          className={cn(
            "flex min-w-0 flex-col gap-0.5 overflow-hidden",
            grouped && "relative ml-[18px] border-l border-border/80 pl-3 pt-1",
          )}
        >
          {tasks.map((task) => (
            <TaskRow
              folders={folders}
              grouped={grouped}
              key={task.id}
              onMove={onMove}
              onSelect={onSelect}
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
            Name the folder that will group related task threads.
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

function TaskRow({
  task,
  selected,
  onSelect,
  onMove,
  folders,
  grouped,
}: {
  task: Task;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (taskId: string, folderId: string | null) => Promise<void>;
  folders: FolderModel[];
  grouped: boolean;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Button
          aria-current={selected ? "page" : undefined}
          className={cn(
            "h-auto w-full min-w-0 justify-start gap-2 overflow-hidden rounded-md px-2.5 py-2 text-left shadow-none",
            grouped &&
              "relative before:absolute before:left-[-11px] before:top-1/2 before:h-px before:w-2 before:bg-border/80",
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
              className="w-full truncate text-[13px] font-medium text-foreground"
              text={task.title}
            />
            <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
              <span
                className={cn(
                  "inline-flex h-4 shrink-0 items-center rounded px-1 text-[9px] font-medium",
                  STATUS_BG[task.status],
                )}
              >
                {task.status}
              </span>
              <EllipsisTooltip
                className="min-w-0 flex-1 truncate"
                text={task.nextStep || "No next step"}
              />
            </span>
          </span>
        </Button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuLabel>Move to</ContextMenuLabel>
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
        className="max-w-80 break-words border border-border bg-popover text-popover-foreground"
        side="top"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
