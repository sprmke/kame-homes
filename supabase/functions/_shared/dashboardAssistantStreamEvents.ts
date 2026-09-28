/**
 * SSE event types for dashboard-assistant-chat streaming turns.
 * Mirror: ui/src/features/dashboard/ai-assistant/lib/assistantStream.ts
 */

import { corsHeaders } from './cors.ts';
import type { ChatBlock } from './dashboardAssistantSafetyGuard.ts';

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
  | {
      type: 'tool_done';
      toolName: string;
      ok: boolean;
      durationMs: number;
      stepId?: string;
      /** Host-facing reason when `ok` is false (`assistantToolFailureReason.ts`). */
      reason?: string;
    }
  | { type: 'plan'; title: string; steps: AssistantStreamTaskPlanStep[] }
  | { type: 'plan_update'; stepId: string; status: TaskPlanStepStatus; reason?: string }
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
      /** Which AI switch is off. `organization` / `property`: the UI links to AI settings; `platform`: plain error. */
      aiBlocker?: 'platform' | 'organization' | 'property';
      aborted?: boolean;
      appliedEffects?: AssistantAppliedEffect[];
    };

export type AssistantAppliedEffect = {
  toolName: string;
  label: string;
  ok: boolean;
};

const TEXT_STREAM_CHUNK_SIZE = 48;
/** Delay between text chunks so the client can paint progressive prose. */
const TEXT_STREAM_CHUNK_DELAY_MS = 18;

export function wantsAssistantStream(req: Request, body?: { stream?: boolean }): boolean {
  const accept = req.headers.get('Accept') ?? '';
  if (accept.includes('text/event-stream')) return true;
  return body?.stream === true;
}

export function encodeAssistantStreamEvent(event: AssistantStreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export function assistantStreamResponse(
  req: Request,
  stream: ReadableStream<Uint8Array>
): Response {
  return new Response(stream, {
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export type AssistantStreamEmitter = (event: AssistantStreamEvent) => void;

export function createAssistantStreamEmitter(
  controller: ReadableStreamDefaultController<Uint8Array>,
  options?: { isAborted?: () => boolean }
): AssistantStreamEmitter {
  return (event) => {
    if (options?.isAborted?.()) return;
    try {
      controller.enqueue(encodeAssistantStreamEvent(event));
    } catch {
      // Controller already closed (client disconnect) — ignore.
    }
  };
}

/** Emit chunked preview of the first text block before the terminal `blocks` event. */
export async function streamAssistantTextPreview(
  emit: AssistantStreamEmitter,
  blocks: ChatBlock[],
  options?: { signal?: AbortSignal }
): Promise<void> {
  const firstText = blocks.find(
    (block): block is Extract<ChatBlock, { type: 'text' }> => block.type === 'text'
  );
  const text = firstText?.text?.trim();
  if (!text) return;
  emit({ type: 'text_start' });
  for (let i = 0; i < text.length; i += TEXT_STREAM_CHUNK_SIZE) {
    if (options?.signal?.aborted) return;
    emit({ type: 'text_chunk', delta: text.slice(i, i + TEXT_STREAM_CHUNK_SIZE) });
    if (i + TEXT_STREAM_CHUNK_SIZE < text.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, TEXT_STREAM_CHUNK_DELAY_MS));
    }
  }
}

export class AssistantTurnAbortedError extends Error {
  override readonly name = 'AssistantTurnAbortedError';
  readonly appliedEffects?: AssistantAppliedEffect[];
  constructor(message = 'Turn aborted', appliedEffects?: AssistantAppliedEffect[]) {
    super(message);
    this.appliedEffects = appliedEffects;
  }
}

export function isAssistantTurnAbortedError(err: unknown): boolean {
  return (
    err instanceof AssistantTurnAbortedError ||
    (err instanceof Error && err.name === 'AssistantTurnAbortedError')
  );
}
