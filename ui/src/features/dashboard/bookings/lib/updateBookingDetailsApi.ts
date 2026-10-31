import { scopedAdminPath } from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import type { BookingRow } from './types';

export type UpdateBookingDetailsResponse = {
  booking: BookingRow;
  skipped?: boolean;
};

export async function callUpdateBookingDetails(
  propertyId: string | null,
  body: Record<string, unknown>
): Promise<UpdateBookingDetailsResponse> {
  return callEdgeFunction<UpdateBookingDetailsResponse>(
    scopedAdminPath('update-booking-details', propertyId),
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}
