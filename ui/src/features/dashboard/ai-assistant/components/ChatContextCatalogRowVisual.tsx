import type { ComponentType } from 'react';

import {
  Bell,
  Building2,
  CalendarDays,
  FileText,
  Gift,
  LayoutTemplate,
  LifeBuoy,
  MessageSquare,
  Palette,
  Star,
  ParkingSquare,
  Play,
  Ticket,
  TrendingDown,
  TrendingUp,
  Users,
  Video,
  Wrench,
} from 'lucide-react';

import type { ContextPickerVisual } from '@/features/dashboard/ai-assistant/lib/contextPickerCatalogVisual';
import { contextPickerInitials } from '@/features/dashboard/ai-assistant/lib/contextPickerCatalogVisual';
import { ATTACHED_CONTEXT_ICONS } from '@/features/dashboard/ai-assistant/lib/contextPickerIcons';
import { PlatformLogo } from '@/features/dashboard/inbox/components/PlatformLogo';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ModuleIconKey = Extract<ContextPickerVisual, { kind: 'module-icon' }>['icon'];

const MODULE_ICON_MAP: Record<ModuleIconKey, ComponentType<{ className?: string }>> = {
  booking: CalendarDays,
  parking_booking: ParkingSquare,
  property: Building2,
  team_member: Users,
  finance_item: Ticket,
  maintenance_item: Wrench,
  pricing_date: CalendarDays,
  inbox_conversation: MessageSquare,
  marketing_template: LayoutTemplate,
  marketing_theme: Palette,
  review: Star,
  voucher: Gift,
  notification_module: Bell,
  public_page: FileText,
  ticket: LifeBuoy,
  property_template: LayoutTemplate,
  income: TrendingUp,
  expense: TrendingDown,
  calendar: CalendarDays,
  design: LayoutTemplate,
  video: Video,
  stay_guide: FileText,
};

const TONE_SHELL: Record<'default' | 'primary' | 'muted' | 'warning' | 'success', string> = {
  default: 'bg-muted text-foreground ring-border/60 ring-1 ring-inset',
  primary: 'bg-primary/10 text-primary ring-primary/15 ring-1 ring-inset',
  muted: 'bg-muted/80 text-muted-foreground ring-border/50 ring-1 ring-inset',
  warning: 'bg-warning/10 text-warning ring-warning/20 ring-1 ring-inset',
  success: 'bg-success/10 text-success ring-success/20 ring-1 ring-inset',
};

type Props = {
  visual: ContextPickerVisual;
  className?: string;
};

export function ChatContextCatalogRowVisual({ visual, className }: Props) {
  const shell = cn(
    'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg',
    className
  );

  if (visual.kind === 'initials') {
    const tone = visual.tone ?? 'default';
    return (
      <Avatar className={cn(shell, 'rounded-lg')}>
        {visual.imageUrl ? (
          <AvatarImage src={visual.imageUrl} alt="" className="rounded-lg object-cover" />
        ) : null}
        <AvatarFallback
          className={cn(
            'rounded-lg text-xs font-semibold',
            tone === 'primary' ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground'
          )}
        >
          {contextPickerInitials(visual.name)}
        </AvatarFallback>
      </Avatar>
    );
  }

  if (visual.kind === 'platform') {
    if (visual.avatarUrl) {
      return (
        <Avatar className={cn(shell, 'rounded-lg')}>
          <AvatarImage src={visual.avatarUrl} alt="" className="rounded-lg object-cover" />
          <AvatarFallback className="bg-muted rounded-lg text-xs">
            {contextPickerInitials('Guest')}
          </AvatarFallback>
        </Avatar>
      );
    }
    return <PlatformLogo platform={visual.platform} size="sm" className="shrink-0" />;
  }

  if (visual.kind === 'thumbnail') {
    const isVideo = visual.contentType === 'video';
    if (visual.src) {
      return (
        <span className={cn(shell, 'bg-muted ring-border/60 relative ring-1 ring-inset')}>
          <img
            src={visual.src}
            alt=""
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
          {isVideo ? (
            <span
              className="absolute inset-0 flex items-center justify-center bg-black/35"
              aria-hidden
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-white/95 text-black shadow-sm">
                <Play className="size-2.5 fill-current" />
              </span>
            </span>
          ) : null}
        </span>
      );
    }
    const Icon = isVideo
      ? Video
      : visual.contentType === 'calendar'
        ? CalendarDays
        : LayoutTemplate;
    return (
      <span className={cn(shell, TONE_SHELL.primary, 'relative')}>
        <Icon className="size-4" aria-hidden />
        {isVideo ? (
          <span
            className="absolute inset-0 flex items-center justify-center bg-black/20"
            aria-hidden
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-white/95 text-black shadow-sm">
              <Play className="size-2.5 fill-current" />
            </span>
          </span>
        ) : null}
      </span>
    );
  }

  if (visual.kind === 'property') {
    const Icon = ATTACHED_CONTEXT_ICONS.property;
    return (
      <span className={cn(shell, TONE_SHELL.primary)}>
        <Icon className="size-4" aria-hidden />
      </span>
    );
  }

  const Icon = MODULE_ICON_MAP[visual.icon];
  const tone =
    visual.tone ??
    (visual.icon === 'income' ? 'success' : visual.icon === 'expense' ? 'warning' : 'default');
  return (
    <span className={cn(shell, TONE_SHELL[tone])}>
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

export function ChatContextCatalogRowVisualSkeleton() {
  return <Skeleton className="size-10 shrink-0 rounded-lg" aria-hidden />;
}
