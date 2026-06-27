import {
  ArrowsDownUp as ArrowUpDown,
  Compass,
  FileText,
  Keyboard as KeyboardIcon,
  PencilLine as PenLine,
  MagnifyingGlass as Search,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd as KbdBase } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/i.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";
const ALT = isMac ? "⌥" : "Alt";
const SHIFT = isMac ? "⇧" : "Shift";
const joinMod = (...parts: string[]) =>
  isMac ? parts.join("") : parts.join(" + ");

interface Shortcut {
  keys: string;
  description: string;
  /** Letter in the description that matches the mnemonic key, highlighted so the binding "snaps" to the action. */
  mnemonic?: string;
}

interface Group {
  label: string;
  icon: typeof Compass;
  shortcuts: Shortcut[];
}

const GROUPS: Group[] = [
  {
    label: "Workspaces",
    icon: Compass,
    shortcuts: [
      { keys: joinMod(MOD, "K"), description: "Open command palette" },
      { keys: joinMod(MOD, ","), description: "Open settings" },
      { keys: joinMod(MOD, "B"), description: "Toggle task sidebar" },
      {
        keys: joinMod(MOD, SHIFT, "A"),
        description: "Archive view",
        mnemonic: "A",
      },
      {
        keys: joinMod(MOD, SHIFT, "W"),
        description: "Worklog view",
        mnemonic: "W",
      },
      {
        keys: joinMod(MOD, SHIFT, "R"),
        description: "Releases view",
        mnemonic: "R",
      },
    ],
  },
  {
    label: "Tasks",
    icon: ArrowUpDown,
    shortcuts: [
      { keys: joinMod(MOD, "N"), description: "New task", mnemonic: "N" },
      {
        keys: joinMod(MOD, SHIFT, "N"),
        description: "New folder",
        mnemonic: "N",
      },
      { keys: joinMod(MOD, "↓"), description: "Next task in sidebar" },
      { keys: joinMod(MOD, "↑"), description: "Previous task in sidebar" },
    ],
  },
  {
    label: "Task detail",
    icon: FileText,
    shortcuts: [
      { keys: joinMod(MOD, "E"), description: "Edit title", mnemonic: "E" },
      {
        keys: joinMod(MOD, "L"),
        description: "Log time",
        mnemonic: "L",
      },
      {
        keys: joinMod(MOD, "F"),
        description: "Find in timeline",
        mnemonic: "F",
      },
      {
        keys: joinMod(MOD, SHIFT, "C"),
        description: "Copy summary as Markdown",
        mnemonic: "C",
      },
      {
        keys: joinMod(MOD, SHIFT, "E"),
        description: "Export summary as CSV",
        mnemonic: "E",
      },
      { keys: joinMod(MOD, "⌫"), description: "Archive / restore task" },
      {
        keys: joinMod(MOD, SHIFT, "⌫"),
        description: "Delete task (with confirm)",
      },
    ],
  },
  {
    label: "Composer",
    icon: PenLine,
    shortcuts: [
      { keys: "@", description: "Open entry-type picker" },
      { keys: `↑ / ↓`, description: "Move mention selection" },
      { keys: `Enter / Tab`, description: "Insert selected type" },
      { keys: `Esc`, description: "Close mention picker" },
      { keys: joinMod(MOD, "↵"), description: "Submit entry" },
      {
        keys: joinMod(MOD, SHIFT, "P"),
        description: "Toggle Private / Report visibility",
        mnemonic: "P",
      },
    ],
  },
];

function highlightMnemonic(description: string, mnemonic?: string) {
  if (!mnemonic) return description;
  const index = description.indexOf(mnemonic);
  if (index === -1) return description;
  return (
    <>
      {description.slice(0, index)}
      <span className="font-semibold text-foreground underline decoration-primary/60 decoration-2 underline-offset-2">
        {description[index]}
      </span>
      {description.slice(index + 1)}
    </>
  );
}

export function ShortcutsTab() {
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return GROUPS;
    return GROUPS.map((group) => ({
      ...group,
      shortcuts: group.shortcuts.filter((shortcut) =>
        shortcut.description.toLowerCase().includes(term),
      ),
    })).filter((group) => group.shortcuts.length > 0);
  }, [query]);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyboardIcon className="size-4 text-muted-foreground" />
          Shortcuts
        </DialogTitle>
        <DialogDescription>
          {isMac
            ? "Shortcuts use ⌘ (Command). They work anywhere, including while typing — the mnemonic letter is underlined so it sticks."
            : "Shortcuts use Ctrl. They work anywhere, including while typing — the mnemonic letter is underlined so it sticks."}
        </DialogDescription>
      </DialogHeader>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Filter shortcuts"
          className="h-8 pl-7 text-xs"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter shortcuts…"
          value={query}
        />
      </div>
      <div className="mt-4 space-y-6 overflow-y-auto pr-2">
        {filteredGroups.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No shortcuts match “{query}”.
          </p>
        )}
        {filteredGroups.map((group) => (
          <section key={group.label}>
            <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <group.icon className="size-3.5" />
              {group.label}
            </h3>
            <div className="mt-2 divide-y divide-border/60 rounded-md border border-border/60">
              {group.shortcuts.map((shortcut) => (
                <div
                  className="flex items-center justify-between gap-3 px-3 py-2"
                  key={shortcut.keys + shortcut.description}
                >
                  <span className="text-sm text-foreground">
                    {highlightMnemonic(shortcut.description, shortcut.mnemonic)}
                  </span>
                  <Kbd keys={shortcut.keys} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function Kbd({ keys }: { keys: string }) {
  if (!isMac) {
    return <KbdBase className="h-auto px-2 py-0.5 text-[11px]">{keys}</KbdBase>;
  }
  const parts = keys.split(/(\s|\/)/).filter(Boolean);
  return (
    <span className="flex items-center gap-1">
      {parts.map((part, index) =>
        part === " " || part === "/" ? (
          <span
            className="text-[10px] text-muted-foreground"
            key={`${part}-${index}`}
          >
            {part === " " ? "+" : "/"}
          </span>
        ) : (
          <KbdBase
            className={cn(
              "h-auto min-w-[1.5rem] justify-center px-1.5 py-0.5 text-[11px]",
              part.length > 1 && "px-2",
            )}
            key={`${part}-${index}`}
          >
            {part}
          </KbdBase>
        ),
      )}
    </span>
  );
}
