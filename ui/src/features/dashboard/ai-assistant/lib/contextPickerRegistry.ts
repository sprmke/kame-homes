import type {
  AttachedContextItem,
  AttachedContextType,
} from '@/features/dashboard/ai-assistant/lib/attachedContext';
import {
  isOrgAdminPath,
  isParkingAdminPath,
  isPropertyAdminPath,
} from '@/features/dashboard/bookings/lib/adminSidebarNav';
import { ORG_SECTION_VIEW_PERMISSION } from '@/features/dashboard/team/lib/orgPermissions';
import type { ParkingSection } from '@/features/dashboard/team/lib/parkingPermissions';
import { PROPERTY_SECTION_VIEW_PERMISSION } from '@/features/dashboard/team/lib/propertyPermissions';

/** Adapter key rendered by the composer quick-picker. */
export type ContextPickerKey =
  | 'booking'
  | 'property'
  | 'parking_booking'
  | 'team_member'
  | 'finance_item'
  | 'maintenance_item'
  | 'pricing_date'
  | 'inbox_conversation'
  | 'marketing_template'
  | 'marketing_theme'
  | 'review'
  | 'voucher'
  | 'notification_module'
  | 'public_page'
  | 'ticket'
  | 'property_template';

/** Property section ids plus org-only and parking-only sections. */
export type ContextPickerModuleId =
  | keyof typeof PROPERTY_SECTION_VIEW_PERMISSION
  | keyof typeof ORG_SECTION_VIEW_PERMISSION
  | 'pricing';

export type ContextPickerConfig = {
  picker: ContextPickerKey;
  entityTypes: AttachedContextType[];
  singular: string;
  plural: string;
};

export type AssistantTenantKind = 'org' | 'property' | 'parking';

export type ResolvedContextPicker = {
  tenant: AssistantTenantKind;
  moduleId: ContextPickerModuleId;
  picker: ContextPickerKey;
  config: ContextPickerConfig;
};

export type ComposerPickerSharedProps = {
  selectedIds: ReadonlySet<string>;
  onSelect: (item: AttachedContextItem) => void;
  disabled?: boolean;
  overlayContainer?: HTMLElement | null;
  pageEntityId?: string | null;
};

export const PICKER_ATTACHED_TYPE: Record<ContextPickerKey, AttachedContextType> = {
  booking: 'booking',
  property: 'property',
  parking_booking: 'parking_booking',
  team_member: 'team_member',
  finance_item: 'finance_item',
  maintenance_item: 'maintenance_item',
  pricing_date: 'pricing_date',
  inbox_conversation: 'inbox_conversation',
  marketing_template: 'marketing_template',
  marketing_theme: 'marketing_theme',
  review: 'review',
  voucher: 'voucher',
  notification_module: 'notification_module',
  public_page: 'public_page',
  ticket: 'ticket',
  property_template: 'property_template',
};

export const ASSISTANT_NOTIFICATION_MODULE_IDS = new Set([
  'staff',
  'finance',
  'maintenance',
  'marketing',
  'admin',
]);

export const ASSISTANT_NOTIFICATION_MODULE_LABELS: Record<string, string> = {
  staff: 'Staff',
  finance: 'Finance',
  maintenance: 'Maintenance',
  marketing: 'Marketing',
  admin: 'Admin',
};

export const CONTEXT_CATALOG_GROUPS: {
  type: AttachedContextType;
  label: string;
}[] = [
  { type: 'booking', label: 'Bookings' },
  { type: 'parking_booking', label: 'Parking' },
  { type: 'property', label: 'Properties' },
  { type: 'team_member', label: 'Team' },
  { type: 'finance_item', label: 'Finance' },
  { type: 'maintenance_item', label: 'Maintenance' },
  { type: 'pricing_date', label: 'Pricing' },
  { type: 'inbox_conversation', label: 'Inbox' },
  { type: 'marketing_template', label: 'Marketing' },
  { type: 'marketing_theme', label: 'Themes' },
  { type: 'review', label: 'Reviews' },
  { type: 'voucher', label: 'Vouchers' },
  { type: 'notification_module', label: 'Notifications' },
  { type: 'public_page', label: 'Pages' },
  { type: 'ticket', label: 'Tickets' },
  { type: 'property_template', label: 'Templates' },
];

const PROPERTY_SECTIONS = new Set(Object.keys(PROPERTY_SECTION_VIEW_PERMISSION));
const ORG_SECTIONS = new Set(Object.keys(ORG_SECTION_VIEW_PERMISSION));
const PARKING_SECTIONS = new Set<ParkingSection>([
  'dashboard',
  'bookings',
  'finance',
  'pricing',
  'notifications',
  'team',
  'settings',
  'inbox',
  'announcements',
  'help-support',
]);

export const CONTEXT_PICKER_REGISTRY: Record<ContextPickerModuleId, ContextPickerConfig> = {
  dashboard: {
    picker: 'booking',
    entityTypes: ['booking'],
    singular: 'booking',
    plural: 'bookings',
  },
  bookings: {
    picker: 'booking',
    entityTypes: ['booking'],
    singular: 'booking',
    plural: 'bookings',
  },
  properties: {
    picker: 'property',
    entityTypes: ['property'],
    singular: 'property',
    plural: 'properties',
  },
  parkings: {
    picker: 'booking',
    entityTypes: ['booking'],
    singular: 'booking',
    plural: 'bookings',
  },
  finance: {
    picker: 'finance_item',
    entityTypes: ['finance_item'],
    singular: 'transaction',
    plural: 'transactions',
  },
  pricing: {
    picker: 'pricing_date',
    entityTypes: ['pricing_date'],
    singular: 'date',
    plural: 'dates',
  },
  maintenance: {
    picker: 'maintenance_item',
    entityTypes: ['maintenance_item'],
    singular: 'reminder',
    plural: 'reminders',
  },
  marketing: {
    picker: 'marketing_template',
    entityTypes: ['marketing_template', 'marketing_theme'],
    singular: 'template',
    plural: 'templates',
  },
  notifications: {
    picker: 'notification_module',
    entityTypes: ['notification_module'],
    singular: 'module',
    plural: 'modules',
  },
  templates: {
    picker: 'property_template',
    entityTypes: ['property_template'],
    singular: 'template',
    plural: 'templates',
  },
  'public-pages': {
    picker: 'public_page',
    entityTypes: ['public_page'],
    singular: 'page',
    plural: 'pages',
  },
  plans: {
    picker: 'property',
    entityTypes: ['property'],
    singular: 'property',
    plural: 'properties',
  },
  team: {
    picker: 'team_member',
    entityTypes: ['team_member'],
    singular: 'member',
    plural: 'members',
  },
  settings: {
    picker: 'property',
    entityTypes: ['property'],
    singular: 'property',
    plural: 'properties',
  },
  inbox: {
    picker: 'inbox_conversation',
    entityTypes: ['inbox_conversation'],
    singular: 'conversation',
    plural: 'conversations',
  },
  reviews: {
    picker: 'review',
    entityTypes: ['review'],
    singular: 'review',
    plural: 'reviews',
  },
  'help-support': {
    picker: 'ticket',
    entityTypes: ['ticket'],
    singular: 'ticket',
    plural: 'tickets',
  },
  announcements: {
    picker: 'ticket',
    entityTypes: ['ticket'],
    singular: 'ticket',
    plural: 'tickets',
  },
  activity: {
    picker: 'booking',
    entityTypes: ['booking'],
    singular: 'booking',
    plural: 'bookings',
  },
  analytics: {
    picker: 'booking',
    entityTypes: ['booking'],
    singular: 'booking',
    plural: 'bookings',
  },
};

function firstSectionSegment(pathname: string, prefixRe: RegExp): string | undefined {
  const match = pathname.match(prefixRe);
  const segment = match?.[1];
  return segment && segment.length > 0 ? segment : undefined;
}

function parseAssistantRoute(pathname: string): {
  tenant: AssistantTenantKind;
  moduleId: ContextPickerModuleId;
} {
  if (isPropertyAdminPath(pathname)) {
    const segment = firstSectionSegment(pathname, /^\/org\/[^/]+\/property\/[^/]+(?:\/([^/]+))?/);
    const moduleId =
      segment && PROPERTY_SECTIONS.has(segment) ? (segment as ContextPickerModuleId) : 'dashboard';
    return { tenant: 'property', moduleId };
  }

  if (isParkingAdminPath(pathname)) {
    const segment = firstSectionSegment(pathname, /^\/org\/[^/]+\/parking\/[^/]+(?:\/([^/]+))?/);
    const moduleId =
      segment && PARKING_SECTIONS.has(segment as ParkingSection)
        ? (segment as ContextPickerModuleId)
        : 'dashboard';
    return { tenant: 'parking', moduleId };
  }

  if (isOrgAdminPath(pathname)) {
    const segment = firstSectionSegment(pathname, /^\/org\/[^/]+(?:\/([^/]+))?/);
    const moduleId =
      segment && ORG_SECTIONS.has(segment) ? (segment as ContextPickerModuleId) : 'dashboard';
    return { tenant: 'org', moduleId };
  }

  return { tenant: 'org', moduleId: 'dashboard' };
}

export function resolveContextPicker(pathname: string): ResolvedContextPicker {
  const { tenant, moduleId } = parseAssistantRoute(pathname);
  const config = CONTEXT_PICKER_REGISTRY[moduleId] ?? CONTEXT_PICKER_REGISTRY.dashboard;
  let picker = config.picker;
  if (tenant === 'parking') {
    if (picker === 'booking' || moduleId === 'dashboard' || moduleId === 'settings') {
      picker = 'parking_booking';
    }
  }
  return { tenant, moduleId, picker, config: { ...config, picker } };
}
