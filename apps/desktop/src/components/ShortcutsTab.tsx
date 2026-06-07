import { KeyboardIcon } from "lucide-react";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
}

interface Group {
  label: string;
  shortcuts: Shortcut[];
}

const GROUPS: Group[] = [
  {
    label: "Global",
    shortcuts: [
      { keys: joinMod(MOD, "K"), description: "Open command palette" },
      { keys: joinMod(MOD, ","), description: "Open settings" },
      { keys: joinMod(MOD, "N"), description: "New task" },
      { keys: joinMod(MOD, SHIFT, "N"), description: "New folder" },
      { keys: joinMod(MOD, "B"), description: "Toggle task sidebar" },
      { keys: joinMod(MOD, SHIFT, "A"), description: "Toggle archive view" },
      { keys: joinMod(MOD, SHIFT, "W"), description: "Open worklog view" },
    ],
  },
  {
    label: "Task header",
    shortcuts: [
      { keys: joinMod(MOD, "E"), description: "Edit title" },
      { keys: joinMod(MOD, "L"), description: "Open log-time dialog" },
      { keys: joinMod(MOD, "F"), description: "Focus timeline search" },
      {
        keys: joinMod(MOD, SHIFT, "C"),
        description: "Copy task summary (Markdown)",
      },
      {
        keys: joinMod(MOD, SHIFT, "E"),
        description: "Copy task summary (CSV)",
      },
      { keys: joinMod(MOD, "⌫"), description: "Archive / restore" },
      { keys: joinMod(MOD, SHIFT, "⌫"), description: "Delete (with confirm)" },
    ],
  },
  {
    label: "Composer",
    shortcuts: [
      { keys: "@", description: "Open entry-type picker" },
      { keys: `↑ / ↓`, description: "Move mention selection" },
      { keys: `Enter / Tab`, description: "Insert selected type" },
      { keys: `Esc`, description: "Close mention picker" },
      { keys: joinMod(MOD, "↵"), description: "Submit entry" },
      { keys: joinMod(MOD, SHIFT, "P"), description: "Toggle visibility" },
    ],
  },
  {
    label: "Navigation",
    shortcuts: [
      { keys: joinMod(MOD, "↓"), description: "Next task in sidebar" },
      { keys: joinMod(MOD, "↑"), description: "Previous task in sidebar" },
    ],
  },
];

export function ShortcutsTab() {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyboardIcon className="size-4 text-muted-foreground" />
          Shortcuts
        </DialogTitle>
        <DialogDescription>
          {isMac
            ? "Keyboard shortcuts use ⌘ (Command). They work anywhere in the app, including while typing in inputs."
            : "Keyboard shortcuts use Ctrl. They work anywhere in the app, including while typing in inputs."}
        </DialogDescription>
      </DialogHeader>
      <div className="mt-6 space-y-6 overflow-y-auto pr-2">
        {GROUPS.map((group) => (
          <section key={group.label}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </h3>
            <div className="mt-2 divide-y divide-border/60 rounded-md border border-border/60">
              {group.shortcuts.map((shortcut) => (
                <div
                  className="flex items-center justify-between gap-3 px-3 py-2"
                  key={shortcut.keys}
                >
                  <span className="text-sm text-foreground">
                    {shortcut.description}
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
    return (
      <kbd className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
        {keys}
      </kbd>
    );
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
          <kbd
            className={cn(
              "inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground",
              part.length > 1 && "px-2",
            )}
            key={`${part}-${index}`}
          >
            {part}
          </kbd>
        ),
      )}
    </span>
  );
}
