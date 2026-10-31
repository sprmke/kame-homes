import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { formatBookingDateShort } from '@/utils/format/bookingDisplay';

const TECHNICAL_BOOKING_CHIP_RE = /^booking\s*#?\s*[\da-f-]+$/i;
const BARE_ID_CHIP_RE = /^[\da-f-]{4,}$/i;

function colSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function formatStayRangeShort(checkIn: string, checkOut: string): string {
  const ci = formatBookingDateShort(checkIn);
  const co = formatBookingDateShort(checkOut);
  if (ci && co && ci !== '-' && co !== '-') return `${ci}–${co}`;
  return ci !== '-' ? ci : co !== '-' ? co : '';
}

function rowHostLabel(row: Record<string, string | number>, columns: string[]): string | null {
  const valueFor = (slugs: string[]) => {
    for (const slug of slugs) {
      const col = columns.find((c) => colSlug(c) === slug);
      if (col) {
        const v = String(row[col] ?? '').trim();
        if (v) return v;
      }
    }
    return '';
  };

  const guest = valueFor(['guest', 'guestname', 'name', 'primaryguestname']);
  const checkIn = valueFor(['checkin', 'checkindate', 'arrival']);
  const checkOut = valueFor(['checkout', 'checkoutdate', 'departure']);
  const status = valueFor(['status', 'statuslabel']);
  const stay = valueFor(['stay', 'dates']);
  const range = stay || (checkIn && checkOut ? formatStayRangeShort(checkIn, checkOut) : '');
  const parts = [guest, range, status].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(' · ');
}

/** Infer readable stay labels from booking cards / tables in the same assistant turn. */
export function collectHostLabelsFromBlocks(blocks: ChatBlock[]): string[] {
  const labels: string[] = [];

  for (const block of blocks) {
    if (block.type === 'booking_card') {
      const guest = block.guestName?.trim() || 'Guest';
      const range = formatStayRangeShort(block.checkIn, block.checkOut);
      const status = block.status?.trim();
      const parts = [guest, range || null, status || null].filter(Boolean);
      labels.push(parts.join(' · '));
      continue;
    }
    if (block.type === 'data_table') {
      const columns = block.columns ?? [];
      for (const row of block.rows ?? []) {
        const label = rowHostLabel(row, columns);
        if (label) labels.push(label);
      }
    }
  }

  return labels;
}

export function isTechnicalBookingChip(label: string): boolean {
  const trimmed = label.trim();
  return TECHNICAL_BOOKING_CHIP_RE.test(trimmed) || BARE_ID_CHIP_RE.test(trimmed);
}

/**
 * Replace "Booking 4069" chips with guest + stay labels when possible.
 * Always drop unresolved technical booking chips — never show raw IDs to hosts.
 */
export function humanizeAssistantQuickActions(
  quickActions: Array<{ label: string; prompt: string }>,
  contentBlocks: ChatBlock[]
): Array<{ label: string; prompt: string }> {
  if (quickActions.length === 0) return quickActions;

  const hostLabels = collectHostLabelsFromBlocks(contentBlocks);
  const technicalCount = quickActions.filter((action) =>
    isTechnicalBookingChip(action.label)
  ).length;
  const mostlyTechnical =
    technicalCount > 0 && technicalCount >= Math.ceil(quickActions.length / 2);

  if (mostlyTechnical && hostLabels.length > 0) {
    const count = Math.min(quickActions.length, hostLabels.length, 5);
    return hostLabels.slice(0, count).map((label, index) => ({
      label,
      prompt: quickActions[index]?.prompt || `Help me complete the stay for ${label}.`,
    }));
  }

  return quickActions.filter((action) => !isTechnicalBookingChip(action.label));
}
