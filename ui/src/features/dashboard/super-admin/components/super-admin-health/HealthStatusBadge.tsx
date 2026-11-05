import {
  HEALTH_STATUS_META,
  type HealthStatus,
} from '@/features/dashboard/super-admin/lib/systemHealth/healthStatus';

import { STATUS_TONE_STYLES } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

export function HealthStatusDot({
  status,
  className,
}: {
  status: HealthStatus;
  className?: string;
}) {
  const style = STATUS_TONE_STYLES[HEALTH_STATUS_META[status].tone];
  return (
    <span
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        style.dot,
        status === 'off' && 'opacity-40',
        className
      )}
      aria-hidden
    />
  );
}

export function HealthStatusBadge({
  status,
  label,
  className,
}: {
  status: HealthStatus;
  label?: string;
  className?: string;
}) {
  const style = STATUS_TONE_STYLES[HEALTH_STATUS_META[status].tone];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight',
        style.badge,
        status === 'off' && 'opacity-70',
        className
      )}
    >
      <HealthStatusDot status={status} />
      {label ?? HEALTH_STATUS_META[status].label}
    </span>
  );
}
