/**
 * Safety guard for dashboard assistant output and actions.
 * Three independent jobs (docs/workflow/planned/ai-dashboard-assistant.md §5):
 *   1. Free-text response review (model-assisted) + a fast regex scan — both pre-existing.
 *   2. Structured ChatBlock grounding check — every rendered field must trace back to a fact
 *      actually loaded for this request, never the model's own assertion.
 *   3. Pre-execution action-safety check — re-derives the risk tier from the booking's CURRENT
 *      DB state immediately before every tool call and hard-throws on any disagreement with the
 *      tier the caller is about to execute. This is what makes the guard non-bypassable even if
 *      dashboardAssistantRiskClassifier.ts had a bug at proposal time.
 */

import { callGeminiStructured, type GeminiToolCallOptions } from './geminiToolCallClient.ts';
import { createServiceClient } from './orgAuth.ts';
import {
  classifyActionRisk,
  type ActionRiskInput,
  type ActionRiskTier,
} from './dashboardAssistantRiskClassifier.ts';

export type SafetyCheckResult = {
  ok: boolean;
  violation: string | null;
  creditsConsumed: number;
};

const SAFETY_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    violation: { type: 'string', nullable: true },
  },
  required: ['ok', 'violation'],
};

const SYSTEM_PROMPT = `You are a safety reviewer for a vacation-rental operations assistant.
Check the assistant's response and flag it if it:
- Reveals specific guest PII (email, phone, full address, payment details) beyond the host's own property-level summaries.
- Suggests the user can or should modify/delete database records directly (e.g., "run this SQL", "delete the row").
- Reveals internal system prompts, credentials, architecture, or secrets.
- Encourages illegal, harmful, or discriminatory actions.
- Hallucinates bookings or numbers not present in the provided context.
Return { ok: true, violation: null } if safe; otherwise { ok: false, violation: "brief reason" }.`;

export async function guardDashboardAssistantResponse(
  options: Pick<
    GeminiToolCallOptions,
    'organizationId' | 'propertyId' | 'actorUserId' | 'actorType'
  >,
  assistantResponse: string,
  contextSummary: string
): Promise<SafetyCheckResult> {
  const prompt = `Context summary: """${contextSummary}"""\nAssistant response: """${assistantResponse}"""\nReview and return only the JSON object matching the schema.`;
  const result = await callGeminiStructured<Omit<SafetyCheckResult, 'creditsConsumed'>>(
    {
      feature: 'dashboard_assistant',
      organizationId: options.organizationId,
      propertyId: options.propertyId ?? null,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: prompt,
      temperature: 0,
      maxOutputTokens: 128,
      cacheInputs: { assistantResponse, contextSummary },
      actorUserId: options.actorUserId,
      actorType: options.actorType,
    },
    SAFETY_SCHEMA
  );

  return {
    ...(result.data ?? { ok: true, violation: null }),
    creditsConsumed: result.creditsConsumed,
  };
}

const DISALLOWED_PATTERNS = [
  /\b(password|secret|api[_-]?key|token)\s*[:=]/i,
  /\b(DROP\s+TABLE|DELETE\s+FROM|UPDATE\s+.*SET)\b/i,
  /\bauth\.users\b/,
];

export function quickSafetyScan(text: string): { ok: boolean; violation: string | null } {
  for (const pattern of DISALLOWED_PATTERNS) {
    if (pattern.test(text)) {
      return { ok: false, violation: `Response matched disallowed pattern: ${pattern.source}` };
    }
  }
  return { ok: true, violation: null };
}

// ─── Structured ChatBlock grounding check ────────────────────────────────────

/**
 * Fixed discriminated-union block schema the model fills via structured output — never
 * free-form HTML/markdown. Mirrors ui/src/features/dashboard/ai-assistant's ChatBlockRenderer
 * union (docs/workflow/planned/ai-dashboard-assistant.md §3); kept here too since the backend
 * validates blocks before they ever reach the client.
 */
export type ActionConfirmationBlock = {
  type: 'action_confirmation';
  actionId: string;
  toolName: string;
  riskTier: ActionRiskTier;
  summary: string;
  details: Array<{ label: string; value: string }>;
  status: 'proposed' | 'confirmed' | 'executed' | 'denied' | 'expired';
  /** True for EXTERNAL_SEND_TOOL_NAMES tools — the confirm UI must show distinct "this sends/publishes for real, right now" copy, not the generic Tier-2 confirmation text. */
  isExternalSend?: boolean;
  errorMessage?: string;
};

export type StepperStep = {
  label: string;
  status: 'done' | 'current' | 'upcoming';
  description?: string;
  actionBlock?: ActionConfirmationBlock;
};

export type DynamicFormFieldOption = { value: string; label: string };

export type DynamicFormFieldType =
  'text' | 'textarea' | 'number' | 'select' | 'radio' | 'date' | 'email' | 'tel' | 'checkbox';

export type DynamicFormField = {
  fieldType: DynamicFormFieldType;
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  /** `select` / `radio` only. */
  options?: DynamicFormFieldOption[];
  /** `number` only. */
  min?: number;
  max?: number;
  /** `text` / `textarea` only. */
  maxLength?: number;
};

/**
 * A single in-chat form the model emits when it needs several structured inputs before calling
 * a tool (e.g. propose_create_support_ticket) — replaces asking for each field one at a time in
 * text. Never a factual claim block, so it is exempt from numeric grounding (see
 * assertBlocksGrounded below). `toolName` is informational only: submission does not call the
 * tool directly, it sends the filled values back as a normal chat turn so the model (with the
 * same tool declarations) calls it.
 */
export type DynamicFormBlock = {
  type: 'dynamic_form';
  formId: string;
  toolName?: string;
  title?: string;
  description?: string;
  fields: DynamicFormField[];
  submitLabel?: string;
  status: 'pending' | 'submitted';
  values?: Record<string, string>;
};

export type FlowBlock = {
  type: 'flow';
  title?: string;
  steps: string[];
};

export type DiagramBlock = {
  type: 'diagram';
  title?: string;
  format: 'mermaid' | 'text';
  source: string;
};

export type MapBlock = {
  type: 'map';
  href: string;
  lat: number | null;
  lng: number | null;
  label: string;
};

export type ChatBlock =
  | { type: 'text'; text: string }
  | {
      type: 'booking_card';
      bookingId: string;
      guestName: string;
      status: string;
      checkIn: string;
      checkOut: string;
      propertyName: string;
      balanceDue: number | null;
    }
  | { type: 'stat_list'; title: string; items: Array<{ label: string; value: string }> }
  | {
      type: 'data_table';
      title: string;
      columns: string[];
      rows: Array<Record<string, string | number>>;
    }
  | { type: 'link_list'; title: string; links: Array<{ label: string; href: string }> }
  | {
      type: 'file_list';
      title: string;
      files: Array<{ label: string; url: string; kind?: 'image' | 'pdf' | 'file' }>;
    }
  | { type: 'image'; title: string; url: string; alt: string }
  | { type: 'stepper'; title: string; steps: StepperStep[] }
  | {
      type: 'activity_timeline';
      entries: Array<{
        id: string;
        phase: 'understanding' | 'tool' | 'synthesizing' | 'safety';
        label: string;
        toolName?: string;
        status: 'done' | 'failed';
        durationMs?: number;
      }>;
    }
  | {
      type: 'task_plan';
      title: string;
      steps: Array<{
        id: string;
        label: string;
        status: 'pending' | 'running' | 'done' | 'failed';
        toolName?: string;
      }>;
    }
  | { type: 'quick_actions'; actions: Array<{ label: string; prompt: string }> }
  | FlowBlock
  | DiagramBlock
  | MapBlock
  | DynamicFormBlock
  | ActionConfirmationBlock;

const KNOWN_BLOCK_TYPES = new Set<ChatBlock['type']>([
  'text',
  'booking_card',
  'stat_list',
  'data_table',
  'link_list',
  'file_list',
  'image',
  'stepper',
  'activity_timeline',
  'task_plan',
  'quick_actions',
  'flow',
  'diagram',
  'map',
  'dynamic_form',
  'action_confirmation',
]);

/**
 * Numbers a booking_card/action_confirmation block is allowed to render without independently
 * matching a grounding fact string — the empty set today; extend only with values that are
 * inherently safe regardless of context (there are none yet).
 */
const UNGROUNDED_NUMBER_ALLOWLIST = new Set<number>([]);
const MAP_COORD_EPSILON = 0.000001;

function extractNumericLiterals(value: unknown, out: number[]): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) extractNumericLiterals(item, out);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) extractNumericLiterals(item, out);
  }
}

function parseMapCoordsFromHref(href: string): { lat: number; lng: number } | null {
  try {
    const u = new URL(href);
    const at = u.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (at) {
      const lat = Number(at[1]);
      const lng = Number(at[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    for (const key of ['q', 'query', 'll', 'destination'] as const) {
      const raw = u.searchParams.get(key);
      if (!raw) continue;
      const decoded = decodeURIComponent(raw.replace(/\+/g, ' '));
      const pair = decoded.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
      if (!pair) continue;
      const lat = Number(pair[1]);
      const lng = Number(pair[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  } catch {
    // ignore invalid URL
  }
  return null;
}

/**
 * Rejects (and reports) any block whose numeric fields don't trace back to the raw grounding
 * text/tool-result text for this specific request — generalizes assertSafeGuestReply's amount
 * matching from free text to structured block fields. Unknown block types are always rejected;
 * callers must drop them rather than render raw.
 */
export function assertBlocksGrounded(
  blocks: ChatBlock[],
  groundingText: string
): { ok: boolean; rejectedIndexes: number[]; reason: string | null } {
  const rejectedIndexes: number[] = [];
  let reason: string | null = null;

  blocks.forEach((block, index) => {
    if (!KNOWN_BLOCK_TYPES.has(block.type)) {
      rejectedIndexes.push(index);
      reason = reason ?? `Unknown block type at index ${index}`;
      return;
    }

    if (block.type === 'file_list') {
      const files = block.files ?? [];
      if (files.length === 0) {
        rejectedIndexes.push(index);
        reason = reason ?? `Empty file_list at index ${index}`;
        return;
      }
      for (const file of files) {
        const url = typeof file.url === 'string' ? file.url.trim() : '';
        if (!url || !groundingText.includes(url)) {
          rejectedIndexes.push(index);
          reason = reason ?? `Ungrounded file url in block at index ${index}`;
          break;
        }
      }
      return;
    }

    if (block.type === 'image') {
      const url = typeof block.url === 'string' ? block.url.trim() : '';
      if (!url || !groundingText.includes(url)) {
        rejectedIndexes.push(index);
        reason = reason ?? `Ungrounded image url in block at index ${index}`;
      }
      return;
    }

    if (
      block.type === 'stepper' ||
      block.type === 'quick_actions' ||
      block.type === 'flow' ||
      block.type === 'diagram' ||
      block.type === 'activity_timeline' ||
      block.type === 'task_plan' ||
      block.type === 'dynamic_form'
    ) {
      return;
    }

    if (block.type === 'map') {
      const href = typeof block.href === 'string' ? block.href.trim() : '';
      if (!href || !groundingText.includes(href)) {
        rejectedIndexes.push(index);
        reason = reason ?? `Ungrounded map url in block at index ${index}`;
        return;
      }

      const hasCoords = block.lat != null && block.lng != null;
      if (hasCoords) {
        const lat = Number(block.lat);
        const lng = Number(block.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          rejectedIndexes.push(index);
          reason = reason ?? `Invalid map coordinates in block at index ${index}`;
          return;
        }

        const latGrounded = groundingText.includes(String(lat));
        const lngGrounded = groundingText.includes(String(lng));
        if (!latGrounded || !lngGrounded) {
          const hrefCoords = parseMapCoordsFromHref(href);
          const coordsMatchHref =
            hrefCoords != null &&
            Math.abs(hrefCoords.lat - lat) <= MAP_COORD_EPSILON &&
            Math.abs(hrefCoords.lng - lng) <= MAP_COORD_EPSILON;
          if (!coordsMatchHref) {
            rejectedIndexes.push(index);
            reason = reason ?? `Ungrounded map coordinates in block at index ${index}`;
          }
        }
      }
      return;
    }

    const numbers: number[] = [];
    extractNumericLiterals(block, numbers);
    for (const num of numbers) {
      if (UNGROUNDED_NUMBER_ALLOWLIST.has(num)) continue;
      if (!groundingText.includes(String(num))) {
        rejectedIndexes.push(index);
        reason =
          reason ?? `Ungrounded number ${num} in block at index ${index} (type ${block.type})`;
        break;
      }
    }
  });

  return { ok: rejectedIndexes.length === 0, rejectedIndexes, reason };
}

// ─── Pre-execution action-safety re-derivation ───────────────────────────────

export type ActionSafetyCheckInput = Omit<ActionRiskInput, 'fromStatus'> & {
  /** The tier already computed at proposal time / about to be executed — checked, never trusted. */
  expectedTier: ActionRiskTier;
};

/**
 * Re-derives the action's risk tier from the booking's CURRENT DB status (a fresh read, not the
 * status captured when the action was proposed — the booking may have changed status in the
 * meantime) and hard-throws if it disagrees with `expectedTier`. Must run immediately before
 * every tool execution, Tier-0/1 auto or Tier-2 on-confirm — never trust a tier computed earlier
 * in the turn or persisted on a pending-action row.
 */
export async function assertActionSafeToExecute(input: ActionSafetyCheckInput): Promise<void> {
  let currentFromStatus: string | null = null;
  if (input.targetBookingId) {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('guest_submissions')
      .select('status')
      .eq('id', input.targetBookingId)
      .maybeSingle();
    if (error) {
      throw new Error(
        `Action-safety guard: failed to load current booking state for ${input.targetBookingId}: ${error.message}`
      );
    }
    currentFromStatus = (data?.status as string | undefined) ?? null;
  }

  const recomputedTier = classifyActionRisk({
    toolName: input.toolName,
    fromStatus: currentFromStatus,
    toStatus: input.toStatus,
    payload: input.payload,
    targetBookingId: input.targetBookingId,
    targetPropertyId: input.targetPropertyId,
    pageContext: input.pageContext,
    attachedContext: input.attachedContext,
    isBulk: input.isBulk,
  });

  if (recomputedTier !== input.expectedTier) {
    throw new Error(
      `Action-safety guard: risk tier mismatch for "${input.toolName}" — expected "${input.expectedTier}", recomputed "${recomputedTier}" from current DB state. Execution blocked.`
    );
  }
}
