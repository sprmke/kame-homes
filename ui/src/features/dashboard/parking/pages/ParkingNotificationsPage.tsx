import * as React from 'react';

import { useLocation, useSearchParams } from 'react-router-dom';

import { Bell, Car, DollarSign, MessageCircle } from 'lucide-react';

import {
  AdminSection,
  AdminSectionGroupHeading,
  AdminSectionNavLayout,
  type AdminSectionNavGroup,
  type AdminSectionNavItem,
} from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { TelegramGlobalBotTokenCard } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramGlobalBotTokenCard';
import { TelegramHelpDialog } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramHelpDialog';
import { TelegramNotificationsGlobalBotProvider } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationsGlobalBotContext';
import { TelegramNotificationsTelegramSection } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationsTelegramSection';
import { TelegramChatSettingsCard } from '@/features/dashboard/bookings/components/TelegramChatSettingsCard';
import { TelegramFinanceSettingsCard } from '@/features/dashboard/bookings/components/TelegramFinanceSettingsCard';
import { InAppNotificationsSection } from '@/features/dashboard/notifications/components/InAppNotificationsSection';
import {
  IN_APP_NOTIFICATIONS_NAV_GROUP_LABEL,
  IN_APP_NOTIFICATIONS_SECTION_ID,
  notificationsHubActivityHash,
} from '@/features/dashboard/notifications/lib/notificationsPaths';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { TelegramParkingSettingsCard } from '@/features/dashboard/parking/components/TelegramParkingSettingsCard';
import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { parkingDashboardPageTitle, usePageTitle } from '@/lib/pageTitle';

const PARKING_NOTIFICATION_MODULES = ['chat', 'parking', 'finance'] as const;

type ParkingNotificationModule = (typeof PARKING_NOTIFICATION_MODULES)[number];

function isParkingNotificationModule(value: string | null): value is ParkingNotificationModule {
  return PARKING_NOTIFICATION_MODULES.includes(value as ParkingNotificationModule);
}

const MODULE_SECTIONS: AdminSectionNavItem[] = [
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'parking', label: 'Parking', icon: Car },
  { id: 'finance', label: 'Finance', icon: DollarSign },
];

const IN_APP_SECTION: AdminSectionNavItem = {
  id: IN_APP_NOTIFICATIONS_SECTION_ID,
  label: 'Activity',
  icon: Bell,
};

const NOTIFICATION_SECTION_GROUPS: AdminSectionNavGroup[] = [
  { label: IN_APP_NOTIFICATIONS_NAV_GROUP_LABEL, sections: [IN_APP_SECTION] },
  { label: 'Telegram notifications', sections: MODULE_SECTIONS },
];

const MODULE_DESCRIPTIONS: Record<ParkingNotificationModule, string> = {
  chat: 'Instant alert for every inbound guest message from web chat.',
  parking:
    'Reservation alerts for new requests, check-in reminders, and payment received on this slot.',
  finance: 'Due-date reminders for parking expense lines you track in Finance.',
};

export function ParkingNotificationsPage() {
  const parkingTenant = useOptionalParkingContext();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const moduleParam = searchParams.get('module');
  const sectionParam = searchParams.get('section');
  const deepLinkModule = isParkingNotificationModule(moduleParam)
    ? moduleParam
    : moduleParam === 'marketing'
      ? 'parking'
      : null;
  const deepLinkSection =
    sectionParam === IN_APP_NOTIFICATIONS_SECTION_ID ||
    location.hash === notificationsHubActivityHash()
      ? IN_APP_NOTIFICATIONS_SECTION_ID
      : null;

  usePageTitle(
    parkingTenant
      ? parkingDashboardPageTitle(
          parkingTenant.org.name,
          parkingTenant.parking.name,
          'Notifications'
        )
      : undefined
  );

  React.useEffect(() => {
    const targetId = deepLinkSection
      ? `section-${deepLinkSection}`
      : deepLinkModule
        ? `section-${deepLinkModule}`
        : null;
    if (!targetId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [deepLinkModule, deepLinkSection, location.hash]);

  return (
    <TelegramNotificationsGlobalBotProvider>
      <AdminMobilePage
        title="Notifications"
        titleId="parking-notifications-heading"
        className="flex min-h-0 flex-1 flex-col"
      >
        <AdminSectionNavLayout
          className="min-h-0 flex-1"
          sectionGroups={NOTIFICATION_SECTION_GROUPS}
        >
          <div className="space-y-3 sm:space-y-4">
            <AdminSectionGroupHeading title={IN_APP_NOTIFICATIONS_NAV_GROUP_LABEL} />

            <InAppNotificationsSection />

            <TelegramNotificationsTelegramSection
              moduleCount={MODULE_SECTIONS.length}
              helpAction={<TelegramHelpDialog defaultTab="bot-token" triggerLabel="Get Help" />}
            >
              <TelegramGlobalBotTokenCard />

              <AdminSection
                id="chat"
                title="Chat"
                icon={MessageCircle}
                description={MODULE_DESCRIPTIONS.chat}
              >
                <TelegramChatSettingsCard embedded />
              </AdminSection>

              <AdminSection
                id="parking"
                title="Parking"
                icon={Car}
                description={MODULE_DESCRIPTIONS.parking}
              >
                <TelegramParkingSettingsCard />
              </AdminSection>

              <AdminSection
                id="finance"
                title="Finance"
                icon={DollarSign}
                description={MODULE_DESCRIPTIONS.finance}
              >
                <TelegramFinanceSettingsCard embedded />
              </AdminSection>
            </TelegramNotificationsTelegramSection>
          </div>
        </AdminSectionNavLayout>
      </AdminMobilePage>
    </TelegramNotificationsGlobalBotProvider>
  );
}
