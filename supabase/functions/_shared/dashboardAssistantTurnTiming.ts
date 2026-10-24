/**
 * Per-turn latency breakdown for dashboard-assistant-chat.
 *
 * One `TurnTimer` per turn records how long each phase took so the super-admin AI Usage tab can
 * show p50/p95 per router module and the guard-mode split, and so the QA loop can read a
 * `turn_timing` SSE event instead of eyeballing a stopwatch. Phases:
 *
 *   preload  — settings, quota, conversation row, grounding facts, prior-turn context
 *   model[]  — every tool-calling model round (one entry per round)
 *   tools[]  — every tool execution (name + ms; names are tool ids, never host data)
 *   synth    — the structured block synthesis call (0 when `respond_with_blocks` replaced it)
 *   guard    — the response safety check (LLM or deterministic)
 *   commit   — persisting the assistant row + usage increment
 *
 * Persisted as `ai_dashboard_assistant_messages.latency_breakdown` (snake_case keys so SQL
 * rollups can read them directly) with `guard_mode` denormalized to its own column.
 */

export type TurnGuardMode =
  /** The model-assisted safety reviewer ran. */
  | 'llm'
  /** Grounding + quick scan were the guard; no reviewer call. */
  | 'deterministic'
  /** The quick regex scan rejected the answer before any reviewer call. */
  | 'blocked'
  /** No model-written text to guard (Tier-2 proposal, tool-provided refusal). */
  | 'none';

export const TURN_GUARD_MODES: readonly TurnGuardMode[] = [
  'llm',
  'deterministic',
  'blocked',
  'none',
] as const;

export type TurnToolTiming = { name: string; ms: number };

export type LatencyBreakdown = {
  preload_ms: number | null;
  model_ms: number[];
  tools_ms: TurnToolTiming[];
  synth_ms: number | null;
  guard_ms: number | null;
  commit_ms: number | null;
  total_ms: number;
  guard_mode: TurnGuardMode | null;
  /** Router modules sent this turn (`core` first). Empty when the router failed open. */
  modules: string[];
  /** First non-core module, or `core`; the AI Usage tab groups by this. */
  primary_module: string;
  rounds: number;
  /** True when the final round used `respond_with_blocks` (no separate synth call). */
  synth_inline: boolean;
};

const round = (ms: number): number => Math.max(0, Math.round(ms));

export function primaryModuleFor(modules: readonly string[]): string {
  return modules.find((module) => module !== 'core') ?? 'core';
}

export class TurnTimer {
  private readonly startedAt: number;
  private preloadMs: number | null = null;
  private readonly modelMs: number[] = [];
  private readonly toolsMs: TurnToolTiming[] = [];
  private synthMs: number | null = null;
  private guardMs: number | null = null;
  private commitMs: number | null = null;
  private guardMode: TurnGuardMode | null = null;
  private modules: string[] = [];
  private synthInline = false;

  constructor(private readonly now: () => number = Date.now) {
    this.startedAt = now();
  }

  /** Runs `fn`, returns its result, records the elapsed time under `phase`. */
  async measure<T>(
    phase: 'preload' | 'model' | 'synth' | 'guard' | 'commit',
    fn: () => Promise<T>
  ): Promise<T> {
    const started = this.now();
    try {
      return await fn();
    } finally {
      this.record(phase, this.now() - started);
    }
  }

  async measureTool<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const started = this.now();
    try {
      return await fn();
    } finally {
      this.recordTool(name, this.now() - started);
    }
  }

  record(phase: 'preload' | 'model' | 'synth' | 'guard' | 'commit', ms: number): void {
    const value = round(ms);
    if (phase === 'preload') this.preloadMs = (this.preloadMs ?? 0) + value;
    else if (phase === 'model') this.modelMs.push(value);
    else if (phase === 'synth') this.synthMs = (this.synthMs ?? 0) + value;
    else if (phase === 'guard') this.guardMs = (this.guardMs ?? 0) + value;
    else this.commitMs = (this.commitMs ?? 0) + value;
  }

  recordTool(name: string, ms: number): void {
    this.toolsMs.push({ name, ms: round(ms) });
  }

  setGuardMode(mode: TurnGuardMode): void {
    this.guardMode = mode;
  }

  setModules(modules: readonly string[]): void {
    this.modules = [...modules];
  }

  markSynthInline(): void {
    this.synthInline = true;
    if (this.synthMs == null) this.synthMs = 0;
  }

  snapshot(): LatencyBreakdown {
    return {
      preload_ms: this.preloadMs,
      model_ms: [...this.modelMs],
      tools_ms: this.toolsMs.map((tool) => ({ ...tool })),
      synth_ms: this.synthMs,
      guard_ms: this.guardMs,
      commit_ms: this.commitMs,
      total_ms: round(this.now() - this.startedAt),
      guard_mode: this.guardMode,
      modules: [...this.modules],
      primary_module: primaryModuleFor(this.modules),
      rounds: this.modelMs.length,
      synth_inline: this.synthInline,
    };
  }
}

/** Sum of every tool execution this turn (tools run serially today, so this is wall time). */
export function totalToolMs(breakdown: Pick<LatencyBreakdown, 'tools_ms'>): number {
  return breakdown.tools_ms.reduce((sum, tool) => sum + tool.ms, 0);
}

/** Sum of every model round (excludes synth and guard, which are separate phases). */
export function totalModelMs(breakdown: Pick<LatencyBreakdown, 'model_ms'>): number {
  return breakdown.model_ms.reduce((sum, ms) => sum + ms, 0);
}
