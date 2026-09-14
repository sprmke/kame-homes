import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';

import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';


import { ChevronUp, ChevronLeft, ChevronRight, LogOut, User } from 'lucide-react';

import { AccountAvatar } from '@/features/guest/account/components/AccountAvatar';
import { GuestProfileModal } from '@/features/guest/account/components/GuestProfileModal';
import { useAccountIdentity } from '@/features/guest/account/hooks/useAccountIdentity';
import { hostLoginPath } from '@/features/guest/auth/lib/hostAuthPaths';
import { ModeSwitcher } from '@/features/guest/marketing/shared/components/ModeSwitcher';

import { AiAssistantLauncherButton } from '@/features/dashboard/ai-assistant/components/AiAssistantLauncherButton';
import { useAiAssistantAccess } from '@/features/dashboard/ai-assistant/hooks/useAiAssistantAccess';
import {
  isAiAssistantFabVisible,
  notificationFabStackedBottomClassName,
} from '@/features/dashboard/ai-assistant/lib/assistantFabLayout';
import {
  getAssistantOpenRequestId,
  subscribeAssistantOpenRequest,
} from '@/features/dashboard/ai-assistant/lib/assistantOpenStore';
import { useHostAnnouncementHasUnread } from '@/features/dashboard/announcements/hooks/useHostAnnouncementHasUnread';
import {
  AdminBrandTheme,
  useAdminBrandThemeStyle,
} from '@/features/dashboard/bookings/components/AdminBrandTheme';
import { AdminMoreSheet } from '@/features/dashboard/bookings/components/AdminMoreSheet';
import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';
import {
  ASSISTANT_TAB_KEY,
  NOTIFICATIONS_TAB_KEY,
  resolveBottomTabActiveKey,
  splitAdminBottomNav,
} from '@/features/dashboard/bookings/lib/adminBottomNav';
import {
  AdminLayoutFillMainActiveContext,
  AdminLayoutFillMainContext,
} from '@/features/dashboard/bookings/lib/adminLayoutFillMain';
import { adminPageTransitionKey } from '@/features/dashboard/bookings/lib/adminPageTransitionKey';
import {
  buildOrgNavSections,
  buildParkingNavSections,
  buildPropertyNavSections,
  buildSuperAdminNavSections,
  filterOrgNavSections,
  filterParkingNavSections,
  filterPropertyNavSections,
  isOrgAdminPath,
  isParkingAdminPath,
  isPropertyAdminPath,
  isSuperAdminPath,
  LEGACY_NAV_SECTIONS,
  type SidebarNavSection,
} from '@/features/dashboard/bookings/lib/adminSidebarNav';
import { resolveActiveNavHref } from '@/features/dashboard/bookings/lib/navActive';
import { NotificationBell } from '@/features/dashboard/notifications/components/NotificationBell';
import { NotificationsProvider } from '@/features/dashboard/notifications/components/NotificationsProvider';
import { useNotificationsList } from '@/features/dashboard/notifications/hooks/useNotifications';
import { ListingContractRenewalProvider } from '@/features/dashboard/org/components/listing-authorization/ListingContractRenewalProvider';
import { ListingVerificationSidebarCta } from '@/features/dashboard/org/components/listing-authorization/ListingVerificationSidebarCta';
import { OrgSettingsIssuesSync } from '@/features/dashboard/org/components/OrgSettingsIssuesSync';
import { SectionNavIssueDot } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  type OrgContextValue,
  useOptionalOrgContext,
} from '@/features/dashboard/org/components/RequireOrgContext';
import {
  type ParkingContextValue,
  useOptionalParkingContext,
} from '@/features/dashboard/org/components/RequireParkingContext';
import { SidebarTenantScope } from '@/features/dashboard/org/components/TenantSwitchers';
import {
  GetVerifiedSidebarCta,
  HostVerificationChangesGate,
} from '@/features/dashboard/org/components/verification/GetVerifiedModal';
import { useOrganizations, useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import {
  hasOrgSettingsIssues,
  subscribeOrgSettingsIssues,
} from '@/features/dashboard/org/lib/orgSettingsIssuesStore';
import {
  hasPropertySettingsIssues,
  subscribePropertySettingsIssues,
} from '@/features/dashboard/org/lib/propertySettingsIssuesStore';
import type { Organization, Parking, Property } from '@/features/dashboard/org/types';
import {
  hasParkingSettingsIssues,
  subscribeParkingSettingsIssues,
} from '@/features/dashboard/parking/lib/parkingSettingsIssuesStore';
import { UpgradeModalProvider } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { SetupGuideProvider } from '@/features/dashboard/setup-guide/components/SetupGuideProvider';
import { SetupGuideSidebarEntry } from '@/features/dashboard/setup-guide/components/SetupGuideSidebarEntry';
import { SuperAdminSidebarScope } from '@/features/dashboard/super-admin/components/SuperAdminSidebarScope';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';
import { useParkingPermissions } from '@/features/dashboard/team/hooks/useParkingPermissions';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';

import { BottomBarSlotProvider } from '@/components/mobile/BottomBarSlot';
import { BottomTabBar } from '@/components/mobile/BottomTabBar';
import { MobileAppShell } from '@/components/mobile/ContextualActionBar';
import { PageTransition } from '@/components/mobile/PageTransition';
import { SectionLoadingFallback } from '@/components/routing/RouteFallback';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { SlidingActivePill } from '@/components/ui/SlidingActivePill';
import { useSlidingActivePill } from '@/hooks/useSlidingActivePill';
import { useFavicon } from '@/lib/favicon';
import {
  appPageTitle,
  orgPageTitle,
  parkingDashboardPageTitle,
  propertyDashboardPageTitle,
  usePageTitle,
} from '@/lib/pageTitle';
import { PostHogAdminScopeSync } from '@/lib/posthog/PostHogAdminScopeSync';
import { cn } from '@/lib/utils';

const SIDEBAR_COLLAPSED_KEY = 'kame-admin-sidebar-collapsed';

const SIDEBAR_EXPANDED_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 72;
/** Vertical center of workspace switcher chevron (expanded) / logo (collapsed). */
const SIDEBAR_TOGGLE_TOP_EXPANDED = 42;
const SIDEBAR_TOGGLE_TOP_COLLAPSED = 32;

function readSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
}

function resolveAdminPageTitle(
  pathname: string,
  navSections: SidebarNavSection[],
  activeNavHref: string | null,
  tenant: OrgContextValue | null,
  parkingTenant: ParkingContextValue | null,
  orgsData: { organizations: Organization[] } | undefined,
  propertiesData: { properties: Property[] } | undefined,
  parkingsData: { parkings: Parking[] } | undefined,
  routeOrgSlug: string | undefined,
  routePropertySlug: string | undefined,
  routeParkingSlug: string | undefined
): string | undefined {
  const activeItem = navSections
    .flatMap((s) => s.items)
    .find((item) => item.href && item.href === activeNavHref);
  const pageName = activeItem?.label;

  if (isSuperAdminPath(pathname)) {
    return appPageTitle(pageName ?? 'Admin');
  }

  const orgSlug = tenant?.orgSlug ?? parkingTenant?.orgSlug ?? routeOrgSlug;
  const org = orgsData?.organizations.find((o) => o.slug === orgSlug);
  const orgName = org?.name;

  if (isPropertyAdminPath(pathname)) {
    const propertySlug = tenant?.propertySlug ?? routePropertySlug;
    const property =
      tenant?.property ?? propertiesData?.properties.find((p) => p.slug === propertySlug);
    if (property?.name && pageName) {
      return propertyDashboardPageTitle(property.name, pageName);
    }
    return undefined;
  }

  if (isParkingAdminPath(pathname)) {
    const parkingSlug = parkingTenant?.parkingSlug ?? routeParkingSlug;
    const parking =
      parkingTenant?.parking ?? parkingsData?.parkings.find((p) => p.slug === parkingSlug);
    if (orgName && parking?.name && pageName) {
      return parkingDashboardPageTitle(orgName, parking.name, pageName);
    }
    return undefined;
  }

  if (isOrgAdminPath(pathname)) {
    if (orgName && pageName) {
      return orgPageTitle(orgName, pageName);
    }
    return undefined;
  }

  return undefined;
}

type Props = {
  children: ReactNode;
  /** Fill main column height (inbox-style layouts). */
  fillMain?: boolean;
};

export function AdminLayout({ children, fillMain: fillMainProp = false }: Props) {
  const [fillMainOptIn, setFillMainOptIn] = useState(false);
  const fillCountRef = useRef(0);
  const setFill = useCallback((fill: boolean) => {
    fillCountRef.current = Math.max(0, fillCountRef.current + (fill ? 1 : -1));
    setFillMainOptIn(fillCountRef.current > 0);
  }, []);
  const fillMain = fillMainProp || fillMainOptIn;

  return (
    <AdminLayoutFillMainContext.Provider value={setFill}>
      <AdminLayoutFillMainActiveContext.Provider value={fillMain}>
        <AdminBrandTheme>
          <UpgradeModalProvider>
            <ListingContractRenewalProvider>
              <SetupGuideProvider>
                <AdminLayoutShell fillMain={fillMain}>{children}</AdminLayoutShell>
              </SetupGuideProvider>
            </ListingContractRenewalProvider>
          </UpgradeModalProvider>
        </AdminBrandTheme>
      </AdminLayoutFillMainActiveContext.Provider>
    </AdminLayoutFillMainContext.Provider>
  );
}

/** Persistent admin chrome for React Router layout routes — keeps sidebar mounted across navigations. */
export function AdminLayoutOutlet() {
  return (
    <AdminLayout>
      <Suspense fallback={<SectionLoadingFallback />}>
        <Outlet />
      </Suspense>
    </AdminLayout>
  );
}

function AdminLayoutShell({ children, fillMain = false }: Props) {
  const brandStyle = useAdminBrandThemeStyle();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    orgSlug: routeOrgSlug,
    propertySlug: routePropertySlug,
    parkingSlug: routeParkingSlug,
  } = useParams<{
    orgSlug?: string;
    propertySlug?: string;
    parkingSlug?: string;
  }>();
  const tenant = useOptionalOrgContext();
  const parkingTenant = useOptionalParkingContext();
  const { data: orgsData } = useOrganizations();
  const orgSlugForLists = tenant?.orgSlug ?? parkingTenant?.orgSlug ?? routeOrgSlug;
  const { data: propertiesData } = useProperties(orgSlugForLists);
  const { data: parkingsData } = useParkings(orgSlugForLists);
  const { email, signOut } = useAdminSession();
  const { displayName, avatarUrl, initials } = useAccountIdentity();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const propertyPermissionsQuery = usePropertyPermissions();
  const parkingPermissionsQuery = useParkingPermissions();
  const orgPermissionsQuery = useOrgPermissions();

  const navSections = useMemo(() => {
    if (isSuperAdminPath(location.pathname)) {
      return buildSuperAdminNavSections();
    }

    const orgSlug = tenant?.orgSlug ?? parkingTenant?.orgSlug ?? routeOrgSlug;
    const propertySlug = tenant?.propertySlug ?? routePropertySlug;
    const parkingSlug = parkingTenant?.parkingSlug ?? routeParkingSlug;

    if (orgSlug && propertySlug && isPropertyAdminPath(location.pathname)) {
      const sections = buildPropertyNavSections(orgSlug, propertySlug);
      if (propertyPermissionsQuery.isPending && !propertyPermissionsQuery.data) {
        return sections;
      }
      return filterPropertyNavSections(sections, propertyPermissionsQuery.data?.permissions);
    }

    if (orgSlug && parkingSlug && isParkingAdminPath(location.pathname)) {
      const sections = buildParkingNavSections(orgSlug, parkingSlug);
      if (parkingPermissionsQuery.isPending && !parkingPermissionsQuery.data) {
        return sections;
      }
      return filterParkingNavSections(sections, parkingPermissionsQuery.data?.permissions);
    }

    if (orgSlug && isOrgAdminPath(location.pathname)) {
      const org = orgsData?.organizations.find((o) => o.slug === orgSlug);
      const propertiesCount = propertiesData?.properties.length ?? 0;
      const parkingsCount = parkingsData?.parkings.length ?? 0;
      const hostModes = org?.hostModes ?? [];
      const sections = buildOrgNavSections(orgSlug, {
        showProperties: hostModes.includes('property') || propertiesCount > 0,
        showParkings: hostModes.includes('parking') || parkingsCount > 0,
      });
      if (orgPermissionsQuery.isPending && !orgPermissionsQuery.data) {
        return sections;
      }
      return filterOrgNavSections(sections, orgPermissionsQuery.data?.permissions);
    }

    if (tenant?.orgSlug && tenant?.propertySlug) {
      return buildPropertyNavSections(tenant.orgSlug, tenant.propertySlug);
    }
    if (parkingTenant?.orgSlug && parkingTenant?.parkingSlug) {
      return buildParkingNavSections(parkingTenant.orgSlug, parkingTenant.parkingSlug);
    }
    return LEGACY_NAV_SECTIONS;
  }, [
    tenant,
    parkingTenant,
    routeOrgSlug,
    routePropertySlug,
    routeParkingSlug,
    location.pathname,
    propertyPermissionsQuery.data?.permissions,
    propertyPermissionsQuery.isPending,
    parkingPermissionsQuery.data?.permissions,
    parkingPermissionsQuery.isPending,
    orgPermissionsQuery.data?.permissions,
    orgPermissionsQuery.isPending,
    orgsData?.organizations,
    propertiesData?.properties.length,
    parkingsData?.parkings.length,
  ]);

  const navHrefs = navSections.flatMap((section) =>
    section.items.flatMap((item) => (item.href ? [item.href] : []))
  );
  const navHrefsKey = navHrefs.join('\0');
  const activeNavHref = resolveActiveNavHref(location.pathname, navHrefs);
  const propertySettingsHasIssues = useSyncExternalStore(
    subscribePropertySettingsIssues,
    hasPropertySettingsIssues,
    () => false
  );
  const parkingSettingsHasIssues = useSyncExternalStore(
    subscribeParkingSettingsIssues,
    hasParkingSettingsIssues,
    () => false
  );
  const orgSettingsHasIssues = useSyncExternalStore(
    subscribeOrgSettingsIssues,
    hasOrgSettingsIssues,
    () => false
  );
  const assistantOpenRequestId = useSyncExternalStore(
    subscribeAssistantOpenRequest,
    getAssistantOpenRequestId,
    () => 0
  );
  const lastHandledAssistantOpenRequestIdRef = useRef(assistantOpenRequestId);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const propertyId = usePropertyIdParam();
  const {
    accessible: assistantAccessible,
    planGate,
    settings: assistantSettings,
  } = useAiAssistantAccess(propertyId);
  const { data: notificationsPreview } = useNotificationsList('preview');
  const unreadNotificationCount = notificationsPreview?.pages[0]?.unreadCount ?? 0;
  const hostAnnouncementsHaveUnread = useHostAnnouncementHasUnread();
  const showAssistantFab = isAiAssistantFabVisible(
    assistantAccessible,
    assistantSettings,
    planGate.allowed
  );

  useEffect(() => {
    setMoreSheetOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (assistantOpenRequestId === 0) return;
    if (assistantOpenRequestId === lastHandledAssistantOpenRequestIdRef.current) return;
    lastHandledAssistantOpenRequestIdRef.current = assistantOpenRequestId;
    setMoreSheetOpen(false);
    setNotificationsOpen(false);

    if (assistantAccessible) {
      setAssistantOpen(true);
      return;
    }

    // Kill-switch layers (platform/org toggle) hide the assistant entirely — nothing to open.
    const killSwitchOff = Boolean(
      assistantSettings && (!assistantSettings.platformEnabled || !assistantSettings.enabled)
    );
    if (killSwitchOff) return;

    // Blocked only by plan tier: open the panel read-only (past history) instead of a hard block.
    if (!planGate.isLoading && !planGate.allowed) {
      setAssistantOpen(true);
    }
  }, [
    assistantOpenRequestId,
    assistantAccessible,
    assistantSettings,
    planGate.isLoading,
    planGate.allowed,
  ]);

  const pageTitle = useMemo(
    () =>
      resolveAdminPageTitle(
        location.pathname,
        navSections,
        activeNavHref,
        tenant,
        parkingTenant,
        orgsData,
        propertiesData,
        parkingsData,
        routeOrgSlug,
        routePropertySlug,
        routeParkingSlug
      ),
    [
      location.pathname,
      navSections,
      activeNavHref,
      tenant,
      parkingTenant,
      orgsData,
      propertiesData,
      parkingsData,
      routeOrgSlug,
      routePropertySlug,
      routeParkingSlug,
    ]
  );
  usePageTitle(pageTitle);

  const faviconUrl = useMemo(() => {
    if (isSuperAdminPath(location.pathname)) return undefined;
    if (isPropertyAdminPath(location.pathname)) return tenant?.org.logoUrl ?? undefined;
    if (isParkingAdminPath(location.pathname)) return parkingTenant?.org.logoUrl ?? undefined;
    if (isOrgAdminPath(location.pathname)) {
      return orgsData?.organizations.find((o) => o.slug === routeOrgSlug)?.logoUrl ?? undefined;
    }
    return undefined;
  }, [
    location.pathname,
    tenant?.org.logoUrl,
    parkingTenant?.org.logoUrl,
    orgsData?.organizations,
    routeOrgSlug,
  ]);
  useFavicon(faviconUrl);

  const superAdmin = isSuperAdminPath(location.pathname);
  const openProfileModal = useCallback(() => {
    setProfileModalOpen(true);
  }, []);

  const openMoreSheet = useCallback(() => {
    setAssistantOpen(false);
    setNotificationsOpen(false);
    setMoreSheetOpen(true);
  }, []);

  const toggleAssistant = useCallback(() => {
    setMoreSheetOpen(false);
    setNotificationsOpen(false);
    setAssistantOpen((open) => !open);
  }, []);

  const toggleNotifications = useCallback(() => {
    setMoreSheetOpen(false);
    setAssistantOpen(false);
    setNotificationsOpen((open) => !open);
  }, []);

  const { tabItems, moreItems, primaryHrefs } = useMemo(
    () =>
      splitAdminBottomNav(navSections, {
        onMoreClick: openMoreSheet,
        assistant: !superAdmin && showAssistantFab ? { onClick: toggleAssistant } : undefined,
        notifications: !superAdmin
          ? {
              onClick: toggleNotifications,
              badge: unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
            }
          : undefined,
      }),
    [
      navSections,
      openMoreSheet,
      superAdmin,
      showAssistantFab,
      toggleAssistant,
      toggleNotifications,
      unreadNotificationCount,
    ]
  );

  const overlayTabKey = assistantOpen
    ? ASSISTANT_TAB_KEY
    : notificationsOpen
      ? NOTIFICATIONS_TAB_KEY
      : null;

  const tabActiveKey = resolveBottomTabActiveKey(
    activeNavHref,
    primaryHrefs,
    moreSheetOpen,
    overlayTabKey
  );

  const settingsIssueOnTabs =
    (propertySettingsHasIssues && isPropertyAdminPath(location.pathname)) ||
    (parkingSettingsHasIssues && isParkingAdminPath(location.pathname)) ||
    (orgSettingsHasIssues && isOrgAdminPath(location.pathname));

  const tabItemsWithBadges = useMemo(() => {
    const announcementsInMore = moreItems.some((item) => item.label === 'Announcements');
    const moreNeedsDot =
      (announcementsInMore && hostAnnouncementsHaveUnread) ||
      (settingsIssueOnTabs && moreItems.some((m) => m.label === 'Settings'));

    return tabItems.map((item) => {
      if (item.key === 'more') {
        return moreNeedsDot ? { ...item, badge: true } : item;
      }
      if (item.label === 'Settings' && settingsIssueOnTabs) return { ...item, badge: true };
      return item;
    });
  }, [tabItems, moreItems, settingsIssueOnTabs, hostAnnouncementsHaveUnread]);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  const mobileTabBar = (
    <BottomTabBar items={tabItemsWithBadges} activeKey={tabActiveKey} aria-label="Admin" />
  );

  return (
    <>
      <PostHogAdminScopeSync />
      {isOrgAdminPath(location.pathname) ? <OrgSettingsIssuesSync /> : null}
      {!superAdmin ? <HostVerificationChangesGate /> : null}
      {!superAdmin ? <NotificationsProvider /> : null}
      <BottomBarSlotProvider tabBar={mobileTabBar}>
        <div className="bg-background flex h-screen overflow-hidden" style={brandStyle}>
          <div className="relative flex min-w-0 flex-1">
            {/* Desktop sidebar */}
            <aside
              className="border-sidebar-border bg-sidebar hidden h-screen shrink-0 flex-col border-r transition-[width] duration-300 ease-out lg:flex"
              style={{ width: sidebarWidth }}
              aria-label="Admin navigation"
              aria-expanded={!sidebarCollapsed}
            >
              <AdminSidebarContent
                navSections={navSections}
                activeNavHref={activeNavHref}
                navHrefsKey={navHrefsKey}
                pathname={location.pathname}
                propertySettingsHasIssues={propertySettingsHasIssues}
                parkingSettingsHasIssues={parkingSettingsHasIssues}
                orgSettingsHasIssues={orgSettingsHasIssues}
                hostAnnouncementsHaveUnread={hostAnnouncementsHaveUnread}
                displayName={displayName}
                avatarUrl={avatarUrl}
                initials={initials}
                email={email}
                signOut={signOut}
                onOpenProfile={openProfileModal}
                collapsed={sidebarCollapsed}
                superAdmin={superAdmin}
              />
            </aside>

            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              style={{
                left: sidebarWidth,
                top: sidebarCollapsed ? SIDEBAR_TOGGLE_TOP_COLLAPSED : SIDEBAR_TOGGLE_TOP_EXPANDED,
              }}
              className={cn(
                'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground shadow-elevated',
                'absolute z-30 hidden min-h-[28px] min-w-[28px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-all duration-300 ease-out lg:flex',
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
              )}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-3 w-3" aria-hidden />
              ) : (
                <ChevronLeft className="h-3 w-3" aria-hidden />
              )}
            </button>

            <div className="admin-mobile-shell-column flex min-w-0 flex-1 flex-col overflow-hidden">
              <AdminMobileTopBar superAdmin={superAdmin} />

              <AdminMainColumn fillMain={fillMain} pathname={location.pathname}>
                {children}
              </AdminMainColumn>
            </div>
          </div>
        </div>

        <AdminMoreSheet
          open={moreSheetOpen}
          onOpenChange={(open) => {
            setMoreSheetOpen(open);
            if (open) {
              setAssistantOpen(false);
              setNotificationsOpen(false);
            }
          }}
          moreItems={moreItems}
          activeNavHref={activeNavHref}
          pathname={location.pathname}
          propertySettingsHasIssues={propertySettingsHasIssues}
          parkingSettingsHasIssues={parkingSettingsHasIssues}
          orgSettingsHasIssues={orgSettingsHasIssues}
          hostAnnouncementsHaveUnread={hostAnnouncementsHaveUnread}
          displayName={displayName}
          avatarUrl={avatarUrl}
          initials={initials}
          email={email}
          signOut={signOut}
          onOpenProfile={() => {
            setMoreSheetOpen(false);
            openProfileModal();
          }}
          onSignOutNavigate={() => navigate(hostLoginPath(), { replace: true })}
          superAdmin={superAdmin}
        />

        <GuestProfileModal open={profileModalOpen} onOpenChange={setProfileModalOpen} />

        {!superAdmin ? (
          <NotificationBell
            variant="fab"
            open={notificationsOpen}
            onOpenChange={(open) => {
              if (open) {
                setMoreSheetOpen(false);
                setAssistantOpen(false);
              }
              setNotificationsOpen(open);
            }}
            className={showAssistantFab ? notificationFabStackedBottomClassName : undefined}
          />
        ) : null}
        {!superAdmin ? (
          <AiAssistantLauncherButton
            open={assistantOpen}
            onOpenChange={(open) => {
              if (open) {
                setMoreSheetOpen(false);
                setNotificationsOpen(false);
              }
              setAssistantOpen(open);
            }}
          />
        ) : null}
      </BottomBarSlotProvider>
    </>
  );
}

function AdminMobileTopBar({ superAdmin }: { superAdmin: boolean }) {
  return (
    <header className="admin-mobile-fallback-topbar border-border/50 bg-background/80 supports-[backdrop-filter]:bg-background/65 sticky top-0 z-20 flex min-h-14 shrink-0 items-center gap-2 border-b px-3 py-2 backdrop-blur-xl lg:hidden">
      <div className="min-w-0 flex-1">
        {superAdmin ? (
          <SuperAdminSidebarScope collapsed={false} />
        ) : (
          <SidebarTenantScope collapsed={false} />
        )}
      </div>
    </header>
  );
}

function AdminMainColumn({
  children,
  fillMain,
  pathname,
}: {
  children: ReactNode;
  fillMain: boolean;
  pathname: string;
}) {
  return (
    <main
      className={cn(
        'min-h-0 flex-1',
        fillMain ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
      )}
    >
      <MobileAppShell
        /* Fill-main pages clear the tab bar on their inner scrollport — shell `pb` here
         * would shrink the flex area into a dead white gap and clip mid-card. */
        withTabBarOffset={!fillMain}
        className={cn(
          /* Mobile px/pt live in index.css (`.admin-mobile-main-shell`) — not Tailwind utilities,
           * or pt-3.5 wins over the hero-page :has() zero-padding rule in the bundle. */
          'admin-mobile-main-shell native-page-canvas mx-auto w-full max-w-7xl lg:px-8 lg:py-5',
          fillMain && 'flex min-h-0 flex-1 flex-col'
        )}
      >
        <PageTransition
          transitionKey={adminPageTransitionKey(pathname)}
          className={cn(
            fillMain
              ? 'flex min-h-0 flex-1 flex-col'
              : 'space-y-3 max-lg:space-y-0 sm:space-y-4 lg:space-y-6'
          )}
        >
          {children}
        </PageTransition>
      </MobileAppShell>
    </main>
  );
}

type AdminSidebarContentProps = {
  navSections: SidebarNavSection[];
  activeNavHref: string | null;
  navHrefsKey: string;
  pathname: string;
  propertySettingsHasIssues: boolean;
  parkingSettingsHasIssues: boolean;
  orgSettingsHasIssues: boolean;
  hostAnnouncementsHaveUnread: boolean;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  email: string | null;
  signOut: () => Promise<void>;
  onOpenProfile: () => void;
  onClose?: () => void;
  collapsed?: boolean;
  /** When false (mobile drawer closed), collapse the account menu. */
  menuOpen?: boolean;
  superAdmin?: boolean;
};

/** Module-level sidebar shell — must not be defined inside AdminLayoutShell or theme changes remount the tree. */
function AdminSidebarContent({
  navSections,
  activeNavHref,
  navHrefsKey,
  pathname,
  propertySettingsHasIssues,
  parkingSettingsHasIssues,
  orgSettingsHasIssues,
  hostAnnouncementsHaveUnread,
  displayName,
  avatarUrl,
  initials,
  email,
  signOut,
  onOpenProfile,
  onClose,
  collapsed = false,
  menuOpen,
  superAdmin = false,
}: AdminSidebarContentProps) {
  const {
    containerRef,
    setItemRef,
    bounds: navPillBounds,
  } = useSlidingActivePill(activeNavHref, [collapsed, navHrefsKey]);

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'border-sidebar-border shrink-0 border-b py-3',
          collapsed ? 'px-2' : 'px-3',
          onClose && 'pt-3'
        )}
      >
        {superAdmin ? (
          <SuperAdminSidebarScope collapsed={collapsed} />
        ) : (
          <SidebarTenantScope collapsed={collapsed} />
        )}
      </div>

      <nav
        className={cn('flex-1 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3')}
        aria-label="Main menu"
      >
        <div ref={containerRef} className="relative space-y-1.5">
          {navPillBounds ? (
            <SlidingActivePill bounds={navPillBounds} className="bg-primary rounded-xl shadow-sm" />
          ) : null}
          {navSections.map((section) => {
            const showHeading =
              !collapsed && navSections.length > 1 && Boolean(section.label) && !section.hideLabel;
            return (
              <div key={section.label} className={showHeading ? 'pt-3 first:pt-0' : undefined}>
                {showHeading ? (
                  <p className="text-sidebar-muted px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider">
                    {section.label}
                  </p>
                ) : null}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const { label, href, Icon, disabled } = item;
                    const active = href ? href === activeNavHref : false;
                    const showSettingsIssue =
                      label === 'Settings' &&
                      ((propertySettingsHasIssues && isPropertyAdminPath(pathname)) ||
                        (parkingSettingsHasIssues && isParkingAdminPath(pathname)) ||
                        (orgSettingsHasIssues && isOrgAdminPath(pathname)));
                    const showAnnouncementsBadge =
                      label === 'Announcements' && hostAnnouncementsHaveUnread;
                    const collapsedNavHint = showSettingsIssue
                      ? `${label}: items need attention`
                      : showAnnouncementsBadge
                        ? `${label}: unread announcements`
                        : label;

                    if (disabled || !href) {
                      return (
                        <div
                          key={label}
                          aria-disabled="true"
                          title={collapsed ? label : undefined}
                          className={cn(
                            'flex cursor-not-allowed items-center rounded-xl px-3 py-2.5 text-sm font-medium opacity-50',
                            collapsed ? 'justify-center px-2' : 'gap-3',
                            'text-sidebar-muted'
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          {!collapsed && <span className="flex-1 truncate">{label}</span>}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={href}
                        ref={setItemRef(href)}
                        to={href}
                        onClick={onClose}
                        title={collapsed ? label : undefined}
                        aria-current={active ? 'page' : undefined}
                        aria-label={collapsed ? collapsedNavHint : undefined}
                        className={cn(
                          'group relative z-[1] flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200',
                          collapsed ? 'justify-center px-2' : 'gap-3',
                          active
                            ? 'text-primary-foreground'
                            : 'text-sidebar-foreground hover:bg-muted/60 hover:text-foreground dark:hover:bg-muted/40'
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-5 w-5 shrink-0 transition-colors',
                            active
                              ? 'text-primary-foreground'
                              : 'text-sidebar-muted group-hover:text-foreground'
                          )}
                        />
                        {!collapsed && (
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="truncate">{label}</span>
                            {showAnnouncementsBadge || showSettingsIssue ? (
                              <SectionNavIssueDot className="ml-auto" />
                            ) : null}
                          </span>
                        )}
                        {collapsed && (showAnnouncementsBadge || showSettingsIssue) ? (
                          <SectionNavIssueDot className="absolute right-1.5 top-1.5" />
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      {!superAdmin ? <SetupGuideSidebarEntry collapsed={collapsed} /> : null}
      {!superAdmin ? (
        isPropertyAdminPath(pathname) || isParkingAdminPath(pathname) ? (
          <ListingVerificationSidebarCta collapsed={collapsed} />
        ) : (
          <GetVerifiedSidebarCta collapsed={collapsed} />
        )
      ) : null}

      <AdminProfileFooter
        collapsed={collapsed}
        showThemeToggle={!onClose}
        displayName={displayName}
        avatarUrl={avatarUrl}
        initials={initials}
        email={email}
        signOut={signOut}
        onOpenProfile={onOpenProfile}
        menuOpen={menuOpen}
      />
    </div>
  );
}

type AdminProfileFooterProps = {
  collapsed: boolean;
  showThemeToggle: boolean;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  email: string | null;
  signOut: () => Promise<void>;
  onOpenProfile: () => void;
  menuOpen?: boolean;
};

/**
 * Account menu at the bottom of each sidebar instance. State is per-instance
 * because desktop and mobile drawers both mount SidebarContent — a shared ref
 * would point at the hidden drawer and break outside-click / sign-out.
 */
function AdminProfileFooter({
  collapsed,
  showThemeToggle,
  displayName,
  avatarUrl,
  initials,
  email,
  signOut,
  onOpenProfile,
  menuOpen,
}: AdminProfileFooterProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname, collapsed]);

  useEffect(() => {
    if (menuOpen === false) setProfileOpen(false);
  }, [menuOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setProfileOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [profileOpen]);

  const handleOpenProfile = () => {
    setProfileOpen(false);
    onOpenProfile();
  };

  const handleSignOut = async () => {
    setProfileOpen(false);
    try {
      await signOut();
      navigate(hostLoginPath(), { replace: true });
    } catch (err) {
      console.error('[AdminProfileFooter] signOut failed', err);
    }
  };

  return (
    <div
      className={cn('border-sidebar-border shrink-0 space-y-2 border-t', collapsed ? 'p-2' : 'p-3')}
    >
      {showThemeToggle && (
        <div className={cn(collapsed ? 'flex justify-center px-0' : 'px-1')}>
          <ThemeToggle
            variant={collapsed ? 'icon' : 'segmented'}
            className={collapsed ? undefined : 'w-full'}
          />
        </div>
      )}

      <div ref={profileRef} className="relative">
        {profileOpen && (
          <div
            className={cn(
              'border-border/50 bg-card shadow-elevated-lg absolute z-50 overflow-hidden rounded-xl border',
              collapsed
                ? 'bottom-0 left-full ml-2 w-[min(18rem,calc(100vw-1.5rem))]'
                : 'bottom-full left-0 right-0 mb-2'
            )}
            role="menu"
            aria-label="Account menu"
          >
            {collapsed ? (
              <div className="flex min-w-0 items-center gap-3 px-3.5 py-3">
                <AccountAvatar
                  avatarUrl={avatarUrl}
                  initials={initials}
                  className="ring-background h-10 w-10 shadow-sm ring-2"
                  fallbackClassName="text-sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-semibold leading-tight">
                    {displayName}
                  </p>
                  {email ? (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs leading-tight">
                      {email}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className={cn('px-3 py-3', collapsed && 'border-border/50 border-t')}>
              <ModeSwitcher className="w-full" />
            </div>

            <div className="border-border/50 border-t p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={handleOpenProfile}
                className="text-ui text-foreground hover:bg-muted/60 focus-visible:ring-ring flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2"
              >
                <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Profile
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleSignOut()}
                className="text-ui text-destructive hover:bg-destructive/10 focus-visible:ring-ring flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Sign out
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setProfileOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          aria-label={`Account menu, ${displayName}`}
          className={cn(
            'relative z-10 flex min-h-[44px] w-full min-w-0 items-center rounded-xl border transition-all duration-150',
            'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            collapsed ? 'justify-center border-transparent px-2 py-2' : 'gap-3 px-2.5 py-2',
            profileOpen
              ? 'border-border bg-muted/60 shadow-sm'
              : 'hover:border-border/50 hover:bg-muted/40 border-transparent'
          )}
        >
          <AccountAvatar
            avatarUrl={avatarUrl}
            initials={initials}
            className="ring-background h-8 w-8 shadow-sm ring-2"
            fallbackClassName="text-xs"
          />
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-foreground truncate text-sm font-semibold leading-tight">
                  {displayName}
                </p>
                {email ? (
                  <p className="text-muted-foreground mt-0.5 truncate text-xs leading-tight">
                    {email}
                  </p>
                ) : null}
              </div>
              <ChevronUp
                className={cn(
                  'text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200',
                  profileOpen && 'rotate-180'
                )}
                aria-hidden
              />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
