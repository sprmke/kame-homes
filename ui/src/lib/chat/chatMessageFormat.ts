import dayjs from 'dayjs';

/** Short time under a bubble (Asia/Manila default from dayjs config). */
export function formatChatBubbleTime(sentAt: string | null | undefined): string {
  if (!sentAt?.trim()) return '';
  const d = dayjs(sentAt);
  if (!d.isValid()) return '';
  const now = dayjs();
  if (d.isSame(now, 'day')) return d.format('h:mm A');
  if (d.isSame(now.subtract(1, 'day'), 'day')) return `Yesterday ${d.format('h:mm A')}`;
  if (d.isSame(now, 'year')) return d.format('MMM D, h:mm A');
  return d.format('MMM D, YYYY h:mm A');
}

/** Centered date pill between message groups. */
export function formatChatDateSeparator(sentAt: string | null | undefined): string {
  if (!sentAt?.trim()) return '';
  const d = dayjs(sentAt);
  if (!d.isValid()) return '';
  const now = dayjs();
  if (d.isSame(now, 'day')) return 'Today';
  if (d.isSame(now.subtract(1, 'day'), 'day')) return 'Yesterday';
  if (d.isSame(now, 'year')) return d.format('MMMM D');
  return d.format('MMMM D, YYYY');
}

export function chatMessageDayKey(sentAt: string): string {
  const d = dayjs(sentAt);
  return d.isValid() ? d.format('YYYY-MM-DD') : sentAt.slice(0, 10);
}

export type ChatMessageRow<T extends { id: string; sent_at: string }> =
  { type: 'date'; key: string; label: string } | { type: 'message'; key: string; message: T };

export function buildChatMessageRows<T extends { id: string; sent_at: string }>(
  messages: T[]
): ChatMessageRow<T>[] {
  const rows: ChatMessageRow<T>[] = [];
  let lastDay = '';

  for (const message of messages) {
    const day = chatMessageDayKey(message.sent_at);
    if (day !== lastDay) {
      rows.push({
        type: 'date',
        key: `date-${day}`,
        label: formatChatDateSeparator(message.sent_at),
      });
      lastDay = day;
    }
    rows.push({ type: 'message', key: message.id, message });
  }

  return rows;
}

export function isChatMessageUnsent(message: { deleted_at?: string | null }): boolean {
  return !!message.deleted_at;
}

export function unsentMessageLabel(viewerIsAuthor: boolean): string {
  return viewerIsAuthor ? 'You unsent a message' : 'Message unsent';
}

export type OutboundDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Normalize DB fields into a single outbound delivery state for tick UI. */
export function resolveOutboundDeliveryStatus(message: {
  delivery_status?: string | null;
  read_at?: string | null;
}): OutboundDeliveryStatus {
  const status = message.delivery_status?.trim().toLowerCase();
  if (status === 'sending' || status === 'failed') return status;
  if (message.read_at || status === 'read') return 'read';
  if (status === 'delivered') return 'delivered';
  return 'sent';
}
