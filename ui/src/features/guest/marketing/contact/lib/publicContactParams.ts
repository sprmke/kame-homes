import {
  SUPPORT_TICKET_CATEGORIES,
  type SupportTicketCategory,
} from '@/features/dashboard/help-support/lib/supportTicketSchema';

export function parsePublicContactCategory(
  value: string | null | undefined
): SupportTicketCategory | undefined {
  if (!value) return undefined;
  return SUPPORT_TICKET_CATEGORIES.includes(value as SupportTicketCategory)
    ? (value as SupportTicketCategory)
    : undefined;
}

export function publicContactPath(options?: {
  category?: SupportTicketCategory;
  subject?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.category) params.set('category', options.category);
  const subject = options?.subject?.trim();
  if (subject) params.set('subject', subject);
  const query = params.toString();
  return query ? `/contact?${query}` : '/contact';
}
