import { usePlatformMaintenanceStatus } from '@/hooks/usePlatformMaintenanceStatus';

export function PlatformMaintenanceBanner() {
  const { data } = usePlatformMaintenanceStatus();
  if (!data?.maintenanceMode) return null;

  const message =
    data.maintenanceMessage ?? 'We are performing maintenance. Some actions may be unavailable.';

  return (
    <div
      role="status"
      className="text-foreground border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm"
    >
      {message}
    </div>
  );
}
