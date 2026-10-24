import type { AssistantBriefingDelta } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

function part(count: number, one: string, many: string): string | null {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? one : many}`;
}

/** One line for the briefing "Since yesterday" row. Empty when every count is 0. */
export function formatBriefingDelta(delta: AssistantBriefingDelta | null | undefined): string {
  if (!delta) return '';
  const parts = [
    part(delta.newBookings, 'booking', 'bookings'),
    part(delta.newMessages, 'message', 'messages'),
    part(delta.completedStays, 'stay', 'stays'),
  ].filter((value): value is string => Boolean(value));
  if (parts.length === 0) return '';
  return `Since yesterday: ${parts.join(', ')}`;
}
