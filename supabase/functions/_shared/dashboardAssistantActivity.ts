/**
 * Records server-side turn activity for the dashboard assistant activity_timeline block.
 * Application-hydrated only — never model-authored.
 */

import { getAssistantToolActivityLabel } from './assistantToolLabels.ts';
import type { ChatBlock } from './dashboardAssistantSafetyGuard.ts';
import type {
  AssistantStreamEmitter,
  AssistantStreamTaskPlanStep,
  TaskPlanStepStatus,
} from './dashboardAssistantStreamEvents.ts';

export type ActivityPhase = 'understanding' | 'tool' | 'synthesizing' | 'safety';

export type ActivityTimelineEntry = {
  id: string;
  phase: ActivityPhase;
  label: string;
  toolName?: string;
  status: 'done' | 'failed';
  durationMs?: number;
  /** Host-facing reason for a failed tool row. */
  reason?: string;
};

export type TaskPlanStep = {
  id: string;
  label: string;
  status: TaskPlanStepStatus;
  toolName?: string;
  reason?: string;
};

const PHASE_STREAM_MAP: Record<
  ActivityPhase,
  'understanding' | 'executing' | 'synthesizing' | 'safety'
> = {
  understanding: 'understanding',
  tool: 'executing',
  synthesizing: 'synthesizing',
  safety: 'safety',
};

const PHASE_DONE_LABELS: Partial<Record<ActivityPhase, string>> = {
  understanding: 'Understood your question',
  synthesizing: 'Prepared your answer',
  safety: 'Checked response safety',
};

const PHASE_PROGRESS_LABELS: Partial<Record<ActivityPhase, string>> = {
  understanding: 'Understanding your question',
  synthesizing: 'Preparing your answer',
  safety: 'Checking response safety',
};

function progressLabelForPhase(phase: ActivityPhase, doneLabel: string): string {
  if (doneLabel.includes('action for your review')) return 'Preparing action for your review';
  if (doneLabel.includes('Applying changes')) return 'Applying changes';
  return PHASE_PROGRESS_LABELS[phase] ?? doneLabel;
}

export class TurnActivityRecorder {
  private entries: ActivityTimelineEntry[] = [];

  constructor(private emit?: AssistantStreamEmitter) {}

  recordPhase(phase: ActivityPhase, label: string, status: 'done' | 'failed' = 'done'): void {
    const doneLabel = label || PHASE_DONE_LABELS[phase] || label;
    this.entries.push({
      id: crypto.randomUUID(),
      phase,
      label: doneLabel,
      status,
    });
    this.emit?.({
      type: 'phase',
      phase: PHASE_STREAM_MAP[phase],
      label: progressLabelForPhase(phase, doneLabel),
    });
  }

  recordToolStart(toolName: string, stepId?: string): void {
    this.emit?.({
      type: 'tool_start',
      toolName,
      label: getAssistantToolActivityLabel(toolName, 'progress'),
      stepId,
    });
  }

  recordToolComplete(
    toolName: string,
    ok: boolean,
    startedAtMs: number,
    stepId?: string,
    failureReason?: string,
    /** Queued Tier 1 writes: stream progress only; the commit adds the timeline row. */
    options: { omitFromTimeline?: boolean } = {}
  ): void {
    const durationMs = Math.max(0, Date.now() - startedAtMs);
    const reason = ok ? undefined : failureReason;
    const label = getAssistantToolActivityLabel(toolName, ok ? 'done' : 'failed');
    const last = this.entries[this.entries.length - 1];
    if (options.omitFromTimeline) {
      // Nothing is applied yet, so a "done" row here would claim a change that may never commit.
    } else if (
      // Collapse consecutive identical tool rows (e.g. list_bookings called in two rounds).
      last &&
      last.phase === 'tool' &&
      last.toolName === toolName &&
      last.label === label &&
      last.status === (ok ? 'done' : 'failed')
    ) {
      last.durationMs = (last.durationMs ?? 0) + durationMs;
    } else {
      this.entries.push({
        id: crypto.randomUUID(),
        phase: 'tool',
        label,
        toolName,
        status: ok ? 'done' : 'failed',
        durationMs,
        ...(reason ? { reason } : {}),
      });
    }
    this.emit?.({
      type: 'tool_done',
      toolName,
      ok,
      durationMs,
      stepId,
      ...(reason ? { reason } : {}),
    });
    if (stepId) {
      this.emit?.({
        type: 'plan_update',
        stepId,
        status: ok ? 'done' : 'failed',
        ...(reason ? { reason } : {}),
      });
    }
  }

  get entryCount(): number {
    return this.entries.length;
  }

  hasToolActivity(): boolean {
    return this.entries.some((e) => e.phase === 'tool');
  }

  buildBlock(): ChatBlock | null {
    if (this.entries.length === 0) return null;
    return {
      type: 'activity_timeline',
      entries: this.entries,
    };
  }
}

/** Live + final task checklist for multi-step tool batches (2+ tools in one round). */
export class TurnTaskPlanRecorder {
  private steps: TaskPlanStep[] = [];
  private title = 'Working on your request';
  private active = false;
  /** True once the model declared its own goals via `plan_task` — replaces per-round inference. */
  private goalPlanActive = false;

  constructor(private emit?: AssistantStreamEmitter) {}

  /** Phase 2 `plan_task`: the model's own declared sub-goals, called before any other tool. */
  declareGoals(goals: readonly string[]): void {
    const cleaned = goals.map((g) => String(g ?? '').trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    this.active = true;
    this.goalPlanActive = true;
    this.steps = cleaned.map((label, index) => ({
      id: `g${index}`,
      label,
      status: 'pending' as const,
    }));
    const streamSteps: AssistantStreamTaskPlanStep[] = this.steps.map((step) => ({ ...step }));
    this.emit?.({ type: 'plan', title: this.title, steps: streamSteps });
  }

  /**
   * Phase 4 resumable turns: seed the plan from a prior turn's unfinished `task_plan` block
   * (the "Continue" chip) instead of starting goal-planning over. Steps already `done` stay
   * done; anything else (`pending`/`running`/`failed`) resets to `pending` so it's retried this
   * turn. Synth placeholder rows from the prior turn are dropped — this turn gets its own.
   */
  resumeFrom(priorSteps: readonly Pick<TaskPlanStep, 'id' | 'label' | 'status'>[]): void {
    const carried = priorSteps.filter((step) => !step.id.endsWith('-synth'));
    if (carried.length === 0) return;
    this.active = true;
    this.goalPlanActive = true;
    this.steps = carried.map((step) => ({
      id: step.id,
      label: step.label,
      status: step.status === 'done' ? ('done' as const) : ('pending' as const),
    }));
    const streamSteps: AssistantStreamTaskPlanStep[] = this.steps.map((step) => ({ ...step }));
    this.emit?.({ type: 'plan', title: this.title, steps: streamSteps });
  }

  /**
   * After a round where at least one real tool call succeeded, advance the earliest open
   * declared goal. Positional, not semantic — a simple, deterministic progress signal, not an
   * attempt to match a goal's text to which tool addressed it.
   */
  advanceDeclaredGoal(): void {
    if (!this.goalPlanActive) return;
    const next = this.steps.find((step) => step.status === 'pending');
    if (!next) return;
    this.updateStep(next.id, 'done');
    this.emit?.({ type: 'plan_update', stepId: next.id, status: 'done' });
  }

  initFromToolCalls(toolCalls: Array<{ name: string }>, roundIndex: number): void {
    // A declared-goal plan replaces the inferred per-tool checklist for this turn — one
    // coherent list, not two.
    if (this.goalPlanActive) return;
    if (toolCalls.length < 2) return;
    this.active = true;
    // Drop prior synth placeholder so multi-round batches accumulate tool steps.
    this.steps = this.steps.filter((step) => !step.id.endsWith('-synth'));
    const nextTools = toolCalls.map((call, index) => ({
      id: `r${roundIndex}-t${index}`,
      label: getAssistantToolActivityLabel(call.name, 'progress').replace(/…$/, ''),
      status: 'pending' as const,
      toolName: call.name,
    }));
    for (const tool of nextTools) {
      let existingIdx = -1;
      for (let i = this.steps.length - 1; i >= 0; i -= 1) {
        if (this.steps[i]?.toolName === tool.toolName) {
          existingIdx = i;
          break;
        }
      }
      if (existingIdx >= 0) {
        // Reuse the prior row for a repeated tool instead of listing it twice.
        this.steps[existingIdx] = {
          ...this.steps[existingIdx],
          id: tool.id,
          label: tool.label,
          status: 'pending',
        };
      } else {
        this.steps.push(tool);
      }
    }
    this.steps.push({
      id: `r${roundIndex}-synth`,
      label: 'Prepare your answer',
      status: 'pending',
    });
    const streamSteps: AssistantStreamTaskPlanStep[] = this.steps.map((step) => ({ ...step }));
    this.emit?.({ type: 'plan', title: this.title, steps: streamSteps });
  }

  markRunning(stepId: string): void {
    if (!this.active) return;
    this.updateStep(stepId, 'running');
    this.emit?.({ type: 'plan_update', stepId, status: 'running' });
  }

  markDone(stepId: string, ok: boolean, failureReason?: string): void {
    if (!this.active) return;
    this.updateStep(stepId, ok ? 'done' : 'failed');
    const step = this.steps.find((s) => s.id === stepId);
    if (step) {
      if (!ok && failureReason) step.reason = failureReason;
      else delete step.reason;
    }
  }

  markSynthRunning(): void {
    const synth = this.steps.find((s) => s.id.endsWith('-synth'));
    if (synth) this.markRunning(synth.id);
  }

  markSynthDone(): void {
    const synth = this.steps.find((s) => s.id.endsWith('-synth'));
    if (synth) {
      this.updateStep(synth.id, 'done');
      this.emit?.({ type: 'plan_update', stepId: synth.id, status: 'done' });
    }
  }

  buildBlock(): ChatBlock | null {
    if (!this.active || this.steps.length < 2) return null;
    return {
      type: 'task_plan',
      title: this.title,
      steps: this.steps,
    };
  }

  /** Steps not yet finished when the turn ran out of rounds/budget — see completionCheck.ts. */
  getOpenSteps(): Array<{ id: string; label: string }> {
    return this.steps
      .filter((step) => step.status === 'pending' || step.status === 'running')
      .filter((step) => !step.id.endsWith('-synth'))
      .map((step) => ({ id: step.id, label: step.label }));
  }

  private updateStep(stepId: string, status: TaskPlanStepStatus): void {
    const step = this.steps.find((s) => s.id === stepId);
    if (step) step.status = status;
  }
}

/** Prepend activity timeline when the turn did meaningful work beyond a plain reply. */
export function prependActivityTimeline(
  blocks: ChatBlock[],
  recorder: TurnActivityRecorder
): ChatBlock[] {
  const timeline = recorder.buildBlock();
  if (!timeline) return blocks;
  if (!recorder.hasToolActivity() && recorder.entryCount <= 1) return blocks;
  return [timeline, ...blocks];
}

export function prependTaskPlan(blocks: ChatBlock[], recorder: TurnTaskPlanRecorder): ChatBlock[] {
  const plan = recorder.buildBlock();
  if (!plan) return blocks;
  return [plan, ...blocks];
}
