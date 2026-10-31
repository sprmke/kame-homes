import { useQuery } from '@tanstack/react-query';

import { scopedAdminPath, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type BookingAiAssistantAuditEntry = {
  id: string;
  tool_name: string;
  risk_tier: 'tier1_auto' | 'tier2_confirmed';
  result_status: 'success' | 'failed' | 'denied';
  result_summary: string | null;
  created_at: string;
};

export function useBookingAiAssistantAudit(bookingId: string | undefined) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: ['booking', bookingId, 'ai-assistant-audit'],
    enabled: Boolean(bookingId),
    queryFn: () =>
      callEdgeFunction<{ entries: BookingAiAssistantAuditEntry[] }>(
        scopedAdminPath(`get-booking-ai-assistant-audit?booking_id=${bookingId}`, propertyId)
      ),
  });
}
