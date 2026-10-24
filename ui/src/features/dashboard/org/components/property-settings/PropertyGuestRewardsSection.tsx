import { Gift } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import type { AppSettingsFormValues } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { PropertyExternalReviewsBlock } from '@/features/dashboard/org/components/property-settings/PropertyExternalReviewsBlock';
import { PropertySettingsSectionAlert } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import { PropertyVoucherSettingsBlock } from '@/features/dashboard/org/components/property-settings/PropertyVoucherSettingsBlock';
import type { PropertyExternalReview } from '@/features/dashboard/org/lib/propertyExternalReviews';
import type { PropertySettingsSectionId } from '@/features/dashboard/org/lib/propertySettingsCompletion';
import { propertySettingsSectionHasIssue } from '@/features/dashboard/org/lib/propertySettingsCompletion';
import { propertySettingsSectionBanner } from '@/features/dashboard/org/lib/propertySettingsFieldError';

export function PropertyGuestRewardsSection({
  draft,
  disabled,
  resolveFieldError,
  markFieldInteracted,
  onChange,
  sectionMessages,
  issueSectionIds = [],
  onSaveReview,
  savingReviewId,
  externalReviewsBaseline,
}: {
  draft: AppSettingsFormValues;
  externalReviewsBaseline: PropertyExternalReview[];
  disabled?: boolean;
  resolveFieldError: (fieldId: string) => string | null;
  markFieldInteracted: (fieldId: string) => void;
  onChange: <K extends keyof AppSettingsFormValues>(
    key: K,
    value: AppSettingsFormValues[K]
  ) => void;
  sectionMessages: Partial<Record<PropertySettingsSectionId, string>>;
  issueSectionIds?: readonly PropertySettingsSectionId[];
  onSaveReview?: (reviewId: string) => void;
  savingReviewId?: string | null;
}) {
  return (
    <AdminSection id="guest-rewards" title="Reviews & vouchers" icon={Gift}>
      {propertySettingsSectionBanner('guest-rewards', sectionMessages) ? (
        <PropertySettingsSectionAlert
          message={propertySettingsSectionBanner('guest-rewards', sectionMessages)!}
        />
      ) : null}

      <div className="space-y-2">
        <PropertyExternalReviewsBlock
          reviews={draft.externalReviews}
          baselineReviews={externalReviewsBaseline}
          disabled={disabled}
          onReviewsChange={(reviews) => onChange('externalReviews', reviews)}
          onInteract={() => markFieldInteracted('property-external-reviews')}
          onSaveReview={onSaveReview}
          savingReviewId={savingReviewId}
        />

        <div className="space-y-1.5">
          <PropertyVoucherSettingsBlock
            enabled={draft.vouchersEnabled}
            prizes={draft.voucherPrizes}
            revealStyle={draft.voucherRevealStyle}
            disabled={disabled}
            onEnabledChange={(enabled) => onChange('vouchersEnabled', enabled)}
            onPrizesChange={(prizes) => onChange('voucherPrizes', prizes)}
            onRevealStyleChange={(style) => onChange('voucherRevealStyle', style)}
            onInteract={() => markFieldInteracted('property-vouchers')}
            manageNeedsAttention={propertySettingsSectionHasIssue('guest-rewards', issueSectionIds)}
          />
          {resolveFieldError('property-vouchers') ? (
            <p className="text-destructive text-xs">{resolveFieldError('property-vouchers')}</p>
          ) : null}
        </div>
      </div>
    </AdminSection>
  );
}
