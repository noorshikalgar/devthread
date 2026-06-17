import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleHelp,
  Eraser,
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
  parseSlashCommand,
  resolveMentionsInContent,
} from "@/lib/composer";
import {
  clearComposerDraft as clearComposerDraftStore,
  getComposerDraft,
  setComposerDraft,
  type ComposerDraft,
} from "@/lib/composerDraftStore";
import {
  ENTRY_TYPES,
  type EntryType,
  type PendingImage,
  type Visibility,
} from "@/lib/types";
import { openExternalUrl, safeExternalUrl } from "@/lib/openExternal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  visibilityToggleRef?: { current: (() => void) | null };
  compact?: boolean;
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

export function Composer({
  taskId,
  onSubmit,
  visibilityToggleRef,
  compact = false,
}: Props) {
  const [content, setContent] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("note");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visibilityToggleRef) return;
    visibilityToggleRef.current = () => undefined;
    return () => {
      visibilityToggleRef.current = null;
    };
  }, [visibilityToggleRef]);
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

  // Hydrate the draft from the per-task store so switching away
  // and back preserves what the user was typing.
  useEffect(() => {
    const draft = getComposerDraft(taskId);
    setContent(draft?.content ?? "");
    setEntryType(draft?.entryType ?? "note");
    setImages(draft?.images ?? []);
    setError("");
    setMention({ active: false, query: "", anchor: 0 });
    if (!compact) requestAnimationFrame(() => textarea.current?.focus());
  }, [compact, taskId]);

  useEffect(() => {
    function hydrateFromStore() {
      const draft = getComposerDraft(taskId);
      const nextContent = draft?.content ?? "";
      const nextEntryType = draft?.entryType ?? "note";
      const nextImages = draft?.images ?? [];
      setContent((current) =>
        current === nextContent ? current : nextContent,
      );
      setEntryType((current) =>
        current === nextEntryType ? current : nextEntryType,
      );
      setImages((current) =>
        samePendingImages(current, nextImages) ? current : nextImages,
      );
    }

    window.addEventListener("devthread:composer-drafts", hydrateFromStore);
    return () =>
      window.removeEventListener("devthread:composer-drafts", hydrateFromStore);
  }, [taskId]);

  // Persist the in-progress draft so it survives task switches.
  // We only update the store when the user has actually entered
  // something (content, images, or a non-default entry type) —
  // an empty draft doesn't deserve a ring on the sidebar dot.
  useEffect(() => {
    const trimmed = content.trim();
    const hasContent = trimmed.length > 0 || images.length > 0;
    if (!hasContent && entryType === "note") {
      clearComposerDraftStore(taskId);
      return;
    }
    const draft: ComposerDraft = { content, entryType, images };
    setComposerDraft(taskId, draft);
  }, [content, entryType, images, taskId]);

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

  function resetComposer() {
    setContent("");
    setImages([]);
    setEntryType("note");
    setError("");
    setMention({ active: false, query: "", anchor: 0 });
    clearComposerDraftStore(taskId);
    requestAnimationFrame(() => textarea.current?.focus());
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
      await onSubmit(parsed.entryType, submittedContent, "private", images);
      setContent("");
      setImages([]);
      setEntryType("note");
      setMention({ active: false, query: "", anchor: 0 });
      clearComposerDraftStore(taskId);
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
  const submitDisabled = saving || (!content.trim() && !images.length);

  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card/95 px-2 py-1.5 shadow-sm">
        <Input
          aria-label="Add quick update"
          autoComplete="off"
          className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
          onChange={(event) => changeContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Add update..."
          value={content}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Add update"
              className="size-7 shrink-0"
              disabled={submitDisabled}
              onClick={() => void submit()}
              size="icon-sm"
            >
              <Send className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{metaKey} + ↵ in full composer</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <Card
      aria-label="Add work update"
      className={cn(
        "overflow-visible border-border/70 bg-card/95 shadow-sm transition-[border-color,box-shadow,background-color]",
        focused &&
          "border-[rgba(255,255,255,0.28)] shadow-[0_0_0_1px_rgba(255,255,255,0.05)]",
      )}
    >
      <CardContent className="relative space-y-2 p-2.5">
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <Textarea
              aria-label="What happened?"
              autoFocus
              className="max-h-[190px] min-h-[64px] resize-none overflow-y-auto border-0 bg-transparent px-2 py-1.5 text-sm leading-6 shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
              onBlur={() => setFocused(false)}
              onChange={(event) => changeContent(event.target.value)}
              onFocus={() => setFocused(true)}
              onKeyDown={keyDown}
              onPaste={paste}
              onSelect={(event) =>
                updateMention((event.target as HTMLTextAreaElement).value)
              }
              placeholder="Type an update, blocker, note, progress..."
              ref={textarea}
              rows={2}
              value={content}
            />
            {mention.active && filteredOptions.length > 0 && (
              <div
                aria-label="Entry type suggestions"
                className="absolute left-2 top-9 z-50 w-80 max-w-[calc(100%-1rem)] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl"
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
                        "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs",
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
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                        {option.label}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        @{option.aliases[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/55 pt-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Select
              onValueChange={(value) => setEntryType(value as EntryType)}
              value={entryType}
            >
              <SelectTrigger
                aria-label="Entry type"
                className="h-7 w-auto gap-1 rounded-md border-0 bg-muted/55 px-2 text-xs font-medium shadow-none hover:bg-muted"
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
            <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border/60" />
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
            {(content.trim() || images.length > 0) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Clear draft"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={resetComposer}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <Eraser />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear draft</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Attach images"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground [&_svg]:size-3.5"
                  onClick={() => fileInput.current?.click()}
                  size="sm"
                  variant="ghost"
                >
                  <ImagePlus />
                  <span>Attach image</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach or paste images</TooltipContent>
            </Tooltip>
            <span
              aria-label="Hint: Type @ to change the content type (progress, blocker, etc)"
              className="inline-flex items-center gap-1 rounded bg-muted/35 px-1.5 py-1 text-[11px] text-muted-foreground"
            >
              <span className="font-medium text-muted-foreground/90">
                Hint:{" "}
              </span>
              <span>
                Type <span className="font-mono text-foreground/75">@</span> to
                change the content type
              </span>
              <span className="hidden sm:inline">
                {" "}
                (progress, blocker, etc)
              </span>
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-7 gap-1.5 px-3 text-xs font-medium shadow-sm transition-transform active:scale-[0.98] [&_svg]:size-3.5"
                disabled={submitDisabled}
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

function samePendingImages(left: PendingImage[], right: PendingImage[]) {
  return (
    left.length === right.length &&
    left.every((image, index) => image.id === right[index]?.id)
  );
}
