import type { PageContext } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

/**
 * Ambient route scope sent with every assistant turn. Parking routes have no property, so
 * `parkingId` is what lets the edge gate the plan on the org and scope parking tools.
 * `bookingId` is the `:bookingId` route param on property or parking booking detail pages.
 */
export function buildAssistantPageContext(input: {
  propertyId: string | null | undefined;
  parkingId: string | null | undefined;
  bookingId: string | null | undefined;
}): PageContext {
  return {
    propertyId: input.propertyId ?? null,
    parkingId: input.parkingId ?? null,
    bookingId: input.bookingId ?? null,
  };
}

/** Stable key so memoized consumers only change when the scope actually changes. */
export function assistantPageContextKey(context: PageContext): string {
  return [context.propertyId ?? '', context.parkingId ?? '', context.bookingId ?? ''].join('|');
}
