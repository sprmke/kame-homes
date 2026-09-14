import { lazy, useEffect, useMemo, useState } from 'react';

import { Navigate, Route, useLocation, useParams, useSearchParams } from 'react-router-dom';

import { CalendarDays, Home, MessageCircle } from 'lucide-react';

import { GuestForm } from '@/features/guest/form/components/GuestForm';
import { GuestFormSuccess } from '@/features/guest/form/components/GuestFormSuccess';
import { useGuestPaymentInfo } from '@/features/guest/form/hooks/useGuestPaymentInfo';
import { stripLegacyFromQueryParam } from '@/features/guest/form/lib/bookingSourceFromSearchParams';
import {
  formatGuestFooterLabel,
  pickGuestOperationalHeaderProps,
} from '@/features/guest/form/lib/guestFormBranding';
import { readGuestPropertySlug } from '@/features/guest/form/lib/guestPropertyScope';
import { useGuestPropertySlug } from '@/features/guest/hooks/useGuestPropertySlug';
import {
  guestCalendarPath,
  guestFormPath,
  guestPayParkingPath,
  guestPropertyPath,
  guestPropertyPickDatesPath,
  guestSdFormPath,
  guestReviewPath,
  guestSuccessPath,
} from '@/features/guest/lib/guestPublicPaths';
import { fetchPayParking } from '@/features/guest/pay-parking/lib/api';

import type { BottomTabItem } from '@/components/mobile/BottomTabBar';
import { MainLayout } from '@/layouts/MainLayout';
import { useFavicon } from '@/lib/favicon';
import { propertyPublicPageTitle, usePageTitle } from '@/lib/pageTitle';

const GuestBookingDocumentPage = lazy(() =>
  import('@/features/guest/booking-documents/pages/GuestBookingDocumentPage').then((m) => ({
    default: m.GuestBookingDocumentPage,
  }))
);
const CalendarPage = lazy(() =>
  import('@/features/guest/calendar/pages/CalendarPage').then((m) => ({ default: m.CalendarPage }))
);
const PropertyChatPage = lazy(() =>
  import('@/features/guest/chat/pages/PropertyChatPage').then((m) => ({
    default: m.PropertyChatPage,
  }))
);
const PropertyShowcasePage = lazy(() =>
  import('@/features/guest/marketing/showcase/pages/PropertyShowcasePage').then((m) => ({
    default: m.PropertyShowcasePage,
  }))
);
const PayParkingPage = lazy(() =>
  import('@/features/guest/pay-parking/pages/PayParkingPage').then((m) => ({
    default: m.PayParkingPage,
  }))
);
const GuestReviewPage = lazy(() =>
  import('@/features/guest/sd-form/pages/GuestReviewPage').then((m) => ({
    default: m.GuestReviewPage,
  }))
);
const SdFormPage = lazy(() =>
  import('@/features/guest/sd-form/pages/SdFormPage').then((m) => ({ default: m.SdFormPage }))
);
const StayGuidePage = lazy(() =>
  import('@/features/guest/stay-guide/pages/StayGuidePage').then((m) => ({
    default: m.StayGuidePage,
  }))
);

function resolvePropertyPublicPageName(pathname: string): string {
  if (pathname.includes('/parking/')) return 'Pay Parking';
  if (pathname.endsWith('/calendar')) return 'Calendar';
  if (pathname.endsWith('/messages')) return 'Messages';
  if (pathname.endsWith('/form')) return 'Book';
  if (pathname.endsWith('/success')) return 'Success';
  if (pathname.endsWith('/sd-form')) return 'Security Deposit';
  if (pathname.endsWith('/guest-review')) return 'Review';
  return 'Guest';
}

/** Persistent phone/tablet nav for the property operational shell — a wizard step (form/sd-form) hides it via `ContextualActionBar`. */
function resolvePropertyTabActiveKey(pathname: string): string {
  if (pathname.endsWith('/calendar')) return 'calendar';
  if (pathname.endsWith('/messages')) return 'messages';
  return 'property';
}

function GuestPublicLayout() {
  const location = useLocation();
  const propertySlug = useGuestPropertySlug();
  const { data: guestBrand } = useGuestPaymentInfo();
  const operationalHeader = pickGuestOperationalHeaderProps(guestBrand);
  const isCalendarRoute = /\/calendar\/?$/.test(location.pathname);
  const propertyName = operationalHeader.propertyName ?? guestBrand?.residenceName ?? propertySlug;
  usePageTitle(
    propertyPublicPageTitle(propertyName, resolvePropertyPublicPageName(location.pathname))
  );
  useFavicon(guestBrand?.emailLogoUrl);

  const bottomTabs = useMemo<BottomTabItem[]>(
    () => [
      { key: 'property', label: 'Property', href: guestPropertyPath(propertySlug), Icon: Home },
      {
        key: 'calendar',
        label: 'Calendar',
        href: guestCalendarPath(propertySlug),
        Icon: CalendarDays,
      },
      {
        key: 'messages',
        label: 'Messages',
        href: guestPropertyPickDatesPath(propertySlug, 'contactHost'),
        Icon: MessageCircle,
      },
    ],
    [propertySlug]
  );

  return (
    <MainLayout
      animateOnNavigate
      contentMaxWidth={isCalendarRoute ? 'max-w-xl' : 'max-w-3xl'}
      brandColor={guestBrand?.brandColor}
      footerLabel={
        guestBrand
          ? formatGuestFooterLabel(guestBrand.organizationName, guestBrand.residenceName)
          : null
      }
      propertySlug={propertySlug}
      propertyImageSrc={operationalHeader.propertyImageSrc}
      propertyName={operationalHeader.propertyName}
      bottomTabs={bottomTabs}
      bottomTabsActiveKey={resolvePropertyTabActiveKey(location.pathname)}
    />
  );
}

type LegacySegment = 'calendar' | 'form' | 'success' | 'sd-form' | 'guest-review';

function LegacyGuestPathRedirect({ segment }: { segment: LegacySegment }) {
  const [searchParams] = useSearchParams();
  const property = readGuestPropertySlug(searchParams);
  if (!property) return <Navigate to="/properties" replace />;

  const next = stripLegacyFromQueryParam(new URLSearchParams(searchParams));
  next.delete('property');
  next.delete('property_slug');

  const bookingId = next.get('bookingId')?.trim();
  if (segment === 'sd-form' && !bookingId) return <Navigate to="/properties" replace />;
  if (segment === 'guest-review' && !bookingId) return <Navigate to="/properties" replace />;

  const path =
    segment === 'calendar'
      ? guestCalendarPath(property, next)
      : segment === 'form'
        ? guestFormPath(property, next)
        : segment === 'success'
          ? guestSuccessPath(property, next)
          : segment === 'guest-review'
            ? guestReviewPath(property, bookingId!, next)
            : guestSdFormPath(property, bookingId!, next);

  return <Navigate to={path} replace />;
}

function LegacyPayParkingRedirect() {
  const { bookingId = '' } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const [target, setTarget] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!bookingId) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchPayParking(bookingId);
        const slug = data.property_slug?.trim();
        if (!slug || cancelled) {
          if (!cancelled) setFailed(true);
          return;
        }
        const admin = searchParams.get('admin') === 'true';
        if (!cancelled) {
          setTarget(guestPayParkingPath(slug, bookingId, { admin }));
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId, searchParams]);

  if (target) return <Navigate to={target} replace />;
  if (failed) return <Navigate to="/properties" replace />;
  return null;
}

/** Operational guest flows scoped to `/properties/:propertySlug/...`. */
export const propertyGuestRoutes = [
  <Route
    key="property-stay-guide"
    path="properties/:propertySlug/stay-guide"
    element={<StayGuidePage />}
  />,
  <Route
    key="property-showcase"
    path="properties/:propertySlug/showcase"
    element={<PropertyShowcasePage />}
  />,
  <Route
    key="property-booking-document"
    path="properties/:propertySlug/document"
    element={<GuestBookingDocumentPage />}
  />,
  <Route key="property-guest" path="properties/:propertySlug" element={<GuestPublicLayout />}>
    <Route path="calendar" element={<CalendarPage />} />
    <Route path="messages" element={<PropertyChatPage />} />
    <Route path="form" element={<GuestForm />} />
    <Route path="success" element={<GuestFormSuccess />} />
    <Route path="sd-form" element={<SdFormPage />} />
    <Route path="guest-review" element={<GuestReviewPage />} />
    <Route path="parking/:bookingId" element={<PayParkingPage />} />
  </Route>,
];

/** Redirects from removed global guest paths (preserve `?property=` when present). */
export const legacyGuestRedirects = [
  <Route
    key="legacy-calendar"
    path="/calendar"
    element={<LegacyGuestPathRedirect segment="calendar" />}
  />,
  <Route key="legacy-form" path="/form" element={<LegacyGuestPathRedirect segment="form" />} />,
  <Route
    key="legacy-success"
    path="/success"
    element={<LegacyGuestPathRedirect segment="success" />}
  />,
  <Route
    key="legacy-guest-review"
    path="/guest-review"
    element={<LegacyGuestPathRedirect segment="guest-review" />}
  />,
  <Route
    key="legacy-sd-form"
    path="/sd-form"
    element={<LegacyGuestPathRedirect segment="sd-form" />}
  />,
  <Route
    key="legacy-pay-parking"
    path="/bookings/:bookingId/parking"
    element={<LegacyPayParkingRedirect />}
  />,
];
