import * as React from 'react';

import { useLocation, useSearchParams } from 'react-router-dom';

import { Bell, DollarSign, HardHat, Megaphone, MessageCircle, Wrench } from 'lucide-react';

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
import { TelegramAdminSettingsCard } from '@/features/dashboard/bookings/components/TelegramAdminSettingsCard';
import { TelegramChatSettingsCard } from '@/features/dashboard/bookings/components/TelegramChatSettingsCard';
import { TelegramFinanceSettingsCard } from '@/features/dashboard/bookings/components/TelegramFinanceSettingsCard';
import { TelegramMaintenanceSettingsCard } from '@/features/dashboard/bookings/components/TelegramMaintenanceSettingsCard';
import { TelegramMarketingSettingsCard } from '@/features/dashboard/bookings/components/TelegramMarketingSettingsCard';
import { TelegramStaffSettingsCard } from '@/features/dashboard/bookings/components/TelegramStaffSettingsCard';
import { InAppNotificationsSection } from '@/features/dashboard/notifications/components/InAppNotificationsSection';
import {
  IN_APP_NOTIFICATIONS_NAV_GROUP_LABEL,
  IN_APP_NOTIFICATIONS_SECTION_ID,
  notificationsHubActivityHash,
} from '@/features/dashboard/notifications/lib/notificationsPaths';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import {
  hasAnyNotificationModuleEditPermission,
  hasPropertyPermission,
  NOTIFICATION_MODULE_EDIT_PERMISSION,
} from '@/features/dashboard/team/lib/propertyPermissions';

import { AdminMobilePage } from '@/components/mobile/MobileBrandHero';
import { propertyDashboardPageTitle, usePageTitle } from '@/lib/pageTitle';
import { cn } from '@/lib/utils';

const NOTIFICATION_MODULES = [
  'chat',
  'marketing',
  'staff',
  'operations',
  'finance',
  'maintenance',
] as const;

type PropertyNotificationModule = (typeof NOTIFICATION_MODULES)[number];

function isNotificationModule(value: string | null): value is PropertyNotificationModule {
  return (NOTIFICATION_MODULES as readonly string[]).includes(value ?? '');
}

const MODULE_SECTIONS: AdminSectionNavItem[] = [
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'staff', label: 'Staff', icon: HardHat },
  { id: 'operations', label: 'Operations', icon: Bell },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
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

const MODULE_DESCRIPTIONS: Record<PropertyNotificationModule, string> = {
  chat: 'Instant alert for every inbound guest message from web chat, Facebook, or Instagram.',
  marketing:
    'Daily calendar alerts, plus instant messages when a guest submits or cancels a booking.',
  staff: 'Daily staff summary at your chosen Manila time.',
  operations:
    'Booking workflow updates as guests move through documents, parking, pets, and check-in stages.',
  finance: 'Due-date reminders for tracked property expenses.',
  maintenance: 'Upcoming reminders for scheduled property upkeep items.',
};

export function NotificationsPage() {
  const tenant = useOptionalOrgContext();
  const { data: access } = usePropertyPermissions();
  const canEditGlobalBot = hasAnyNotificationModuleEditPermission(access?.permissions);
  const canEditModule = (module: PropertyNotificationModule) =>
    hasPropertyPermission(access?.permissions, NOTIFICATION_MODULE_EDIT_PERMISSION[module]);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const moduleParam = searchParams.get('module');
  const sectionParam = searchParams.get('section');
  const deepLinkModule = isNotificationModule(moduleParam) ? moduleParam : null;
  const deepLinkSection =
    sectionParam === IN_APP_NOTIFICATIONS_SECTION_ID ||
    location.hash === notificationsHubActivityHash()
      ? IN_APP_NOTIFICATIONS_SECTION_ID
      : null;

  usePageTitle(
    tenant ? propertyDashboardPageTitle(tenant.property.name, 'Notifications') : undefined
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
      <AdminMobilePage title="Notifications" titleId="notifications-heading">
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
              <div
                className={cn(!canEditGlobalBot && 'pointer-events-none opacity-60')}
                aria-disabled={!canEditGlobalBot || undefined}
              >
                <TelegramGlobalBotTokenCard />
              </div>

              <AdminSection
                id="chat"
                title="Chat"
                icon={MessageCircle}
                description={MODULE_DESCRIPTIONS.chat}
              >
                <div
                  className={cn(!canEditModule('chat') && 'pointer-events-none opacity-60')}
                  aria-disabled={!canEditModule('chat') || undefined}
                >
                  <TelegramChatSettingsCard embedded />
                </div>
              </AdminSection>

              <AdminSection
                id="marketing"
                title="Marketing"
                icon={Megaphone}
                description={MODULE_DESCRIPTIONS.marketing}
              >
                <div
                  className={cn(!canEditModule('marketing') && 'pointer-events-none opacity-60')}
                  aria-disabled={!canEditModule('marketing') || undefined}
                >
                  <TelegramMarketingSettingsCard embedded />
                </div>
              </AdminSection>

              <AdminSection
                id="staff"
                title="Staff"
                icon={HardHat}
                description={MODULE_DESCRIPTIONS.staff}
              >
                <div
                  className={cn(!canEditModule('staff') && 'pointer-events-none opacity-60')}
                  aria-disabled={!canEditModule('staff') || undefined}
                >
                  <TelegramStaffSettingsCard embedded />
                </div>
              </AdminSection>

              <AdminSection
                id="operations"
                title="Operations"
                icon={Bell}
                description={MODULE_DESCRIPTIONS.operations}
              >
                <div
                  className={cn(!canEditModule('operations') && 'pointer-events-none opacity-60')}
                  aria-disabled={!canEditModule('operations') || undefined}
                >
                  <TelegramAdminSettingsCard embedded />
                </div>
              </AdminSection>

              <AdminSection
                id="finance"
                title="Finance"
                icon={DollarSign}
                description={MODULE_DESCRIPTIONS.finance}
              >
                <div
                  className={cn(!canEditModule('finance') && 'pointer-events-none opacity-60')}
                  aria-disabled={!canEditModule('finance') || undefined}
                >
                  <TelegramFinanceSettingsCard embedded />
                </div>
              </AdminSection>

              <AdminSection
                id="maintenance"
                title="Maintenance"
                icon={Wrench}
                description={MODULE_DESCRIPTIONS.maintenance}
              >
                <div
                  className={cn(!canEditModule('maintenance') && 'pointer-events-none opacity-60')}
                  aria-disabled={!canEditModule('maintenance') || undefined}
                >
                  <TelegramMaintenanceSettingsCard embedded />
                </div>
              </AdminSection>
            </TelegramNotificationsTelegramSection>
          </div>
        </AdminSectionNavLayout>
      </AdminMobilePage>
    </TelegramNotificationsGlobalBotProvider>
  );
}
