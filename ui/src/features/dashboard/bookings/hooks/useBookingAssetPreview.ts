/**
 * Shared in-page asset preview for booking detail / workflow rails.
 * Resolves private storage URLs then opens `BookingDetailAssetPreviewModal`.
 */

import { useCallback, useState } from 'react';

import { toast } from 'sonner';

import {
  isStorageObjectNotFoundError,
  resolveAssetUrlForBrowser,
} from '@/features/dashboard/bookings/lib/storageUrls';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export type BookingAssetPreviewHandler = (label: string, rawUrl: string) => void | Promise<void>;

type BookingAssetPreviewState = {
  label: string;
  url: string;
  rawUrl: string;
  type: 'image' | 'pdf' | 'file';
};

function getDocType(url: string): 'image' | 'pdf' | 'file' {
  const path = url.split('?')[0].toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif|heic|heif)$/.test(path)) return 'image';
  if (/\.pdf$/.test(path)) return 'pdf';
  return 'file';
}

export function useBookingAssetPreview(bookingId: string | null | undefined = null) {
  const propertyId = usePropertyIdParam();
  const [previewAsset, setPreviewAsset] = useState<BookingAssetPreviewState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreview = useCallback(
    async (label: string, rawUrl: string) => {
      setPreviewLoading(true);
      try {
        const resolved = await resolveAssetUrlForBrowser(rawUrl, propertyId, bookingId ?? null);
        setPreviewAsset({
          label,
          url: resolved,
          rawUrl,
          type: getDocType(resolved),
        });
      } catch (err) {
        toast.error(
          isStorageObjectNotFoundError(err)
            ? 'This file is no longer in storage'
            : err instanceof Error
              ? err.message
              : 'Failed to open document'
        );
      } finally {
        setPreviewLoading(false);
      }
    },
    [propertyId, bookingId]
  );

  const closePreview = useCallback(() => {
    if (!previewLoading) setPreviewAsset(null);
  }, [previewLoading]);

  return {
    previewAsset,
    previewLoading,
    handlePreview,
    closePreview,
  };
}
