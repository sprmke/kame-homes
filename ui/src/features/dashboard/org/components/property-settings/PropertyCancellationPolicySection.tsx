import { useState, type ReactNode } from 'react';

import { Check, Shield } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import {
  LimitedCountInput,
  SettingsField,
} from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  CANCELLATION_DAYS_BEFORE_OPTIONS,
  CANCELLATION_GRACE_HOUR_OPTIONS,
  CANCELLATION_PARTIAL_PERCENT_OPTIONS,
  CANCELLATION_POLICY_CUSTOM_DESCRIPTION_MAX,
  CANCELLATION_POLICY_CUSTOM_TITLE_MAX,
  CANCELLATION_POLICY_PRESETS,
  normalizeCancellationPolicySettings,
  resolveCancellationPolicyDisplay,
  type CancellationPolicySettings,
  type CancellationPolicyType,
} from '@/features/dashboard/org/lib/propertyCancellationPolicy';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Props = {
  policy: CancellationPolicySettings;
  disabled?: boolean;
  resolveFieldError: (fieldId: string) => string | null;
  markFieldInteracted: (fieldId: string) => void;
  onChange: (policy: CancellationPolicySettings) => void;
  /** When true, render controls only (no AdminSection card) for Page Editor. */
  embedded?: boolean;
};

function graceLabel(hours: number): string {
  if (hours === 168) return '7 days';
  return `${hours} hours`;
}

function CancellationPolicyPreview({
  policy,
  action,
}: {
  policy: CancellationPolicySettings;
  action?: ReactNode;
}) {
  const display = resolveCancellationPolicyDisplay(policy);
  const toneClasses =
    display.tone === 'positive'
      ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/50'
      : display.tone === 'warning'
        ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
        : 'border-border bg-muted/40';

  const textClasses =
    display.tone === 'positive'
      ? 'text-green-800 dark:text-green-300'
      : display.tone === 'warning'
        ? 'text-amber-900 dark:text-amber-200'
        : 'text-foreground';

  const subtextClasses =
    display.tone === 'positive'
      ? 'text-green-700 dark:text-green-400'
      : display.tone === 'warning'
        ? 'text-amber-800 dark:text-amber-300'
        : 'text-muted-foreground';

  return (
    <div className={cn('rounded-lg border p-3 sm:p-4', toneClasses)}>
      <div className="flex items-start gap-2.5">
        <Check className={cn('mt-0.5 size-4 shrink-0', subtextClasses)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-xs font-semibold leading-snug sm:text-sm sm:font-medium',
              textClasses
            )}
          >
            {display.title}
          </p>
          <p className={cn('mt-0.5 text-xs leading-snug', subtextClasses)}>{display.description}</p>
        </div>
        {action ? <div className="shrink-0 self-center">{action}</div> : null}
      </div>
    </div>
  );
}

export function PropertyCancellationPolicySection({
  policy,
  disabled,
  resolveFieldError,
  markFieldInteracted,
  onChange,
  embedded = false,
}: Props) {
  const [manageOpen, setManageOpen] = useState(false);
  const normalized = normalizeCancellationPolicySettings(policy);

  const setType = (type: CancellationPolicyType) => {
    const next: CancellationPolicySettings = { type };
    if (type === 'grace_period' || type === 'moderate') {
      next.gracePeriodHours = normalized.gracePeriodHours ?? 48;
    }
    if (
      type === 'full_before_checkin' ||
      type === 'moderate' ||
      type === 'partial_before_checkin'
    ) {
      next.daysBeforeCheckIn = normalized.daysBeforeCheckIn ?? (type === 'moderate' ? 5 : 7);
    }
    if (type === 'partial_before_checkin') {
      next.partialRefundPercent = normalized.partialRefundPercent ?? 50;
    }
    if (type === 'custom') {
      next.customTitle = normalized.customTitle ?? '';
      next.customDescription = normalized.customDescription ?? '';
    }
    onChange(next);
  };

  const patch = (partial: Partial<CancellationPolicySettings>) => {
    onChange(normalizeCancellationPolicySettings({ ...normalized, ...partial }));
  };

  const customTitleError = resolveFieldError('cancellation-custom-title');
  const customDescriptionError = resolveFieldError('cancellation-custom-description');

  const formFields = (
    <>
      <RadioGroup
        value={normalized.type}
        onValueChange={(value) => setType(value as CancellationPolicyType)}
        disabled={disabled}
        className="space-y-3"
      >
        {CANCELLATION_POLICY_PRESETS.map((preset) => {
          const selected = normalized.type === preset.type;
          return (
            <label
              key={preset.type}
              className={cn(
                'flex min-h-[44px] cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
                selected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:bg-muted/30',
                disabled && 'cursor-not-allowed opacity-60'
              )}
            >
              <RadioGroupItem value={preset.type} disabled={disabled} className="mt-1" />
              <span className="min-w-0 space-y-1">
                <span className="block text-sm font-medium">{preset.label}</span>
                <span className="text-muted-foreground block text-sm">{preset.summary}</span>
              </span>
            </label>
          );
        })}
      </RadioGroup>

      {normalized.type === 'grace_period' || normalized.type === 'moderate' ? (
        <SettingsField id="cancellation-grace-hours" label="Free cancellation window">
          <Select
            value={String(normalized.gracePeriodHours ?? 48)}
            onValueChange={(value) => patch({ gracePeriodHours: Number(value) })}
            disabled={disabled}
          >
            <SelectTrigger id="cancellation-grace-hours" className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANCELLATION_GRACE_HOUR_OPTIONS.map((hours) => (
                <SelectItem key={hours} value={String(hours)}>
                  {graceLabel(hours)} after booking
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      ) : null}

      {normalized.type === 'full_before_checkin' ||
      normalized.type === 'moderate' ||
      normalized.type === 'partial_before_checkin' ? (
        <SettingsField id="cancellation-days-before" label="Deadline before check-in">
          <Select
            value={String(normalized.daysBeforeCheckIn ?? (normalized.type === 'moderate' ? 5 : 7))}
            onValueChange={(value) => patch({ daysBeforeCheckIn: Number(value) })}
            disabled={disabled}
          >
            <SelectTrigger id="cancellation-days-before" className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANCELLATION_DAYS_BEFORE_OPTIONS.map((days) => (
                <SelectItem key={days} value={String(days)}>
                  {days === 1 ? '1 day' : `${days} days`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      ) : null}

      {normalized.type === 'partial_before_checkin' ? (
        <SettingsField id="cancellation-partial-percent" label="Refund amount">
          <Select
            value={String(normalized.partialRefundPercent ?? 50)}
            onValueChange={(value) => patch({ partialRefundPercent: Number(value) })}
            disabled={disabled}
          >
            <SelectTrigger id="cancellation-partial-percent" className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CANCELLATION_PARTIAL_PERCENT_OPTIONS.map((percent) => (
                <SelectItem key={percent} value={String(percent)}>
                  {percent}% refund
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      ) : null}

      {normalized.type === 'custom' ? (
        <div className="space-y-4">
          <SettingsField
            id="cancellation-custom-title"
            label="Guest-facing title"
            required
            error={customTitleError}
          >
            <LimitedCountInput
              id="cancellation-custom-title"
              value={normalized.customTitle ?? ''}
              maxLength={CANCELLATION_POLICY_CUSTOM_TITLE_MAX}
              disabled={disabled}
              onChange={(event) => {
                markFieldInteracted('cancellation-custom-title');
                patch({ customTitle: event.target.value });
              }}
              aria-invalid={Boolean(customTitleError)}
              className={cn(customTitleError && 'border-destructive')}
            />
          </SettingsField>

          <SettingsField
            id="cancellation-custom-description"
            label="Guest-facing description"
            required
            error={customDescriptionError}
          >
            <div className="relative">
              <Textarea
                id="cancellation-custom-description"
                value={normalized.customDescription ?? ''}
                maxLength={CANCELLATION_POLICY_CUSTOM_DESCRIPTION_MAX}
                disabled={disabled}
                rows={4}
                onChange={(event) => {
                  markFieldInteracted('cancellation-custom-description');
                  patch({ customDescription: event.target.value });
                }}
                aria-invalid={Boolean(customDescriptionError)}
                className={cn(
                  'min-h-[120px] resize-y pr-14',
                  customDescriptionError && 'border-destructive'
                )}
              />
              <span className="text-muted-foreground pointer-events-none absolute bottom-3 right-3 text-xs tabular-nums">
                {(normalized.customDescription ?? '').length}/
                {CANCELLATION_POLICY_CUSTOM_DESCRIPTION_MAX}
              </span>
            </div>
          </SettingsField>
        </div>
      ) : null}
    </>
  );

  const guestPreviewBlock = (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Guest preview</Label>
      <CancellationPolicyPreview policy={normalized} />
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-4 px-4 py-3">
        {formFields}
        {guestPreviewBlock}
      </div>
    );
  }

  return (
    <AdminSection
      id="cancellation"
      title="Cancellation policy"
      icon={Shield}
      description="Refund rules when a guest cancels."
    >
      <CancellationPolicyPreview
        policy={normalized}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="settings-action"
            onClick={() => setManageOpen(true)}
          >
            Manage
          </Button>
        }
      />

      <ResponsiveModal open={manageOpen} onOpenChange={setManageOpen}>
        <ResponsiveModalContent
          sheetLayout="split"
          className={cn(
            'flex max-h-[min(92dvh,52rem)] w-[min(calc(100vw-1.5rem),40rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,40rem)] sm:p-0'
          )}
        >
          <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5 sm:py-4">
            <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
              Cancellation policy
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
            {formFields}
            {guestPreviewBlock}
          </div>

          <ResponsiveModalFooter className="border-border/60 shrink-0 border-t px-4 py-3 sm:px-5">
            <Button
              type="button"
              className="min-h-[44px] w-full sm:ml-auto sm:w-auto"
              onClick={() => setManageOpen(false)}
            >
              Save
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </AdminSection>
  );
}
