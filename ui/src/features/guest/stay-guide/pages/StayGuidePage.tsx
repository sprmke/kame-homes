import { Suspense, useEffect, useMemo, useRef } from 'react';

import { useParams, useSearchParams } from 'react-router-dom';

import { usePreviewOverride } from '@/features/guest/lib/previewOverrideContext';
import { PublicPagePlanAccessOverlay } from '@/features/guest/lib/PublicPagePlanAccessOverlay';
import { getShowcaseTemplate } from '@/features/guest/marketing/showcase/templates/registry';
import {
  useGuestStayGuide,
  useGuestStayGuidePreview,
} from '@/features/guest/stay-guide/hooks/useGuestStayGuide';
import { mapStayGuideData } from '@/features/guest/stay-guide/lib/mapStayGuideData';

import { propertyPublicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';

function StayGuideLoading() {
  return (
    <div className="bg-background flex min-h-[100dvh] items-center justify-center">
      <div className="bg-muted h-8 w-8 animate-pulse rounded-full" aria-hidden />
      <span className="sr-only">Loading stay guide</span>
    </div>
  );
}

function StayGuideUnavailable({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF] px-4 dark:bg-[#0A0A0A]">
      <div
        className={cn(
          'max-w-md rounded-2xl border border-[#171717]/10 bg-[#F5F5F5] p-8 text-center shadow-sm dark:border-[#FAFAFA]/10 dark:bg-[#171717]'
        )}
      >
        <p className="text-base font-medium text-[#171717] dark:text-[#FAFAFA]">{message}</p>
      </div>
    </div>
  );
}

export function StayGuidePage() {
  const { propertySlug = '' } = useParams<{ propertySlug: string }>();
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') ?? '').trim();
  const isPreview = searchParams.get('preview') === '1';
  const isEmbed = searchParams.get('embed') === '1';
  const previewPropertyId = (searchParams.get('property_id') ?? '').trim();
  const previewOverride = usePreviewOverride();
  const isEditorPreview = previewOverride?.kind === 'stay-guide';

  const tokenQuery = useGuestStayGuide(propertySlug, token);
  const previewQuery = useGuestStayGuidePreview(propertySlug, previewPropertyId);
  const activeQuery = isEditorPreview
    ? {
        data: previewOverride.data,
        isLoading: false,
        isError: false,
        error: null as Error | null,
        planAccessDenied: false,
      }
    : isPreview
      ? previewQuery
      : { ...tokenQuery, planAccessDenied: false };
  const { data, isLoading, isError, error, planAccessDenied } = activeQuery;

  const showcaseData = useMemo(
    () =>
      data
        ? mapStayGuideData({
            dto: data,
            previewPlaceholders: isEditorPreview || isPreview || isEmbed || undefined,
          })
        : null,
    [data, isEditorPreview, isPreview, isEmbed]
  );
  const stayTitle = data?.property.name.trim();
  usePageTitle(stayTitle ? propertyPublicPageTitle(stayTitle, 'Stay Guide') : undefined);
  const stayGuideOpenedRef = useRef(false);

  useEffect(() => {
    if (!data || isEditorPreview || isPreview || stayGuideOpenedRef.current) return;
    stayGuideOpenedRef.current = true;
    captureAppEvent('guest_stay_guide_opened', {
      slug: data.property.slug,
    });
  }, [data, isEditorPreview, isPreview]);

  if (!isEditorPreview && planAccessDenied) {
    return (
      <div className="bg-background relative min-h-[100dvh]">
        <PublicPagePlanAccessOverlay pageLabel="Stay Guide" />
      </div>
    );
  }

  if (!isEditorPreview && !isPreview && !token) {
    return (
      <StayGuideUnavailable message="Missing access link. Open the guide from your check-in email." />
    );
  }

  if (!isEditorPreview && isPreview && !previewPropertyId) {
    return (
      <StayGuideUnavailable message="Open the stay guide preview from Public Pages in the dashboard." />
    );
  }

  if (isLoading) return <StayGuideLoading />;

  if (isError || !data || !showcaseData) {
    return (
      <StayGuideUnavailable
        message={error instanceof Error ? error.message : 'This stay guide is not available.'}
      />
    );
  }

  const entry = getShowcaseTemplate(showcaseData.templateKey);
  const Template = entry.component;

  return (
    <Suspense fallback={<StayGuideLoading />}>
      <Template data={showcaseData} />
    </Suspense>
  );
}
