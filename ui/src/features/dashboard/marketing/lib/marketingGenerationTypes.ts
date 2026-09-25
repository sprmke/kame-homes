/** DTOs returned by generate-marketing-media, get-marketing-generation-job, marketing-generations. */

export type MarketingGenerationMediaType = 'image' | 'video';

export type MarketingGenerationStatus =
  'pending' | 'processing' | 'finalizing' | 'completed' | 'failed' | 'cancelled';

export type MarketingGenerationTier = 'draft' | 'standard' | 'premium';

export type MarketingGenerationJob = {
  id: string;
  organizationId: string;
  propertyId: string;
  mediaType: MarketingGenerationMediaType;
  jobStatus: MarketingGenerationStatus;
  prompt: string;
  negativePrompt: string | null;
  /** The full scene description actually sent to the image model, when prompt
   *  enhancement ran (image jobs only). Null when enhancement was off, not
   *  applicable (video), or failed open — see marketingImagePromptBuilder.ts. */
  enhancedPrompt: string | null;
  /** True only when enhancement actually ran and succeeded. */
  promptEnhanced: boolean;
  model: string;
  qualityTier: MarketingGenerationTier;
  aspectRatio: string;
  imageSize: string | null;
  resolution: string | null;
  durationSeconds: number | null;
  referenceUrls: string[];
  referencePaths: string[];
  outputUrl: string | null;
  outputMimeType: string | null;
  outputBytes: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  estimatedCredits: number;
  creditsConsumed: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketingGenerationReference = {
  id: string;
  organization_id: string;
  property_id: string;
  media_type: MarketingGenerationMediaType;
  storage_path: string;
  public_url: string;
  mime_type: string;
  file_name: string | null;
  byte_size: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  last_used_at: string | null;
  created_at: string;
};
