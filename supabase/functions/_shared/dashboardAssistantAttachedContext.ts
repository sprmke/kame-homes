/**
 * Attached chat context — explicit pins the host added in the composer.
 * Keep in sync with ui/src/features/dashboard/ai-assistant/lib/attachedContext.ts
 */

import { createServiceClient, verifyPropertyAccess } from './orgAuth.ts';
import { inlineUntrusted } from './ai/untrusted.ts';

export const ATTACHED_CONTEXT_TYPES = [
  'booking',
  'property',
  'parking_booking',
  'team_member',
  'finance_item',
  'maintenance_item',
  'pricing_date',
  'inbox_conversation',
  'marketing_template',
  'notification_module',
  'public_page',
  'ticket',
] as const;

export type AttachedContextType = (typeof ATTACHED_CONTEXT_TYPES)[number];

export type AttachedContextItem = {
  type: AttachedContextType;
  id: string;
  label: string;
  propertyId?: string | null;
};

export const ATTACHED_CONTEXT_MAX = 8;
export const ASSISTANT_SCOPE_PAYLOAD_KEY = '__assistantScope';

const TYPE_SET = new Set<string>(ATTACHED_CONTEXT_TYPES);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTIFICATION_MODULE_IDS = new Set(['staff', 'finance', 'maintenance', 'marketing', 'admin']);
const PUBLIC_PAGE_ID_RE = /^[a-z][a-z0-9_-]{0,63}$/;
const UUID_TYPES = new Set<AttachedContextType>([
  'booking',
  'property',
  'parking_booking',
  'team_member',
  'finance_item',
  'maintenance_item',
  'inbox_conversation',
  'marketing_template',
  'ticket',
]);

export type AssistantPageContext = {
  propertyId?: string | null;
  bookingId?: string | null;
};

export type AssistantScope = {
  pageContext: AssistantPageContext;
  attachedContext: AttachedContextItem[];
};

function isAttachedContextType(value: string): value is AttachedContextType {
  return TYPE_SET.has(value);
}

function assertIdFormat(type: AttachedContextType, id: string): void {
  if (UUID_TYPES.has(type)) {
    if (!UUID_RE.test(id)) throw new Error(`Invalid ${type} id`);
    return;
  }
  if (type === 'pricing_date' && !ISO_DATE_RE.test(id)) {
    throw new Error('Invalid pricing date');
  }
  if (type === 'notification_module' && !NOTIFICATION_MODULE_IDS.has(id)) {
    throw new Error('Invalid notification module');
  }
  if (type === 'public_page' && !PUBLIC_PAGE_ID_RE.test(id)) {
    throw new Error('Invalid public page id');
  }
}

function parseOne(raw: unknown): AttachedContextItem {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid attached context item');
  const rec = raw as Record<string, unknown>;
  const type = typeof rec.type === 'string' ? rec.type.trim() : '';
  const id = typeof rec.id === 'string' ? rec.id.trim() : '';
  const label = typeof rec.label === 'string' ? rec.label.trim() : '';
  if (!isAttachedContextType(type)) throw new Error('Unknown attached context type');
  if (!id) throw new Error('Attached context id is required');
  if (!label || label.length > 200) throw new Error('Invalid attached context label');
  assertIdFormat(type, id);
  const propertyId =
    typeof rec.propertyId === 'string' && rec.propertyId.trim() ? rec.propertyId.trim() : null;
  if (propertyId && !UUID_RE.test(propertyId))
    throw new Error('Invalid attached context propertyId');
  return { type, id, label, propertyId };
}

export function parseAttachedContextInput(raw: unknown): AttachedContextItem[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new Error('attachedContext must be an array');
  if (raw.length > ATTACHED_CONTEXT_MAX) {
    throw new Error(`Up to ${ATTACHED_CONTEXT_MAX} attached items`);
  }
  const seen = new Set<string>();
  const items: AttachedContextItem[] = [];
  for (const entry of raw) {
    const item = parseOne(entry);
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

/** RBAC-check every attached item the host can actually see. */
export async function verifyAttachedContextAccess(
  req: Request,
  items: AttachedContextItem[]
): Promise<AttachedContextItem[]> {
  if (items.length === 0) return items;

  const propertyIds = new Set<string>();
  const bookingIds: string[] = [];
  for (const item of items) {
    if (item.type === 'property') propertyIds.add(item.id);
    if (item.propertyId) propertyIds.add(item.propertyId);
    if (item.type === 'booking' || item.type === 'parking_booking') bookingIds.push(item.id);
  }

  if (bookingIds.length > 0) {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('guest_submissions')
      .select('id, property_id')
      .in('id', bookingIds);
    if (error) throw new Error(`Failed to verify attached bookings: ${error.message}`);
    const found = new Map(
      (data ?? []).map((row) => [String(row.id), row.property_id as string | null])
    );
    for (const id of bookingIds) {
      const propertyId = found.get(id);
      if (!propertyId) throw new Error('Attached booking not found');
      propertyIds.add(propertyId);
    }
    for (const item of items) {
      if (item.type !== 'booking' && item.type !== 'parking_booking') continue;
      const propertyId = found.get(item.id);
      if (propertyId && !item.propertyId) item.propertyId = propertyId;
    }
  }

  for (const propertyId of propertyIds) {
    await verifyPropertyAccess(req, propertyId);
  }
  return items;
}

export function firstAttachedId(
  items: AttachedContextItem[],
  type: AttachedContextType
): string | undefined {
  return items.find((item) => item.type === type)?.id;
}

export function firstAttachedPropertyId(items: AttachedContextItem[]): string | undefined {
  for (const item of items) {
    if (item.type === 'property') return item.id;
    if (item.propertyId) return item.propertyId;
  }
  return undefined;
}

export function attachedContextPromptLines(items: AttachedContextItem[]): string {
  if (items.length === 0) return '';
  const grouped = new Map<AttachedContextType, AttachedContextItem[]>();
  for (const item of items) {
    const list = grouped.get(item.type) ?? [];
    list.push(item);
    grouped.set(item.type, list);
  }
  const parts: string[] = [];
  for (const type of ATTACHED_CONTEXT_TYPES) {
    const list = grouped.get(type);
    if (!list?.length) continue;
    parts.push(
      list.map((item) => `${typeLabel(type)} ${inlineUntrusted(item.label)} (${item.id})`).join('; ')
    );
  }
  return `\nThe host attached: ${parts.join('; ')}. Prefer these entities for matching tools unless they name a different one.`;
}

function typeLabel(type: AttachedContextType): string {
  switch (type) {
    case 'booking':
      return 'Booking';
    case 'property':
      return 'Property';
    case 'parking_booking':
      return 'Parking booking';
    case 'team_member':
      return 'Team member';
    case 'finance_item':
      return 'Finance item';
    case 'maintenance_item':
      return 'Maintenance item';
    case 'pricing_date':
      return 'Pricing date';
    case 'inbox_conversation':
      return 'Inbox conversation';
    case 'marketing_template':
      return 'Marketing template';
    case 'notification_module':
      return 'Notification module';
    case 'public_page':
      return 'Public page';
    case 'ticket':
      return 'Support ticket';
  }
}

export function stripAssistantScopeFromPayload(payload: Record<string, unknown>): {
  payload: Record<string, unknown>;
  scope: AssistantScope | null;
} {
  if (!(ASSISTANT_SCOPE_PAYLOAD_KEY in payload)) {
    return { payload, scope: null };
  }
  const { [ASSISTANT_SCOPE_PAYLOAD_KEY]: rawScope, ...rest } = payload;
  return { payload: rest, scope: parseAssistantScope(rawScope) };
}

export function withAssistantScope(
  payload: Record<string, unknown>,
  scope: AssistantScope
): Record<string, unknown> {
  return { ...payload, [ASSISTANT_SCOPE_PAYLOAD_KEY]: scope };
}

function parseAssistantScope(raw: unknown): AssistantScope | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const page = rec.pageContext && typeof rec.pageContext === 'object' ? rec.pageContext : {};
  const pageRec = page as Record<string, unknown>;
  try {
    return {
      pageContext: {
        propertyId:
          typeof pageRec.propertyId === 'string' && pageRec.propertyId.trim()
            ? pageRec.propertyId.trim()
            : null,
        bookingId:
          typeof pageRec.bookingId === 'string' && pageRec.bookingId.trim()
            ? pageRec.bookingId.trim()
            : null,
      },
      attachedContext: parseAttachedContextInput(rec.attachedContext),
    };
  } catch {
    return null;
  }
}
