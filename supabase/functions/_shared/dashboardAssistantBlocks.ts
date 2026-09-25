/**
 * Host-facing ChatBlock cleanup for the dashboard assistant.
 * Gemini structured output often emits empty cards or data_table rows whose keys
 * don't match column headers — never show those to the host.
 */

import { computeBookingFinancials } from './bookingFinance.ts';
import {
  documentsFromToolResults,
  documentsRequestedByMessage,
  selectDocumentsForMessage,
} from './dashboardAssistantBookingDocuments.ts';
import {
  buildJourneyIntroText,
  buildJourneyQuickActions,
  filterEchoSuggestionChips,
  isBookingJourneyRecord,
  sanitizeQuickActionPrompt,
} from './dashboardAssistantActionDisplay.ts';
import type { AttachedContextItem } from './dashboardAssistantAttachedContext.ts';
import {
  collectHostDisplayRefs,
  collectHostDisplayRefsFromBlocks,
  formatBookingHostLabel,
  formatStayDateShort,
  formatStayRangeShort,
  humanizeBlocksForHost,
  mergeHostDisplayRefs,
} from './dashboardAssistantHostDisplay.ts';
import {
  bookingPipeline,
  isBookingStatus,
  nextStep,
  requiredSubForm,
  STATUS_HUMAN_LABEL,
  type BookingStatus,
} from './statusMachine.ts';
import type {
  ChatBlock,
  ActionConfirmationBlock,
  DynamicFormField,
  DynamicFormFieldType,
  StepperStep,
} from './dashboardAssistantSafetyGuard.ts';

const STATUS_CODE_RE = /\b([A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+)\b/g;

function keySlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function asDisplay(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

/** Chip prompt when the host picks a stay to advance/complete — host-facing only (no tool names). */
export function buildStayGuidancePrompt(input: {
  guestName: string;
  checkIn?: string;
  checkOut?: string;
  statusLabel?: string;
}): string {
  const guest = input.guestName.trim() || 'this guest';
  const status = (input.statusLabel ?? '').trim() || 'its current status';
  const range =
    input.checkIn && input.checkOut
      ? ` (${formatStayDateShort(input.checkIn)}–${formatStayDateShort(input.checkOut)})`
      : '';
  return (
    `Help me complete ${guest}'s booking${range}. It is currently at ${status}. ` +
    `If Completed is not allowed yet, explain why, what is still pending, and the next valid step — do not say the booking is missing.`
  );
}

function recordHasContent(record: Record<string, string | number>): boolean {
  return Object.values(record).some((value) => String(value).trim() !== '');
}

function rowToRecord(row: unknown, columns: string[]): Record<string, string | number> | null {
  if (row == null) return null;

  if (Array.isArray(row)) {
    const record: Record<string, string | number> = {};
    columns.forEach((col, i) => {
      record[col] = asDisplay(row[i]);
    });
    return recordHasContent(record) ? record : null;
  }

  if (typeof row !== 'object') return null;
  const obj = row as Record<string, unknown>;

  if (Array.isArray(obj.cells)) {
    const cells = obj.cells as unknown[];
    const record: Record<string, string | number> = {};
    columns.forEach((col, i) => {
      record[col] = asDisplay(cells[i]);
    });
    return recordHasContent(record) ? record : null;
  }

  const bySlug = new Map<string, unknown>();
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'cells' || key === 'type') continue;
    bySlug.set(keySlug(key), value);
  }

  const record: Record<string, string | number> = {};
  for (const col of columns) {
    if (obj[col] != null && asDisplay(obj[col]) !== '') {
      const raw = obj[col];
      record[col] = typeof raw === 'number' && Number.isFinite(raw) ? raw : asDisplay(raw);
      continue;
    }
    const match = bySlug.get(keySlug(col));
    record[col] = typeof match === 'number' && Number.isFinite(match) ? match : asDisplay(match);
  }

  return recordHasContent(record) ? record : null;
}

export function humanizeStatusCodesInText(text: string): string {
  return text.replace(STATUS_CODE_RE, (code) => {
    if (isBookingStatus(code)) return STATUS_HUMAN_LABEL[code];
    return code;
  });
}

const SUB_FORM_HINT: Record<Exclude<ReturnType<typeof requiredSubForm>, null>, string> = {
  pricing: 'Confirm pricing before proceeding',
  parking: 'Complete parking endorsement',
  guest_balance: 'Settle guest balance',
  sd_refund: 'Process security deposit refund',
};

/** Read-only booking pipeline snapshot for stepper UI and multi-step guidance. */
export function buildBookingJourneyData(booking: Record<string, unknown>): Record<string, unknown> {
  const status = String(booking.status ?? '');
  if (!isBookingStatus(status)) {
    return { kind: 'booking_journey', bookingId: String(booking.id ?? ''), steps: [] };
  }

  const flags = {
    need_parking: Boolean(booking.need_parking),
    has_pets: Boolean(booking.has_pets),
    security_deposit: booking.security_deposit as number | string | null,
  };
  const pipeline = bookingPipeline(flags, status);
  const currentIdx = pipeline.indexOf(status);
  const pending = pendingTasksForBooking(booking);
  const steps = pipeline.map((stepStatus, index) => {
    const next = pipeline[index + 1];
    const subForm = next ? requiredSubForm(stepStatus, next) : null;
    let stepState: 'done' | 'current' | 'upcoming' = 'upcoming';
    if (currentIdx >= 0 && index < currentIdx) stepState = 'done';
    else if (index === currentIdx) stepState = 'current';
    const description =
      index === currentIdx
        ? pending.join(' ') || undefined
        : stepState === 'upcoming' && subForm
          ? SUB_FORM_HINT[subForm]
          : undefined;
    return {
      status: stepStatus,
      label: STATUS_HUMAN_LABEL[stepStatus],
      stepStatus: stepState,
      requiredSubForm: subForm,
      nextStatus: next ?? null,
      nextStatusLabel: next ? STATUS_HUMAN_LABEL[next] : null,
      description,
    };
  });

  const next = nextStep(flags, status as BookingStatus);
  return {
    kind: 'booking_journey',
    bookingId: String(booking.id ?? ''),
    guestName: String(booking.primary_guest_name || booking.guest_facebook_name || 'Guest'),
    hostLabel: formatBookingHostLabel({
      guestName: String(booking.primary_guest_name || booking.guest_facebook_name || 'Guest'),
      checkIn: String(booking.check_in_date ?? ''),
      checkOut: String(booking.check_out_date ?? ''),
      statusLabel: STATUS_HUMAN_LABEL[status],
    }),
    currentStatus: status,
    currentStatusLabel: STATUS_HUMAN_LABEL[status],
    nextStatus: next,
    nextStatusLabel: next ? STATUS_HUMAN_LABEL[next] : null,
    steps,
  };
}

/** Prepends intro text and appends actionable follow-ups around a booking-journey stepper. */
export function wrapBlocksWithJourneyGuidance(
  blocks: ChatBlock[],
  toolResults: unknown[],
  options?: { introText?: string | null; userMessage?: string | null }
): ChatBlock[] {
  const journey = toolResults.find(isBookingJourneyRecord);
  if (!journey) return blocks;

  const hasStepper = blocks.some((block) => block.type === 'stepper');
  if (!hasStepper) return blocks;

  const intro = options?.introText?.trim() || buildJourneyIntroText(journey);
  const prefix: ChatBlock[] = blocks.some((block) => block.type === 'text' && block.text === intro)
    ? []
    : [{ type: 'text', text: humanizeStatusCodesInText(intro) }];

  // Prefer journey follow-ups over stay-picker chips (re-selecting the same guest is useless).
  const withoutQuickActions = blocks.filter((block) => block.type !== 'quick_actions');
  const quickActions = filterEchoSuggestionChips(buildJourneyQuickActions(journey), {
    userMessage: options?.userMessage,
    echoLabels: [asDisplay(journey?.hostLabel), asDisplay(journey?.guestName)].filter(Boolean),
  });
  const suffix: ChatBlock[] =
    quickActions.length > 0 ? [{ type: 'quick_actions', actions: quickActions }] : [];

  return [...prefix, ...withoutQuickActions, ...suffix];
}

export { finalizeAssistantBlocksForHost } from './dashboardAssistantHostDisplay.ts';

export function pendingTasksForBooking(booking: Record<string, unknown>): string[] {
  const status = String(booking.status ?? '');
  const sd = Number(booking.security_deposit ?? 0);
  const formSubmitted = Boolean(
    booking.sd_refund_form_submitted_at && String(booking.sd_refund_form_submitted_at).trim()
  );
  const formEmailed = Boolean(
    booking.sd_refund_form_emailed_at && String(booking.sd_refund_form_emailed_at).trim()
  );

  switch (status) {
    case 'PENDING_REVIEW':
      return ['Review guest details, pricing, IDs, and downpayment, then proceed.'];
    case 'PENDING_DOCUMENTS':
    case 'PENDING_GAF':
    case 'PENDING_PARKING_REQUEST':
    case 'PENDING_PET_REQUEST':
      return [
        'Complete the required building documents. This step moves forward automatically once they are done.',
      ];
    case 'READY_FOR_CHECKIN':
      return [
        'Settle the remaining guest balance and upload the receipt.',
        'Check-out instructions go to the guest automatically near checkout.',
      ];
    case 'READY_FOR_CHECKOUT':
      if (!(sd > 0)) {
        return ['No security deposit on this stay — proceed to complete the booking.'];
      }
      if (!formSubmitted) {
        const tasks = ['Waiting for the guest to submit the security deposit refund form.'];
        if (!formEmailed) {
          tasks.push(
            'Check-out instructions have not been emailed yet — resend from Automation Triggers if needed.'
          );
        }
        return tasks;
      }
      return [
        'Guest submitted the SD refund form — move to Pending SD Refund if it has not advanced automatically.',
      ];
    case 'PENDING_SD_REFUND':
      return ['Settle the security deposit refund, then proceed to complete the booking.'];
    case 'COMPLETED':
      return ['No pending tasks — this stay is complete.'];
    case 'CANCELLED':
      return ['No pending tasks — this booking is cancelled.'];
    default:
      return [];
  }
}

export function sdRefundAmountForBooking(booking: Record<string, unknown>): number {
  const stored = booking.sd_refund_amount;
  if (stored != null && stored !== '') {
    const n = Number(stored);
    if (Number.isFinite(n)) return Math.round(n * 100) / 100;
  }
  const financials = computeBookingFinancials(booking);
  const deposit = Number(booking.security_deposit ?? 0) || 0;
  return Math.round((deposit + financials.sdExpenseTotal - financials.sdProfitTotal) * 100) / 100;
}

function sanitizeStatList(block: Extract<ChatBlock, { type: 'stat_list' }>): ChatBlock | null {
  const items = (block.items ?? []).filter(
    (item) => asDisplay(item.label) !== '' && asDisplay(item.value) !== ''
  );
  if (items.length === 0) return null;
  return { ...block, items };
}

function sanitizeDataTable(block: Extract<ChatBlock, { type: 'data_table' }>): ChatBlock | null {
  const rawRows = Array.isArray(block.rows) ? (block.rows as unknown[]) : [];
  let columns = (block.columns ?? []).map((col) => String(col).trim()).filter(Boolean);

  if (columns.length === 0 && rawRows.length > 0) {
    const first = rawRows[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      columns = Object.keys(first as Record<string, unknown>).filter(
        (key) => key !== 'cells' && key !== 'type'
      );
    }
  }
  if (columns.length === 0) return null;

  const rows = rawRows
    .map((row) => rowToRecord(row, columns))
    .filter((row): row is Record<string, string | number> => row != null);

  if (rows.length === 0) return null;
  return { ...block, columns, rows };
}

/**
 * Model-written hrefs render as in-app links, so only same-origin app paths are allowed. Blocks
 * injected external/phishing URLs, protocol-relative `//host`, `javascript:` and backslash tricks.
 */
export function isSafeInternalHref(href: string): boolean {
  const value = href.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  return !/[\\\u0000-\u001f\u007f]/.test(value);
}

/**
 * Deterministic "Related pages" citations for knowledge-base answers. Only routes whose
 * `:params` all resolve (and stay internal) are linked; the model never writes these hrefs.
 */
export function knowledgeSourceLinks(
  hits: Array<Record<string, unknown>>,
  params: Record<string, string | null | undefined>,
  max = 3
): ChatBlock | null {
  const links: Array<{ label: string; href: string }> = [];
  for (const hit of hits) {
    const template = asDisplay(hit.route_path);
    const label = asDisplay(hit.question);
    if (!template || !label) continue;
    let unresolved = false;
    const href = template.replace(/:([A-Za-z]+)/g, (_, key: string) => {
      const value = params[key];
      if (!value) unresolved = true;
      return value ? encodeURIComponent(value) : '';
    });
    if (unresolved || !isSafeInternalHref(href) || links.some((l) => l.href === href)) continue;
    links.push({ label, href });
    if (links.length >= max) break;
  }
  return links.length > 0 ? { type: 'link_list', title: 'Related pages', links } : null;
}

function sanitizeLinkList(block: Extract<ChatBlock, { type: 'link_list' }>): ChatBlock | null {
  const links = (block.links ?? []).filter(
    (link) => asDisplay(link.label) !== '' && isSafeInternalHref(asDisplay(link.href))
  );
  if (links.length === 0) return null;
  return { ...block, links };
}

function sanitizeFileList(block: Extract<ChatBlock, { type: 'file_list' }>): ChatBlock | null {
  const files = (block.files ?? []).filter(
    (file) => asDisplay(file.label) !== '' && asDisplay(file.url) !== ''
  );
  if (files.length === 0) return null;
  return { ...block, title: asDisplay(block.title) || files[0].label, files };
}

function sanitizeImage(block: Extract<ChatBlock, { type: 'image' }>): ChatBlock | null {
  const url = asDisplay(block.url);
  if (!url) return null;
  return {
    type: 'image',
    title: asDisplay(block.title),
    url,
    alt: asDisplay(block.alt) || asDisplay(block.title) || 'Image',
  };
}

function sanitizeFlow(block: Extract<ChatBlock, { type: 'flow' }>): ChatBlock | null {
  const steps = (block.steps ?? []).map((step) => asDisplay(step)).filter(Boolean);
  if (steps.length === 0) return null;
  const title = asDisplay(block.title);
  return { type: 'flow', ...(title ? { title } : {}), steps };
}

function sanitizeDiagram(block: Extract<ChatBlock, { type: 'diagram' }>): ChatBlock | null {
  const source = asDisplay(block.source);
  if (!source) return null;
  const title = asDisplay(block.title);
  const format = block.format === 'mermaid' ? 'mermaid' : 'text';
  return { type: 'diagram', ...(title ? { title } : {}), format, source };
}

function sanitizeMap(block: Extract<ChatBlock, { type: 'map' }>): ChatBlock | null {
  const href = asDisplay(block.href);
  if (!href) return null;
  const label = asDisplay(block.label) || 'Location';
  const lat = typeof block.lat === 'number' && Number.isFinite(block.lat) ? block.lat : null;
  const lng = typeof block.lng === 'number' && Number.isFinite(block.lng) ? block.lng : null;
  return { type: 'map', href, lat, lng, label };
}

const URL_IN_TEXT_RE = /https?:\/\/|www\./i;

function sanitizeQuickActions(
  block: Extract<ChatBlock, { type: 'quick_actions' }>,
  hostRefs?: ReturnType<typeof collectHostDisplayRefs>
): ChatBlock | null {
  const actions = (block.actions ?? [])
    .map((action) => {
      const label = asDisplay(action.label);
      const prompt = sanitizeQuickActionPrompt(asDisplay(action.prompt));
      if (!label || !prompt) return null;
      if (URL_IN_TEXT_RE.test(label) || URL_IN_TEXT_RE.test(prompt)) return null;
      return { label, prompt };
    })
    .filter((action): action is { label: string; prompt: string } => action != null);
  if (actions.length === 0) return null;
  const humanized = hostRefs?.length
    ? humanizeBlocksForHost([{ type: 'quick_actions', actions }], hostRefs)[0]
    : { type: 'quick_actions' as const, actions };
  if (humanized.type !== 'quick_actions' || humanized.actions.length === 0) return null;
  return humanized;
}

function sanitizeStepper(block: Extract<ChatBlock, { type: 'stepper' }>): ChatBlock | null {
  const steps = (block.steps ?? [])
    .map((step): StepperStep | null => {
      const label = asDisplay(step.label);
      if (!label) return null;
      const status =
        step.status === 'done' || step.status === 'current' || step.status === 'upcoming'
          ? step.status
          : 'upcoming';
      const description = asDisplay(step.description) || undefined;
      return { ...step, label, status, description };
    })
    .filter((step): step is StepperStep => step != null);
  if (steps.length === 0) return null;
  return { type: 'stepper', title: asDisplay(block.title) || 'Booking journey', steps };
}

const DYNAMIC_FORM_FIELD_TYPES = new Set<DynamicFormFieldType>([
  'text',
  'textarea',
  'number',
  'select',
  'radio',
  'date',
  'email',
  'tel',
  'checkbox',
]);

function sanitizeDynamicFormField(field: DynamicFormField): DynamicFormField | null {
  const key = asDisplay(field.key);
  const label = asDisplay(field.label);
  const fieldType = DYNAMIC_FORM_FIELD_TYPES.has(field.fieldType) ? field.fieldType : null;
  if (!key || !label || !fieldType) return null;

  const next: DynamicFormField = { fieldType, key, label };
  const placeholder = asDisplay(field.placeholder);
  if (placeholder) next.placeholder = placeholder;
  if (field.required) next.required = true;

  if (fieldType === 'select' || fieldType === 'radio') {
    const options = (field.options ?? [])
      .map((opt) => ({ value: asDisplay(opt.value), label: asDisplay(opt.label) }))
      .filter((opt) => opt.value !== '' && opt.label !== '');
    if (options.length === 0) return null;
    next.options = options;
  }

  if (fieldType === 'number') {
    if (typeof field.min === 'number' && Number.isFinite(field.min)) next.min = field.min;
    if (typeof field.max === 'number' && Number.isFinite(field.max)) next.max = field.max;
  }

  if (fieldType === 'text' || fieldType === 'textarea') {
    if (typeof field.maxLength === 'number' && Number.isFinite(field.maxLength)) {
      next.maxLength = field.maxLength;
    }
  }

  return next;
}

function sanitizeDynamicForm(
  block: Extract<ChatBlock, { type: 'dynamic_form' }>
): ChatBlock | null {
  const seenKeys = new Set<string>();
  const fields = (block.fields ?? [])
    .map(sanitizeDynamicFormField)
    .filter((field): field is DynamicFormField => {
      if (!field) return false;
      if (seenKeys.has(field.key)) return false;
      seenKeys.add(field.key);
      return true;
    });
  if (fields.length === 0) return null;

  const title = asDisplay(block.title);
  const description = asDisplay(block.description);
  const submitLabel = asDisplay(block.submitLabel);
  const toolName = asDisplay(block.toolName);

  return {
    type: 'dynamic_form',
    formId: asDisplay(block.formId) || crypto.randomUUID(),
    fields,
    status: block.status === 'submitted' ? 'submitted' : 'pending',
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(submitLabel ? { submitLabel } : {}),
    ...(toolName ? { toolName } : {}),
    ...(block.values && typeof block.values === 'object' ? { values: block.values } : {}),
  };
}

function sanitizeBookingCard(
  block: Extract<ChatBlock, { type: 'booking_card' }>
): ChatBlock | null {
  if (!asDisplay(block.guestName) && !asDisplay(block.bookingId)) return null;
  return block;
}

/** Drop empty cards, align table cells to column headers, and humanize status codes in text. */
export function sanitizeAssistantChatBlocks(
  blocks: ChatBlock[],
  hostRefs?: ReturnType<typeof collectHostDisplayRefs>
): ChatBlock[] {
  const out: ChatBlock[] = [];
  for (const block of blocks) {
    if (block.type === 'text') {
      const text = humanizeStatusCodesInText(asDisplay(block.text));
      if (!text) continue;
      out.push({ type: 'text', text });
      continue;
    }
    if (block.type === 'stat_list') {
      const next = sanitizeStatList(block);
      if (next) out.push(next);
      continue;
    }
    if (block.type === 'data_table') {
      const next = sanitizeDataTable(block);
      if (next) out.push(next);
      continue;
    }
    if (block.type === 'link_list') {
      const next = sanitizeLinkList(block);
      if (next) out.push(next);
      continue;
    }
    if (block.type === 'file_list') {
      const next = sanitizeFileList(block);
      if (next) out.push(next);
      continue;
    }
    if (block.type === 'image') {
      const next = sanitizeImage(block);
      if (next) out.push(next);
      continue;
    }
    if (block.type === 'flow') {
      const next = sanitizeFlow(block);
      if (next) out.push(next);
      continue;
    }
    if (block.type === 'diagram') {
      const next = sanitizeDiagram(block);
      if (next) out.push(next);
      continue;
    }
    if (block.type === 'map') {
      const next = sanitizeMap(block);
      if (next) out.push(next);
      continue;
    }
    if (block.type === 'quick_actions') {
      const next = sanitizeQuickActions(block, hostRefs);
      if (next) out.push(next);
      continue;
    }
    if (block.type === 'stepper') {
      const next = sanitizeStepper(block);
      if (next) out.push(next);
      continue;
    }
    if (block.type === 'booking_card') {
      const next = sanitizeBookingCard(block);
      if (next) out.push(next);
      continue;
    }
    if (block.type === 'dynamic_form') {
      const next = sanitizeDynamicForm(block);
      if (next) out.push(next);
      continue;
    }
    out.push(block);
  }
  return out;
}

function toolResultRecords(toolResults: unknown[]): Record<string, unknown>[] {
  return toolResults.filter((item): item is Record<string, unknown> =>
    Boolean(item && typeof item === 'object' && !Array.isArray(item))
  );
}

function blocksMention(blocks: ChatBlock[], snippet: string): boolean {
  if (!snippet.trim()) return false;
  return JSON.stringify(blocks).includes(snippet);
}

/** Fill in pending tasks / booked stays / requested files when the model omitted them. */
export function hydrateAssistantBlocksFromTools(
  blocks: ChatBlock[],
  toolResults: unknown[],
  userMessage = '',
  options?: { attachedContext?: AttachedContextItem[] }
): ChatBlock[] {
  const records = toolResultRecords(toolResults);
  const hostRefs = mergeHostDisplayRefs(
    collectHostDisplayRefs(toolResults, options?.attachedContext ?? []),
    collectHostDisplayRefsFromBlocks(blocks)
  );
  let next = [...blocks];

  const askedForFiles = documentsRequestedByMessage(userMessage).asked;
  const pendingTasks = records.flatMap((record) =>
    Array.isArray(record.pendingTasks)
      ? record.pendingTasks.map((task) => asDisplay(task)).filter(Boolean)
      : []
  );
  if (
    !askedForFiles &&
    pendingTasks.length > 0 &&
    !pendingTasks.every((task) => blocksMention(next, task))
  ) {
    next.push({
      type: 'text',
      text: pendingTasks.map((task) => `• ${task}`).join('\n'),
    });
  }

  const bookedStays = records.flatMap((record) =>
    Array.isArray(record.bookedStays) ? record.bookedStays : []
  ) as Array<Record<string, unknown>>;
  const hasFilledTable = next.some(
    (block) => block.type === 'data_table' && Array.isArray(block.rows) && block.rows.length > 0
  );
  const returnedBookedStays = records.some((record) => Array.isArray(record.bookedStays));
  if (bookedStays.length > 0 && !hasFilledTable) {
    const guestNames = bookedStays.map((stay) => asDisplay(stay.guestName)).filter(Boolean);
    const alreadyListed =
      guestNames.length > 0 && guestNames.every((name) => blocksMention(next, name));
    if (!alreadyListed) {
      const propertyName = asDisplay(
        records.find((record) => asDisplay(record.propertyName))?.propertyName
      );
      const from = asDisplay(records.find((record) => asDisplay(record.from))?.from);
      const to = asDisplay(records.find((record) => asDisplay(record.to))?.to);
      const titleParts = ['Booked stays'];
      if (propertyName) titleParts.push(propertyName);
      if (from && to) titleParts.push(`${from}–${to}`);
      next.push({
        type: 'data_table',
        title: titleParts.join(' · '),
        columns: ['Guest', 'Check-in', 'Check-out'],
        rows: bookedStays.map((stay) => ({
          Guest: asDisplay(stay.guestName) || 'Guest',
          'Check-in': asDisplay(stay.checkIn),
          'Check-out': asDisplay(stay.checkOut),
        })),
      });
    }
  } else if (returnedBookedStays && bookedStays.length === 0 && !hasFilledTable) {
    const emptyLine = 'No booked stays in that date range.';
    if (!blocksMention(next, emptyLine)) {
      next.push({ type: 'text', text: emptyLine });
    }
  }

  const listedBookings = records.flatMap((record) =>
    Array.isArray(record.bookings) ? record.bookings : []
  ) as Array<Record<string, unknown>>;

  const bookingByGuest = new Map<string, Record<string, unknown>>();
  for (const row of listedBookings) {
    const guest = asDisplay(row.guestName).toLowerCase();
    if (guest) bookingByGuest.set(guest, row);
  }

  // Ensure booking pickers show Status (and human dates) even when the model omitted them.
  next = next.map((block) => {
    if (block.type !== 'data_table') return block;
    const columns = (block.columns ?? []).map((col) => String(col));
    const guestCol = columns.find((col) => /^guest$/i.test(col.trim()));
    if (!guestCol || listedBookings.length === 0) return block;

    const hasStatus = columns.some((col) => /^status$/i.test(col.trim()));
    const nextColumns = hasStatus ? columns : [...columns, 'Status'];
    const rows = (block.rows ?? []).map((row) => {
      const nextRow: Record<string, string | number> = { ...row };
      const guest = asDisplay(nextRow[guestCol]);
      const match = bookingByGuest.get(guest.toLowerCase());
      const statusCode = asDisplay(match?.status);
      const statusHuman = asDisplay(
        match?.statusLabel ?? match?.status ?? nextRow.Status ?? nextRow.status
      );
      const statusValue = statusCode || statusHuman;
      if (!hasStatus && statusValue) nextRow.Status = statusValue;
      else if (hasStatus && statusValue) {
        const statusCol = columns.find((col) => /^status$/i.test(col.trim()))!;
        if (!asDisplay(nextRow[statusCol]) || statusCode) nextRow[statusCol] = statusValue;
      }

      for (const col of nextColumns) {
        if (/^check[- ]?in$/i.test(col) && match?.checkIn) {
          nextRow[col] = formatStayDateShort(asDisplay(match.checkIn)) || asDisplay(nextRow[col]);
        }
        if (/^check[- ]?out$/i.test(col) && match?.checkOut) {
          nextRow[col] = formatStayDateShort(asDisplay(match.checkOut)) || asDisplay(nextRow[col]);
        }
      }
      return nextRow;
    });
    return { ...block, columns: nextColumns, rows };
  });

  const hasBookingTable = next.some(
    (block) => block.type === 'data_table' && Array.isArray(block.rows) && block.rows.length > 0
  );
  const hasJourney = records.some((record) => record.kind === 'booking_journey');
  if (listedBookings.length > 0 && !hasBookingTable && !hasJourney) {
    next.push({
      type: 'data_table',
      title: 'Bookings',
      columns: ['Guest', 'Stay', 'Status'],
      rows: listedBookings.map((row) => ({
        Guest: asDisplay(row.guestName) || 'Guest',
        Stay: formatStayRangeShort(asDisplay(row.checkIn), asDisplay(row.checkOut)),
        Status: asDisplay(row.status) || asDisplay(row.statusLabel),
      })),
    });
  }

  // Stay-picker chips only when choosing among bookings — never after a journey is already shown.
  const existingQuickActions = next.flatMap((block) =>
    block.type === 'quick_actions' ? (block.actions ?? []) : []
  );
  const hasTechnicalChips = existingQuickActions.some((action) =>
    /^booking\s*#?\s*[\da-f-]+$/i.test(action.label.trim())
  );
  const needsStayPicker =
    !hasJourney &&
    listedBookings.length > 0 &&
    (listedBookings.length > 1 || hasTechnicalChips || existingQuickActions.length === 0);

  if (needsStayPicker) {
    const stayActions = listedBookings.slice(0, 5).map((row) => {
      const label = formatBookingHostLabel({
        guestName: asDisplay(row.guestName),
        checkIn: asDisplay(row.checkIn),
        checkOut: asDisplay(row.checkOut),
        statusLabel: asDisplay(row.statusLabel ?? row.status),
      });
      return {
        label,
        prompt: buildStayGuidancePrompt({
          guestName: asDisplay(row.guestName),
          checkIn: asDisplay(row.checkIn),
          checkOut: asDisplay(row.checkOut),
          statusLabel: asDisplay(row.statusLabel ?? row.status),
        }),
      };
    });
    let replaced = false;
    next = next.map((block) => {
      if (block.type !== 'quick_actions') return block;
      replaced = true;
      return { type: 'quick_actions' as const, actions: stayActions };
    });
    if (!replaced) {
      next.push({ type: 'quick_actions', actions: stayActions });
    }
  } else if (hasJourney) {
    // Drop stay-picker echoes; wrapBlocksWithJourneyGuidance will attach real follow-ups.
    next = next.filter((block) => {
      if (block.type !== 'quick_actions') return true;
      const actions = block.actions ?? [];
      const allStayPickers = actions.every((action) => / · /.test(action.label));
      return !allStayPickers;
    });
  }

  const knownDocs = documentsFromToolResults(toolResults);
  const knownUrls = new Set(knownDocs.map((doc) => doc.url));
  next = next.map((block) => {
    if (block.type !== 'file_list') return block;
    const files = (block.files ?? []).filter((file) => knownUrls.has(asDisplay(file.url)));
    return { ...block, files };
  });

  if (askedForFiles) {
    const { files, missingLabels } = selectDocumentsForMessage(knownDocs, userMessage);
    const alreadyShown = new Set(
      next.flatMap((block) =>
        block.type === 'file_list' ? (block.files ?? []).map((file) => asDisplay(file.url)) : []
      )
    );
    const toAdd = files.filter((file) => !alreadyShown.has(file.url));
    if (toAdd.length > 0) {
      next.push({
        type: 'file_list',
        title: toAdd.length === 1 ? toAdd[0].label : 'Files',
        files: toAdd.map((file) => ({ label: file.label, url: file.url, kind: file.kind })),
      });
    }
    for (const label of missingLabels) {
      const line =
        label === 'No files on this booking'
          ? 'No files on file for this booking.'
          : `${label} is not on file for this booking.`;
      if (!blocksMention(next, line)) {
        next.push({ type: 'text', text: line });
      }
    }
  }

  next = hydrateStepperFromJourney(next, records);
  const finalRefs = mergeHostDisplayRefs(hostRefs, collectHostDisplayRefsFromBlocks(next));
  next = humanizeBlocksForHost(next, finalRefs);
  return sanitizeAssistantChatBlocks(next, finalRefs);
}

/**
 * Final pass after all server-built `action_confirmation` blocks exist (Tier-1 auto or Tier-2
 * proposed). Builds the booking-journey stepper from `plan_booking_journey` and nests the first
 * `propose_transition_booking` confirmation on the current step instead of leaving it standalone.
 */
export function nestBookingJourneyStepper(
  blocks: ChatBlock[],
  toolResults: unknown[],
  attachedContext: AttachedContextItem[] = []
): ChatBlock[] {
  const records = toolResultRecords(toolResults);
  const hostRefs = mergeHostDisplayRefs(
    collectHostDisplayRefs(toolResults, attachedContext),
    collectHostDisplayRefsFromBlocks(blocks)
  );
  return sanitizeAssistantChatBlocks(
    humanizeBlocksForHost(hydrateStepperFromJourney(blocks, records), hostRefs),
    hostRefs
  );
}

function hydrateStepperFromJourney(
  blocks: ChatBlock[],
  records: Record<string, unknown>[]
): ChatBlock[] {
  const journey = records.find(
    (record) => record.kind === 'booking_journey' && Array.isArray(record.steps)
  );
  if (!journey) return blocks;

  const rawSteps = journey.steps as Array<Record<string, unknown>>;
  const guestName = asDisplay(journey.guestName);
  const titleParts = ['Booking journey'];
  if (guestName) titleParts.push(guestName);

  let actionBlock: ActionConfirmationBlock | undefined;
  const withoutAction = blocks.filter((block) => {
    if (block.type !== 'action_confirmation') return true;
    if (block.toolName === 'propose_transition_booking' && !actionBlock) {
      actionBlock = block;
      return false;
    }
    return true;
  });

  const steps = rawSteps
    .map((step): StepperStep | null => {
      const label = asDisplay(step.label);
      if (!label) return null;
      const status: 'done' | 'current' | 'upcoming' =
        step.stepStatus === 'done' ||
        step.stepStatus === 'current' ||
        step.stepStatus === 'upcoming'
          ? step.stepStatus
          : 'upcoming';
      const description = asDisplay(step.description) || undefined;
      return {
        label,
        status,
        description,
        actionBlock: status === 'current' ? actionBlock : undefined,
      };
    })
    .filter((step): step is StepperStep => step != null);

  if (steps.length === 0) return blocks;

  return [
    ...withoutAction.filter((block) => block.type !== 'stepper'),
    {
      type: 'stepper',
      title: titleParts.join(' · '),
      steps,
    },
  ];
}
