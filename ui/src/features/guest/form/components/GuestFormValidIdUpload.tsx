import { Upload } from 'lucide-react';

import { FormControl, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { validateImageFile } from '@/utils/text/helpers';

type GuestFormValidIdUploadProps = {
  label?: string;
  preview: string | null;
  value: File | undefined;
  imageLoadError: boolean;
  onChange: (file: File | undefined) => void;
  onPreviewChange: (preview: string | null) => void;
  onImageLoadErrorChange: (hasError: boolean) => void;
  fieldProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'>;
};

export function GuestFormValidIdUpload({
  label = 'Valid ID',
  preview,
  value,
  imageLoadError,
  onChange,
  onPreviewChange,
  onImageLoadErrorChange,
  fieldProps,
}: GuestFormValidIdUploadProps) {
  const handleFileSelect = (file: File | undefined) => {
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    onChange(file);
    onPreviewChange(URL.createObjectURL(file));
    onImageLoadErrorChange(false);
  };

  return (
    <FormItem>
      <FormLabel>
        {label} <span className="text-destructive">*</span>
      </FormLabel>
      <FormControl>
        <div className="guest-image-upload-dropzone group">
          {imageLoadError ? (
            <div className="guest-image-upload-error">
              <p>Image could not be loaded (link may be outdated).</p>
              <p>Please re-upload the valid ID below.</p>
              <label className="guest-image-upload-trigger">
                <Upload className="h-4 w-4" />
                Re-upload Image
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                  className="hidden"
                  {...fieldProps}
                  onChange={(event) => handleFileSelect(event.target.files?.[0])}
                />
              </label>
            </div>
          ) : preview || value ? (
            <>
              <img
                src={preview || (value && URL.createObjectURL(value))}
                alt={`${label} preview`}
                decoding="async"
                className="h-full w-full object-cover"
                onError={() => {
                  onImageLoadErrorChange(true);
                  onPreviewChange(null);
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <label className="guest-image-upload-replace">
                  <Upload className="h-4 w-4" />
                  Replace Image
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                    className="hidden"
                    {...fieldProps}
                    onChange={(event) => handleFileSelect(event.target.files?.[0])}
                  />
                </label>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <label className="guest-image-upload-trigger">
                <Upload className="h-4 w-4" />
                Upload Image
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                  className="hidden"
                  {...fieldProps}
                  onChange={(event) => handleFileSelect(event.target.files?.[0])}
                />
              </label>
            </div>
          )}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
