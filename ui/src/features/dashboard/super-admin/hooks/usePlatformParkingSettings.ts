import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type PlatformParkingSettings = {
  commissionPct: number;
  /** Phase 8 — commission applied to direct-booking-link bookings instead of commissionPct. */
  directCommissionPct: number;
  guestRateWeekday: number;
  guestRateWeekend: number;
  supportEscalationPhone: string | null;
  updatedAt?: string;
};

export type ParkingPayoutTransaction = {
  id: string;
  bookingId: string;
  parkingId: string;
  parkingName: string | null;
  organizationId: string;
  organizationName: string | null;
  guestName: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  nights: number;
  guestChargeTotal: number;
  hostGrossTotal: number;
  commissionPct: number;
  bookingChannel: string;
  hostNetTotal: number;
  status: string;
  paidAt: string | null;
  disbursedAt: string | null;
  disbursementReference: string | null;
  disbursementMethod: string;
  clawbackAmount: number | null;
  clawbackReason: string | null;
  clawbackAt: string | null;
};

const PARKING_SETTINGS_KEY = ['super-admin', 'platform-parking-settings'] as const;
const PARKING_PAYOUTS_KEY = ['super-admin', 'parking-payouts'] as const;

export function usePlatformParkingSettings() {
  return useQuery({
    queryKey: PARKING_SETTINGS_KEY,
    queryFn: () =>
      callEdgeFunction<{ settings: PlatformParkingSettings }>('platform-parking-settings').then(
        (data) => data.settings
      ),
  });
}

export function useUpdatePlatformParkingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<PlatformParkingSettings>) =>
      callEdgeFunction<{ settings: PlatformParkingSettings }>('platform-parking-settings', {
        method: 'PUT',
        body: JSON.stringify(input),
      }).then((data) => data.settings),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: PARKING_SETTINGS_KEY });
      toast.success('Parking settings saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not save settings');
    },
  });
}

export function useParkingPayouts() {
  return useQuery({
    queryKey: PARKING_PAYOUTS_KEY,
    queryFn: () =>
      callEdgeFunction<{ transactions: ParkingPayoutTransaction[] }>('parking-payouts').then(
        (data) => data.transactions
      ),
  });
}

export function useMarkParkingPayoutDisbursed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { transactionId: string; reference?: string }) =>
      callEdgeFunction<{ transaction: ParkingPayoutTransaction }>('parking-payouts', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'mark_disbursed', ...input }),
      }).then((data) => data.transaction),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: PARKING_PAYOUTS_KEY });
      toast.success('Marked as disbursed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not mark disbursed');
    },
  });
}

export function useRecordParkingPayoutClawback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { transactionId: string; amount: number; reason: string }) =>
      callEdgeFunction<{ transaction: ParkingPayoutTransaction }>('parking-payouts', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'record_clawback', ...input }),
      }).then((data) => data.transaction),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: PARKING_PAYOUTS_KEY });
      toast.success('Clawback recorded');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not record clawback');
    },
  });
}
