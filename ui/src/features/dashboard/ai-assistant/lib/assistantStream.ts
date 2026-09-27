/**
 * SSE client for dashboard-assistant-chat streaming turns.
 * Mirror: supabase/functions/_shared/dashboardAssistantStreamEvents.ts
 */

import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import type { PageContext } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { getAssistantToolActivityLabel } from '@/features/dashboard/ai-assistant/lib/assistantToolLabels';
import type { AttachedContextItem } from '@/features/dashboard/ai-assistant/lib/attachedContext';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type AssistantStreamPhase =
  'understanding' | 'planning' | 'executing' | 'synthesizing' | 'safety';

export type TaskPlanStepStatus = 'pending' | 'running' | 'done' | 'failed';

export type AssistantStreamTaskPlanStep = {
  id: string;
  label: string;
  status: TaskPlanStepStatus;
  toolName?: string;
};

export type AssistantStreamEvent =
  | { type: 'turn_started'; conversationId: string }
  | { type: 'phase'; phase: AssistantStreamPhase; label?: string }
  | { type: 'tool_start'; toolName: string; label: string; stepId?: string }
  | { type: 'tool_done'; toolName: string; ok: boolean; durationMs: number; stepId?: string }
  | { type: 'plan'; title: string; steps: AssistantStreamTaskPlanStep[] }
  | { type: 'plan_update'; stepId: string; status: TaskPlanStepStatus }
  | { type: 'text_start' }
  | { type: 'text_chunk'; delta: string }
  | {
      type: 'blocks';
      conversationId: string;
      blocks: ChatBlock[];
      upgradeHook?: boolean;
      /** Persisted assistant row id (feedback, copy, live refresh). */
      messageId?: string;
      /** Persisted user row id this turn answered (edit & resend). */
      userMessageId?: string;
    }
  | {
      type: 'error';
      message: string;
      upgradeHook?: boolean;
      aborted?: boolean;
      appliedEffects?: AssistantAppliedEffect[];
    };

export type AssistantAppliedEffect = {
  toolName: string;
  label: string;
  ok: boolean;
};

export type StreamChatMessageInput = {
  orgSlug: string;
  conversationId?: string | null;
  pageContext: PageContext;
  attachedContext?: AttachedContextItem[];
  message: string;
  /** Host-facing text persisted/shown in the thread (defaults to message). */
  displayMessage?: string;
  attachments?: Array<{ name: string; mimeType: string; dataBase64: string }>;
  /** Re-run the last user turn without inserting a duplicate user message. */
  regenerate?: boolean;
  /** Edit & resend: drop this user message and everything after it, then send `message`. */
  editMessageId?: string;
};

export type StreamChatMessageResult = {
  conversationId: string;
  blocks: ChatBlock[];
  upgradeHook?: boolean;
  messageId?: string;
  userMessageId?: string;
};

export type StreamChatMessageHandlers = {
  onEvent?: (event: AssistantStreamEvent) => void;
  signal?: AbortSignal;
};

export class AssistantStreamAbortedError extends Error {
  override readonly name = 'AssistantStreamAbortedError';
  readonly appliedEffects?: AssistantAppliedEffect[];
  constructor(message = 'Turn cancelled', appliedEffects?: AssistantAppliedEffect[]) {
    super(message);
    this.appliedEffects = appliedEffects;
  }
}

/** Stream cut mid-flight (hot-reload, proxy kill, ERR_INCOMPLETE_CHUNKED_ENCODING). */
export class AssistantStreamInterruptedError extends Error {
  override readonly name = 'AssistantStreamInterruptedError';
  readonly conversationId: string | null;
  constructor(
    conversationId: string | null = null,
    message = 'Connection interrupted. Try again.'
  ) {
    super(message);
    this.conversationId = conversationId;
  }
}

function baseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
}

function parseSseChunk(buffer: string): { events: AssistantStreamEvent[]; rest: string } {
  const events: AssistantStreamEvent[] = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const part of parts) {
    const line = part
      .split('\n')
      .find((row) => row.startsWith('data: '))
      ?.slice(6);
    if (!line) continue;
    try {
      events.push(JSON.parse(line) as AssistantStreamEvent);
    } catch {
      // ignore malformed chunks
    }
  }
  return { events, rest };
}

export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name;
  return (
    name === 'AbortError' ||
    name === 'AssistantStreamAbortedError' ||
    err instanceof AssistantStreamAbortedError
  );
}

export function isInterruptedStreamError(err: unknown): boolean {
  if (err instanceof AssistantStreamInterruptedError) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg === 'network error' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('incomplete_chunked') ||
    msg.includes('incomplete chunked') ||
    msg.includes('stream ended without a response') ||
    (err.name === 'TypeError' && msg.includes('network'))
  );
}

export function humanizeAssistantStreamError(err: unknown): string {
  if (isInterruptedStreamError(err)) {
    return 'Connection interrupted. Try again.';
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return 'Something went wrong';
}

export async function streamChatMessage(
  input: StreamChatMessageInput,
  handlers: StreamChatMessageHandlers = {}
): Promise<StreamChatMessageResult> {
  const jwt = await getSessionJwt();
  const res = await fetch(`${baseUrl()}/dashboard-assistant-chat`, {
    method: 'POST',
    signal: handlers.signal,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      ...input,
      stream: true,
      regenerate: input.regenerate === true ? true : undefined,
    }),
  });

  const contentType = res.headers.get('Content-Type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    const json = (await res.json()) as {
      success?: boolean;
      error?: string;
      data?: StreamChatMessageResult;
      upgradeHook?: boolean;
    };
    if (!res.ok || !json.success) {
      const err = new Error(json.error ?? 'Request failed') as Error & {
        status?: number;
        upgradeHook?: boolean;
      };
      err.status = res.status;
      err.upgradeHook = json.upgradeHook === true;
      throw err;
    }
    const data = json.data!;
    return {
      conversationId: data.conversationId,
      blocks: data.blocks,
      upgradeHook: data.upgradeHook,
      messageId: data.messageId,
      userMessageId: data.userMessageId,
    };
  }

  if (!res.ok || !res.body) {
    throw new Error('Stream request failed');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let seenConversationId: string | null = input.conversationId ?? null;
  let finalResult: StreamChatMessageResult | null = null;

  try {
    let streamDone = false;
    while (!streamDone) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (readErr) {
        if (handlers.signal?.aborted || isAbortError(readErr)) {
          throw readErr instanceof AssistantStreamAbortedError
            ? readErr
            : new AssistantStreamAbortedError();
        }
        throw new AssistantStreamInterruptedError(seenConversationId);
      }
      const { done, value } = chunk;
      streamDone = done;
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseChunk(buffer);
      buffer = parsed.rest;
      for (const event of parsed.events) {
        if (event.type === 'turn_started' && event.conversationId) {
          seenConversationId = event.conversationId;
        }
        handlers.onEvent?.(event);
        if (event.type === 'blocks') {
          finalResult = {
            conversationId: event.conversationId,
            blocks: event.blocks,
            upgradeHook: event.upgradeHook,
            messageId: event.messageId,
            userMessageId: event.userMessageId,
          };
        }
        if (event.type === 'error') {
          if (event.aborted) {
            throw new AssistantStreamAbortedError(event.message, event.appliedEffects);
          }
          const err = new Error(event.message) as Error & { upgradeHook?: boolean };
          err.upgradeHook = event.upgradeHook;
          throw err;
        }
      }
    }
  } catch (err) {
    if (handlers.signal?.aborted || isAbortError(err)) {
      if (finalResult) return finalResult;
      throw err instanceof AssistantStreamAbortedError ? err : new AssistantStreamAbortedError();
    }
    if (isInterruptedStreamError(err)) {
      throw err instanceof AssistantStreamInterruptedError
        ? err
        : new AssistantStreamInterruptedError(seenConversationId);
    }
    throw err;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }

  if (!finalResult) {
    throw new AssistantStreamInterruptedError(seenConversationId);
  }
  return finalResult;
}

export type TurnProgressLiveState = {
  steps: Array<{
    id: string;
    label: string;
    status: 'pending' | 'active' | 'done' | 'failed';
    toolName?: string;
  }>;
  planTitle?: string;
};

function phaseProgressLabel(phase: AssistantStreamPhase, explicit?: string): string {
  if (explicit && !/^(Understood|Prepared|Checked|Applying|Gathered)/.test(explicit)) {
    return explicit;
  }
  if (phase === 'understanding') return 'Understanding your question';
  if (phase === 'planning') return 'Planning next steps';
  if (phase === 'executing') return explicit ?? 'Gathering data from your account';
  if (phase === 'synthesizing') {
    if (explicit?.includes('action')) return 'Preparing action for your review';
    return 'Preparing your answer';
  }
  if (phase === 'safety') return 'Checking response safety';
  return 'Working on your request';
}

function labelForStepStatus(step: {
  label: string;
  toolName?: string;
  status: 'pending' | 'active' | 'done' | 'failed';
}): string {
  if (step.status === 'pending') return step.label;
  if (step.toolName) {
    if (step.status === 'active') return getAssistantToolActivityLabel(step.toolName, 'progress');
    if (step.status === 'failed') return getAssistantToolActivityLabel(step.toolName, 'failed');
    if (step.status === 'done') return getAssistantToolActivityLabel(step.toolName, 'done');
  }
  return step.label;
}

type LiveStepStatus = TurnProgressLiveState['steps'][number]['status'];

function mapPlanStepStatus(status: TaskPlanStepStatus): LiveStepStatus {
  if (status === 'running') return 'active';
  if (status === 'pending') return 'pending';
  if (status === 'failed') return 'failed';
  return 'done';
}

export function buildTurnProgressFromStreamEvent(
  prev: TurnProgressLiveState | null,
  event: AssistantStreamEvent
): TurnProgressLiveState | null {
  if (event.type === 'plan') {
    return {
      planTitle: event.title,
      steps: event.steps.map((step) => {
        const status = mapPlanStepStatus(step.status);
        const base = {
          id: step.id,
          label: step.label,
          toolName: step.toolName,
          status,
        };
        return { ...base, label: labelForStepStatus(base) };
      }),
    };
  }
  if (event.type === 'plan_update' && prev) {
    return {
      ...prev,
      steps: prev.steps.map((step) => {
        if (step.id !== event.stepId) return step;
        const status = mapPlanStepStatus(event.status);
        const next = { ...step, status };
        return { ...next, label: labelForStepStatus(next) };
      }),
    };
  }
  if (event.type === 'tool_start') {
    const steps = prev?.steps ?? [];
    if (event.stepId && steps.some((s) => s.id === event.stepId)) {
      return buildTurnProgressFromStreamEvent(prev, {
        type: 'plan_update',
        stepId: event.stepId,
        status: 'running',
      });
    }

    const withoutPhases = steps.filter((s) => !s.id.startsWith('phase-'));
    let existingIdx = -1;
    for (let i = withoutPhases.length - 1; i >= 0; i -= 1) {
      if (withoutPhases[i]?.toolName === event.toolName) {
        existingIdx = i;
        break;
      }
    }

    // Same tool called again in a later round — reuse the row instead of stacking duplicates.
    if (existingIdx >= 0) {
      const nextSteps = withoutPhases.map((step, index) => {
        if (index === existingIdx) {
          const active = {
            ...step,
            id: event.stepId ?? step.id,
            toolName: event.toolName,
            status: 'active' as const,
            label: event.label,
          };
          return { ...active, label: labelForStepStatus(active) };
        }
        if (step.status !== 'active') return step;
        return {
          ...step,
          status: 'done' as const,
          label: labelForStepStatus({ ...step, status: 'done' }),
        };
      });
      return { planTitle: prev?.planTitle, steps: nextSteps };
    }

    const nextSteps = [
      ...withoutPhases.map((s) => {
        if (s.status !== 'active') return s;
        return {
          ...s,
          status: 'done' as const,
          label: labelForStepStatus({ ...s, status: 'done' }),
        };
      }),
      {
        id: event.stepId ?? event.toolName,
        label: event.label,
        toolName: event.toolName,
        status: 'active' as const,
      },
    ];
    const last = nextSteps[nextSteps.length - 1];
    if (last) {
      nextSteps[nextSteps.length - 1] = { ...last, label: labelForStepStatus(last) };
    }
    return { planTitle: prev?.planTitle, steps: nextSteps };
  }
  if (event.type === 'tool_done') {
    const steps = prev?.steps ?? [];
    const targetId = event.stepId ?? event.toolName;
    if (steps.length === 0) {
      const status = event.ok ? ('done' as const) : ('failed' as const);
      const base = {
        id: targetId,
        label: getAssistantToolActivityLabel(event.toolName, event.ok ? 'done' : 'failed'),
        toolName: event.toolName,
        status,
      };
      return { steps: [base] };
    }
    return {
      planTitle: prev?.planTitle,
      steps: steps.map((step) => {
        if (step.id !== targetId) return step;
        const status = event.ok ? ('done' as const) : ('failed' as const);
        const next = { ...step, toolName: step.toolName ?? event.toolName, status };
        return { ...next, label: labelForStepStatus(next) };
      }),
    };
  }
  if (event.type === 'phase') {
    const activeLabel = phaseProgressLabel(event.phase, event.label);
    if (!prev?.steps.length) {
      return {
        steps: [{ id: `phase-${event.phase}`, label: activeLabel, status: 'active' }],
      };
    }
    if (event.phase === 'synthesizing' || event.phase === 'safety' || event.phase === 'executing') {
      return {
        planTitle: prev.planTitle,
        steps: [
          ...prev.steps
            .filter((s) => !s.id.startsWith('phase-'))
            .map((s) => {
              if (s.status !== 'active') return s;
              return {
                ...s,
                status: 'done' as const,
                label: labelForStepStatus({ ...s, status: 'done' }),
              };
            }),
          { id: `phase-${event.phase}`, label: activeLabel, status: 'active' },
        ],
      };
    }
    return prev;
  }
  return prev;
}
