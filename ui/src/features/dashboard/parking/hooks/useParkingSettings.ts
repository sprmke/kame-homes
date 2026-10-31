import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  PlatformSecretsStatus,
  PropertyIntegrationStatus,
} from '@/features/dashboard/bookings/hooks/useAppSettings';
import { appendParkingId, useParkingIdParam } from '@/features/dashboard/org/lib/adminParkingScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { ParkingAutomationToggles } from '@/features/dashboard/parking/lib/parkingEmailAutomation';

export const PARKING_SETTINGS_QUERY_KEY = ['parking-settings'] as const;

export type ParkingSettingsPayload = {
  parkingId: string;
  paymentProvider: string | null;
  gcashName: string | null;
  gcashNumber: string | null;
  gcashQrImageUrl: string | null;
  paymentMethods: unknown[];
  parkingNotificationTemplates: Record<string, string>;
  automationToggles: ParkingAutomationToggles;
  updatedAt: string;
  parkingIntegrations?: PropertyIntegrationStatus;
  platformSecrets?: PlatformSecretsStatus;
};

export function useParkingSettings() {
  const parkingId = useParkingIdParam();
  const params = new URLSearchParams();
  appendParkingId(params, parkingId);

  return useQuery({
    queryKey: [...PARKING_SETTINGS_QUERY_KEY, parkingId],
    queryFn: () =>
      callEdgeFunction<ParkingSettingsPayload>(`parking-settings?${params.toString()}`),
  });
}

export function useUpdateParkingSettings() {
  const parkingId = useParkingIdParam();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const params = new URLSearchParams();
      appendParkingId(params, parkingId);
      return callEdgeFunction<ParkingSettingsPayload>(`parking-settings?${params.toString()}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...PARKING_SETTINGS_QUERY_KEY, parkingId] });
    },
  });
}
