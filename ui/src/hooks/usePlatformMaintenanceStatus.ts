import { useQuery } from '@tanstack/react-query';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type PlatformMaintenanceStatus = {
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  signupsEnabled: boolean;
};

async function fetchPlatformMaintenanceStatus(): Promise<PlatformMaintenanceStatus> {
  const res = await fetch(`${FUNCTIONS_URL}/get-public-platform-status`, {
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.data) {
    return { maintenanceMode: false, maintenanceMessage: null, signupsEnabled: true };
  }
  const data = json.data as PlatformMaintenanceStatus;
  return {
    maintenanceMode: data.maintenanceMode === true,
    maintenanceMessage:
      typeof data.maintenanceMessage === 'string' && data.maintenanceMessage.trim()
        ? data.maintenanceMessage.trim()
        : null,
    signupsEnabled: data.signupsEnabled !== false,
  };
}

export function usePlatformMaintenanceStatus() {
  return useQuery({
    queryKey: ['platform-maintenance-status'],
    queryFn: fetchPlatformMaintenanceStatus,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
