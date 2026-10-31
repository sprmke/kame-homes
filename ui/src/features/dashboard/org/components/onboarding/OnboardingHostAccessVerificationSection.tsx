import { OnboardingProofUpload } from '@/features/dashboard/org/components/onboarding/OnboardingProofUpload';
import { OnboardingVerificationRightsFields } from '@/features/dashboard/org/components/onboarding/OnboardingVerificationRightsFields';
import {
  validateVerificationFile,
  verificationRightsProofHelp,
  type OrgVerificationRights,
} from '@/features/dashboard/org/lib/orgVerification';

type Props = {
  sectionId: string;
  title: string;
  subtitle: string;
  rights: OrgVerificationRights | '';
  onRightsChange: (value: OrgVerificationRights) => void;
  rightsError: string | null;
  contractEndDate: string;
  onContractEndDateChange: (value: string) => void;
  contractEndDateError: string | null;
  proofFile: File | null;
  proofPreview: string | null;
  proofError: string | null;
  onProofChange: (file: File | null, preview: string | null) => void;
  screenshotFile: File | null;
  screenshotPreview: string | null;
  screenshotError: string | null;
  onScreenshotChange: (file: File | null, preview: string | null) => void;
  onUploadError: (message: string | null) => void;
};

export function OnboardingHostAccessVerificationSection({
  sectionId,
  title,
  subtitle,
  rights,
  onRightsChange,
  rightsError,
  contractEndDate,
  onContractEndDateChange,
  contractEndDateError,
  proofFile,
  proofPreview,
  proofError,
  onProofChange,
  screenshotFile,
  screenshotPreview,
  screenshotError,
  onScreenshotChange,
  onUploadError,
}: Props) {
  const kind = sectionId.includes('parking') ? 'parking' : 'property';

  return (
    <div className="border-border space-y-4 rounded-xl border p-3 sm:p-4">
      <div className="space-y-0.5">
        <p className="text-foreground text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground text-xs leading-snug">{subtitle}</p>
      </div>
      <OnboardingVerificationRightsFields
        idPrefix={sectionId}
        kind={kind}
        rights={rights}
        onRightsChange={onRightsChange}
        rightsError={rightsError}
        contractEndDate={contractEndDate}
        onContractEndDateChange={onContractEndDateChange}
        contractEndDateError={contractEndDateError}
      />
      <OnboardingProofUpload
        id={`${sectionId}-ownership-proof`}
        label="Proof of ownership or management"
        help={verificationRightsProofHelp(rights, kind)}
        file={proofFile}
        previewUrl={proofPreview}
        error={proofError}
        onFileChange={(file, preview) => {
          if (file) {
            const err = validateVerificationFile(file);
            if (err) {
              onUploadError(err);
              onProofChange(null, null);
              return;
            }
          }
          onUploadError(null);
          onProofChange(file, preview);
        }}
      />
      <OnboardingProofUpload
        id={`${sectionId}-access-screenshot`}
        label="Access screenshot"
        help="Screenshot showing you are logged in as owner or admin of that Page or listing."
        file={screenshotFile}
        previewUrl={screenshotPreview}
        error={screenshotError}
        onFileChange={(file, preview) => {
          if (file) {
            const err = validateVerificationFile(file);
            if (err) {
              onUploadError(err);
              onScreenshotChange(null, null);
              return;
            }
          }
          onUploadError(null);
          onScreenshotChange(file, preview);
        }}
      />
    </div>
  );
}
