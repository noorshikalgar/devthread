import {
  Check,
  Info,
  ListTodo,
  Moon,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CommandPalette } from "@/components/CommandPalette";
import { Composer } from "@/components/Composer";
import { TaskHeader } from "@/components/TaskHeader";
import { TaskSidebar } from "@/components/TaskSidebar";
import { Timeline } from "@/components/Timeline";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
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

const SELECTED_TASK_KEY = "devthread:selected-task";
const SIDEBAR_WIDTH_KEY = "devthread:sidebar-width";
const THEME_KEY = "devthread:theme";
const DEFAULT_TASK_TITLE = "Untitled task";
const PAGE_SIZE = 100;
const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 420;
const APP_THEMES = [
  {
    id: "default-dark",
    label: "Default Dark",
    family: "Default",
    dark: true,
  },
  {
    id: "default-light",
    label: "Default Light",
    family: "Default",
    dark: false,
  },
  {
    id: "tokyo-night-dark",
    label: "Tokyo Night",
    family: "Tokyo Night",
    dark: true,
  },
  {
    id: "tokyo-night-light",
    label: "Tokyo Night Light",
    family: "Tokyo Night",
    dark: false,
  },
  {
    id: "zed-dark",
    label: "Zed One Dark",
    family: "Zed",
    dark: true,
  },
  {
    id: "zed-light",
    label: "Zed One Light",
    family: "Zed",
    dark: false,
  },
] as const;
type AppTheme = (typeof APP_THEMES)[number]["id"];

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
  const [theme, setTheme] = useState<AppTheme>(() => {
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
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedId) ?? null,
    [selectedId, tasks],
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

  async function createTask() {
    const task = await api.createTask(DEFAULT_TASK_TITLE);
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

  return (
    <div className="flex h-full min-h-0 w-full bg-background text-foreground">
      <AppRail
        onTaskToggle={() => setSidebarOpen((open) => !open)}
        onThemeChange={setTheme}
        tasksActive={sidebarOpen}
        theme={theme}
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
            onMoveTask={moveTask}
            onRenameFolder={renameFolder}
            onSelect={setSelectedId}
            selectedId={selectedId}
            tasks={tasks}
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
          <EmptyState onOpenSidebar={() => setSidebarOpen(true)} />
        )}
      </main>
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
    </div>
  );
}

function AppRail({
  tasksActive,
  theme,
  onTaskToggle,
  onThemeChange,
}: {
  tasksActive: boolean;
  theme: AppTheme;
  onTaskToggle: () => void;
  onThemeChange: (theme: AppTheme) => void;
}) {
  const themeGroups = Array.from(
    new Set(APP_THEMES.map((option) => option.family)),
  );

  return (
    <aside className="flex h-full w-12 shrink-0 flex-col items-center border-r border-border bg-card py-3 text-card-foreground">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={tasksActive ? "Hide task sidebar" : "Show task sidebar"}
            aria-pressed={tasksActive}
            className={cn(
              "relative rounded-md",
              tasksActive &&
                "bg-secondary text-secondary-foreground before:absolute before:left-[-9px] before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary",
            )}
            onClick={onTaskToggle}
            size="icon-sm"
            variant="ghost"
          >
            <ListTodo />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Tasks</TooltipContent>
      </Tooltip>

      <div className="mt-auto">
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  aria-label="Open settings"
                  size="icon-sm"
                  variant="ghost"
                >
                  <Settings />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
          <PopoverContent
            align="end"
            className="w-72 p-0"
            side="right"
            sideOffset={10}
          >
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Settings</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Local workspace preferences
              </p>
            </div>
            <div className="p-2">
              <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                General
              </div>
              {themeGroups.map((family) => (
                <div className="space-y-1 pb-2 last:pb-0" key={family}>
                  <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                    {family}
                  </div>
                  {APP_THEMES.filter((option) => option.family === family).map(
                    (option) => (
                      <ThemeOption
                        active={theme === option.id}
                        dark={option.dark}
                        key={option.id}
                        label={option.label}
                        onClick={() => onThemeChange(option.id)}
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );
}

function ThemeOption({
  active,
  dark,
  label,
  onClick,
}: {
  active: boolean;
  dark: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = dark ? Moon : Sun;
  return (
    <Button
      aria-pressed={active}
      className="h-8 w-full justify-start gap-2 px-2 text-xs"
      onClick={onClick}
      variant={active ? "secondary" : "ghost"}
    >
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="flex-1 text-left">{label}</span>
      {active && <Check className="size-3.5 text-muted-foreground" />}
    </Button>
  );
}

function isAppTheme(value: string | null): value is AppTheme {
  return APP_THEMES.some((option) => option.id === value);
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

function EmptyState({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-secondary text-sm font-semibold tracking-tight">
        DT
      </div>
      <div className="space-y-1">
        <h1 className="text-balance text-xl font-semibold tracking-tight">
          Keep the thread of your work.
        </h1>
        <p className="text-sm text-muted-foreground">
          Open the sidebar to start a new task, or press{" "}
          <span className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">
            ⌘K
          </span>{" "}
          to search.
        </p>
      </div>
      <Button onClick={onOpenSidebar} size="sm" variant="outline">
        Open sidebar
      </Button>
    </div>
  );
}
