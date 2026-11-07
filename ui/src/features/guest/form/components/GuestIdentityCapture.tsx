import { useState } from 'react';

import { BadgeCheck, ScanFace, Upload } from 'lucide-react';

import { IdentityVerificationFlow } from '@/features/verification/components/IdentityVerificationFlow';
import { VerificationResultBadge } from '@/features/verification/components/VerificationResultBadge';
import type { IdentitySubmitResponse } from '@/features/verification/lib/identityApi';
import type { IdentityVerdict } from '@/features/verification/lib/identityVerdict';

import { FormControl, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalTitle } from '@/components/ui/responsive-modal';

import { GuestFormValidIdUpload } from './GuestFormValidIdUpload';

type GuestIdentityCaptureProps = {
  label: string;
  guestSlot: number;
  guestName: string;
  email: string;
  propertySlug: string;
  identityVerificationId: string | undefined;
  onIdentityChange: (id: string | undefined) => void;
  // File fallback — same contract as `GuestFormValidIdUpload`.
  preview: string | null;
  value: File | undefined;
  imageLoadError: boolean;
  onChange: (file: File | undefined) => void;
  onPreviewChange: (preview: string | null) => void;
  onImageLoadErrorChange: (hasError: boolean) => void;
  fieldProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'>;
};

/**
 * One ID slot on the booking form. Three states:
 *   * a live verification is attached → a confirmation row with a "Use a different ID" escape
 *   * a file is attached → the existing preview/uploader
 *   * nothing yet → verify with the camera, or upload as a fallback
 */
export function GuestIdentityCapture({
  label,
  guestSlot,
  guestName,
  email,
  propertySlug,
  identityVerificationId,
  onIdentityChange,
  preview,
  value,
  imageLoadError,
  onChange,
  onPreviewChange,
  onImageLoadErrorChange,
  fieldProps,
}: GuestIdentityCaptureProps) {
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState<IdentityVerdict | null>(null);

  const [upload, setUpload] = useState(false);

  const handleComplete = (result: IdentitySubmitResponse) => {
    setVerdict(result.verdict);
    onIdentityChange(result.verificationId);
    setOpen(false);
    setUpload(false);
  };

  if (identityVerificationId && !upload) {
    return (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-emerald-500" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{guestName || 'Guest'} verified</p>
                {verdict && <VerificationResultBadge verdict={verdict} />}
              </div>
            </div>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-xs underline"
              onClick={() => {
                onIdentityChange(undefined);
                setVerdict(null);
                setUpload(true);
              }}
            >
              Use a different ID
            </button>
          </div>
        </FormControl>
        <FormMessage />
      </FormItem>
    );
  }

  if (upload || preview || value) {
    return (
      <GuestFormValidIdUpload
        label={label}
        preview={preview}
        value={value}
        imageLoadError={imageLoadError}
        onChange={onChange}
        onPreviewChange={onPreviewChange}
        onImageLoadErrorChange={onImageLoadErrorChange}
        fieldProps={fieldProps}
      />
    );
  }

  return (
    <FormItem>
      <FormLabel>
        {label} <span className="text-destructive">*</span>
      </FormLabel>
      <FormControl>
        <div className="flex flex-col gap-2 rounded-xl border p-3">
          <button
            type="button"
            disabled={!email.trim()}
            className="hover:bg-muted focus-visible:ring-ring flex min-h-[52px] items-center gap-3 rounded-lg px-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setOpen(true)}
          >
            <ScanFace className="text-primary h-5 w-5" aria-hidden />
            <span className="text-sm font-medium">Verify your ID</span>
          </button>
          {!email.trim() && (
            <p className="text-muted-foreground px-2 text-xs">Enter your email first</p>
          )}
          <button
            type="button"
            className="text-muted-foreground flex min-h-[44px] items-center gap-3 rounded-lg px-2 text-left text-sm"
            onClick={() => setUpload(true)}
          >
            <Upload className="h-4 w-4" aria-hidden />
            Upload a photo instead
          </button>
        </div>
      </FormControl>
      <FormMessage />

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent sheetLayout="split" className="sm:max-w-md">
          <div className="flex items-center justify-between px-4 pt-4">
            <ResponsiveModalTitle>Verify your ID</ResponsiveModalTitle>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {open && (
              <IdentityVerificationFlow
                subjectKind="guest"
                guestSlot={guestSlot}
                email={email}
                propertySlug={propertySlug}
                onComplete={handleComplete}
                onCancel={() => setOpen(false)}
              />
            )}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </FormItem>
  );
}
