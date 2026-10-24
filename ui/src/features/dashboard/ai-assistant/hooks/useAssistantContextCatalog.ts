import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import type { AttachedContextItem } from '@/features/dashboard/ai-assistant/lib/attachedContext';
import {
  bookingGuestName,
  bookingSearchHaystack,
  bookingStayRange,
} from '@/features/dashboard/ai-assistant/lib/bookingPickerItems';
import {
  marketingTemplateThumbnail,
  type ContextPickerVisual,
} from '@/features/dashboard/ai-assistant/lib/contextPickerCatalogVisual';
import {
  ASSISTANT_NOTIFICATION_MODULE_IDS,
  ASSISTANT_NOTIFICATION_MODULE_LABELS,
  CONTEXT_CATALOG_GROUPS,
} from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import { useBookings } from '@/features/dashboard/bookings/hooks/useBookings';
import { DEFAULT_BOOKINGS_QUERY } from '@/features/dashboard/bookings/lib/types';
import {
  useCustomPages,
  type CustomPageType,
} from '@/features/dashboard/custom-pages/hooks/useCustomPages';
import { useFinanceLineItems } from '@/features/dashboard/finance/hooks/useFinanceLineItems';
import { DEFAULT_FINANCE_QUERY } from '@/features/dashboard/finance/lib/types';
import { useSupportTickets } from '@/features/dashboard/help-support/hooks/useSupportTickets';
import { useInboxThreads } from '@/features/dashboard/inbox/hooks/useInbox';
import { platformLabel } from '@/features/dashboard/inbox/lib/inboxFormat';
import { useMaintenanceItems } from '@/features/dashboard/maintenance/hooks/useMaintenanceItems';
import { DEFAULT_MAINTENANCE_QUERY } from '@/features/dashboard/maintenance/lib/types';
import { useMarketingTemplates } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { useMarketingThemes } from '@/features/dashboard/marketing/hooks/useMarketingThemes';
import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import {
  useOrgIdParam,
  useOrgSlugParam,
  useParkingIdParam,
  usePropertyIdParam,
} from '@/features/dashboard/org/lib/adminApiScope';
import { useOrgTeam } from '@/features/dashboard/team/hooks/useOrgTeam';
import {
  loadParkingTeam,
  PARKING_TEAM_QUERY_KEY,
} from '@/features/dashboard/team/hooks/useParkingTeam';
import { usePropertyTeam } from '@/features/dashboard/team/hooks/usePropertyTeam';
import type { OrgTeamMember } from '@/features/dashboard/team/types/orgTeam';
import type { TeamMember } from '@/features/dashboard/team/types/propertyTeam';

import { usePropertyReviews } from '@/features/reviews/hooks/usePropertyReviews';
import {
  defaultReviewsQuery,
  type ReceivedReviewItem,
} from '@/features/reviews/lib/propertyReviewsApi';

import { formatMoney } from '@/utils/format/currency';

const PAGE_LABELS: Record<CustomPageType, string> = {
  stay_guide: 'Stay guide',
  property_showcase: 'Showcase',
};

const CATALOG_LIMIT = 40;

/** The catalog only needs the newest page of published reviews. */
const RECEIVED_PAGE_QUERY = defaultReviewsQuery('received');

export type AssistantCatalogEntry = {
  item: AttachedContextItem;
  subtitle?: string;
  meta?: string;
  metaTone?: 'default' | 'primary';
  keywords: string;
  visual: ContextPickerVisual;
  /** Booking status code — renders a compact badge when set. */
  status?: string;
};

export type AssistantCatalogGroup = {
  type: AttachedContextItem['type'];
  label: string;
  items: AssistantCatalogEntry[];
  totalCount: number;
};

function teamLabel(member: TeamMember | OrgTeamMember): string {
  return member.displayName || member.name || member.email;
}

function take<T>(items: T[], limit = CATALOG_LIMIT): T[] {
  return items.slice(0, limit);
}

export function useAssistantContextCatalog(): {
  groups: AssistantCatalogGroup[];
  isLoading: boolean;
} {
  const orgSlug = useOrgSlugParam();
  const orgId = useOrgIdParam();
  const propertyId = usePropertyIdParam();
  const parkingId = useParkingIdParam();

  const bookingQuery = {
    ...DEFAULT_BOOKINGS_QUERY,
    bookingKind: parkingId ? null : ('property' as const),
    sort: 'check_in_date:asc' as const,
    limit: CATALOG_LIMIT,
  };
  const bookings = useBookings(bookingQuery, {
    scope: parkingId ? 'parking' : propertyId ? 'property' : 'org',
  });
  const properties = useProperties(orgSlug ?? undefined);
  const orgTeam = useOrgTeam(propertyId || parkingId ? null : orgId);
  const propertyTeam = usePropertyTeam();
  const parkingTeam = useQuery({
    queryKey: [...PARKING_TEAM_QUERY_KEY, parkingId],
    queryFn: () => loadParkingTeam(parkingId!),
    enabled: Boolean(parkingId),
  });
  const finance = useFinanceLineItems(
    { ...DEFAULT_FINANCE_QUERY, limit: CATALOG_LIMIT },
    { enabled: Boolean(propertyId || parkingId) }
  );
  const maintenance = useMaintenanceItems(
    { ...DEFAULT_MAINTENANCE_QUERY, limit: CATALOG_LIMIT },
    { enabled: Boolean(propertyId) }
  );
  const inbox = useInboxThreads(
    orgSlug,
    orgId,
    { status: 'all', platform: 'all', search: '' },
    { propertyId, parkingId }
  );
  const marketing = useMarketingTemplates();
  const themes = useMarketingThemes();
  const reviews = usePropertyReviews('received', RECEIVED_PAGE_QUERY);
  const pages = useCustomPages();
  const tickets = useSupportTickets();

  const isLoading =
    bookings.isLoading ||
    properties.isLoading ||
    (Boolean(orgId) && orgTeam.isLoading) ||
    (Boolean(propertyId) && propertyTeam.isLoading) ||
    (Boolean(parkingId) && parkingTeam.isLoading) ||
    (Boolean(propertyId || parkingId) && finance.isLoading) ||
    (Boolean(propertyId) && maintenance.isLoading) ||
    inbox.isLoading ||
    (Boolean(propertyId) && marketing.isLoading) ||
    (Boolean(propertyId) && themes.isLoading) ||
    (Boolean(propertyId) && reviews.isLoading) ||
    (Boolean(propertyId) && pages.isLoading) ||
    tickets.isLoading;

  const groups = useMemo((): AssistantCatalogGroup[] => {
    const byType = new Map<AttachedContextItem['type'], AssistantCatalogEntry[]>();
    const push = (entry: AssistantCatalogEntry) => {
      const list = byType.get(entry.item.type) ?? [];
      list.push(entry);
      byType.set(entry.item.type, list);
    };

    const bookingType = parkingId ? 'parking_booking' : 'booking';
    const bookingRows = take(bookings.data?.rows ?? []);
    for (const row of bookingRows) {
      const guestName = bookingGuestName(row);
      push({
        item: {
          type: bookingType,
          id: row.id,
          propertyId: row.property_id ?? null,
          label: guestName,
        },
        subtitle: bookingStayRange(row),
        meta: row.property_name ?? undefined,
        keywords: bookingSearchHaystack(row),
        visual: { kind: 'initials', name: guestName, tone: 'primary' },
        status: row.status,
      });
    }

    for (const property of take(properties.data?.properties ?? [])) {
      const subtitle = [property.residenceName, property.tower, property.unitNumber]
        .filter(Boolean)
        .join(' · ');
      push({
        item: {
          type: 'property',
          id: property.id,
          propertyId: property.id,
          label: property.name,
        },
        subtitle: subtitle || property.type || undefined,
        keywords: [property.name, property.slug, subtitle, property.address]
          .filter(Boolean)
          .join(' '),
        visual: { kind: 'property', name: property.name },
      });
    }

    const teamMembers: Array<TeamMember | OrgTeamMember> = parkingId
      ? (parkingTeam.data?.members ?? [])
      : propertyId
        ? (propertyTeam.data?.members ?? [])
        : (orgTeam.data?.members ?? []);
    for (const member of take(teamMembers)) {
      const label = teamLabel(member);
      push({
        item: { type: 'team_member', id: member.id, label },
        subtitle: member.email,
        keywords: `${label} ${member.email}`,
        visual: { kind: 'initials', name: label },
      });
    }

    for (const item of take(finance.data ?? [])) {
      push({
        item: { type: 'finance_item', id: item.id, label: item.label },
        subtitle: item.category ?? (item.kind === 'income' ? 'Income' : 'Expense'),
        meta: formatMoney(item.amount),
        metaTone: item.kind === 'income' ? 'primary' : 'default',
        keywords: [item.label, item.kind, item.category, item.occurred_on]
          .filter(Boolean)
          .join(' '),
        visual: {
          kind: 'module-icon',
          icon: item.kind,
          tone: item.kind === 'income' ? 'success' : 'warning',
        },
      });
    }

    for (const item of take(maintenance.data ?? [])) {
      push({
        item: {
          type: 'maintenance_item',
          id: item.id,
          propertyId,
          label: item.label,
        },
        subtitle: item.scheduled_on,
        meta: item.completed_at ? 'Done' : 'Pending',
        keywords: [item.label, item.category, item.scheduled_on].filter(Boolean).join(' '),
        visual: {
          kind: 'module-icon',
          icon: 'maintenance_item',
          tone: item.completed_at ? 'muted' : 'warning',
        },
      });
    }

    const conversations = take(inbox.data?.pages.flatMap((page) => page.conversations) ?? []);
    for (const conversation of conversations) {
      const label = conversation.participant_name || conversation.subject_preview || 'Conversation';
      const platform = platformLabel(conversation.platform);
      push({
        item: {
          type: 'inbox_conversation',
          id: conversation.id,
          propertyId,
          label,
        },
        subtitle: conversation.subject_preview ?? platform,
        meta: conversation.unread_count > 0 ? `${conversation.unread_count} unread` : undefined,
        metaTone: conversation.unread_count > 0 ? 'primary' : 'default',
        keywords: [label, platform, conversation.platform, conversation.subject_preview]
          .filter(Boolean)
          .join(' '),
        visual: {
          kind: 'platform',
          platform: conversation.platform,
          avatarUrl: conversation.participant_avatar_url,
        },
      });
    }

    for (const template of take(marketing.data ?? [])) {
      const thumb = marketingTemplateThumbnail(template.designJson, template.contentType);
      push({
        item: {
          type: 'marketing_template',
          id: template.id,
          propertyId,
          label: template.name,
        },
        subtitle: template.contentType,
        meta: template.platform ?? undefined,
        keywords: `${template.name} ${template.contentType} ${template.platform ?? ''}`,
        visual: {
          kind: 'thumbnail',
          src: thumb,
          contentType: template.contentType,
        },
      });
    }

    for (const theme of take(themes.data?.themes ?? [])) {
      push({
        item: {
          type: 'marketing_theme',
          id: theme.id,
          propertyId,
          label: theme.name,
        },
        subtitle: theme.source,
        keywords: `${theme.name} ${theme.source}`,
        visual: { kind: 'module-icon', icon: 'marketing_theme', tone: 'primary' },
      });
    }

    const receivedReviews = take(
      (reviews.data?.items ?? []).filter(
        (item): item is ReceivedReviewItem => 'starRating' in item
      )
    );
    for (const review of receivedReviews) {
      const guestName = review.guestName?.trim() || 'Guest';
      push({
        item: {
          type: 'review',
          id: review.id,
          propertyId,
          label: guestName,
        },
        subtitle: `${review.starRating} stars`,
        keywords: `${guestName} ${review.reviewText ?? ''}`,
        visual: { kind: 'module-icon', icon: 'review', tone: 'primary' },
      });
    }

    for (const id of ASSISTANT_NOTIFICATION_MODULE_IDS) {
      const label = ASSISTANT_NOTIFICATION_MODULE_LABELS[id] ?? id;
      push({
        item: { type: 'notification_module', id, label },
        keywords: label,
        visual: { kind: 'module-icon', icon: 'notification_module', tone: 'primary' },
      });
    }

    const customPages =
      pages.data && pages.data.length > 0
        ? pages.data
        : propertyId
          ? [{ pageType: 'stay_guide' as const, templateKey: 'stay_guide', updatedAt: '' }]
          : [];
    for (const page of customPages) {
      const label = PAGE_LABELS[page.pageType] ?? page.pageType;
      push({
        item: { type: 'public_page', id: page.pageType, propertyId, label },
        keywords: label,
        visual: { kind: 'module-icon', icon: 'stay_guide', tone: 'primary' },
      });
    }

    for (const ticket of take(tickets.data?.tickets ?? [])) {
      push({
        item: {
          type: 'ticket',
          id: ticket.id,
          propertyId: ticket.property_id ?? propertyId,
          label: ticket.subject,
        },
        subtitle: ticket.category,
        meta: ticket.status,
        keywords: [ticket.subject, ticket.status, ticket.category, ticket.submitted_by_name].join(
          ' '
        ),
        visual: { kind: 'module-icon', icon: 'ticket' },
      });
    }

    return CONTEXT_CATALOG_GROUPS.map((group) => {
      const items = take(byType.get(group.type) ?? []);
      const totalCount =
        group.type === bookingType ? (bookings.data?.total ?? items.length) : items.length;
      return {
        type: group.type,
        label: group.label,
        items,
        totalCount,
      };
    }).filter((group) => group.items.length > 0);
  }, [
    bookings.data,
    finance.data,
    inbox.data,
    maintenance.data,
    marketing.data,
    orgTeam.data,
    reviews.data,
    themes.data,
    pages.data,
    parkingId,
    parkingTeam.data,
    properties.data,
    propertyId,
    propertyTeam.data,
    tickets.data,
  ]);

  return { groups, isLoading };
}
