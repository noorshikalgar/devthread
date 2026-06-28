import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock as Clock4,
  ArrowCounterClockwise as RotateCcw,
} from "@phosphor-icons/react";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDuration, parseDuration } from "@/lib/duration";
import type { Visibility } from "@/lib/types";

interface Props {
  open: boolean;
  taskTitle: string;
  now?: () => Date;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: LogTimeInput) => Promise<void>;
}

export interface LogTimeInput {
  occurredAt: string;
  startedAt: string;
  durationMinutes: number;
  contentMarkdown: string;
  visibility: Visibility;
}

const HOURS = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const DURATION_PRESETS = ["15m", "30m", "1h", "2h", "3h", "4h"];

function defaultNow() {
  return new Date();
}

function timeString(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function subtractMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() - minutes * 60_000);
}

function timeParts(value: string) {
  const [rawHours = "0", rawMinutes = "0"] = value.split(":");
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  return {
    hour: String(hours % 12 || 12).padStart(2, "0"),
    minute: String(minutes).padStart(2, "0"),
    period: hours >= 12 ? "PM" : "AM",
  };
}

function timeFromParts(hour: string, minute: string, period: string) {
  let hours = Number(hour);
  if (period === "AM" && hours === 12) hours = 0;
  if (period === "PM" && hours !== 12) hours += 12;
  return `${String(hours).padStart(2, "0")}:${minute}`;
}

function formatTimeLabel(value: string) {
  const { hour, minute, period } = timeParts(value);
  return `${Number(hour)}:${minute} ${period}`;
}

function formatDateTimeLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function LogTimeDialog({
  now: getNow = defaultNow,
  open,
  taskTitle,
  onOpenChange,
  onSubmit,
}: Props) {
  const today = getNow();
  const [date, setDate] = useState<Date>(today);
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const [time, setTime] = useState(() => timeString(today));
  const [endTimeAnchor, setEndTimeAnchor] = useState(today);
  const [timeManuallyEdited, setTimeManuallyEdited] = useState(false);
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const current = getNow();
      setDate(current);
      setEndTimeAnchor(current);
      setTime(timeString(current));
      setTimeManuallyEdited(false);
      setDuration("");
      setNote("");
      setVisibility("private");
      setError("");
    }
  }, [getNow, open]);

  const parsedMinutes = parseDuration(duration);
  const calculatedStartTime = parsedMinutes
    ? timeString(subtractMinutes(endTimeAnchor, parsedMinutes))
    : timeString(getNow());
  const selectedTimeParts = timeParts(time);

  useEffect(() => {
    if (!open || !parsedMinutes || timeManuallyEdited) return;
    setTime(timeString(subtractMinutes(endTimeAnchor, parsedMinutes)));
  }, [endTimeAnchor, open, parsedMinutes, timeManuallyEdited]);

  function updateTimePart(next: Partial<ReturnType<typeof timeParts>>) {
    const current = timeParts(time);
    setTime(
      timeFromParts(
        next.hour ?? current.hour,
        next.minute ?? current.minute,
        next.period ?? current.period,
      ),
    );
    setTimeManuallyEdited(true);
  }

  function useCalculatedStartTime() {
    setTime(calculatedStartTime);
    setTimeManuallyEdited(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsedMinutes) {
      setError(
        "Enter a duration like 30m, 2h, 1d 30m, or 1w (1d = 8h, 1w = 5d).",
      );
      return;
    }
    if (!date) {
      setError("Pick the date the work was done.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const [startHours, startMinutes] = time.split(":").map(Number);
      const startedAt = new Date(date);
      startedAt.setHours(startHours, startMinutes, 0, 0);
      const endedAt = new Date(startedAt.getTime() + parsedMinutes * 60_000);
      const content =
        note.trim() ||
        `Logged ${formatDuration(parsedMinutes)} from ${formatDateTimeLabel(startedAt)} to ${formatDateTimeLabel(endedAt)} on ${taskTitle}.`;
      await onSubmit({
        occurredAt: endedAt.toISOString(),
        startedAt: startedAt.toISOString(),
        durationMinutes: parsedMinutes,
        contentMarkdown: content,
        visibility,
      });
      onOpenChange(false);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock4 className="size-4 text-muted-foreground" />
            Log time
          </DialogTitle>
          <DialogDescription>
            Record how long you spent on {taskTitle}. Press Enter to submit.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4 shrink-0" />
                    <span className="truncate">
                      {date ? format(date, "MMM d, yyyy") : "Pick a date"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    startMonth={sixMonthsAgo}
                    endMonth={endOfMonth}
                    disabled={{ after: today }}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Started</Label>
                <Button
                  aria-label="Use calculated start time"
                  className="h-6 px-2"
                  disabled={!parsedMinutes}
                  onClick={useCalculatedStartTime}
                  type="button"
                  variant="ghost"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    aria-label={`Start time ${formatTimeLabel(time)}`}
                    className="w-full justify-start text-left font-normal"
                    type="button"
                    variant="outline"
                  >
                    <Clock4 className="mr-2 size-4 shrink-0 text-muted-foreground" />
                    <span className="font-mono tabular-nums">
                      {formatTimeLabel(time)}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-3">
                  <div className="grid grid-cols-[1fr_1fr_1fr] gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase text-muted-foreground">
                        Hour
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          updateTimePart({ hour: value })
                        }
                        value={selectedTimeParts.hour}
                      >
                        <SelectTrigger aria-label="Start hour">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOURS.map((hour) => (
                            <SelectItem key={hour} value={hour}>
                              {hour}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase text-muted-foreground">
                        Minute
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          updateTimePart({ minute: value })
                        }
                        value={selectedTimeParts.minute}
                      >
                        <SelectTrigger aria-label="Start minute">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MINUTES.map((minute) => (
                            <SelectItem key={minute} value={minute}>
                              {minute}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase text-muted-foreground">
                        Period
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          updateTimePart({ period: value })
                        }
                        value={selectedTimeParts.period}
                      >
                        <SelectTrigger aria-label="Start period">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AM">AM</SelectItem>
                          <SelectItem value="PM">PM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="log-duration">Time spent</Label>
            <Input
              aria-describedby="log-duration-hint"
              autoFocus
              className="font-mono"
              id="log-duration"
              onChange={(event) => {
                setDuration(event.target.value);
                if (error) setError("");
              }}
              placeholder="1d 3h"
              value={duration}
            />
            <div className="grid grid-cols-6 gap-1.5">
              {DURATION_PRESETS.map((preset) => (
                <Button
                  className="h-7 px-0 font-mono text-[11px]"
                  key={preset}
                  onClick={() => {
                    setDuration(preset);
                    if (error) setError("");
                  }}
                  type="button"
                  variant={duration === preset ? "default" : "outline"}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>
          <p
            className="-mt-2 font-mono text-[10px] text-muted-foreground"
            id="log-duration-hint"
          >
            {parsedMinutes
              ? `= ${formatDuration(parsedMinutes)} · starts ${formatTimeLabel(time)}`
              : "Units: 1d = 8h, 1w = 5d. Combine: 1w 3d 4h 30m."}
          </p>
          <div className="space-y-2">
            <Label htmlFor="log-note">Note (optional)</Label>
            <Input
              id="log-note"
              onChange={(event) => setNote(event.target.value)}
              placeholder="What did you work on?"
              value={note}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="log-visibility">Visibility</Label>
            <Select
              onValueChange={(value) => setVisibility(value as Visibility)}
              value={visibility}
            >
              <SelectTrigger className="h-8" id="log-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="report">Report eligible</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={saving} type="submit" variant="default">
              {saving ? "Logging…" : "Log time"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
