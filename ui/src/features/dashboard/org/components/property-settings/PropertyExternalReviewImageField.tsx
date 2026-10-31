import { useUploadAppSettingsAsset } from '@/features/dashboard/bookings/hooks/useUploadAppSettingsAsset';
import { withStorageUrlCacheBust } from '@/features/dashboard/bookings/lib/storageUrls';

import { ImageUploadDropzoneContained } from '@/components/forms/ImageUploadDropzone';

type Props = {
  reviewId: string;
  imageUrl: string | null;
  disabled?: boolean;
  onImageUrlChange: (url: string | null) => void;
};

export function PropertyExternalReviewImageField({
  reviewId,
  imageUrl,
  disabled,
  onImageUrlChange,
}: Props) {
  const uploadMut = useUploadAppSettingsAsset();
  const busy = disabled || uploadMut.isPending;
  const displaySrc = imageUrl?.trim() ? withStorageUrlCacheBust(imageUrl, null) : null;
  const inputId = `external-review-image-${reviewId}`;

  async function handleFileChange(file: File | undefined) {
    if (!file) return;
    try {
      const result = await uploadMut.mutateAsync({
        assetType: 'external_review_image',
        file,
        reviewId,
      });
      onImageUrlChange(result.url);
    } catch {
      // Upload errors surface via mutation / toast at call site if needed.
    }
  }

  return (
    <ImageUploadDropzoneContained
      id={inputId}
      imageUrl={displaySrc}
      uploading={uploadMut.isPending}
      disabled={busy}
      emptyLabel="Proof screenshot"
      onFileSelect={(file) => void handleFileChange(file)}
      onRemove={() => onImageUrlChange(null)}
    />
  );
}
