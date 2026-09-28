import type {
  ActionConfirmationBlock,
  ChatBlock,
  DynamicFormField,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { statusLabel } from '@/features/dashboard/bookings/lib/bookingStatus';

const STATUS_CODE_RE = /\b([A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+)\b/g;

function keySlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function asDisplay(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

export function humanizeAssistantStatusText(text: string): string {
  return text.replace(STATUS_CODE_RE, (code) => {
    const label = statusLabel(code);
    return label === code ? code : label;
  });
}

const HOST_FIELD_LABELS: Record<string, string> = {
  weekdayNightlyRate: 'weekday nightly rate',
  weekendNightlyRate: 'weekend nightly rate',
  downPayment: 'down payment',
  securityDeposit: 'security deposit',
  petFee: 'pet fee',
  parkingRateGuest: 'guest parking rate',
  guestAdditionalFee: 'extra guest fee',
  maxGuests: 'max guests',
  unitNumber: 'unit number',
  residenceName: 'residence name',
  brandColor: 'brand color',
  contactName: 'contact name',
  contactRole: 'contact role',
  contactPhone: 'contact phone',
  contactEmail: 'contact email',
  customHouseRules: 'house rules',
  customAmenities: 'amenities',
  cancellationPolicy: 'cancellation policy',
};

const CAMEL_CASE_TOKEN_RE = /\b[A-Za-z]+[a-z][A-Z][A-Za-z0-9]*\b/g;

function humanizeCamelToken(token: string): string {
  if (HOST_FIELD_LABELS[token]) return HOST_FIELD_LABELS[token];
  if (/^[A-Z]{2,5}$/.test(token)) return token;
  return token
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase();
}

/** Strip camelCase / code-like tokens from confirmation titles (covers older persisted messages). */
export function humanizeAssistantConfirmationCopy(text: string): string {
  if (!text.trim()) return text;
  return humanizeAssistantStatusText(
    text
      .replace(CAMEL_CASE_TOKEN_RE, humanizeCamelToken)
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+\./g, '.')
      .trim()
  );
}

const TOOL_INSTRUCTION_RE =
  /\b(list_bookings|get_booking|get_booking_documents|plan_booking_journey|get_available_transitions|propose_transition_booking|pendingTasks|guestName\s*=|no status filter|status filter)\b/i;

/**
 * User bubbles must never show internal tool / system-instruction prompts.
 * Older threads may have persisted those as content_text — collapse them for display.
 */
export function hostFacingUserMessageText(text: string | null | undefined): string | null {
  if (text == null) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!TOOL_INSTRUCTION_RE.test(trimmed) && !/`[a-z_]+`/.test(trimmed)) {
    return humanizeAssistantConfirmationCopy(trimmed);
  }

  const lookUpMatch = trimmed.match(
    /(?:Look up|Help me complete)\s+(.+?)'s booking(?:\s*\(([^)]+)\))?/i
  );
  if (lookUpMatch) {
    const guest = lookUpMatch[1].trim();
    const range = lookUpMatch[2]?.trim();
    const statusMatch = trimmed.match(
      /(?:Current status is|currently(?: at)?)\s+([A-Za-z][A-Za-z0-9 ]{2,40}?)(?:\.|,|$)/i
    );
    const status = statusMatch?.[1]?.trim();
    const parts = [guest, range, status].filter(Boolean);
    if (parts.length > 0) return parts.join(' · ');
  }

  const guestMatch = trimmed.match(/\bfor\s+([A-Z][\w'.-]+(?:\s+[A-Z][\w'.-]+){0,3})\b/);
  if (guestMatch) return guestMatch[1].trim();

  return 'Selected suggestion';
}

export function dataTableRowCells(
  row: Record<string, string | number> | undefined,
  columns: string[]
): string[] {
  if (!row) return columns.map(() => '');

  const cells = (row as { cells?: unknown }).cells;
  if (Array.isArray(cells)) {
    return columns.map((_, i) => asDisplay(cells[i]));
  }

  const bySlug = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    if (key === 'cells' || key === 'type') continue;
    bySlug.set(keySlug(key), value);
  }

  return columns.map((col) => {
    if (row[col] != null && asDisplay(row[col]) !== '') return asDisplay(row[col]);
    return asDisplay(bySlug.get(keySlug(col)));
  });
}

export function dataTableHasRows(
  columns: string[] | undefined,
  rows: Array<Record<string, string | number>> | undefined
): boolean {
  const cols = columns ?? [];
  if (cols.length === 0) return false;
  return (rows ?? []).some((row) =>
    dataTableRowCells(row, cols).some((cell) => cell.trim() !== '')
  );
}

export function dataTableCell(
  row: Record<string, string | number>,
  column: string,
  columns: string[]
): string {
  const index = columns.indexOf(column);
  const cells = dataTableRowCells(row, columns);
  return index >= 0 ? cells[index] : asDisplay(row[column]);
}

export function isCanvasWorthyBlock(block: ChatBlock): boolean {
  if (block.type === 'stepper') return (block.steps?.length ?? 0) > 0;
  if (block.type === 'data_table') return (block.rows?.length ?? 0) > 8;
  return false;
}

export function canvasBlockTitle(block: ChatBlock): string {
  if (block.type === 'stepper' || block.type === 'data_table') return block.title || '';
  return '';
}

export function canvasBlockSummary(block: ChatBlock): string {
  if (block.type === 'stepper') {
    const current = (block.steps ?? []).find((step) => step.status === 'current');
    return current?.label ?? `${block.steps?.length ?? 0} steps`;
  }
  if (block.type === 'data_table') return `${block.rows?.length ?? 0} rows`;
  return '';
}

/** Resolves a filled field value to its host-facing display text (select/radio → option label). */
export function dynamicFormValueDisplay(
  field: DynamicFormField,
  rawValue: string | undefined
): string {
  const raw = (rawValue ?? '').trim();
  if (!raw) return '';
  if (field.fieldType === 'checkbox') return raw === 'true' ? 'Yes' : 'No';
  if (field.fieldType === 'select' || field.fieldType === 'radio') {
    return field.options?.find((opt) => opt.value === raw)?.label ?? raw;
  }
  return raw;
}

/** Builds "Label: value" recap lines for a submitted form — used for both the chat bubble and the message sent to the model. */
export function dynamicFormValuesToLines(
  fields: DynamicFormField[],
  values: Record<string, string>
): string[] {
  return fields
    .map((field) => {
      const display = dynamicFormValueDisplay(field, values[field.key]);
      if (!display) return null;
      return `${field.label}: ${display}`;
    })
    .filter((line): line is string => line != null);
}

/** Buckets a `dynamic_form`'s field count/complexity into a 60–100% chat bubble width. */
export function dynamicFormWidthClass(fields: DynamicFormField[]): string {
  const hasLongField = fields.some(
    (field) => field.fieldType === 'textarea' || (field.maxLength ?? 0) > 300
  );
  const score = fields.length + (hasLongField ? 1 : 0);
  if (score <= 2) return 'max-w-[60%]';
  if (score === 3) return 'max-w-[70%]';
  if (score === 4) return 'max-w-[85%]';
  return 'max-w-[100%]';
}

/** Assistant chat bubble width — widens (up to full width) when the turn includes a form. */
export function assistantBubbleWidthClass(blocks: ChatBlock[]): string {
  const form = blocks.find(
    (block): block is Extract<ChatBlock, { type: 'dynamic_form' }> => block.type === 'dynamic_form'
  );
  if (!form) return 'max-w-[92%]';
  return `w-full ${dynamicFormWidthClass(form.fields)}`;
}

export function patchDynamicFormStatus(
  blocks: ChatBlock[],
  formId: string,
  values: Record<string, string>
): ChatBlock[] {
  return blocks.map((block) =>
    block.type === 'dynamic_form' && block.formId === formId
      ? { ...block, status: 'submitted' as const, values }
      : block
  );
}

export function patchActionConfirmationStatus(
  blocks: ChatBlock[],
  actionId: string,
  status: ActionConfirmationBlock['status'],
  errorMessage?: string | null,
  resultNote?: string | null
): ChatBlock[] {
  const patchBlock = (block: ActionConfirmationBlock): ActionConfirmationBlock => ({
    ...block,
    status,
    ...(errorMessage ? { errorMessage } : {}),
    ...(resultNote ? { resultNote } : {}),
  });

  return blocks.map((block) => {
    if (block.type === 'action_confirmation' && block.actionId === actionId) {
      return patchBlock(block);
    }
    if (block.type === 'stepper') {
      return {
        ...block,
        steps: (block.steps ?? []).map((step) =>
          step.actionBlock?.actionId === actionId
            ? { ...step, actionBlock: patchBlock(step.actionBlock) }
            : step
        ),
      };
    }
    return block;
  });
}
