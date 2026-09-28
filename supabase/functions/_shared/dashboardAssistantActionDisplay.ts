/**
 * Host-facing formatting for dashboard assistant action confirmations and workflow errors.
 * Never expose raw IDs, enum codes, camelCase field names, or serialized objects in cards.
 */

import { getAssistantToolActivityLabel } from './assistantToolLabels.ts';
import { isBookingStatus, STATUS_HUMAN_LABEL } from './statusMachine.ts';

const HIDDEN_DETAIL_KEYS = new Set([
  'summary',
  '__assistantScope',
  'bookingId',
  'toStatus',
  'payload',
  'pendingCommit',
  'kind',
  'validatedCount',
  'errors',
  'propertyId',
  'organizationId',
  'toolName',
  'riskTier',
  'actionId',
  'currentStatus',
  'currentStatusLabel',
  'nextStatus',
  'steps',
  'guestName',
  'auditPropertyId',
  'auditBookingId',
  'parkingId',
  'attachmentPath',
  'documentCompletionTarget',
  'alsoMarkComplete',
  'mimeType',
  'previousUrl',
  'hostLabel',
  'displayDetails',
]);

/** Prefer these over camelCase-splitting for known API field keys. */
const HOST_FIELD_LABELS: Record<string, string> = {
  weekdayNightlyRate: 'Weekday nightly rate',
  weekendNightlyRate: 'Weekend nightly rate',
  downPayment: 'Down payment',
  securityDeposit: 'Security deposit',
  petFee: 'Pet fee',
  parkingRateGuest: 'Guest parking rate',
  guestAdditionalFee: 'Extra guest fee',
  maxGuests: 'Max guests',
  unitNumber: 'Unit number',
  residenceName: 'Residence name',
  brandColor: 'Brand color',
  contactName: 'Contact name',
  contactRole: 'Contact role',
  contactPhone: 'Contact phone',
  contactEmail: 'Contact email',
  customHouseRules: 'House rules',
  customAmenities: 'Amenities',
  cancellationPolicy: 'Cancellation policy',
  name: 'Name',
  description: 'Description',
  tagline: 'Tagline',
  address: 'Address',
  status: 'Status',
  tower: 'Tower',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  floors: 'Floors',
  maxAdults: 'Max adults',
  maxChildren: 'Max children',
};

const MONEY_FIELD_KEYS = new Set([
  'weekdayNightlyRate',
  'weekendNightlyRate',
  'downPayment',
  'securityDeposit',
  'petFee',
  'parkingRateGuest',
  'guestAdditionalFee',
  'rate',
  'amount',
]);

const STATUS_CODE_RE = /\b([A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+)\b/g;
/** camelCase / PascalCase tokens that should never appear in host-facing copy. */
const CAMEL_CASE_TOKEN_RE = /\b[A-Za-z]+[a-z][A-Z][A-Za-z0-9]*\b/g;
const SNAKE_TOOL_NAME_RE = /\b[a-z]+(?:_[a-z0-9]+)+\b/g;

function asDisplay(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
}

export function humanizeHostFieldLabel(key: string): string {
  const known = HOST_FIELD_LABELS[key];
  if (known) return known;
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function formatPhpAmount(value: number): string {
  return `₱${Math.round(value).toLocaleString('en-PH')}`;
}

function humanizeDetailLabel(key: string): string {
  return humanizeHostFieldLabel(key);
}

function formatDetailValue(key: string, value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object') return null;
  if (typeof value === 'number' && Number.isFinite(value) && MONEY_FIELD_KEYS.has(key)) {
    return formatPhpAmount(value);
  }
  const text = asDisplay(value);
  if (!text) return null;
  if (key === 'toStatus' && isBookingStatus(text)) return STATUS_HUMAN_LABEL[text];
  return humanizeHostFacingCopy(
    text.replace(STATUS_CODE_RE, (code) => {
      if (isBookingStatus(code)) return STATUS_HUMAN_LABEL[code];
      return code;
    })
  );
}

/** Rewrite camelCase / snake_case identifiers in free-form host-facing text. */
export function humanizeHostFacingCopy(text: string): string {
  if (!text.trim()) return text;
  return text
    .replace(CAMEL_CASE_TOKEN_RE, (token) => {
      if (HOST_FIELD_LABELS[token]) return HOST_FIELD_LABELS[token].toLowerCase();
      // Keep short all-caps acronyms (GAF, PDF) and normal Title Case words alone.
      if (/^[A-Z]{2,5}$/.test(token)) return token;
      return humanizeHostFieldLabel(token).toLowerCase();
    })
    .replace(SNAKE_TOOL_NAME_RE, (token) => {
      if (!token.includes('_')) return token;
      if (token.startsWith('propose_') || token.startsWith('get_') || token.startsWith('list_')) {
        return humanizeHostFieldLabel(token).toLowerCase();
      }
      return token;
    })
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
}

/** Short host-facing summary for a map of updated field keys. */
export function buildHostFacingFieldsSummary(prefix: string, fieldKeys: string[]): string {
  const labels = fieldKeys.map((key) => humanizeHostFieldLabel(key).toLowerCase());
  if (labels.length === 0) return humanizeHostFacingCopy(prefix);
  if (labels.length === 1) return `${prefix.replace(/:\s*$/, '')}: ${labels[0]}.`;
  if (labels.length === 2) return `${prefix.replace(/:\s*$/, '')}: ${labels[0]} and ${labels[1]}.`;
  return `${prefix.replace(/:\s*$/, '')}: ${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}.`;
}

/** Property/parking base-rate confirmation summary — never camelCase keys. */
export function buildPricingBaseRateSummary(
  scope: 'property' | 'parking',
  patch: Record<string, number>
): string {
  const entries = Object.entries(patch).filter(([, value]) => Number.isFinite(value));
  if (entries.length === 0) {
    return scope === 'parking' ? 'Update parking base rates.' : 'Update property base rates.';
  }
  if (entries.length === 1) {
    const [key, value] = entries[0];
    return `Update ${humanizeHostFieldLabel(key).toLowerCase()} to ${formatPhpAmount(value)}.`;
  }
  const parts = entries.map(
    ([key, value]) => `${humanizeHostFieldLabel(key).toLowerCase()} to ${formatPhpAmount(value)}`
  );
  const head = scope === 'parking' ? 'Update parking base rates' : 'Update property base rates';
  return `${head}: ${parts.join('; ')}.`;
}

/** Normalize confirmation card title before persist / display. */
export function humanizeActionConfirmationSummary(
  toolName: string,
  summary: string | null | undefined,
  payload?: Record<string, unknown>
): string {
  const raw = asDisplay(summary);
  if (raw) return humanizeHostFacingCopy(raw);

  if (
    toolName === 'propose_update_property_base_rate' ||
    toolName === 'propose_update_parking_base_rate'
  ) {
    const patch: Record<string, number> = {};
    for (const key of MONEY_FIELD_KEYS) {
      if (typeof payload?.[key] === 'number') patch[key] = payload[key] as number;
    }
    return buildPricingBaseRateSummary(
      toolName === 'propose_update_parking_base_rate' ? 'parking' : 'property',
      patch
    );
  }

  const label = getAssistantToolActivityLabel(toolName, 'done');
  return label.startsWith('Could not') ? 'Confirm this change.' : label;
}

/** User-facing detail rows for action confirmation cards — omits technical fields. */
export function buildActionConfirmationDetails(
  toolName: string,
  payload: Record<string, unknown>
): Array<{ label: string; value: string }> {
  if (
    toolName === 'propose_transition_booking' ||
    toolName === 'propose_cancel_booking' ||
    toolName === 'propose_transition_parking_booking'
  ) {
    return [];
  }

  // Parity tools supply host-facing rows themselves (no ids, human labels).
  if (Array.isArray(payload.displayDetails)) {
    return (payload.displayDetails as unknown[])
      .filter(
        (row): row is { label: string; value: string } =>
          Boolean(row) &&
          typeof (row as { label?: unknown }).label === 'string' &&
          typeof (row as { value?: unknown }).value === 'string'
      )
      .slice(0, 12)
      .map((row) => ({ label: row.label.slice(0, 60), value: row.value.slice(0, 240) }));
  }

  const details: Array<{ label: string; value: string }> = [];
  for (const [key, value] of Object.entries(payload)) {
    if (HIDDEN_DETAIL_KEYS.has(key)) continue;
    const formatted = formatDetailValue(key, value);
    if (!formatted) continue;
    details.push({ label: humanizeDetailLabel(key), value: formatted });
  }
  return details;
}

export function buildTier1ActionSummary(toolName: string): string {
  const label = getAssistantToolActivityLabel(toolName, 'done');
  return label.startsWith('Could not') ? `Done automatically` : label;
}

const TRANSITION_NOT_ALLOWED_RE = /^Transition\s+([A-Z_]+)\s*→\s*([A-Z_]+)\s+is not allowed/i;

/** Turn workflow orchestrator errors into host-readable copy. */
export function humanizeTransitionError(message: string): string {
  const trimmed = message.trim();
  const match = TRANSITION_NOT_ALLOWED_RE.exec(trimmed);
  if (match) {
    const from = match[1];
    const to = match[2];
    const fromLabel = isBookingStatus(from) ? STATUS_HUMAN_LABEL[from] : from;
    const toLabel = isBookingStatus(to) ? STATUS_HUMAN_LABEL[to] : to;
    return `This booking can't jump from ${fromLabel} to ${toLabel}. Work through each step in order — see the progress guide below.`;
  }
  return trimmed.replace(STATUS_CODE_RE, (code) => {
    if (isBookingStatus(code)) return STATUS_HUMAN_LABEL[code];
    return code;
  });
}

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** Strip internal IDs and tool/instruction jargon from quick-action prompts. */
export function sanitizeQuickActionPrompt(prompt: string): string {
  return prompt
    .replace(UUID_RE, 'this booking')
    .replace(/\bbooking\s+this booking\b/gi, 'this booking')
    .replace(
      /\b(list_bookings|get_booking|get_booking_documents|plan_booking_journey|get_available_transitions|propose_transition_booking|pendingTasks|guestName|status filter|no status filter)\b/gi,
      ''
    )
    .replace(/\bcall\s+[a-z_]+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

export function buildJourneyQuickActions(journey: Record<string, unknown>): Array<{
  label: string;
  prompt: string;
}> {
  const currentLabel = asDisplay(journey.currentStatusLabel);
  const nextLabel = asDisplay(journey.nextStatusLabel);
  const guestName = asDisplay(journey.guestName);
  const currentStatus = asDisplay(journey.currentStatus);
  const guestRef = guestName ? ` for ${guestName}` : '';

  const actions: Array<{ label: string; prompt: string }> = [];

  if (nextLabel) {
    actions.push({
      label: `Advance to ${nextLabel}`,
      prompt: `Help me move this booking${guestRef} from ${currentLabel || 'its current status'} to ${nextLabel}. Only take the next valid step — do not jump to Completed.`,
    });
  }

  actions.push({
    label: 'What is still pending?',
    prompt: `What is still pending on this booking${guestRef}${currentLabel ? ` at ${currentLabel}` : ''}? Explain clearly.`,
  });

  const docsStatuses = new Set([
    'PENDING_DOCUMENTS',
    'PENDING_GAF',
    'PENDING_PARKING_REQUEST',
    'PENDING_PET_REQUEST',
  ]);
  if (docsStatuses.has(currentStatus)) {
    actions.push({
      label: 'Show documents',
      prompt: `Show building documents on file for this booking${guestRef}.`,
    });
  } else {
    actions.push({
      label: 'Show files',
      prompt: `Show files on this booking${guestRef}.`,
    });
  }

  return actions.slice(0, 3);
}

/**
 * Drop suggestion chips that only repeat what the host just selected/typed
 * (any module — bookings, inbox, maintenance, team, marketing, …).
 */
export function filterEchoSuggestionChips(
  actions: Array<{ label: string; prompt: string }>,
  options?: { userMessage?: string | null; echoLabels?: string[] }
): Array<{ label: string; prompt: string }> {
  const msg = (options?.userMessage ?? '').trim().toLowerCase();
  const echoLabels = (options?.echoLabels ?? [])
    .map((label) => label.trim().toLowerCase())
    .filter(Boolean);

  return actions.filter((action) => {
    const label = action.label.trim().toLowerCase();
    if (!label) return false;
    if (msg && (label === msg || msg.includes(label) || label.includes(msg))) return false;
    for (const echo of echoLabels) {
      if (label === echo) return false;
      // Stay/entity picker style: "Name · …" matching a selected hostLabel's primary name
      const echoPrimary = echo.split(' · ')[0];
      if (echoPrimary && label.startsWith(`${echoPrimary} ·`)) return false;
    }
    return true;
  });
}

export function buildJourneyIntroText(journey: Record<string, unknown>): string {
  const guestName = asDisplay(journey.guestName);
  const currentLabel = asDisplay(journey.currentStatusLabel);
  if (!currentLabel) {
    return guestName
      ? `${guestName}'s booking has several steps left — work through them in order.`
      : 'This booking has several steps left — work through them in order.';
  }
  return guestName
    ? `${guestName}'s booking is at ${currentLabel}. Complete each step below before moving on.`
    : `This booking is at ${currentLabel}. Complete each step below before moving on.`;
}

export function isBookingJourneyRecord(record: unknown): record is Record<string, unknown> {
  return (
    record != null &&
    typeof record === 'object' &&
    (record as Record<string, unknown>).kind === 'booking_journey'
  );
}
