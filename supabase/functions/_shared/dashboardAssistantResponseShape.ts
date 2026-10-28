/**
 * Deterministic post-processing of dashboard assistant blocks, shared by the live handler
 * (`dashboard-assistant-chat`) and the offline block-shape evals so both run the same pipeline.
 *
 * Two stages:
 *  1. `shapeCandidateBlocks` — model output → sanitized, hydrated, grounded blocks (pre-guard).
 *  2. `finalizeResponseBlocks` — guarded blocks → journey nesting + host display finalization.
 *
 * Both are pure: no network, no DB, no clock.
 */
import type { AttachedContextItem } from './dashboardAssistantAttachedContext.ts';
import {
  humanizeStatusCodesInText,
  hydrateAssistantBlocksFromTools,
  nestBookingJourneyStepper,
  sanitizeAssistantChatBlocks,
  wrapBlocksWithJourneyGuidance,
} from './dashboardAssistantBlocks.ts';
import {
  finalizeAssistantBlocksForHost,
  summarizeGatheredToolResults,
} from './dashboardAssistantHostDisplay.ts';
import { assertBlocksGrounded, type ChatBlock } from './dashboardAssistantSafetyGuard.ts';

export const UNFORMATTED_ANSWER_FALLBACK =
  "I couldn't finish that answer. Try asking again, or narrow it to one question.";

export const CONTINUE_REST_ACTION = {
  label: 'Continue with the rest',
  prompt: 'Continue with the rest of that answer.',
} as const;

export type ShapeCandidateInput = {
  /** Raw model blocks (may be empty; a text fallback is synthesized then). */
  modelBlocks: unknown[];
  /** Model's free-text draft, used when it produced no blocks. */
  draftText?: string | null;
  /** Tool results gathered this turn (same array the grounding text is built from). */
  toolResults: unknown[];
  /** Serialized grounding text numbers/urls must trace back to. */
  groundingText: string;
  userMessage: string;
  attachedContext?: AttachedContextItem[];
  /** Loaded attached-template copy, used as a deterministic answer when the model returns nothing. */
  attachedTemplateText?: string | null;
};

export type ShapeCandidateResult = {
  blocks: ChatBlock[];
  grounded: boolean;
  groundingReason: string | null;
  rejectedCount: number;
};

/** Stage 1: sanitize → hydrate from tools → drop ungrounded blocks → sanitize → never empty. */
export function shapeCandidateBlocks(input: ShapeCandidateInput): ShapeCandidateResult {
  const draft = (input.draftText ?? '').trim();
  const seed: unknown[] =
    input.modelBlocks.length > 0 ? input.modelBlocks : draft ? [{ type: 'text', text: draft }] : [];

  const candidate = hydrateAssistantBlocksFromTools(
    sanitizeAssistantChatBlocks(seed as ChatBlock[]),
    input.toolResults,
    input.userMessage,
    { attachedContext: input.attachedContext ?? [], rawModelBlocks: seed }
  ).filter(
    (block) =>
      block.type !== 'text' ||
      !/i couldn't generate a response\.?/i.test((block as { text?: string }).text ?? '')
  );

  const grounded = assertBlocksGrounded(candidate, input.groundingText);
  const safe = sanitizeAssistantChatBlocks(
    grounded.ok ? candidate : candidate.filter((_, i) => !grounded.rejectedIndexes.includes(i))
  );
  if (safe.length === 0) {
    const templateText = (input.attachedTemplateText ?? '').trim();
    const toolSummary = templateText ? null : summarizeGatheredToolResults(input.toolResults);
    safe.push({
      type: 'text',
      text: humanizeStatusCodesInText(
        templateText || draft || toolSummary || UNFORMATTED_ANSWER_FALLBACK
      ),
    });
    if (!draft && !templateText) {
      safe.push({ type: 'quick_actions', actions: [{ ...CONTINUE_REST_ACTION }] });
    }
  } else {
    // The model sometimes emits the old dead-end line even when the attached template or a
    // template tool result has the actual copy. Replace the line instead of showing it.
    const templateText = (input.attachedTemplateText ?? '').trim();
    const toolSummary = templateText ? null : summarizeGatheredToolResults(input.toolResults);
    const answer = templateText || toolSummary;
    const deadEndOnly =
      Boolean(answer) &&
      safe.every((block) =>
        block.type === 'text'
          ? /which listing or dates|couldn't finish that answer/i.test(block.text ?? '')
          : block.type === 'quick_actions'
      );
    if (deadEndOnly && answer) {
      const kept = safe.filter(
        (block) => block.type !== 'text' && block.type !== 'quick_actions'
      );
      safe.length = 0;
      safe.push({ type: 'text', text: humanizeStatusCodesInText(answer) }, ...kept);
    }
  }
  return {
    blocks: safe,
    grounded: grounded.ok,
    groundingReason: grounded.reason,
    rejectedCount: grounded.rejectedIndexes.length,
  };
}

export type FinalizeResponseInput = {
  blocks: ChatBlock[];
  toolResults: unknown[];
  userMessage: string;
  attachedContext?: AttachedContextItem[];
  journeyIntroText?: string | null;
  executedToolNames?: string[];
};

/** Stage 2: journey stepper nesting + guidance, then host-display finalization. */
export function finalizeResponseBlocks(input: FinalizeResponseInput): ChatBlock[] {
  const attached = input.attachedContext ?? [];
  return finalizeAssistantBlocksForHost(
    wrapBlocksWithJourneyGuidance(
      nestBookingJourneyStepper(input.blocks, input.toolResults, attached),
      input.toolResults,
      { introText: input.journeyIntroText ?? null, userMessage: input.userMessage }
    ),
    input.toolResults,
    attached,
    { userMessage: input.userMessage, executedToolNames: input.executedToolNames }
  );
}

/**
 * Skip the extra Gemini structured-synth call when hydrators already have something
 * to work with: `respond_with_blocks`, tool JSON, or a model draft. The fallback
 * `generateStructuredViaTool` stays only for the empty no-tools no-text case.
 */
export function canSkipStructuredSynth(input: {
  hasInlineBlocks: boolean;
  hasToolResults: boolean;
  hasDraftText: boolean;
}): boolean {
  return input.hasInlineBlocks || input.hasToolResults || input.hasDraftText;
}

/** Convenience for offline evals: full deterministic pipeline with no guard in between. */
export function shapeAndFinalizeForEval(input: ShapeCandidateInput): ChatBlock[] {
  const shaped = shapeCandidateBlocks(input);
  return finalizeResponseBlocks({
    blocks: shaped.blocks,
    toolResults: input.toolResults,
    userMessage: input.userMessage,
    attachedContext: input.attachedContext,
  });
}
