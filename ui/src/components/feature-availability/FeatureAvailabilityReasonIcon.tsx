import { Clock, CloudOff, Info, Pause, Sparkles, Wrench, type LucideIcon } from 'lucide-react';

import type { FeatureAvailabilityReasonIcon as ReasonIconName } from '@/lib/featureAvailability/featureAvailabilityCatalog';
import { cn } from '@/lib/utils';

const ICON_BY_NAME: Record<ReasonIconName, LucideIcon> = {
  Wrench,
  CloudOff,
  Sparkles,
  Clock,
  Pause,
  Info,
};

type Props = {
  name: ReasonIconName;
  className?: string;
};

export function FeatureAvailabilityReasonIcon({ name, className }: Props) {
  const Icon = ICON_BY_NAME[name] ?? Info;
  return <Icon className={cn('h-8 w-8', className)} aria-hidden />;
}
