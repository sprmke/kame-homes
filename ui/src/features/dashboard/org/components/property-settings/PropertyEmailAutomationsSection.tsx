import { Mail } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import type { AppSettingsFormValues } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { PropertyEmailAutomationTogglePanel } from '@/features/dashboard/org/components/property-settings/PropertyEmailAutomationTogglePanel';
import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  PROPERTY_AUTOMATION_TOGGLE_KEYS,
  SD_REFUND_CRON_EMAIL_LEAD_MAX_HOURS,
  type PropertyAutomationToggleKey,
} from '@/features/dashboard/org/lib/propertyEmailAutomation';
import { getEmailAutomationDefaults } from '@/features/dashboard/org/lib/propertyEmailAutomationDefaults';
import { DEFAULT_RESIDENCE_NAME } from '@/features/dashboard/org/lib/propertyDisplay';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { Input } from '@/components/ui/input';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { cn } from '@/lib/utils';

function SettingsSubsection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="min-w-0 space-y-1">
        <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
          {title}
        </h3>
        {description ? (
          <p className="text-muted-foreground text-xs leading-snug">{description}</p>
        ) : null}
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

export function PropertyEmailAutomationsSection({
  draft,
  residenceName,
  disabled,
  resolveFieldError,
  markFieldInteracted,
  onChange,
  onAutomationToggleChange,
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
}) {
  const effectiveResidence = residenceName.trim() || DEFAULT_RESIDENCE_NAME;
  const copy = getEmailAutomationDefaults(effectiveResidence);
  const fieldError = resolveFieldError;
  const { allowed: automatedBookingFlowAllowed } = useFeatureGate('automatedBookingFlow');

  const enabledSendCount = PROPERTY_AUTOMATION_TOGGLE_KEYS.filter(
    (key) => draft.automationToggles[key]
  ).length;
  const totalSendCount = PROPERTY_AUTOMATION_TOGGLE_KEYS.length;

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
      description="Who gets workflow emails and when."
    >
      <div className="space-y-6">
        <SettingsSubsection title="Recipients">
          <FieldGrid>
            <SettingsField
              id="email-reply-to"
              label="Team email"
              help="Gets new booking alerts and is the Reply-To on guest emails."
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
            <SettingsField
              id="building-admin-email"
              label="Building admin email"
              help="Set by your residence. Empty means GAF and pet emails cannot send."
            >
              <Input
                id="building-admin-email"
                type="email"
                autoComplete="off"
                readOnly
                value={draft.emailTo}
                placeholder="Not set"
                className="bg-muted/40 h-10 cursor-default"
                aria-readonly="true"
              />
            </SettingsField>
          </FieldGrid>
        </SettingsSubsection>

        <SettingsDivider />

        <SettingsSubsection
          title="Check-out email"
          description="When guests get the check-out and deposit refund email."
        >
          <FieldGrid>
            <SettingsField
              id="sd-lead-hours"
              label="Send check-out email"
              help="Guests get the check-out steps and the security deposit refund form this many hours before check-out."
              error={fieldError('sd-lead-hours')}
            >
              <div className="flex items-center gap-2">
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
                <span className="text-muted-foreground shrink-0 text-xs">hours before check-out</span>
              </div>
            </SettingsField>
            <SettingsField
              id="sd-max-age"
              label="Skip if check-out was over"
              help="Stops the check-out email for old stays, for example after an import. 0 means never skip. Does not affect review emails."
              error={fieldError('sd-max-age')}
            >
              <div className="flex items-center gap-2">
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
                <span className="text-muted-foreground shrink-0 text-xs">days ago</span>
              </div>
            </SettingsField>
          </FieldGrid>
        </SettingsSubsection>

        <SettingsDivider />

        <SettingsSubsection
          title="Automated sends"
          description={`${enabledSendCount} of ${totalSendCount} on`}
        >
          <PropertyEmailAutomationTogglePanel
            draft={draft}
            disabled={disabled}
            automatedBookingFlowAllowed={automatedBookingFlowAllowed}
            onToggleChange={onAutomationToggleChange}
          />
        </SettingsSubsection>
      </div>
    </AdminSection>
  );
}
