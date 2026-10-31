/**
 * Client mirror of the server activity catalog
 * (supabase/functions/_shared/activityLog.ts).
 *
 * Keep the enums here in sync with the CHECK constraints in
 * supabase/migrations/20261306150000_activity_log.sql and the unions in
 * `_shared/activityLog.ts`. This file owns *presentation only* — category glyphs,
 * labels, and severity styling for the Activity feed and <EntityActivityHistory>.
 */

import {
  Activity,
  Banknote,
  CalendarClock,
  Car,
  CreditCard,
  Megaphone,
  MessageSquare,
  Plug,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Tags,
  UserRound,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type ActivitySeverity = 'info' | 'notice' | 'warning' | 'destructive';
export type ActivityScope = 'org' | 'property' | 'parking';

export type ActivityActorType =
  | 'org_owner'
  | 'team_member'
  | 'super_admin'
  | 'ai_assistant'
  | 'guest'
  | 'public'
  | 'system'
  | 'cron'
  | 'webhook'
  | 'integration'
  | 'email_inbound';

export type ActivitySource =
  | 'dashboard'
  | 'public_form'
  | 'ai_assistant'
  | 'cron'
  | 'webhook'
  | 'telegram'
  | 'email_inbound'
  | 'db_trigger';

export type ActivityCategory =
  | 'booking'
  | 'team'
  | 'settings'
  | 'pricing'
  | 'finance'
  | 'maintenance'
  | 'marketing'
  | 'inbox'
  | 'property'
  | 'parking'
  | 'org'
  | 'plans_billing'
  | 'verification'
  | 'integrations'
  | 'public_pages'
  | 'guest'
  | 'security'
  | 'system';

export type ActivityChange = { field: string; from: unknown; to: unknown };

/** One row of `list-activity-log` — the wire shape returned by the edge fn. */
export type ActivityEvent = {
  id: string;
  createdAt: string;
  organizationId: string;
  propertyId: string | null;
  parkingId: string | null;
  scope: ActivityScope;
  actorType: ActivityActorType;
  actorUserId: string | null;
  actorEmail: string | null;
  actorDisplayName: string | null;
  actorRole: string | null;
  actorMemberId: string | null;
  action: string;
  category: ActivityCategory;
  severity: ActivitySeverity;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  summary: string;
  changes: ActivityChange[] | null;
  metadata: Record<string, unknown>;
  ipPrefix: string | null;
  userAgent: string | null;
  source: ActivitySource;
  requestId: string | null;
};

export type ActivityCursor = { ts: string; id: string };

export type ActivityLogResponse = {
  events: ActivityEvent[];
  nextCursor: ActivityCursor | null;
};

/** Exhaustive category → glyph (mirrors the NOTIFICATION_ICONS pattern). */
export const ACTIVITY_CATEGORY_ICONS: Record<ActivityCategory, LucideIcon> = {
  booking: CalendarClock,
  team: Users,
  settings: Settings2,
  pricing: Tags,
  finance: Banknote,
  maintenance: Wrench,
  marketing: Megaphone,
  inbox: MessageSquare,
  property: ScrollText,
  parking: Car,
  org: ScrollText,
  plans_billing: CreditCard,
  verification: ShieldCheck,
  integrations: Plug,
  public_pages: ScrollText,
  guest: UserRound,
  security: ShieldAlert,
  system: Activity,
};

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  booking: 'Bookings',
  team: 'Team',
  settings: 'Settings',
  pricing: 'Pricing',
  finance: 'Finance',
  maintenance: 'Maintenance',
  marketing: 'Marketing',
  inbox: 'Inbox',
  property: 'Property',
  parking: 'Parking',
  org: 'Organization',
  plans_billing: 'Plans & billing',
  verification: 'Verification',
  integrations: 'Integrations',
  public_pages: 'Public pages',
  guest: 'Guest',
  security: 'Security',
  system: 'System',
};

export function activityCategoryIcon(category: ActivityCategory): LucideIcon {
  return ACTIVITY_CATEGORY_ICONS[category] ?? Activity;
}

export function activityCategoryLabel(category: ActivityCategory): string {
  return ACTIVITY_CATEGORY_LABELS[category] ?? 'Activity';
}

/** Tailwind accent classes per severity — text + subtle background for the row rail. */
export const ACTIVITY_SEVERITY_META: Record<
  ActivitySeverity,
  { label: string; dot: string; text: string; badge: string }
> = {
  info: {
    label: 'Info',
    dot: 'bg-muted-foreground/40',
    text: 'text-muted-foreground',
    badge: 'bg-muted text-muted-foreground',
  },
  notice: {
    label: 'Notice',
    dot: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-300',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  },
  warning: {
    label: 'Warning',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  destructive: {
    label: 'Destructive',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  },
};

export const ACTIVITY_ACTOR_LABELS: Record<ActivityActorType, string> = {
  org_owner: 'Owner',
  team_member: 'Team member',
  super_admin: 'Platform admin',
  ai_assistant: 'AI assistant',
  guest: 'Guest',
  public: 'Public',
  system: 'System',
  cron: 'Scheduled job',
  webhook: 'External service',
  integration: 'Integration',
  email_inbound: 'Inbound email',
};

export function activityActorLabel(actorType: ActivityActorType): string {
  return ACTIVITY_ACTOR_LABELS[actorType] ?? 'Someone';
}

/** All filterable categories, in display order. */
export const ACTIVITY_FILTER_CATEGORIES: ActivityCategory[] = [
  'booking',
  'parking',
  'team',
  'pricing',
  'finance',
  'maintenance',
  'marketing',
  'inbox',
  'settings',
  'property',
  'org',
  'integrations',
  'verification',
  'plans_billing',
  'public_pages',
  'guest',
  'security',
  'system',
];
