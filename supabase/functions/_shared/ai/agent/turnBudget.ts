/**
 * Wall-clock budget for one agent turn.
 *
 * Supabase edge functions are killed at their wall-clock limit, and a turn is up to 8 model
 * rounds of up to 45s each. The deadline lets the loop stop starting new rounds while there is
 * still time left to synthesize, run the safety guard and persist the reply.
 */

/** Total soft budget for the whole turn, below the platform kill limit. */
export const DEFAULT_TURN_DEADLINE_MS = 110_000;
/** A new model round may only start with this much budget left (45s model timeout + headroom). */
export const MIN_MS_FOR_ANOTHER_ROUND = 50_000;

export type TurnDeadline = {
  elapsedMs: () => number;
  remainingMs: () => number;
  /** False once a further model round could not finish before the deadline. */
  hasRoomForAnotherRound: () => boolean;
};

export function createTurnDeadline(
  totalMs: number = DEFAULT_TURN_DEADLINE_MS,
  now: () => number = Date.now,
  minRoundMs: number = MIN_MS_FOR_ANOTHER_ROUND
): TurnDeadline {
  const startedAt = now();
  const elapsedMs = () => Math.max(0, now() - startedAt);
  const remainingMs = () => Math.max(0, totalMs - elapsedMs());
  return {
    elapsedMs,
    remainingMs,
    hasRoomForAnotherRound: () => remainingMs() >= minRoundMs,
  };
}

/** Reads the optional env override; ignores anything that is not a sane positive number. */
export function turnDeadlineMsFromEnv(raw: string | undefined | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 20_000 || parsed > 140_000) {
    return DEFAULT_TURN_DEADLINE_MS;
  }
  return Math.round(parsed);
}
