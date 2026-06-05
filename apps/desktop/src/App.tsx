import {
  Archive,
  Download,
  Info,
  ListTodo,
  Moon,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  check,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CommandPalette } from "@/components/CommandPalette";
import { Composer } from "@/components/Composer";
import { TaskHeader } from "@/components/TaskHeader";
import { TaskSidebar } from "@/components/TaskSidebar";
import { Timeline } from "@/components/Timeline";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { APP_THEMES, isAppTheme, type AppThemeId } from "@/lib/themes";
import {
  type Attachment,
  type EntryType,
  type Folder,
  type PendingImage,
  type Task,
  type Visibility,
  type WorkLogEntry,
  type WorkLogRevision,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const SELECTED_TASK_KEY = "taskline:selected-task";
const SIDEBAR_WIDTH_KEY = "taskline:sidebar-width";
const THEME_KEY = "taskline:theme";
const DEFAULT_TASK_TITLE = "Untitled task";
const PAGE_SIZE = 100;
const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 420;

export { TaskHeader } from "@/components/TaskHeader";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    localStorage.getItem(SELECTED_TASK_KEY),
  );
  const [pendingTitleEdit, setPendingTitleEdit] = useState(false);
  const [entries, setEntries] = useState<WorkLogEntry[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [revisions, setRevisions] = useState<WorkLogRevision[]>([]);
  const [historyEntryId, setHistoryEntryId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clampSidebarWidth(Number(localStorage.getItem(SIDEBAR_WIDTH_KEY))),
  );
  const [theme, setTheme] = useState<AppThemeId>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return isAppTheme(saved) ? saved : "default-dark";
  });
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [error, setError] = useState("");
  const [entryTypeFilter, setEntryTypeFilter] = useState<EntryType | "all">(
    "all",
  );
  const [threadSearch, setThreadSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveView, setArchiveView] = useState(false);
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedId) ?? null,
    [selectedId, tasks],
  );
  const sidebarTasks = useMemo(
    () =>
      tasks.filter((task) =>
        archiveView ? task.status === "archived" : task.status !== "archived",
      ),
    [archiveView, tasks],
  );

  useEffect(() => {
    void loadTasks();
    void loadFolders();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const selectedTheme = APP_THEMES.find((option) => option.id === theme);
    localStorage.setItem(THEME_KEY, theme);
    root.classList.toggle("dark", selectedTheme?.dark ?? true);
    for (const option of APP_THEMES) {
      root.classList.toggle(`theme-${option.id}`, option.id === theme);
    }

    return () => {
      for (const option of APP_THEMES) {
        root.classList.remove(`theme-${option.id}`);
      }
    };
  }, [theme]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setEntries([]);
      return;
    }
    localStorage.setItem(SELECTED_TASK_KEY, selectedId);
    void loadEntries(selectedId);
  }, [selectedId]);

  const visibleEntries = useMemo(() => {
    const term = threadSearch.trim().toLowerCase();
    return entries.filter((entry) => {
      if (entryTypeFilter !== "all" && entry.entryType !== entryTypeFilter) {
        return false;
      }
      if (!term) return true;
      return entry.contentMarkdown.toLowerCase().includes(term);
    });
  }, [entries, entryTypeFilter, threadSearch]);

  async function loadTasks() {
    try {
      const next = await api.listTasks();
      setTasks(next);
      const saved = localStorage.getItem(SELECTED_TASK_KEY);
      if (!selectedId || !next.some((task) => task.id === selectedId)) {
        setSelectedId(
          next.find((task) => task.id === saved)?.id ?? next[0]?.id ?? null,
        );
      }
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function loadFolders() {
    try {
      setFolders(await api.listFolders());
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function loadEntries(taskId: string) {
    try {
      const next = await api.listEntries(taskId, PAGE_SIZE, 0);
      const nextAttachments = await api.listAttachments(taskId);
      setEntries(next);
      setAttachments(nextAttachments);
      setHasMore(next.length === PAGE_SIZE);
      setHistoryEntryId(null);
    } catch (cause) {
      setError(String(cause));
    }
  }

  async function createTask(folderId?: string | null) {
    const created = await api.createTask(DEFAULT_TASK_TITLE);
    const task =
      folderId && !created.folderId
        ? await api.moveTask(created.id, folderId)
        : created;
    setTasks((current) => [task, ...current]);
    setSelectedId(task.id);
    setPendingTitleEdit(true);
  }

  async function updateTask(task: Task) {
    const updated = await api.updateTask(task);
    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      ),
    );
  }

  async function createEntry(
    type: EntryType,
    content: string,
    visibility: Visibility,
    images: PendingImage[],
  ) {
    if (!selectedId) return;
    const entry = await api.createEntry(selectedId, type, content, visibility);
    const savedImages: Attachment[] = [];
    for (const image of images) {
      try {
        savedImages.push(
          await api.createAttachment(
            entry.id,
            image.name,
            image.mediaType,
            image.base64Data,
          ),
        );
      } catch (cause) {
        setError(
          `Entry saved, but ${image.name} could not be attached: ${cause}`,
        );
      }
    }
    setEntries((current) => [entry, ...current]);
    setAttachments((current) => [...current, ...savedImages]);
    await loadTasks();
  }

  async function updateEntry(
    id: string,
    type: EntryType,
    content: string,
    visibility: Visibility,
  ) {
    const updated = await api.updateEntry(id, type, content, visibility);
    replaceEntry(updated);
  }

  async function showHistory(entryId: string) {
    if (historyEntryId === entryId) {
      setHistoryEntryId(null);
      return;
    }
    setRevisions(await api.listRevisions(entryId));
    setHistoryEntryId(entryId);
  }

  async function restoreRevision(revisionId: string) {
    const updated = await api.restoreRevision(revisionId);
    replaceEntry(updated);
    setRevisions(await api.listRevisions(updated.id));
  }

  async function trashEntry(entryId: string) {
    await api.trashEntry(entryId);
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    toast("Entry moved to trash.", {
      description: "You can restore it from the trash view.",
      action: {
        label: "Undo",
        onClick: () => void undoTrash(entryId),
      },
    });
  }

  async function undoTrash(entryId: string) {
    if (!selectedId) return;
    await api.restoreEntry(entryId);
    await loadEntries(selectedId);
  }

  async function loadMore() {
    if (!selectedId) return;
    const next = await api.listEntries(selectedId, PAGE_SIZE, entries.length);
    setEntries((current) => [...current, ...next]);
    setHasMore(next.length === PAGE_SIZE);
  }

  async function createFolder(name: string) {
    const folder = await api.createFolder(name);
    setFolders((current) => [...current, folder]);
  }

  async function renameFolder(folderId: string, name: string) {
    const folder = await api.renameFolder(folderId, name);
    setFolders((current) =>
      current.map((candidate) =>
        candidate.id === folder.id ? folder : candidate,
      ),
    );
  }

  async function moveTask(taskId: string, folderId: string | null) {
    const updated = await api.moveTask(taskId, folderId);
    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      ),
    );
  }

  async function deleteTask(taskId: string) {
    await api.deleteTask(taskId);
    setTasks((current) => current.filter((task) => task.id !== taskId));
    if (selectedId === taskId) {
      const next = tasks.find((task) => task.id !== taskId) ?? null;
      setSelectedId(next?.id ?? null);
    }
  }

  function selectFolder(folderId: string | null) {
    if (!sidebarOpen) setSidebarOpen(true);
    const firstTask = tasks.find((task) => task.folderId === folderId);
    if (firstTask) setSelectedId(firstTask.id);
  }

  function selectEntry(taskId: string, entryId: string) {
    if (selectedId !== taskId) {
      setSelectedId(taskId);
    }
    setTimeout(() => {
      const node = document.querySelector(`[data-entry-id="${entryId}"]`);
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }

  function replaceEntry(updated: WorkLogEntry) {
    setEntries((current) =>
      current.map((entry) => (entry.id === updated.id ? updated : entry)),
    );
  }

  function startSidebarResize(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    setResizingSidebar(true);

    function move(pointer: globalThis.MouseEvent) {
      const nextWidth = clampSidebarWidth(
        startWidth + pointer.clientX - startX,
      );
      setSidebarWidth(nextWidth);
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(nextWidth));
    }

    function stop() {
      setResizingSidebar(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    }

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  }

  const statusCounts = useMemo(
    () => ({
      active: tasks.filter((task) => task.status === "active").length,
      planned: tasks.filter((task) => task.status === "planned").length,
      done: tasks.filter((task) => task.status === "done").length,
    }),
    [tasks],
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background text-foreground">
      <div className="flex min-h-0 flex-1">
        <AppRail
          archiveActive={archiveView}
          onArchiveToggle={() => {
            setArchiveView((active) => !active);
            setSidebarOpen(true);
          }}
          onSearchOpen={() => setPaletteOpen(true)}
          onSettingsOpen={() => setSettingsOpen(true)}
          onTaskToggle={() => setSidebarOpen((open) => !open)}
          tasksActive={sidebarOpen}
        />

        <div
          className={cn(
            "relative h-full shrink-0 overflow-hidden border-r border-border transition-[width] duration-200 ease-out",
            resizingSidebar && "transition-none",
          )}
          style={{ width: sidebarOpen ? sidebarWidth : 0 }}
        >
          <div className="h-full" style={{ width: sidebarWidth }}>
            <TaskSidebar
              folders={folders}
              onCreate={createTask}
              onCreateFolder={createFolder}
              onDeleteTask={deleteTask}
              onMoveTask={moveTask}
              onRenameFolder={renameFolder}
              onSelect={setSelectedId}
              selectedId={selectedId}
              tasks={sidebarTasks}
            />
          </div>
          {sidebarOpen && (
            <button
              aria-label="Resize task sidebar"
              className="absolute right-0 top-0 z-20 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40 focus-visible:bg-primary/50 focus-visible:outline-none"
              onDoubleClick={() => {
                setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
                localStorage.setItem(
                  SIDEBAR_WIDTH_KEY,
                  String(DEFAULT_SIDEBAR_WIDTH),
                );
              }}
              onMouseDown={startSidebarResize}
              type="button"
            />
          )}
        </div>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {error && (
            <Alert
              className="m-4 flex items-start gap-3 border-destructive/30 bg-destructive/5"
              variant="destructive"
            >
              <Info />
              <div className="flex-1">
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </div>
              <Button onClick={() => setError("")} size="sm" variant="ghost">
                Dismiss
              </Button>
            </Alert>
          )}
          {selectedTask ? (
            <>
              <TaskHeader
                entriesLoaded={entries.length}
                key={selectedTask.id}
                onPendingTitleEditConsumed={() => setPendingTitleEdit(false)}
                onUpdate={updateTask}
                pendingTitleEdit={pendingTitleEdit}
                task={selectedTask}
              />
              <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1">
                <ThreadColumn
                  entryTypeFilter={entryTypeFilter}
                  onEntryTypeFilterChange={setEntryTypeFilter}
                  onSearchChange={setThreadSearch}
                  search={threadSearch}
                >
                  <Composer onSubmit={createEntry} taskId={selectedTask.id} />
                  <Timeline
                    attachments={attachments}
                    entries={visibleEntries}
                    hasMore={hasMore}
                    historyEntryId={historyEntryId}
                    onEdit={updateEntry}
                    onHistory={showHistory}
                    onLoadMore={loadMore}
                    onRestoreRevision={restoreRevision}
                    onTrash={trashEntry}
                    revisions={revisions}
                  />
                </ThreadColumn>
              </div>
            </>
          ) : (
            <EmptyState onCreateTask={createTask} />
          )}
        </main>
      </div>
      <StatusBar counts={statusCounts} selectedTask={selectedTask} />
      <CommandPalette
        entries={entries}
        folders={folders}
        onOpenChange={setPaletteOpen}
        onSelectEntry={selectEntry}
        onSelectFolder={selectFolder}
        onSelectTask={setSelectedId}
        open={paletteOpen}
        tasks={tasks}
      />
      <SettingsDialog
        onOpenChange={setSettingsOpen}
        onThemeChange={setTheme}
        open={settingsOpen}
        theme={theme}
      />
    </div>
  );
}

function AppRail({
  tasksActive,
  archiveActive,
  onTaskToggle,
  onSearchOpen,
  onArchiveToggle,
  onSettingsOpen,
}: {
  tasksActive: boolean;
  archiveActive: boolean;
  onTaskToggle: () => void;
  onSearchOpen: () => void;
  onArchiveToggle: () => void;
  onSettingsOpen: () => void;
}) {
  return (
    <aside className="flex h-full w-12 shrink-0 flex-col items-center border-r border-border bg-card py-3 text-card-foreground">
      <RailButton
        active={tasksActive}
        icon={ListTodo}
        label={tasksActive ? "Hide task sidebar" : "Show task sidebar"}
        onClick={onTaskToggle}
        tooltip="Tasks"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="Open global search"
            className="mt-1 rounded-md"
            onClick={onSearchOpen}
            size="icon-sm"
            variant="ghost"
          >
            <Search />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Search</TooltipContent>
      </Tooltip>

      <div className="mt-auto flex flex-col gap-1">
        <RailButton
          active={archiveActive}
          icon={Archive}
          label={archiveActive ? "Hide archived tasks" : "Show archived tasks"}
          onClick={onArchiveToggle}
          tooltip="Archive"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Open settings"
              onClick={onSettingsOpen}
              size="icon-sm"
              variant="ghost"
            >
              <Settings />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}

function RailButton({
  active,
  label,
  tooltip,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  tooltip: string;
  icon: typeof ListTodo;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "relative rounded-md",
            active &&
              "bg-secondary text-secondary-foreground before:absolute before:left-[-9px] before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary",
          )}
          onClick={onClick}
          size="icon-sm"
          variant="ghost"
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function StatusBar({
  counts,
  selectedTask,
}: {
  counts: { active: number; planned: number; done: number };
  selectedTask: Task | null;
}) {
  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-card px-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-foreground/80">Local-first</span>
        <span>v0.1.0</span>
        {selectedTask && (
          <span className="hidden min-w-0 truncate sm:inline">
            {selectedTask.title}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span>Active {counts.active}</span>
        <span>Todo {counts.planned}</span>
        <span>Done {counts.done}</span>
      </div>
    </footer>
  );
}

function SettingsDialog({
  open,
  theme,
  onOpenChange,
  onThemeChange,
}: {
  open: boolean;
  theme: AppThemeId;
  onOpenChange: (open: boolean) => void;
  onThemeChange: (theme: AppThemeId) => void;
}) {
  const [update, setUpdate] = useState<Update | null>(null);
  const [updateState, setUpdateState] = useState<
    | "idle"
    | "checking"
    | "available"
    | "none"
    | "downloading"
    | "installed"
    | "error"
  >("idle");
  const [updateMessage, setUpdateMessage] = useState(
    "Check GitHub Releases when you want. Updates never run automatically.",
  );
  const [downloadProgress, setDownloadProgress] = useState(0);

  async function checkForUpdates() {
    setUpdateState("checking");
    setUpdateMessage("Checking GitHub Releases...");
    setDownloadProgress(0);
    try {
      const next = await check({ timeout: 30_000 });
      if (!next) {
        setUpdate(null);
        setUpdateState("none");
        setUpdateMessage("You are already on the latest available version.");
        return;
      }
      setUpdate(next);
      setUpdateState("available");
      setUpdateMessage(
        `Version ${next.version} is available. Review it before installing.`,
      );
    } catch (cause) {
      setUpdate(null);
      setUpdateState("error");
      setUpdateMessage(`Could not check for updates: ${String(cause)}`);
    }
  }

  async function installUpdate() {
    if (!update) return;
    setUpdateState("downloading");
    setUpdateMessage("Downloading update...");
    setDownloadProgress(0);

    let downloaded = 0;
    let total = 0;
    const onEvent = (event: DownloadEvent) => {
      if (event.event === "Started") {
        downloaded = 0;
        total = event.data.contentLength ?? 0;
        setDownloadProgress(0);
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        if (total > 0) {
          setDownloadProgress(
            Math.min(100, Math.round((downloaded / total) * 100)),
          );
        }
      } else {
        setDownloadProgress(100);
      }
    };

    try {
      await update.downloadAndInstall(onEvent, { timeout: 120_000 });
      setUpdateState("installed");
      setUpdateMessage(
        "Update installed. Restart when you are ready; your local Taskline data stays in the app-data folder.",
      );
    } catch (cause) {
      setUpdateState("error");
      setUpdateMessage(`Could not install update: ${String(cause)}`);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="grid h-[520px] w-[min(820px,calc(100vw-32px))] max-w-none grid-cols-[180px_minmax(0,1fr)] gap-0 overflow-hidden p-0">
        <aside className="border-r border-border bg-card/60 p-3">
          <DialogTitle className="px-2 py-2 text-base">Settings</DialogTitle>
          <button
            className="mt-3 flex w-full items-center rounded-md bg-secondary px-2 py-1.5 text-left text-xs font-medium text-secondary-foreground"
            type="button"
          >
            General
          </button>
        </aside>
        <section className="min-w-0 p-6">
          <DialogHeader>
            <DialogTitle>General</DialogTitle>
            <DialogDescription>
              Workspace preferences stored locally on this device.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 max-w-sm space-y-2">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="theme-select"
            >
              Theme
            </label>
            <Select
              onValueChange={(value) => {
                if (isAppTheme(value)) onThemeChange(value);
              }}
              value={theme}
            >
              <SelectTrigger id="theme-select">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Dark</SelectLabel>
                  {APP_THEMES.filter((option) => option.dark).map((option) => {
                    const Icon = Moon;
                    return (
                      <SelectItem key={option.id} value={option.id}>
                        <span className="inline-flex items-center gap-2">
                          <Icon className="size-3.5 text-muted-foreground" />
                          {option.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Light</SelectLabel>
                  {APP_THEMES.filter((option) => !option.dark).map((option) => {
                    const Icon = Sun;
                    return (
                      <SelectItem key={option.id} value={option.id}>
                        <span className="inline-flex items-center gap-2">
                          <Icon className="size-3.5 text-muted-foreground" />
                          {option.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-8 max-w-xl border-t border-border pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm font-medium">Updates</h3>
                <p className="max-w-md text-xs leading-5 text-muted-foreground">
                  Optional update checks use the latest signed GitHub Release.
                  Installing an app update does not touch your local SQLite
                  data.
                </p>
              </div>
              <Button
                disabled={
                  updateState === "checking" || updateState === "downloading"
                }
                onClick={() => void checkForUpdates()}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw
                  className={cn(
                    "size-3.5",
                    updateState === "checking" && "animate-spin",
                  )}
                />
                Check
              </Button>
            </div>
            <div className="mt-4 rounded-md border border-border bg-card p-3">
              <p className="text-xs leading-5 text-muted-foreground">
                {updateMessage}
              </p>
              {update?.body && updateState === "available" && (
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-foreground">
                  {update.body}
                </p>
              )}
              {updateState === "downloading" && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {updateState === "available" && (
                  <Button
                    onClick={() => void installUpdate()}
                    size="sm"
                    type="button"
                  >
                    <Download className="size-3.5" />
                    Download and install
                  </Button>
                )}
                {updateState === "installed" && (
                  <Button
                    onClick={() => void relaunch()}
                    size="sm"
                    type="button"
                  >
                    <RotateCcw className="size-3.5" />
                    Restart Taskline
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function clampSidebarWidth(value: number) {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SIDEBAR_WIDTH;
  const viewportLimit =
    typeof window === "undefined"
      ? MAX_SIDEBAR_WIDTH
      : Math.min(MAX_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.42));
  return Math.min(Math.max(value, MIN_SIDEBAR_WIDTH), viewportLimit);
}

function ThreadColumn({
  children,
  search,
  onSearchChange,
  entryTypeFilter,
  onEntryTypeFilterChange,
}: {
  children: React.ReactNode;
  search: string;
  onSearchChange: (value: string) => void;
  entryTypeFilter: EntryType | "all";
  onEntryTypeFilterChange: (value: EntryType | "all") => void;
}) {
  const FILTERS: { value: EntryType | "all"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "progress", label: "Progress" },
    { value: "finding", label: "Findings" },
    { value: "blocker", label: "Blockers" },
    { value: "decision", label: "Decisions" },
  ];
  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-background/40 px-6 py-2.5">
        <div className="relative min-w-[180px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search this thread"
            className="h-7 pl-7 text-xs"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search this thread…"
            value={search}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((filter) => {
            const active = entryTypeFilter === filter.value;
            return (
              <Button
                aria-pressed={active}
                className={cn(
                  "h-7 rounded-full px-2.5 text-[11px] font-medium",
                  active && "bg-secondary text-secondary-foreground",
                )}
                key={filter.value}
                onClick={() => onEntryTypeFilterChange(filter.value)}
                size="sm"
                variant={active ? "secondary" : "ghost"}
              >
                {filter.label}
              </Button>
            );
          })}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-[920px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}

function EmptyState({ onCreateTask }: { onCreateTask: () => Promise<void> }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-secondary text-sm font-semibold tracking-tight">
        TL
      </div>
      <div className="space-y-1">
        <h1 className="text-balance text-xl font-semibold tracking-tight">
          Keep your work moving in Taskline.
        </h1>
        <p className="text-sm text-muted-foreground">
          Create a task to start capturing context, or press{" "}
          <span className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">
            ⌘K
          </span>{" "}
          to search.
        </p>
      </div>
      <Button onClick={() => void onCreateTask()} size="sm" variant="outline">
        Create new task
      </Button>
    </div>
  );
}
