import { lazy } from 'react';

import { Navigate, Route, useParams } from 'react-router-dom';

import { guestAccountRoutes } from '@/features/guest/account/routes';
import { MarketingLayoutShell } from '@/features/guest/marketing/shared/components/MarketingLayoutShell';

import { NotFoundPage } from '@/routes/NotFoundPage';

const ExplorePreviewPage = lazy(() =>
  import('@/features/guest/marketing/explore-preview/pages/ExplorePreviewPage').then((m) => ({
    default: m.ExplorePreviewPage,
  }))
);
const AboutPage = lazy(() =>
  import('@/features/guest/marketing/pages/AboutPage').then((m) => ({ default: m.AboutPage }))
);
const ContactPage = lazy(() =>
  import('@/features/guest/marketing/pages/ContactPage').then((m) => ({ default: m.ContactPage }))
);
const CookiesPage = lazy(() =>
  import('@/features/guest/marketing/pages/CookiesPage').then((m) => ({ default: m.CookiesPage }))
);
const DevelopmentDetailPage = lazy(() =>
  import('@/features/guest/marketing/pages/DevelopmentDetailPage').then((m) => ({
    default: m.DevelopmentDetailPage,
  }))
);
const DevelopmentParkingListPage = lazy(() =>
  import('@/features/guest/marketing/pages/DevelopmentParkingListPage').then((m) => ({
    default: m.DevelopmentParkingListPage,
  }))
);
const DevelopmentPropertiesPage = lazy(() =>
  import('@/features/guest/marketing/pages/DevelopmentPropertiesPage').then((m) => ({
    default: m.DevelopmentPropertiesPage,
  }))
);
const DevelopmentsListPage = lazy(() =>
  import('@/features/guest/marketing/pages/DevelopmentsListPage').then((m) => ({
    default: m.DevelopmentsListPage,
  }))
);
const DevelopmentsLocationPage = lazy(() =>
  import('@/features/guest/marketing/pages/DevelopmentsLocationPage').then((m) => ({
    default: m.DevelopmentsLocationPage,
  }))
);
const ForHostsPage = lazy(() =>
  import('@/features/guest/marketing/pages/ForHostsPage').then((m) => ({
    default: m.ForHostsPage,
  }))
);
const ForHostsPreviewPage = lazy(() =>
  import('@/features/guest/marketing/pages/ForHostsPreviewPage').then((m) => ({
    default: m.ForHostsPreviewPage,
  }))
);
const ForHostsPricingPage = lazy(() =>
  import('@/features/guest/marketing/pages/ForHostsPricingPage').then((m) => ({
    default: m.ForHostsPricingPage,
  }))
);
const GuestLandingPage = lazy(() =>
  import('@/features/guest/marketing/pages/GuestLandingPage').then((m) => ({
    default: m.GuestLandingPage,
  }))
);
const HostPublicPage = lazy(() =>
  import('@/features/guest/marketing/pages/HostPublicPage').then((m) => ({
    default: m.HostPublicPage,
  }))
);
const ParkingDetailPage = lazy(() =>
  import('@/features/guest/marketing/pages/ParkingDetailPage').then((m) => ({
    default: m.ParkingDetailPage,
  }))
);
const ParkingFormPage = lazy(() =>
  import('@/features/guest/marketing/pages/ParkingFormPage').then((m) => ({
    default: m.ParkingFormPage,
  }))
);
const ParkingsListPage = lazy(() =>
  import('@/features/guest/marketing/pages/ParkingsListPage').then((m) => ({
    default: m.ParkingsListPage,
  }))
);
const ParkingsLocationPage = lazy(() =>
  import('@/features/guest/marketing/pages/ParkingsLocationPage').then((m) => ({
    default: m.ParkingsLocationPage,
  }))
);
const PrivacyPage = lazy(() =>
  import('@/features/guest/marketing/pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage }))
);
const PropertiesListPage = lazy(() =>
  import('@/features/guest/marketing/pages/PropertiesListPage').then((m) => ({
    default: m.PropertiesListPage,
  }))
);
const PropertiesLocationPage = lazy(() =>
  import('@/features/guest/marketing/pages/PropertiesLocationPage').then((m) => ({
    default: m.PropertiesLocationPage,
  }))
);
const PropertyDetailPage = lazy(() =>
  import('@/features/guest/marketing/pages/PropertyDetailPage').then((m) => ({
    default: m.PropertyDetailPage,
  }))
);
const ServicesPage = lazy(() =>
  import('@/features/guest/marketing/pages/ServicesPage').then((m) => ({
    default: m.ServicesPage,
  }))
);
const SupportPage = lazy(() =>
  import('@/features/guest/marketing/pages/SupportPage').then((m) => ({ default: m.SupportPage }))
);
const TermsPage = lazy(() =>
  import('@/features/guest/marketing/pages/TermsPage').then((m) => ({ default: m.TermsPage }))
);
const ParkingRequestStatusPage = lazy(() =>
  import('@/features/guest/marketing/parkings/pages/ParkingRequestStatusPage').then((m) => ({
    default: m.ParkingRequestStatusPage,
  }))
);
const SearchResultsPage = lazy(() =>
  import('@/features/guest/search/pages/SearchResultsPage').then((m) => ({
    default: m.SearchResultsPage,
  }))
);

function DevelopmentParkingListRedirect() {
  const { slug = '' } = useParams<{ slug: string }>();
  return <Navigate to={`/developments/${slug}/parking`} replace />;
}

function DevelopmentParkingCategoryRedirect() {
  const { slug = '' } = useParams<{ slug: string }>();
  return <Navigate to={`/developments/${slug}/parking`} replace />;
}

/** PMA (marketing) guest site routes — mock data until public APIs ship. */
export const marketingRoutes = [
  <Route key="marketing-shell" element={<MarketingLayoutShell />}>
    <Route index element={<GuestLandingPage />} />
    <Route path="search" element={<SearchResultsPage />} />
    <Route path="for-hosts/pricing" element={<ForHostsPricingPage />} />
    {/* Ground-up redesign preview — swap into `for-hosts` below once approved. */}
    <Route path="for-hosts/preview" element={<ForHostsPreviewPage />} />
    {/* Guest landing redesign preview — manual review, not linked from nav. */}
    <Route path="explore-preview" element={<ExplorePreviewPage />} />
    <Route path="for-hosts" element={<ForHostsPage />} />
    <Route path="services" element={<ServicesPage />} />
    <Route path="hosts/:orgSlug" element={<HostPublicPage />} />
    <Route path="properties" element={<PropertiesListPage />} />
    {/* Location browse — must be before `:propertySlug` so `in` is not treated as a property slug */}
    <Route path="properties/in/:location" element={<PropertiesLocationPage />} />
    <Route path="parkings" element={<ParkingsListPage />} />
    <Route path="parkings/in/:location" element={<ParkingsLocationPage />} />
    <Route path="parkings/requests/:bookingId" element={<ParkingRequestStatusPage />} />
    <Route path="parkings/:parkingSlug/form" element={<ParkingFormPage />} />
    <Route path="parkings/:parkingSlug" element={<ParkingDetailPage />} />
    <Route path="properties/:propertySlug" element={<PropertyDetailPage />} />
    <Route path="developments" element={<DevelopmentsListPage />} />
    {/* Location browse — must be before `:slug` so `in` is not treated as a development slug */}
    <Route path="developments/in/:location" element={<DevelopmentsLocationPage />} />
    <Route path="developments/:slug" element={<DevelopmentDetailPage />} />
    <Route path="developments/:slug/properties" element={<DevelopmentPropertiesPage />} />
    <Route path="developments/:slug/parking" element={<DevelopmentParkingListPage />} />
    <Route
      path="developments/:slug/parking/category"
      element={<DevelopmentParkingCategoryRedirect />}
    />
    <Route path="developments/:slug/parking/list" element={<DevelopmentParkingListRedirect />} />
    <Route path="about" element={<AboutPage />} />
    <Route path="contact" element={<ContactPage />} />
    <Route path="support" element={<SupportPage />} />
    <Route path="terms" element={<TermsPage />} />
    <Route path="privacy" element={<PrivacyPage />} />
    <Route path="cookies" element={<CookiesPage />} />
    {guestAccountRoutes}
    <Route path="*" element={<NotFoundPage />} />
  </Route>,
];
