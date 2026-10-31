import { useState, type ReactNode } from 'react';

import { Mail } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import type { AppSettingsFormValues } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { PropertyEmailAutomationTogglePanel } from '@/features/dashboard/org/components/property-settings/PropertyEmailAutomationTogglePanel';
import {
  SettingsField,
  SettingsManageButton,
} from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  propertySettingsSectionHasIssue,
  type PropertySettingsSectionId,
} from '@/features/dashboard/org/lib/propertySettingsCompletion';
import { DEFAULT_RESIDENCE_NAME } from '@/features/dashboard/org/lib/propertyDisplay';
import {
  PROPERTY_AUTOMATION_TOGGLE_GROUPS,
  SD_REFUND_CRON_EMAIL_LEAD_MAX_HOURS,
  type PropertyAutomationToggleKey,
} from '@/features/dashboard/org/lib/propertyEmailAutomation';
import { getEmailAutomationDefaults } from '@/features/dashboard/org/lib/propertyEmailAutomationDefaults';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { cn } from '@/lib/utils';

function SettingsSubsection({
  title,
  description,
  headerAction,
  children,
}: {
  title: string;
  description?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className={cn(headerAction && 'flex flex-row items-start justify-between gap-3')}>
        <div className="min-w-0 space-y-1">
          <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
            {title}
          </h3>
          {description ? (
            <p className="text-muted-foreground text-xs leading-snug">{description}</p>
          ) : null}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      {children}
    </div>
  );
}

function SettingsDivider() {
  return <div className="border-border/50 border-t" role="presentation" />;
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5 lg:grid-cols-2 lg:gap-x-5">
      {children}
    </div>
  );
}

function FieldSpan({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0 lg:col-span-2">{children}</div>;
}

const AUTOMATION_TOGGLE_KEYS = PROPERTY_AUTOMATION_TOGGLE_GROUPS.flatMap((group) =>
  group.items.map((item) => item.key)
);

export function PropertyEmailAutomationsSection({
  draft,
  residenceName,
  disabled,
  resolveFieldError,
  markFieldInteracted,
  onChange,
  onAutomationToggleChange,
  issueSectionIds = [],
}: {
  draft: AppSettingsFormValues;
  residenceName: string;
  disabled: boolean;
  resolveFieldError: (fieldId: string) => string | null;
  markFieldInteracted: (fieldId: string) => void;
  onChange: <K extends keyof AppSettingsFormValues>(
    key: K,
    value: AppSettingsFormValues[K]
  ) => void;
  onAutomationToggleChange: (key: PropertyAutomationToggleKey, value: boolean) => void;
  issueSectionIds?: readonly PropertySettingsSectionId[];
}) {
  const [automatedSendsOpen, setAutomatedSendsOpen] = useState(false);
  const effectiveResidence = residenceName.trim() || DEFAULT_RESIDENCE_NAME;
  const copy = getEmailAutomationDefaults(effectiveResidence);
  const fieldError = resolveFieldError;
  const { allowed: automatedBookingFlowAllowed } = useFeatureGate('automatedBookingFlow');

  const enabledSendCount = AUTOMATION_TOGGLE_KEYS.filter(
    (key) => draft.automationToggles[key]
  ).length;
  const totalSendCount = AUTOMATION_TOGGLE_KEYS.length;

  const setField = <K extends keyof AppSettingsFormValues>(
    key: K,
    value: AppSettingsFormValues[K],
    fieldId: string
  ) => {
    markFieldInteracted(fieldId);
    onChange(key, value);
  };

  return (
    <AdminSection
      id="email-automations"
      title="Email automations"
      icon={Mail}
      badge={<TierBadge feature="automatedBookingFlow" />}
      description="Workflow email recipients and send timing."
    >
      <div className="space-y-6">
        <SettingsSubsection
          title="Recipients"
          description="Team inbox for workflow mail. Guest mail uses each booking."
        >
          <FieldGrid>
            <SettingsField
              id="email-reply-to"
              label={copy.propertyEmailLabel}
              help={copy.propertyEmailHint}
              required
              error={fieldError('email-reply-to')}
            >
              <Input
                id="email-reply-to"
                type="email"
                autoComplete="off"
                disabled={disabled}
                value={draft.emailReplyTo}
                onChange={(event) => setField('emailReplyTo', event.target.value, 'email-reply-to')}
                placeholder={copy.propertyEmailPlaceholder}
                className={cn('h-10', fieldError('email-reply-to') && 'border-destructive')}
                aria-invalid={Boolean(fieldError('email-reply-to'))}
              />
            </SettingsField>
            <FieldSpan>
              <SettingsField
                id="parking-owner-emails"
                label="Parking owners"
                help="Comma-separated BCC list for parking broadcast emails."
                error={fieldError('parking-owner-emails')}
              >
                <Input
                  id="parking-owner-emails"
                  disabled={disabled}
                  value={draft.parkingOwnerEmails}
                  onChange={(event) =>
                    setField('parkingOwnerEmails', event.target.value, 'parking-owner-emails')
                  }
                  placeholder={FORM_PLACEHOLDERS.orgParkingOwners}
                  className={cn('h-10', fieldError('parking-owner-emails') && 'border-destructive')}
                  aria-invalid={Boolean(fieldError('parking-owner-emails'))}
                />
              </SettingsField>
            </FieldSpan>
          </FieldGrid>
        </SettingsSubsection>

        <SettingsDivider />

        <SettingsSubsection
          title="Check-out timing & defaults"
          description="Check-out email timing and default parking rate."
        >
          <FieldGrid>
            <SettingsField
              id="sd-lead-hours"
              label="SD refund email lead (hours)"
              help="Hours before checkout the guest receives the check-out and SD refund email."
              error={fieldError('sd-lead-hours')}
            >
              <Input
                id="sd-lead-hours"
                type="number"
                min={0}
                max={SD_REFUND_CRON_EMAIL_LEAD_MAX_HOURS}
                step={0.5}
                disabled={disabled}
                value={draft.sdRefundCronEmailLeadHours}
                onChange={(event) =>
                  setField(
                    'sdRefundCronEmailLeadHours',
                    Number(event.target.value) || 0,
                    'sd-lead-hours'
                  )
                }
                placeholder={FORM_PLACEHOLDERS.orgSdRefundLeadHours}
                className={cn('h-10', fieldError('sd-lead-hours') && 'border-destructive')}
                aria-invalid={Boolean(fieldError('sd-lead-hours'))}
              />
            </SettingsField>
            <SettingsField
              id="sd-max-age"
              label="Days after checkout to stop guest emails"
              help="Skips automated check-out emails for stale stays. 0 = no limit."
              error={fieldError('sd-max-age')}
            >
              <Input
                id="sd-max-age"
                type="number"
                min={0}
                max={365}
                disabled={disabled}
                value={draft.sdRefundCronMaxCheckoutAgeDays}
                onChange={(event) =>
                  setField(
                    'sdRefundCronMaxCheckoutAgeDays',
                    Number(event.target.value) || 0,
                    'sd-max-age'
                  )
                }
                placeholder={FORM_PLACEHOLDERS.orgStaleCheckoutEmailCutoffDays}
                className={cn('h-10', fieldError('sd-max-age') && 'border-destructive')}
                aria-invalid={Boolean(fieldError('sd-max-age'))}
              />
            </SettingsField>
          </FieldGrid>
        </SettingsSubsection>

        <SettingsDivider />

        <SettingsSubsection
          title="Automated sends"
          description="Turn each workflow email on or off."
        >
          <div className="bg-muted/40 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="min-w-0 text-xs font-medium sm:text-sm">
              {enabledSendCount} of {totalSendCount} email automations enabled
            </p>
            <SettingsManageButton
              needsAttention={propertySettingsSectionHasIssue('email-automations', issueSectionIds)}
              onClick={() => setAutomatedSendsOpen(true)}
            />
          </div>

          <ResponsiveModal open={automatedSendsOpen} onOpenChange={setAutomatedSendsOpen}>
            <ResponsiveModalContent
              sheetLayout="split"
              className={cn(
                'flex max-h-[min(92dvh,52rem)] w-[min(calc(100vw-1.5rem),40rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,40rem)] sm:p-0'
              )}
            >
              <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5 sm:py-4">
                <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
                  Automated sends
                </ResponsiveModalTitle>
              </ResponsiveModalHeader>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
                <PropertyEmailAutomationTogglePanel
                  draft={draft}
                  disabled={disabled}
                  automatedBookingFlowAllowed={automatedBookingFlowAllowed}
                  onToggleChange={onAutomationToggleChange}
                />
              </div>

              <ResponsiveModalFooter className="border-border/60 shrink-0 border-t px-4 py-3 sm:px-5">
                <Button
                  type="button"
                  className="min-h-[44px] w-full sm:ml-auto sm:w-auto"
                  onClick={() => setAutomatedSendsOpen(false)}
                >
                  Save
                </Button>
              </ResponsiveModalFooter>
            </ResponsiveModalContent>
          </ResponsiveModal>
        </SettingsSubsection>
      </div>
    </AdminSection>
  );
}
