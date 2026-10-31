---
name: tanstack-query
description: TanStack Query v5 for admin data fetching via Supabase Edge Functions. Use for hooks, query keys, mutations, cache invalidation, pagination, or loading states.
---

# TanStack Query v5 (GFM)

No tRPC — queries call **edge functions** with admin JWT.

## Hook layout

```
ui/src/features/<feature>/hooks/
  useBookings.ts
  useUpdateBooking.ts
  useFinanceSummary.ts
```

## Query example

```typescript
export const BOOKING_QUERY_KEY = ['booking'] as const;

export function useBooking(bookingId: string) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: [...BOOKING_QUERY_KEY, propertyId, bookingId],
    queryFn: () => callEdgeFunction<BookingRow>(`get-booking?id=${bookingId}`),
    enabled: !!bookingId,
  });
}
```

## List + pagination

Reference: `useBookings.ts` — `keepPreviousData`, query key includes full filter object + `propertyId`.

## Mutations

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: [...BOOKING_QUERY_KEY, bookingId] });
};
```

Workflow transitions: `useTransitionBooking` → invalidate booking + list keys.

## v5

- `gcTime` not `cacheTime`
- `placeholderData: keepPreviousData` for paged lists
- `enabled` when ids required

## Rule

`.cursor/rules/state-management.mdc`

## Don'ts

- Second Supabase client in hooks
- Omit `propertyId` from keys for property-scoped data
- Fetch admin endpoints without `Authorization` header
