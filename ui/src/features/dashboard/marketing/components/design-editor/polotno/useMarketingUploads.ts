/**
 * useMarketingUploads (formerly usePolotnoSessionMedia) — session upload grid for
 * the Design canvas's Upload/Background panels.
 *
 * Shows an optimistic local preview the instant a file is picked (so the grid
 * never waits on the network), then persists the file via
 * `upload-marketing-asset` and swaps every canvas element using that preview's
 * `blob:` URL over to the real https URL once the upload settles — the fix for
 * the bug where a `blob:` URL survived into `design_json.polotno` and died on
 * reload. Autosave is suspended for the duration via the caller's own
 * `useMarketingAutoSaveSuspension` instance (passed in, not created here, so it
 * shares state with the studio's autosave gate).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toast } from 'sonner';

import { useUploadMarketingAsset } from '@/features/dashboard/marketing/hooks/useUploadMarketingAsset';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';
import type { PropertyMediaItem } from '@/features/dashboard/marketing/lib/polotno/propertyMedia';

export function mergePropertyMediaItems(
  propertyImages: PropertyMediaItem[],
  sessionUploads: PropertyMediaItem[]
): PropertyMediaItem[] {
  const seen = new Set<string>();
  const merged: PropertyMediaItem[] = [];
  for (const item of [...propertyImages, ...sessionUploads]) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    merged.push(item);
  }
  return merged;
}

type UseMarketingUploadsOptions = {
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
};

type StorePageLike = {
  children: Array<{ src?: string; set: (patch: Record<string, unknown>) => void }>;
};

/** Patches every canvas element (across every page) whose `src` is the given blob URL. */
function replaceElementSrcEverywhere(store: PolotnoStore, fromSrc: string, toSrc: string): void {
  const pages = (store as unknown as { pages: StorePageLike[] }).pages ?? [];
  for (const page of pages) {
    for (const element of page.children) {
      if (element.src === fromSrc) {
        element.set({ src: toSrc });
      }
    }
  }
}

export function useMarketingUploads(
  store: PolotnoStore | null,
  options: UseMarketingUploadsOptions = {}
) {
  const [sessionUploads, setSessionUploads] = useState<PropertyMediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const blobUrlsRef = useRef<string[]>([]);
  const { mutateAsync: uploadAsset } = useUploadMarketingAsset();
  const onUploadStartRef = useRef(options.onUploadStart);
  const onUploadEndRef = useRef(options.onUploadEnd);
  onUploadStartRef.current = options.onUploadStart;
  onUploadEndRef.current = options.onUploadEnd;

  const appendFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const picked = Array.from(files);

      const localEntries = picked.map((file) => {
        const blobUrl = URL.createObjectURL(file);
        blobUrlsRef.current.push(blobUrl);
        return { blobUrl, file };
      });

      setIsUploading(true);
      onUploadStartRef.current?.();
      setSessionUploads((prev) => [
        ...prev,
        ...localEntries.map(({ blobUrl }) => ({
          url: blobUrl,
          preview: blobUrl,
          type: 'image' as const,
        })),
      ]);

      try {
        await Promise.all(
          localEntries.map(async ({ blobUrl, file }) => {
            try {
              const result = await uploadAsset(file);
              if (store) replaceElementSrcEverywhere(store, blobUrl, result.url);
              setSessionUploads((prev) =>
                prev.map((item) =>
                  item.url === blobUrl
                    ? { url: result.url, preview: result.url, type: 'image' as const }
                    : item
                )
              );
              URL.revokeObjectURL(blobUrl);
              blobUrlsRef.current = blobUrlsRef.current.filter((url) => url !== blobUrl);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Upload failed');
            }
          })
        );
      } finally {
        setIsUploading(false);
        onUploadEndRef.current?.();
      }
    },
    [store, uploadAsset]
  );

  useEffect(() => {
    return () => {
      for (const url of blobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      blobUrlsRef.current = [];
    };
  }, []);

  return useMemo(
    () => ({ sessionUploads, isUploading, appendFiles }),
    [sessionUploads, isUploading, appendFiles]
  );
}

export type MarketingUploads = ReturnType<typeof useMarketingUploads>;
