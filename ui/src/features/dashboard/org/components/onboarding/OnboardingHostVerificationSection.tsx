import { OnboardingProofUpload } from '@/features/dashboard/org/components/onboarding/OnboardingProofUpload';
import {
  propertyAccessScreenshotHelp,
  validateVerificationFile,
} from '@/features/dashboard/org/lib/orgVerification';

type Props = {
  file: File | null;
  previewUrl: string | null;
  error: string | null;
  onFileChange: (file: File | null, preview: string | null) => void;
  socialProofFile: File | null;
  socialProofPreviewUrl: string | null;
  socialProofError: string | null;
  onSocialProofChange: (file: File | null, preview: string | null) => void;
  onUploadError: (message: string | null) => void;
};

export function OnboardingHostVerificationSection({
  file,
  previewUrl,
  error,
  onFileChange,
  socialProofFile,
  socialProofPreviewUrl,
  socialProofError,
  onSocialProofChange,
  onUploadError,
}: Props) {
  return (
    <div className="border-border space-y-4 rounded-xl border p-3 sm:p-4">
      <div className="space-y-0.5">
        <p className="text-foreground text-sm font-semibold">Host verification</p>
        <p className="text-muted-foreground text-xs leading-snug">
          Upload a government-issued photo ID that matches your host name.
        </p>
      </div>
      <OnboardingProofUpload
        id="onboarding-valid-id"
        label="Valid ID"
        help="Passport, driver’s license, or national ID. Name should match your organization’s host name."
        file={file}
        previewUrl={previewUrl}
        error={error}
        onFileChange={(nextFile, preview) => {
          if (nextFile) {
            const err = validateVerificationFile(nextFile);
            if (err) {
              onUploadError(err);
              onFileChange(null, null);
              return;
            }
          }
          onUploadError(null);
          onFileChange(nextFile, preview);
        }}
      />
      <OnboardingProofUpload
        id="onboarding-facebook-page"
        label="Facebook Page screenshot"
        help={propertyAccessScreenshotHelp('facebook')}
        file={socialProofFile}
        previewUrl={socialProofPreviewUrl}
        error={socialProofError}
        onFileChange={(nextFile, preview) => {
          if (nextFile) {
            const err = validateVerificationFile(nextFile);
            if (err) {
              onUploadError(err);
              onSocialProofChange(null, null);
              return;
            }
          }
          onUploadError(null);
          onSocialProofChange(nextFile, preview);
        }}
      />
    </div>
  );
}
