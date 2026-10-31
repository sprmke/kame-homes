import { useState } from 'react';

import { Link } from 'react-router-dom';

import { Check, ChevronRight } from 'lucide-react';

import { AiIntegrationCard } from '@/features/dashboard/bookings/components/AiIntegrationCard';
import { IntegrationSourceBadge } from '@/features/dashboard/bookings/components/IntegrationSourceBadge';
import type {
  PropertyIntegrationStatus,
  PropertyTelegramCredentialsStatus,
} from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { propertyNotificationsPath } from '@/features/dashboard/org/lib/tenantPaths';

import { TelegramMark } from '@/components/branding/TelegramMark';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { toneIconWrapClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

type TelegramChannel = {
  id: 'marketing' | 'staff' | 'operations' | 'finance' | 'maintenance' | 'parking' | 'chat';
  label: string;
  status: PropertyTelegramCredentialsStatus;
};

function TelegramIntegrationBlock({
  channels,
  notificationsPath,
}: {
  channels: TelegramChannel[];
  notificationsPath: (module: TelegramChannel['id']) => string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border bg-card hover:bg-muted/20 flex w-full items-center gap-3 rounded-xl border p-3 text-left shadow-sm transition-colors sm:p-4"
      >
        <div
          className={cn(
            toneIconWrapClasses('blue'),
            'flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10'
          )}
        >
          <TelegramMark className="size-5 sm:size-[22px]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-card-title">Telegram</h3>
          <p className="text-card-description mt-1">
            {channels.filter((c) => c.status.tokenConfigured && c.status.chatIdConfigured).length}{' '}
            of {channels.length} channels configured
          </p>
        </div>
        <ChevronRight className="text-muted-foreground size-5 shrink-0" aria-hidden />
      </button>

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),28rem)]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Telegram channels</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="space-y-2">
            {channels.map((channel) => (
              <TelegramChannelRow
                key={channel.id}
                label={channel.label}
                href={notificationsPath(channel.id)}
                status={channel.status}
              />
            ))}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

function TelegramChannelRow({
  label,
  href,
  status,
}: {
  label: string;
  href: string;
  status: PropertyTelegramCredentialsStatus;
}) {
  const configured = status.tokenConfigured && status.chatIdConfigured;

  return (
    <Link
      to={href}
      className="border-border/60 bg-background/80 hover:bg-muted/30 flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors"
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md',
          configured
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {configured ? <Check className="size-4" aria-hidden /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">{label}</p>
        <IntegrationSourceBadge
          configured={configured}
          source={status.tokenSource === 'db' || status.chatIdSource === 'db' ? 'db' : 'none'}
        />
      </div>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </Link>
  );
}

export function PropertyIntegrationsPanel({
  status,
  aiKeys,
  notificationsPath,
  telegramLayout = 'property',
}: {
  status: PropertyIntegrationStatus;
  aiKeys: {
    primaryKeysConfigured: boolean;
    fallbackKeyConfigured: boolean;
  };
  notificationsPath?: (module: TelegramChannel['id']) => string;
  /** Parking slots use a single Telegram channel (bot + templates on notifications page). */
  telegramLayout?: 'property' | 'parking';
}) {
  const orgContext = useOptionalOrgContext();

  const resolveNotificationsPath =
    notificationsPath ??
    ((module: TelegramChannel['id']) => {
      if (!orgContext) return '#';
      return propertyNotificationsPath(orgContext.orgSlug, orgContext.propertySlug, module);
    });

  const telegramChannels: TelegramChannel[] =
    telegramLayout === 'parking'
      ? [
          {
            id: 'parking',
            label: 'Parking',
            status: status.telegram.marketing,
          },
          {
            id: 'finance',
            label: 'Finance',
            status: status.telegram.finance,
          },
        ]
      : [
          {
            id: 'chat',
            label: 'Chat',
            status: status.telegram.chat ?? {
              tokenConfigured: false,
              chatIdConfigured: false,
              tokenSource: 'none' as const,
              chatIdSource: 'none' as const,
              secretsEncryptionConfigured: false,
            },
          },
          {
            id: 'marketing',
            label: 'Marketing',
            status: status.telegram.marketing,
          },
          {
            id: 'staff',
            label: 'Staff',
            status: status.telegram.staff,
          },
          {
            id: 'operations',
            label: 'Operations',
            status: status.telegram.admin,
          },
          {
            id: 'finance',
            label: 'Finance',
            status: status.telegram.finance,
          },
          {
            id: 'maintenance',
            label: 'Maintenance',
            status: status.telegram.maintenance,
          },
        ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
          Telegram
        </h4>
        <TelegramIntegrationBlock
          channels={telegramChannels}
          notificationsPath={resolveNotificationsPath}
        />
      </div>

      <div className="space-y-2">
        <h4 className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
          AI services
        </h4>
        <div className="border-border bg-card overflow-hidden rounded-xl border p-4 shadow-sm">
          <AiIntegrationCard
            variant="nested"
            primaryKeysConfigured={aiKeys.primaryKeysConfigured}
            fallbackKeyConfigured={aiKeys.fallbackKeyConfigured}
          />
        </div>
      </div>
    </div>
  );
}
