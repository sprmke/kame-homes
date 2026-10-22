import { useMemo, useRef } from 'react';

import { CalendarBuilder } from '@/features/dashboard/marketing/components/calendar-builder/components/CalendarBuilder';
import { useCalendarExport } from '@/features/dashboard/marketing/components/calendar-builder/hooks/useCalendarExport';
import { useCalendarBuilderStore } from '@/features/dashboard/marketing/components/calendar-builder/stores/calendarBuilderStore';
import type {
  MarketingEditorDocument,
  MarketingEditorNav,
} from '@/features/dashboard/marketing/components/shared/MarketingEditorHost';
import { useMarketingBookedDates } from '@/features/dashboard/marketing/hooks/useMarketingBookedDates';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import { bookedDatesToPreviewBookings } from '@/features/dashboard/marketing/lib/marketingBookedDates';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { BookingsCalendarSkeleton } from '@/components/skeletons/AdminSkeletons';

type Props = {
  document: MarketingEditorDocument;
  nav: MarketingEditorNav;
  onPublish?: (blob: Blob) => void;
};

export function MarketingCalendarSection({ document, nav, onPublish }: Props) {
  const { property } = useOrgContext();
  const previewRef = useRef<HTMLDivElement>(null);
  const previewMonth = useCalendarBuilderStore((s) => s.previewMonth);
  const { data: bookedDates, isLoading } = useMarketingBookedDates();
  const { canEditContent, canPublish } = useMarketingPermissions();
  const { canUse: canUseMarketingStudio, isLoading: marketingStudioLoading } =
    useFeatureGate('marketingStudio');
  const { canUse: canPublishToMeta, isLoading: publishEntitlementsLoading } = useFeatureGate(
    'marketingPublishLimitPerGroup'
  );
  const { open: openUpgradeModal } = useUpgradeModal();

  const bookings = useMemo(
    () => bookedDatesToPreviewBookings(bookedDates ?? [], previewMonth),
    [bookedDates, previewMonth]
  );

  const {
    handleDownload: handleDownloadFromHook,
    handleExportBlob,
    isExporting,
  } = useCalendarExport(previewRef, property.name);

  const handleDownload = async () => {
    if (!canEditContent) return;
    if (!canUseMarketingStudio) {
      if (!marketingStudioLoading) openUpgradeModal('marketingStudio');
      return;
    }
    await handleDownloadFromHook();
  };

  const handlePublish = async () => {
    if (!canPublish) return;
    if (!canPublishToMeta) {
      if (!publishEntitlementsLoading) openUpgradeModal('marketingPublishLimitPerGroup');
      return;
    }
    if (!onPublish) return;
    const blob = await handleExportBlob();
    if (blob) onPublish(blob);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {isLoading && (
        <div className="bg-background/60 absolute inset-0 z-10 overflow-hidden rounded-xl">
          <BookingsCalendarSkeleton gridOnly compact />
        </div>
      )}
      <CalendarBuilder
        document={document}
        nav={nav}
        propertyName={property.name}
        propertySlug={property.slug}
        bookings={bookings}
        exportContainerRef={previewRef}
        onExport={canEditContent ? () => void handleDownload() : undefined}
        onPublish={canPublish && onPublish ? () => void handlePublish() : undefined}
        isExporting={isExporting}
      />
    </div>
  );
}
