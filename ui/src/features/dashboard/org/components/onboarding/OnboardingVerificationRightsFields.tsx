import { VerificationFieldLabel } from '@/features/dashboard/org/components/onboarding/VerificationFieldLabel';
import {
  ORG_VERIFICATION_RIGHTS,
  verificationRightsFieldHelp,
  verificationRightsFieldLabel,
  verificationRightsNeedsContractEnd,
  verificationRightsSelectPlaceholder,
  type OrgVerificationRights,
  type VerificationSectionKind,
} from '@/features/dashboard/org/lib/orgVerification';

import { FieldLabel } from '@/components/forms/FieldLabel';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  DATE_PICKER_DISPLAY_FORMAT,
  getManilaYmdToday,
  stringToDate,
  dateToString,
} from '@/utils/format/dates';

type Props = {
  idPrefix: string;
  kind: VerificationSectionKind;
  rights: OrgVerificationRights | '';
  onRightsChange: (value: OrgVerificationRights) => void;
  rightsError: string | null;
  contractEndDate: string;
  onContractEndDateChange: (value: string) => void;
  contractEndDateError: string | null;
  /** Override the rights field label (defaults to Property Rights / Parking Rights). */
  roleLabel?: string;
  rolePlaceholder?: string;
  hideRoleHelp?: boolean;
};

export function OnboardingVerificationRightsFields({
  idPrefix,
  kind,
  rights,
  onRightsChange,
  rightsError,
  contractEndDate,
  onContractEndDateChange,
  contractEndDateError,
  roleLabel,
  rolePlaceholder,
  hideRoleHelp = false,
}: Props) {
  const showContractEnd = verificationRightsNeedsContractEnd(rights);
  const minContractEndDate = stringToDate(getManilaYmdToday());
  const rightsLabel = roleLabel ?? verificationRightsFieldLabel(kind);
  const rightsPlaceholder = rolePlaceholder ?? verificationRightsSelectPlaceholder(kind);

  return (
    <>
      <div className="space-y-2">
        {hideRoleHelp ? (
          <FieldLabel htmlFor={`${idPrefix}-rights`} label={rightsLabel} required />
        ) : (
          <VerificationFieldLabel
            htmlFor={`${idPrefix}-rights`}
            label={rightsLabel}
            help={verificationRightsFieldHelp(kind)}
            required
          />
        )}
        <Select
          value={rights || undefined}
          onValueChange={(value) => onRightsChange(value as OrgVerificationRights)}
        >
          <SelectTrigger
            id={`${idPrefix}-rights`}
            className={cn('h-10', rightsError && 'border-destructive')}
            aria-invalid={Boolean(rightsError)}
          >
            <SelectValue placeholder={rightsPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {ORG_VERIFICATION_RIGHTS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {rightsError ? (
          <p role="alert" className="text-destructive text-xs">
            {rightsError}
          </p>
        ) : null}
      </div>

      {showContractEnd ? (
        <div className="space-y-1.5">
          <VerificationFieldLabel
            htmlFor={`${idPrefix}-contract-end`}
            label="Contract end date"
            help={
              kind === 'parking'
                ? 'When your parking authorization, lease, or sublease ends. We will require verification again after this date incase you renew your authorization.'
                : 'When your property authorization, lease, or sublease ends. We will require verification again after this date incase you renew your authorization.'
            }
            required
          />
          <DatePicker
            date={contractEndDate ? stringToDate(contractEndDate) : undefined}
            minDate={minContractEndDate}
            placeholder={DATE_PICKER_DISPLAY_FORMAT}
            onSelect={(date) => {
              onContractEndDateChange(date ? dateToString(date) : '');
            }}
            className={cn(contractEndDateError && 'border-destructive')}
          />
          {contractEndDateError ? (
            <p role="alert" className="text-destructive text-xs">
              {contractEndDateError}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
