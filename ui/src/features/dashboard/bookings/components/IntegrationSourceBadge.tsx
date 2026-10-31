import type { IntegrationFieldSource } from '@/features/dashboard/bookings/hooks/useAppSettings';

import { compactStatusBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

const SOURCE_LABEL: Record<IntegrationFieldSource, string> = {
  db: 'Property',
  none: 'Missing',
};

const SOURCE_VARIANT: Record<IntegrationFieldSource, 'success' | 'warning'> = {
  db: 'success',
  none: 'warning',
};

export function IntegrationSourceBadge({
  source,
  configured,
  className,
}: {
  source: IntegrationFieldSource;
  configured?: boolean;
  className?: string;
}) {
  const effectiveSource = configured === false ? 'none' : source;
  return (
    <span className={cn(compactStatusBadgeClasses(SOURCE_VARIANT[effectiveSource]), className)}>
      {SOURCE_LABEL[effectiveSource]}
    </span>
  );
}
