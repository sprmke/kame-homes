import { Sparkles } from 'lucide-react';

import { useBookingAiAssistantAudit } from '@/features/dashboard/ai-assistant/hooks/useBookingAiAssistantAudit';
import { getAssistantToolAuditLabel } from '@/features/dashboard/ai-assistant/lib/assistantToolLabels';
import { BookingDetailCard } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailCard';

import { formatRelative } from '@/utils/format/bookingDisplay';

const RESULT_LABELS: Record<string, string> = {
  success: 'Succeeded',
  failed: 'Failed',
  denied: 'Denied',
};

/** Read-only trail of AI assistant actions taken on this booking — hidden when there are none. */
export function BookingAiAssistantAuditCard({ bookingId }: { bookingId: string }) {
  const { data, isLoading } = useBookingAiAssistantAudit(bookingId);
  const entries = data?.entries ?? [];

  if (!isLoading && entries.length === 0) return null;

  return (
    <BookingDetailCard title="Actions taken by AI assistant" icon={Sparkles}>
      <ul className="divide-border/60 divide-y">
        {entries.map((entry) => (
          <li key={entry.id} className="space-y-0.5 py-2 text-sm first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground font-medium">
                {getAssistantToolAuditLabel(entry.tool_name)}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatRelative(entry.created_at)}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              {RESULT_LABELS[entry.result_status] ?? entry.result_status}
              {entry.risk_tier === 'tier1_auto' ? ' · done automatically' : ' · host confirmed'}
              {entry.result_summary ? ` · ${entry.result_summary}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </BookingDetailCard>
  );
}
