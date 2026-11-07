import { BellRing, Check, Send } from 'lucide-react';

import { NotificationMasterSwitchRow } from '@/features/dashboard/notifications/components/NotificationMasterSwitchRow';
import {
  useTelegramDeliveryControl,
  useUpdateTelegramDeliveryControl,
} from '@/features/dashboard/notifications/hooks/useTelegramDeliveryControl';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

/** Matches the master switch rows so the layout does not move when data lands. */
export function ChannelSwitchSkeleton() {
  return (
    <div className="border-border bg-card flex items-center justify-between gap-3 rounded-xl border px-3 py-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <div className="min-w-0 space-y-1.5">
          <Skeleton className="h-3.5 w-32 max-w-full" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
    </div>
  );
}

/** Card skeletons for the Telegram module list while delivery state is unknown. */
export function ChannelCardsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="border-border rounded-xl border px-3 py-3 sm:px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-3 w-4/5 max-w-md" />
          <Skeleton className="mt-1 h-3 w-2/3 max-w-sm" />
        </div>
      ))}
    </div>
  );
}

type PausedPanelProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  /** What turning it on gives them, in plain words. */
  items: string[];
  className?: string;
};

/**
 * Shown instead of the configuration once a channel's main switch is off.
 * Explains the value of the channel before any of its controls appear, so an
 * off switch never looks like a broken or empty form.
 */
export function ChannelPausedPanel({
  icon: Icon,
  title,
  description,
  items,
  className,
}: PausedPanelProps) {
  return (
    <div
      className={cn(
        'border-border/70 bg-muted/30 rounded-xl border px-3 py-3 sm:px-4 sm:py-4',
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="bg-background text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-foreground text-[13px] font-semibold leading-tight sm:text-sm">
            {title}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{description}</p>

          <ul className="mt-2 space-y-1">
            {items.map((item) => (
              <li key={item} className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <Check className="text-primary mt-0.5 size-3 shrink-0" aria-hidden />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Paused copy for this device's phone push. */
export function DevicePushPausedPanel() {
  return (
    <ChannelPausedPanel
      icon={BellRing}
      title="Push is off on this device"
      description="Activity still records every event. Turn push on to also get phone alerts."
      items={[
        'One switch per group: bookings, messages, reviews, pricing and more',
        'Quiet hours in Philippine time',
        'Per device, so your phone and laptop opt in separately',
      ]}
    />
  );
}

/** Paused copy for Telegram delivery. */
export function TelegramPausedPanel() {
  return (
    <ChannelPausedPanel
      icon={Send}
      title="Telegram is paused"
      description="Turn delivery back on to send alerts to your groups again."
      items={[
        'Chat, Marketing, Staff, Operations, Finance and Maintenance alerts',
        'One bot token shared by every module, or one per module',
        'Schedules and message templates per module',
      ]}
    />
  );
}

type TelegramSwitchProps = {
  /** Render the paused copy under the switch when delivery is off. */
  showPausedPanel?: boolean;
  className?: string;
};

/**
 * Master Telegram switch. Skeletons until the control query lands so it never
 * paints "on" and then flips to "off".
 */
export function TelegramDeliverySwitchRow({
  showPausedPanel = false,
  className,
}: TelegramSwitchProps) {
  const { data, isLoading } = useTelegramDeliveryControl();
  const update = useUpdateTelegramDeliveryControl();

  if (isLoading) return <ChannelSwitchSkeleton />;

  const enabled = data?.enabled !== false;

  return (
    <div className="space-y-2">
      <NotificationMasterSwitchRow
        icon={Send}
        title="Telegram delivery"
        description="Turn every Telegram alert on or off at once. Your module settings stay saved."
        checked={enabled}
        disabled={update.isPending}
        onCheckedChange={(next) => update.mutate(next)}
        className={className}
      />
      {!enabled && showPausedPanel ? <TelegramPausedPanel /> : null}
    </div>
  );
}
