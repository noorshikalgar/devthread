import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleHelp,
  ImagePlus,
  Lightbulb,
  Send,
  StickyNote,
  X,
} from "lucide-react";
import {
  ClipboardEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fileToPendingImage } from "@/lib/content";
import { extractLinkPreviews } from "@/lib/content";
import {
  detectMention,
  draftKey,
  parseSlashCommand,
  resolveMentionsInContent,
} from "@/lib/composer";
import {
  ENTRY_TYPES,
  type EntryType,
  type PendingImage,
  type Visibility,
} from "@/lib/types";
import { openExternalUrl, safeExternalUrl } from "@/lib/openExternal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
  onSubmit: (
    type: EntryType,
    content: string,
    visibility: Visibility,
    images: PendingImage[],
  ) => Promise<void>;
}

interface MentionOption {
  type: EntryType;
  label: string;
  aliases: string[];
  hint: string;
  Icon: typeof StickyNote;
}

const MENTION_OPTIONS: MentionOption[] = [
  {
    type: "note",
    label: "Note",
    aliases: ["note", "notes"],
    hint: "A general update or piece of context",
    Icon: StickyNote,
  },
  {
    type: "progress",
    label: "Progress",
    aliases: ["progress"],
    hint: "What moved forward",
    Icon: CircleDot,
  },
  {
    type: "finding",
    label: "Finding",
    aliases: ["finding", "findings"],
    hint: "A discovery worth keeping",
    Icon: Lightbulb,
  },
  {
    type: "blocker",
    label: "Blocker",
    aliases: ["blocker", "blockers"],
    hint: "Something stuck in the way",
    Icon: CircleAlert,
  },
  {
    type: "decision",
    label: "Decision",
    aliases: ["decision", "decisions"],
    hint: "A choice that was made",
    Icon: CircleCheck,
  },
];

const COMPOSER_ENTRY_TYPES: EntryType[] = [
  "note",
  "progress",
  "finding",
  "blocker",
  "decision",
];

function optionMatchesQuery(option: MentionOption, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return option.aliases.some((alias) => alias.startsWith(normalized));
}

export function Composer({ taskId, onSubmit }: Props) {
  const [content, setContent] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("note");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  const [focused, setFocused] = useState(false);
  const [mention, setMention] = useState({
    active: false,
    query: "",
    anchor: 0,
  });
  const [mentionIndex, setMentionIndex] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mentionList = useRef<HTMLDivElement>(null);
  const links = extractLinkPreviews(content);

  const filteredOptions = useMemo(
    () =>
      MENTION_OPTIONS.filter((option) =>
        optionMatchesQuery(option, mention.query),
      ),
    [mention.query],
  );

  useEffect(() => {
    setContent(localStorage.getItem(draftKey(taskId)) ?? "");
    setImages([]);
    setError("");
    setMention({ active: false, query: "", anchor: 0 });
  }, [taskId]);

  useEffect(() => {
    if (content) localStorage.setItem(draftKey(taskId), content);
    else localStorage.removeItem(draftKey(taskId));
  }, [content, taskId]);

  useEffect(() => {
    if (!mention.active) return;
    if (mentionIndex >= filteredOptions.length) {
      setMentionIndex(0);
    }
  }, [filteredOptions, mention.active, mentionIndex]);

  useEffect(() => {
    if (!mention.active) return;
    const list = mentionList.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>(
      `[data-mention-index="${mentionIndex}"]`,
    );
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [mention.active, mentionIndex, filteredOptions.length]);

  const updateMention = useCallback((value: string) => {
    const cursor = textarea.current?.selectionStart ?? value.length;
    setMention(detectMention(value, cursor));
    setMentionIndex(0);
  }, []);

  function changeContent(value: string) {
    setContent(value);
    updateMention(value);
  }

  function selectMention(option: MentionOption) {
    const cursor = textarea.current?.selectionStart ?? content.length;
    const nextContent = removeMentionTrigger(content, mention.anchor, cursor);
    setEntryType(option.type);
    setContent(nextContent);
    setMention({ active: false, query: "", anchor: 0 });
    requestAnimationFrame(() => {
      textarea.current?.focus();
      const nextCursor = Math.max(
        0,
        Math.min(mention.anchor, nextContent.length),
      );
      textarea.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function submit() {
    if (mention.active) {
      const current = filteredOptions[mentionIndex] ?? filteredOptions[0];
      if (current) {
        selectMention(current);
      }
      return;
    }
    const mentions = resolveMentionsInContent(content, entryType);
    const workingType = mentions.type ?? entryType;
    const cleanedContent = mentions.cleaned;
    const parsed = parseSlashCommand(cleanedContent, workingType);
    if ((!parsed.content.trim() && !images.length) || saving) return;
    setSaving(true);
    setError("");
    try {
      const submittedContent =
        parsed.content.trim() ||
        `Attached ${images.length === 1 ? "image" : `${images.length} images`}.`;
      await onSubmit(parsed.entryType, submittedContent, visibility, images);
      setContent("");
      setImages([]);
      setEntryType("note");
      setMention({ active: false, query: "", anchor: 0 });
      requestAnimationFrame(() => textarea.current?.focus());
    } catch (cause) {
      setError(String(cause));
    } finally {
      setSaving(false);
    }
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (mention.active) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((index) =>
          filteredOptions.length ? (index + 1) % filteredOptions.length : 0,
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex((index) =>
          filteredOptions.length
            ? (index - 1 + filteredOptions.length) % filteredOptions.length
            : 0,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const current = filteredOptions[mentionIndex] ?? filteredOptions[0];
        if (current) {
          event.preventDefault();
          selectMention(current);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMention({ active: false, query: "", anchor: 0 });
        return;
      }
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  }

  async function addImages(files: File[]) {
    try {
      const next = await Promise.all(files.map(fileToPendingImage));
      setImages((current) => [...current, ...next].slice(0, 8));
      setError("");
    } catch (cause) {
      setError(String(cause));
    }
  }

  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = [...event.clipboardData.files].filter((file) =>
      file.type.startsWith("image/"),
    );
    if (!files.length) return;
    event.preventDefault();
    void addImages(files);
  }

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/i.test(navigator.platform);
  const metaKey = isMac ? "⌘" : "Ctrl";

  return (
    <Card
      aria-label="Add work update"
      className={cn(
        "border-border/60 bg-card transition-shadow",
        focused && "shadow-md ring-1 ring-ring/30",
      )}
    >
      <CardContent className="space-y-3 p-3">
        <div className="flex flex-col gap-1">
          <div className="relative">
            <Textarea
              aria-label="What happened?"
              autoFocus
              className="max-h-[220px] min-h-[88px] resize-none overflow-y-auto border-0 bg-transparent p-1 text-sm leading-6 shadow-none focus-visible:ring-0"
              onBlur={() => setFocused(false)}
              onChange={(event) => changeContent(event.target.value)}
              onFocus={() => setFocused(true)}
              onKeyDown={keyDown}
              onPaste={paste}
              onSelect={(event) =>
                updateMention((event.target as HTMLTextAreaElement).value)
              }
              placeholder="What happened?  Type @ to switch entry type"
              ref={textarea}
              rows={3}
              value={content}
            />
            {mention.active && filteredOptions.length > 0 && (
              <div
                aria-label="Entry type suggestions"
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
                ref={mentionList}
                role="listbox"
              >
                {filteredOptions.map((option, index) => {
                  const active = index === mentionIndex;
                  const Icon = option.Icon ?? CircleHelp;
                  return (
                    <button
                      aria-selected={active}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-xs",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/60",
                      )}
                      data-mention-index={index}
                      key={option.type}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectMention(option);
                      }}
                      onMouseEnter={() => setMentionIndex(index)}
                      role="option"
                      type="button"
                    >
                      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-medium text-foreground">
                          {option.label}
                        </span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {option.hint}
                        </span>
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        @{option.aliases[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <p className="px-1 text-[11px] text-muted-foreground">
            Add an update, finding, blocker, decision, link… Type{" "}
            <span className="font-mono">@</span> to switch the entry type.
          </p>
        </div>

        {!!images.length && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
            {images.map((image) => (
              <div className="relative" key={image.id}>
                <img
                  alt={image.name}
                  className="block h-24 w-full rounded-md border border-border bg-muted object-cover"
                  src={image.previewUrl}
                />
                <Button
                  aria-label={`Remove ${image.name}`}
                  className="absolute right-1.5 top-1.5"
                  onClick={() =>
                    setImages((current) =>
                      current.filter((candidate) => candidate.id !== image.id),
                    )
                  }
                  size="icon-sm"
                  variant="secondary"
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
        )}

        {!!links.length && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {links.map((link) => (
              <a
                className="flex min-w-[200px] max-w-[280px] flex-col rounded-md border border-border bg-muted/40 px-3 py-2 text-xs hover:bg-accent"
                href={safeExternalUrl(link.url) ?? "#"}
                key={link.url}
                onClick={(event) => {
                  event.preventDefault();
                  void openExternalUrl(link.url);
                }}
                rel="noreferrer"
                target="_blank"
              >
                <span className="font-medium text-foreground">{link.host}</span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {link.label || link.url}
                </span>
              </a>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
          <div className="flex flex-wrap items-center gap-1">
            <Select
              onValueChange={(value) => setEntryType(value as EntryType)}
              value={entryType}
            >
              <SelectTrigger
                aria-label="Entry type"
                className="h-7 w-auto gap-1 px-2 text-xs shadow-none"
              >
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {ENTRY_TYPES.filter((type) =>
                  COMPOSER_ENTRY_TYPES.includes(type),
                ).map((type) => (
                  <SelectItem key={type} value={type}>
                    {MENTION_OPTIONS.find((option) => option.type === type)
                      ?.label ?? type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              onValueChange={(value) => setVisibility(value as Visibility)}
              value={visibility}
            >
              <SelectTrigger
                aria-label="Visibility"
                className="h-7 w-auto gap-1 px-2 text-xs shadow-none"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="report">Report eligible</SelectItem>
              </SelectContent>
            </Select>
            <input
              accept="image/*"
              className="sr-only"
              multiple
              onChange={(event) => {
                void addImages([...(event.target.files ?? [])]);
                event.target.value = "";
              }}
              ref={fileInput}
              type="file"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Attach images"
                  onClick={() => fileInput.current?.click()}
                  size="icon-sm"
                  variant="ghost"
                >
                  <ImagePlus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach or paste images</TooltipContent>
            </Tooltip>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={saving || (!content.trim() && !images.length)}
                onClick={() => void submit()}
                size="sm"
              >
                <Send />
                {saving ? "Adding…" : "Add"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {metaKey} + ↵ to add · Type @ to switch type
            </TooltipContent>
          </Tooltip>
        </div>

        {error && (
          <p className="text-[11px] text-destructive">
            {error} Draft retained.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function removeMentionTrigger(content: string, anchor: number, cursor: number) {
  if (anchor < 0) return content;
  const before = content.slice(0, anchor);
  const after = content.slice(cursor);
  const joined = `${before}${after}`.replace(/[ \t]{2,}/g, " ");
  return anchor === 0 ? joined.trimStart() : joined;
}
