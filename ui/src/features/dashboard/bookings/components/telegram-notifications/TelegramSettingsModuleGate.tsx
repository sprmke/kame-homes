import type { ReactNode } from 'react';

import { TelegramNotificationModuleSkeleton } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationModuleSkeleton';

type Props = {
  isError: boolean;
  error: unknown;
  loadErrorFallback: string;
  isLoading: boolean;
  draft: unknown | null;
  skeleton: { manageRows: 1 | 2; ariaLabel: string };
  children: ReactNode;
};

export function TelegramSettingsModuleGate({
  isError,
  error,
  loadErrorFallback,
  isLoading,
  draft,
  skeleton,
  children,
}: Props) {
  if (isError) {
    return (
      <section className="border-destructive/40 bg-card w-full rounded-xl border px-3 py-3 sm:px-4">
        <p className="text-destructive text-sm">{(error as Error).message ?? loadErrorFallback}</p>
      </section>
    );
  }

  if (isLoading || !draft) {
    return (
      <TelegramNotificationModuleSkeleton
        manageRows={skeleton.manageRows}
        ariaLabel={skeleton.ariaLabel}
      />
    );
  }

  return <>{children}</>;
}
