import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import { Loader2, Upload, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

import {
  OrgSettingsField,
  OrgSettingsFieldSpan,
} from '@/features/dashboard/org/components/org-settings/OrgSettingsFields';
import { type OrgSettingsFieldSource } from '@/features/dashboard/org/hooks/useOrgSettings';
import { useUploadOrgSettingsAsset } from '@/features/dashboard/org/hooks/useUploadOrgSettingsAsset';

import { TeamLogoMark } from '@/components/branding/TeamLogoMark';
import { isUsableLogoNaturalSize } from '@/lib/entityInitials';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { cn } from '@/lib/utils';

const LOGO_FRAME_CLASS = 'relative size-40 shrink-0 overflow-hidden rounded-xl border sm:size-44';

export function OrgSettingsImageField({
  id,
  label,
  help,
  source,
  disabled,
  imageUrl,
  fallbackName,
  previewAlt,
  uploadLabel = 'Upload image',
  replaceLabel = 'Replace image',
  required = false,
  error = null,
  onInteract,
}: {
  id: string;
  label: string;
  help?: string;
  source?: OrgSettingsFieldSource;
  disabled?: boolean;
  imageUrl: string | null;
  /** Listing / org name for initials when no usable logo is stored. */
  fallbackName?: string | null;
  previewAlt: string;
  uploadLabel?: string;
  replaceLabel?: string;
  required?: boolean;
  error?: string | null;
  onInteract?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadMut = useUploadOrgSettingsAsset();
  const busy = disabled || uploadMut.isPending;
  const hasStoredCustom = source === 'db';
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(imageUrl?.trim()) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    onInteract?.();
    try {
      await uploadMut.mutateAsync(file);
      toast.success(`${label} updated`);
    } catch (err) {
      toast.error(friendlyToastError(err, 'Upload failed'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <OrgSettingsFieldSpan>
      <OrgSettingsField id={id} label={label} help={help} required={required} error={error}>
        <div className="space-y-3">
          {uploadMut.isPending ? (
            <div
              className={cn(
                LOGO_FRAME_CLASS,
                'border-border/60 bg-muted/20 text-muted-foreground flex flex-col items-center justify-center gap-2 text-sm'
              )}
            >
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Uploading…
            </div>
          ) : hasImage ? (
            <div className={cn(LOGO_FRAME_CLASS, 'border-border/60 bg-muted/20 group/image')}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onInteract?.();
                  fileRef.current?.click();
                }}
                aria-label={hasStoredCustom ? replaceLabel : uploadLabel}
                aria-invalid={Boolean(error)}
                className={cn(
                  'relative size-full overflow-hidden border-0 bg-transparent p-0',
                  'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  !busy && 'cursor-pointer',
                  busy && !uploadMut.isPending && 'cursor-not-allowed opacity-60'
                )}
              >
                <img
                  src={imageUrl!}
                  alt={previewAlt}
                  width={176}
                  height={176}
                  className={cn(
                    'size-full object-cover object-center',
                    uploadMut.isPending && 'opacity-50'
                  )}
                  onError={() => setImageFailed(true)}
                  onLoad={(event) => {
                    const img = event.currentTarget;
                    if (!isUsableLogoNaturalSize(img.naturalWidth, img.naturalHeight)) {
                      setImageFailed(true);
                    }
                  }}
                />
                <span
                  className={cn(
                    'bg-background/80 text-foreground pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center text-sm font-medium transition-opacity motion-reduce:transition-none',
                    'opacity-0 group-focus-within/image:opacity-100 group-hover/image:opacity-100'
                  )}
                  aria-hidden
                >
                  <Upload className="text-primary size-5" />
                  <span>{hasStoredCustom ? replaceLabel : uploadLabel}</span>
                </span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onInteract?.();
                fileRef.current?.click();
              }}
              aria-label={uploadLabel}
              aria-invalid={Boolean(error)}
              className={cn(
                LOGO_FRAME_CLASS,
                'border-border group/empty relative border-dashed p-0',
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                error && 'border-destructive',
                !busy && 'cursor-pointer',
                busy && 'cursor-not-allowed opacity-60'
              )}
            >
              <TeamLogoMark
                name={fallbackName || previewAlt}
                alt={previewAlt}
                className="size-full rounded-xl shadow-none ring-0"
                initialsClassName="text-3xl sm:text-4xl"
              />
              <span
                className={cn(
                  'bg-background/80 text-foreground pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center text-sm font-medium transition-opacity motion-reduce:transition-none',
                  'opacity-0 group-focus-within/empty:opacity-100 group-hover/empty:opacity-100'
                )}
                aria-hidden
              >
                <ImagePlus className="text-primary size-5" />
                <span>{uploadLabel}</span>
              </span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(event) => void handleFileChange(event)}
          />
        </div>
      </OrgSettingsField>
    </OrgSettingsFieldSpan>
  );
}
