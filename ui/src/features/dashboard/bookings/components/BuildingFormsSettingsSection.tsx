import { useCallback, useEffect, useRef, useState } from 'react';

import { FileText, PawPrint } from 'lucide-react';

import { GafOwnerSignatureUploadField } from '@/features/dashboard/bookings/components/GafOwnerSignatureUploadField';
import { GafPdfPreview } from '@/features/dashboard/bookings/components/GafPdfPreview';
import { PetPdfPreview } from '@/features/dashboard/bookings/components/PetPdfPreview';
import type { GafDetailsValues } from '@/features/dashboard/bookings/lib/gafDefaults';
import type { PetDetailsValues } from '@/features/dashboard/bookings/lib/petDefaults';
import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/sliding-tabs';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { cn } from '@/lib/utils';

type PreviewTab = 'gaf' | 'pet';

const PREVIEW_TABS: {
  value: PreviewTab;
  label: string;
  shortLabel: string;
  Icon: typeof FileText;
}[] = [
  {
    value: 'gaf',
    label: 'Guest Advisory Form',
    shortLabel: 'GAF',
    Icon: FileText,
  },
  {
    value: 'pet',
    label: 'Pet Registration',
    shortLabel: 'Pet',
    Icon: PawPrint,
  },
];

type BuildingFormsSettingsSectionProps = {
  values: GafDetailsValues;
  towerUnitLabel: string;
  signatureImageUrl: string | null;
  disabled?: boolean;
  onChange: <K extends keyof GafDetailsValues>(key: K, value: GafDetailsValues[K]) => void;
  onSignatureInteracted?: () => void;
  resolveFieldError: (fieldId: string) => string | null;
};

/** Compact card summary — opens Manage modal from the settings page. */
export function BuildingFormsSettingsSummary({
  values,
  towerUnitLabel,
  signatureConfigured,
  disabled,
  onManage,
}: {
  values: GafDetailsValues;
  towerUnitLabel: string;
  signatureConfigured: boolean;
  disabled?: boolean;
  onManage: () => void;
}) {
  const owner = values.gafUnitOwner.trim() || 'No unit owner';
  const unit = towerUnitLabel.trim() || 'No tower & unit';
  const contact = values.gafGuestsOnsiteContactPerson.trim();
  const phone = values.gafOwnerContactNumber.trim();
  const detailParts = [
    contact || null,
    phone || null,
    signatureConfigured ? 'Signature on file' : 'Signature missing',
  ].filter(Boolean);

  return (
    <div className="bg-muted/40 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-foreground min-w-0 truncate text-xs font-medium sm:text-sm">
          {owner}
          <span className="text-muted-foreground font-normal"> · </span>
          {unit}
        </p>
        {detailParts.length > 0 ? (
          <p className="text-muted-foreground min-w-0 truncate text-[11px] sm:text-xs">
            {detailParts.join(' · ')}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="settings-action shrink-0"
        disabled={disabled}
        onClick={onManage}
      >
        Manage
      </Button>
    </div>
  );
}

function BuildingFormField({
  id,
  label,
  disabled,
  readOnly = false,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  error,
}: {
  id: string;
  label: string;
  disabled?: boolean;
  readOnly?: boolean;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  error?: string | null;
}) {
  return (
    <SettingsField id={id} label={label} required={required} error={error}>
      <Input
        id={id}
        type={type}
        autoComplete="off"
        disabled={disabled}
        readOnly={readOnly}
        value={value}
        onChange={readOnly ? undefined : (event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={cn(error && 'border-destructive', readOnly && 'bg-muted/30 cursor-default')}
      />
    </SettingsField>
  );
}

export function BuildingFormsSettingsSection({
  values,
  towerUnitLabel,
  signatureImageUrl,
  disabled,
  onChange,
  onSignatureInteracted,
  resolveFieldError,
}: BuildingFormsSettingsSectionProps) {
  const fieldError = resolveFieldError;

  const [previewTab, setPreviewTab] = useState<PreviewTab>('gaf');
  const [signaturePreviewOverride, setSignaturePreviewOverrideState] = useState<string | null>(
    null
  );
  const signaturePreviewOverrideRef = useRef<string | null>(null);

  const setSignaturePreviewOverride = useCallback((url: string | null) => {
    const previous = signaturePreviewOverrideRef.current;
    if (previous?.startsWith('blob:') && previous !== url) {
      URL.revokeObjectURL(previous);
    }
    signaturePreviewOverrideRef.current = url;
    setSignaturePreviewOverrideState(url);
  }, []);

  useEffect(() => {
    return () => {
      const pending = signaturePreviewOverrideRef.current;
      if (pending?.startsWith('blob:')) {
        URL.revokeObjectURL(pending);
      }
    };
  }, []);

  const effectiveSignatureUrl = signaturePreviewOverride ?? signatureImageUrl;

  const handleSignatureSaved = useCallback(
    (url: string) => {
      setSignaturePreviewOverride(url);
      onSignatureInteracted?.();
    },
    [onSignatureInteracted, setSignaturePreviewOverride]
  );

  const petValues: PetDetailsValues = {
    gafUnitOwner: values.gafUnitOwner,
    gafTowerAndUnitNumber: values.gafTowerAndUnitNumber,
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,34%)_minmax(0,66%)] lg:gap-8">
      <div className="min-w-0 space-y-4 lg:max-w-md">
        <BuildingFormField
          id="gaf-unit-owner"
          label="Unit Owner"
          required
          error={fieldError('gaf-unit-owner')}
          disabled={disabled}
          value={values.gafUnitOwner}
          onChange={(value) => onChange('gafUnitOwner', value)}
          placeholder={FORM_PLACEHOLDERS.fullName}
        />
        <BuildingFormField
          id="gaf-tower-unit"
          label="Tower & Unit Number"
          required
          readOnly
          error={fieldError('gaf-tower-unit')}
          disabled={disabled}
          value={towerUnitLabel}
          placeholder={FORM_PLACEHOLDERS.towerAndUnit}
        />
        <BuildingFormField
          id="gaf-onsite-contact"
          label="On-Site Contact Person"
          required
          error={fieldError('gaf-onsite-contact')}
          disabled={disabled}
          value={values.gafGuestsOnsiteContactPerson}
          onChange={(value) => onChange('gafGuestsOnsiteContactPerson', value)}
          placeholder={FORM_PLACEHOLDERS.fullName}
        />
        <BuildingFormField
          id="gaf-owner-phone"
          label="Contact No."
          required
          error={fieldError('gaf-owner-phone')}
          disabled={disabled}
          type="tel"
          value={values.gafOwnerContactNumber}
          onChange={(value) => onChange('gafOwnerContactNumber', value)}
          placeholder={FORM_PLACEHOLDERS.phone}
        />
        <GafOwnerSignatureUploadField
          disabled={disabled}
          storedSignatureUrl={signatureImageUrl}
          currentSignatureUrl={effectiveSignatureUrl}
          required
          error={fieldError('gaf-owner-signature')}
          onSignatureSaved={handleSignatureSaved}
          onPreviewUrlChange={setSignaturePreviewOverride}
        />
      </div>

      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <SegmentedControl
          value={previewTab}
          onChange={setPreviewTab}
          size="dense"
          fullWidth
          aria-label="PDF preview"
          className="mb-3 w-full max-w-full sm:max-w-md"
          options={PREVIEW_TABS.map(({ value, label, shortLabel, Icon }) => ({
            value,
            ariaLabel: label,
            icon: Icon,
            label: (
              <>
                <span className="truncate sm:hidden">{shortLabel}</span>
                <span className="hidden truncate sm:inline">{label}</span>
              </>
            ),
          }))}
        />

        <div
          role="tabpanel"
          id={`building-form-preview-panel-${previewTab}`}
          aria-label={PREVIEW_TABS.find((tab) => tab.value === previewTab)?.label ?? 'PDF preview'}
        >
          {previewTab === 'gaf' ? (
            <GafPdfPreview details={values} signatureUrl={effectiveSignatureUrl} />
          ) : (
            <PetPdfPreview details={petValues} signatureUrl={effectiveSignatureUrl} />
          )}
        </div>
      </div>
    </div>
  );
}
