import { Suspense } from 'react';

import { useParams } from 'react-router-dom';
import { Navigate } from 'react-router-dom';

import { usePreviewOverride } from '@/features/guest/lib/previewOverrideContext';
import { PublicPagePlanAccessOverlay } from '@/features/guest/lib/PublicPagePlanAccessOverlay';
import { useShowcaseData } from '@/features/guest/marketing/showcase/hooks/useShowcaseData';
import { getShowcaseTemplate } from '@/features/guest/marketing/showcase/templates/registry';

import { PublicFullBleedPageSkeleton } from '@/components/skeletons/GuestPageSkeletons';
import { usePageTitle } from '@/lib/pageTitle';

export function PropertyShowcasePage() {
  const { propertySlug: routeSlug = '' } = useParams();
  const previewOverride = usePreviewOverride();
  const isEditorPreview = previewOverride?.kind === 'property-showcase';
  const propertySlug = routeSlug || (isEditorPreview ? previewOverride.data.slug : '');
  const { data, planAccessDenied, isLoading, isError } = useShowcaseData(propertySlug);
  usePageTitle(data?.propertyName ? `${data.propertyName} - Showcase` : undefined);

  if (!propertySlug && !isEditorPreview) {
    return <Navigate to="/properties" replace />;
  }

  if (isLoading) {
    return <PublicFullBleedPageSkeleton label="Loading showcase" />;
  }

  if (planAccessDenied && !isEditorPreview) {
    return (
      <div className="bg-background relative min-h-[100dvh]">
        <PublicPagePlanAccessOverlay pageLabel="Showcase" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-background flex min-h-[100dvh] items-center justify-center px-4">
        <p className="text-muted-foreground text-sm">Showcase unavailable</p>
      </div>
    );
  }

  if (!data.published) {
    const preview =
      isEditorPreview ||
      (typeof window !== 'undefined' &&
        (new URLSearchParams(window.location.search).get('embed') === '1' ||
          new URLSearchParams(window.location.search).get('preview') === '1'));
    if (!preview) {
      return (
        <div className="bg-background flex min-h-[100dvh] items-center justify-center px-4">
          <p className="text-muted-foreground text-sm">Not available</p>
        </div>
      );
    }
  }

  const entry = getShowcaseTemplate(data.templateKey);
  const Template = entry.component;

  return (
    <Suspense fallback={<PublicFullBleedPageSkeleton label="Loading showcase" />}>
      <Template data={data} />
    </Suspense>
  );
}
