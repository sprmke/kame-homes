import { useQuery } from '@tanstack/react-query';

import {
  fetchGuestVouchers,
  GUEST_VOUCHERS_QUERY_KEY,
  type GuestVoucherDto,
} from '@/features/guest/account/lib/guestAccountApi';

export function useGuestVouchersQuery(opts?: {
  propertyId?: string;
  propertySlug?: string;
  includeRedeemed?: boolean;
  enabled?: boolean;
}) {
  const propertyId = opts?.propertyId?.trim() || undefined;
  const propertySlug = opts?.propertySlug?.trim() || undefined;
  const includeRedeemed = opts?.includeRedeemed === true;
  const enabled = opts?.enabled !== false;

  return useQuery({
    queryKey: [
      ...GUEST_VOUCHERS_QUERY_KEY,
      propertyId ?? null,
      propertySlug ?? null,
      includeRedeemed,
    ],
    queryFn: () => fetchGuestVouchers({ propertyId, propertySlug, includeRedeemed }),
    enabled,
    staleTime: 60_000,
  });
}

export type { GuestVoucherDto };
