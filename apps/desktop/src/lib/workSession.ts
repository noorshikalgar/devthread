export type SessionPhase = "work" | "rest";
export type SessionStatus = "idle" | "running" | "paused" | "finished";

export interface WorkSessionState {
  status: SessionStatus;
  phase: SessionPhase;
  workMinutes: number;
  restMinutes: number;
  remainingSeconds: number;
  elapsedWorkSeconds: number;
  elapsedRestSeconds: number;
  /** 1-based — the work phase you're in (or about to start) counts as the current round. */
  round: number;
  linkedTaskId: string | null;
}

export const IDLE_SESSION: WorkSessionState = {
  status: "idle",
  phase: "work",
  workMinutes: 25,
  restMinutes: 5,
  remainingSeconds: 25 * 60,
  elapsedWorkSeconds: 0,
  elapsedRestSeconds: 0,
  round: 1,
  linkedTaskId: null,
};

export const POMODORO_PRESETS = [
  { workMinutes: 25, restMinutes: 5, label: "25 / 5" },
  { workMinutes: 50, restMinutes: 10, label: "50 / 10" },
  { workMinutes: 90, restMinutes: 15, label: "90 / 15" },
] as const;

export function formatSessionClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
