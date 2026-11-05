import type { PlanMarketingMediaLibrary } from '@/features/dashboard/plans/lib/planFeatures';

export type MarketingMediaKind = 'image' | 'video' | 'audio';

export type MarketingMediaLimitCode =
  'storage_full' | 'too_many_files' | 'file_too_large' | 'video_too_long' | 'daily_limit';

/** One library asset as returned by `marketing-media`. */
export type MarketingMediaAsset = {
  id: string;
  kind: MarketingMediaKind;
  source: 'upload' | 'ai' | 'legacy_upload' | 'music_upload';
  fileName: string;
  mimeType: string;
  url: string;
  posterUrl: string | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  peaks: number[] | null;
  createdAt: string;
};

export type MarketingMediaPage = {
  items: MarketingMediaAsset[];
  nextCursor: string | null;
};

export type MarketingMediaUsage = {
  usedBytes: number;
  files: number;
  uploadsToday: number;
  limits: PlanMarketingMediaLibrary;
};

export type ReserveResponse =
  | { deduped: true; asset: MarketingMediaAsset }
  | {
      deduped: false;
      assetId: string;
      uploadUrl: string;
      token: string;
      path: string;
      poster: { uploadUrl: string; token: string; path: string } | null;
    };

export type MarketingMediaListFilter = {
  kind?: MarketingMediaKind;
  source?: MarketingMediaAsset['source'];
  q?: string;
};
