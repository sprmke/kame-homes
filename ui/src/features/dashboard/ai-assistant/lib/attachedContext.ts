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
  'marketing_theme',
  'review',
  'voucher',
  'notification_module',
  'public_page',
  'ticket',
  'property_template',
] as const;

export type AttachedContextType = (typeof ATTACHED_CONTEXT_TYPES)[number];

export type AttachedContextItem = {
  type: AttachedContextType;
  id: string;
  label: string;
  propertyId?: string | null;
};

export const ATTACHED_CONTEXT_MAX = 8;

const TYPE_SET = new Set<string>(ATTACHED_CONTEXT_TYPES);

export function isAttachedContextType(value: string): value is AttachedContextType {
  return TYPE_SET.has(value);
}

export function attachedContextKey(item: Pick<AttachedContextItem, 'type' | 'id'>): string {
  return `${item.type}:${item.id}`;
}

export function upsertAttachedContext(
  current: AttachedContextItem[],
  item: AttachedContextItem,
  max = ATTACHED_CONTEXT_MAX
): AttachedContextItem[] {
  const key = attachedContextKey(item);
  if (current.some((existing) => attachedContextKey(existing) === key)) return current;
  if (current.length >= max) return current;
  return [...current, item];
}

export function removeAttachedContext(
  current: AttachedContextItem[],
  item: Pick<AttachedContextItem, 'type' | 'id'>
): AttachedContextItem[] {
  const key = attachedContextKey(item);
  return current.filter((existing) => attachedContextKey(existing) !== key);
}

export function firstAttachedOfType(
  items: AttachedContextItem[],
  type: AttachedContextType
): AttachedContextItem | undefined {
  return items.find((item) => item.type === type);
}
