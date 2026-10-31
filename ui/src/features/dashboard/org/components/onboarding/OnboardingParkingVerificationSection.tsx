import { OnboardingProofUpload } from '@/features/dashboard/org/components/onboarding/OnboardingProofUpload';
import { OnboardingVerificationRightsFields } from '@/features/dashboard/org/components/onboarding/OnboardingVerificationRightsFields';
import {
  validateVerificationFile,
  verificationRightsProofHelp,
  type OrgVerificationRights,
} from '@/features/dashboard/org/lib/orgVerification';

type Props = {
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
  onUploadError: (message: string | null) => void;
};

export function OnboardingParkingVerificationSection({
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
  onUploadError,
}: Props) {
  return (
    <div className="border-border space-y-4 rounded-xl border p-3 sm:p-4">
      <div className="space-y-0.5">
        <p className="text-foreground text-sm font-semibold">Parking verification</p>
        <p className="text-muted-foreground text-xs leading-snug">
          Tell us your parking rights and upload supporting proof.
        </p>
      </div>

      <OnboardingVerificationRightsFields
        idPrefix="parking-verification"
        kind="parking"
        rights={rights}
        onRightsChange={onRightsChange}
        rightsError={rightsError}
        contractEndDate={contractEndDate}
        onContractEndDateChange={onContractEndDateChange}
        contractEndDateError={contractEndDateError}
      />

      <OnboardingProofUpload
        id="parking-ownership-proof"
        label="Proof of ownership or management"
        help={verificationRightsProofHelp(rights, 'parking')}
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
    </div>
  );
}
