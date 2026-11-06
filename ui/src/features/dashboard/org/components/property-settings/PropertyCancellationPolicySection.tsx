import { useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { Check, Plus, Shield, Trash2 } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import {
  SettingsField,
  SettingsManageButton,
} from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  CANCELLATION_GRACE_HOUR_OPTIONS,
  CANCELLATION_MIN_LEAD_DAY_OPTIONS,
  CANCELLATION_POLICY_MAX_TIERS,
  CANCELLATION_POLICY_NOTE_MAX,
  CANCELLATION_PRESETS,
  buildCancellationPreset,
  cancellationPolicyEqual,
  resolveCancellationPolicyDisplay,
  validateCancellationPolicy,
  type CancellationFeeRule,
  type CancellationPolicy,
  type CancellationPresetId,
  type CancellationTier,
} from '@/features/dashboard/org/lib/cancellationPolicy';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Props = {
  policy: CancellationPolicy | null;
  disabled?: boolean;
  resolveFieldError: (fieldId: string) => string | null;
  markFieldInteracted: (fieldId: string) => void;
  onChange: (policy: CancellationPolicy | null) => void;
  /** When true, render controls only (no AdminSection card) for Page Editor. */
  embedded?: boolean;
  manageNeedsAttention?: boolean;
  /** Upcoming bookings that keep their existing policy. */
  upcomingBookingsCount?: number;
};

function graceLabel(hours: number): string {
  return hours === 168 ? '7 days' : `${hours} hours`;
}

function daysLabel(days: number): string {
  if (days === 0) return 'check-in day';
  return days === 1 ? '1 day' : `${days} days`;
}

function TimelinePreview({ policy }: { policy: CancellationPolicy }) {
  const sampleCheckIn = useMemo(() => addDays(new Date(), 30), []);
  const rows = policy.tiers.map((tier) => ({
    ...tier,
    deadline: addDays(sampleCheckIn, -tier.daysBefore),
  }));

  return (
    <div className="bg-muted/40 space-y-3 rounded-2xl p-4">
      <p className="text-muted-foreground text-xs">
        Example check-in {format(sampleCheckIn, 'MMM d, yyyy')}
      </p>
      {policy.grace?.enabled ? (
        <div className="flex items-start gap-2 text-sm">
          <span className="mt-0.5 size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          <span>
            <span className="font-medium">100% of paid</span> within {graceLabel(policy.grace.hours)} of
            booking
            {policy.grace.minLeadDays > 0
              ? `, when booked at least ${daysLabel(policy.grace.minLeadDays)} ahead`
              : ''}
          </span>
        </div>
      ) : null}
      {rows.length === 0 && !policy.grace?.enabled ? (
        <p className="text-sm font-medium">No refund after booking.</p>
      ) : null}
      {rows.map((row) => (
        <div key={row.daysBefore} className="flex items-start gap-2 text-sm">
          <span
            className={cn(
              'mt-0.5 size-2 shrink-0 rounded-full',
              row.refundPercent >= 100
                ? 'bg-emerald-500'
                : row.refundPercent > 0
                  ? 'bg-amber-500'
                  : 'bg-muted-foreground/50'
            )}
            aria-hidden
          />
          <span>
            <span className="font-medium">{row.refundPercent}% of paid</span> until{' '}
            {format(row.deadline, 'MMM d, yyyy')} ({daysLabel(row.daysBefore)} before)
          </span>
        </div>
      ))}
      {rows.length > 0 && policy.fallbackRefundPercent > 0 ? (
        <div className="flex items-start gap-2 text-sm">
          <span className="bg-muted-foreground/50 mt-0.5 size-2 shrink-0 rounded-full" aria-hidden />
          <span>
            <span className="font-medium">{policy.fallbackRefundPercent}% of paid</span> after that
          </span>
        </div>
      ) : null}
    </div>
  );
}

function FeeRuleSelect({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: CancellationFeeRule;
  disabled?: boolean;
  onChange: (value: CancellationFeeRule) => void;
}) {
  return (
    <SettingsField id={id} label={label}>
      <Select value={value} onValueChange={(next) => onChange(next as CancellationFeeRule)} disabled={disabled}>
        <SelectTrigger id={id} className="h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="follow_policy">Follow the policy</SelectItem>
          <SelectItem value="always_refund">Always refund</SelectItem>
          <SelectItem value="never_refund">Never refund</SelectItem>
        </SelectContent>
      </Select>
    </SettingsField>
  );
}

function TierBuilder({
  policy,
  disabled,
  onChange,
}: {
  policy: CancellationPolicy;
  disabled?: boolean;
  onChange: (tiers: CancellationTier[]) => void;
}) {
  const updateTier = (index: number, patch: Partial<CancellationTier>) => {
    const next = policy.tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier));
    onChange(next);
  };

  const addTier = () => {
    if (policy.tiers.length >= CANCELLATION_POLICY_MAX_TIERS) return;
    const last = policy.tiers[policy.tiers.length - 1];
    const daysBefore = last ? Math.max(0, last.daysBefore - 7) : 7;
    onChange([...policy.tiers, { daysBefore, refundPercent: 100 }]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">Refund schedule</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="settings-action"
          onClick={addTier}
          disabled={disabled || policy.tiers.length >= CANCELLATION_POLICY_MAX_TIERS}
        >
          <Plus className="mr-1 size-3.5" aria-hidden />
          Add row
        </Button>
      </div>
      {policy.tiers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No deadline yet. Add a row or use a free cancellation window.</p>
      ) : null}
      {policy.tiers.map((tier, index) => (
        <div key={`${tier.daysBefore}-${index}`} className="flex items-end gap-2">
          <SettingsField id={`cancellation-tier-days-${index}`} label="Days before" className="w-24">
            <Input
              id={`cancellation-tier-days-${index}`}
              type="number"
              min={0}
              max={365}
              value={tier.daysBefore}
              disabled={disabled}
              onChange={(event) => updateTier(index, { daysBefore: Number(event.target.value) })}
            />
          </SettingsField>
          <SettingsField id={`cancellation-tier-percent-${index}`} label="Refund %" className="w-24">
            <Input
              id={`cancellation-tier-percent-${index}`}
              type="number"
              min={0}
              max={100}
              step={5}
              value={tier.refundPercent}
              disabled={disabled}
              onChange={(event) => updateTier(index, { refundPercent: Number(event.target.value) })}
            />
          </SettingsField>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mb-0.5 size-9 shrink-0"
            aria-label={`Remove row ${index + 1}`}
            onClick={() => onChange(policy.tiers.filter((_, i) => i !== index))}
            disabled={disabled}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ))}
    </div>
  );
}

function PolicyFields({
  policy,
  disabled,
  resolveFieldError,
  markFieldInteracted,
  onChange,
}: {
  policy: CancellationPolicy;
  disabled?: boolean;
  resolveFieldError: (fieldId: string) => string | null;
  markFieldInteracted: (fieldId: string) => void;
  onChange: (policy: CancellationPolicy) => void;
}) {
  const setPreset = (presetId: CancellationPresetId) => {
    onChange(buildCancellationPreset(presetId, policy));
  };

  const patch = (partial: Partial<CancellationPolicy>) => {
    onChange({ ...policy, ...partial });
  };

  return (
    <>
      <RadioGroup
        value={policy.presetId}
        onValueChange={(value) => setPreset(value as CancellationPresetId)}
        disabled={disabled}
        className="grid gap-2 sm:grid-cols-2"
      >
        {CANCELLATION_PRESETS.map((preset) => {
          const selected = policy.presetId === preset.id;
          return (
            <label
              key={preset.id}
              className={cn(
                'flex min-h-[44px] cursor-pointer gap-3 rounded-xl border p-3 transition-colors',
                selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:bg-muted/30',
                disabled && 'cursor-not-allowed opacity-60'
              )}
            >
              <RadioGroupItem value={preset.id} disabled={disabled} className="mt-1" />
              <span className="min-w-0 space-y-0.5">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {preset.label}
                  {preset.recommended ? (
                    <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      Popular
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground block text-xs leading-snug">{preset.summary}</span>
              </span>
            </label>
          );
        })}
      </RadioGroup>

      {policy.presetId === 'custom' ? (
        <div className="space-y-4">
          <TierBuilder
            policy={policy}
            disabled={disabled}
            onChange={(tiers) => patch({ tiers })}
          />
          <SettingsField id="cancellation-fallback" label="Refund after the last deadline">
            <Select
              value={String(policy.fallbackRefundPercent)}
              onValueChange={(value) => patch({ fallbackRefundPercent: Number(value) })}
              disabled={disabled}
            >
              <SelectTrigger id="cancellation-fallback" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 25, 50, 75, 100].map((percent) => (
                  <SelectItem key={percent} value={String(percent)}>
                    {percent}% of paid
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </div>
      ) : null}

      <TimelinePreview policy={policy} />

      <div className="border-border/70 space-y-4 border-t pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="cancellation-grace-toggle" className="text-sm font-medium">
              Free cancellation window
            </Label>
            <p className="text-muted-foreground text-xs">
              Full refund right after booking, when booked far enough ahead.
            </p>
          </div>
          <Switch
            id="cancellation-grace-toggle"
            checked={Boolean(policy.grace?.enabled)}
            disabled={disabled}
            onCheckedChange={(checked) =>
              patch({
                grace: checked
                  ? { enabled: true, hours: policy.grace?.hours ?? 24, minLeadDays: policy.grace?.minLeadDays ?? 7 }
                  : null,
              })
            }
          />
        </div>
        {policy.grace?.enabled ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsField id="cancellation-grace-hours" label="Window">
              <Select
                value={String(policy.grace.hours)}
                onValueChange={(value) =>
                  patch({ grace: { ...policy.grace!, hours: Number(value) } })
                }
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
            <SettingsField id="cancellation-grace-lead" label="Only when booked ahead">
              <Select
                value={String(policy.grace.minLeadDays)}
                onValueChange={(value) =>
                  patch({ grace: { ...policy.grace!, minLeadDays: Number(value) } })
                }
                disabled={disabled}
              >
                <SelectTrigger id="cancellation-grace-lead" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANCELLATION_MIN_LEAD_DAY_OPTIONS.map((days) => (
                    <SelectItem key={days} value={String(days)}>
                      {days === 0 ? 'No minimum' : `${daysLabel(days)} ahead`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsField>
          </div>
        ) : null}
      </div>

      <div className="border-border/70 grid gap-3 border-t pt-4 sm:grid-cols-2">
        <FeeRuleSelect
          id="cancellation-fee-pet"
          label="Pet fee"
          value={policy.feeRules.petFee}
          disabled={disabled}
          onChange={(petFee) => patch({ feeRules: { ...policy.feeRules, petFee } })}
        />
        <FeeRuleSelect
          id="cancellation-fee-additional"
          label="Additional guest fee"
          value={policy.feeRules.additionalFees}
          disabled={disabled}
          onChange={(additionalFees) => patch({ feeRules: { ...policy.feeRules, additionalFees } })}
        />
      </div>

      <div className="border-border/70 space-y-3 border-t pt-4">
        <Label className="text-sm font-medium">When a guest cancels</Label>
        <RadioGroup
          value={policy.guestCancellation}
          onValueChange={(value) => patch({ guestCancellation: value as 'instant' | 'request' })}
          disabled={disabled}
          className="gap-2"
        >
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border p-3">
            <RadioGroupItem value="instant" className="mt-1" disabled={disabled} />
            <span>
              <span className="block text-sm font-medium">Cancel right away</span>
              <span className="text-muted-foreground block text-xs">
                The booking is cancelled and the refund is recorded.
              </span>
            </span>
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border p-3">
            <RadioGroupItem value="request" className="mt-1" disabled={disabled} />
            <span>
              <span className="block text-sm font-medium">Ask me first</span>
              <span className="text-muted-foreground block text-xs">
                The guest sends a request and you approve or decline it.
              </span>
            </span>
          </label>
        </RadioGroup>
      </div>

      <SettingsField id="cancellation-note" label="Note for guests" error={resolveFieldError('cancellation-note')}>
        <Textarea
          id="cancellation-note"
          value={policy.note ?? ''}
          maxLength={CANCELLATION_POLICY_NOTE_MAX}
          rows={2}
          disabled={disabled}
          onChange={(event) => {
            markFieldInteracted('cancellation-note');
            patch({ note: event.target.value });
          }}
        />
      </SettingsField>
    </>
  );
}

function PreviewCard({ policy, action }: { policy: CancellationPolicy | null; action?: React.ReactNode }) {
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
          <p className={cn('text-xs font-semibold leading-snug sm:text-sm sm:font-medium', textClasses)}>
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
  manageNeedsAttention = false,
  upcomingBookingsCount,
}: Props) {
  const [manageOpen, setManageOpen] = useState(false);
  const [draft, setDraft] = useState<CancellationPolicy | null>(
    policy ?? buildCancellationPreset('moderate')
  );
  const [baselineDraft, setBaselineDraft] = useState<CancellationPolicy | null>(policy);
  const [confirmUpcoming, setConfirmUpcoming] = useState(false);
  const [pendingSave, setPendingSave] = useState<CancellationPolicy | null>(null);
  const propertyId = usePropertyIdParam();

  const impactQuery = useQuery({
    queryKey: ['cancellation-policy-impact', propertyId],
    enabled: Boolean(propertyId) && manageOpen,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const jwt = data.session?.access_token;
      if (!jwt) return { upcomingCount: 0 };
      const res = await fetch(
        scopedFunctionsUrl(`/cancellation-policy-impact?property_id=${propertyId}`, propertyId),
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      const json = await res.json().catch(() => ({}));
      return { upcomingCount: Number(json?.data?.upcomingCount ?? 0) };
    },
  });
  const upcomingCount = upcomingBookingsCount ?? impactQuery.data?.upcomingCount ?? 0;

  const dirty = !cancellationPolicyEqual(draft, baselineDraft);
  const draftError = draft ? validateCancellationPolicy(draft) : 'Choose a cancellation policy';

  const openManage = () => {
    const initial = policy ?? buildCancellationPreset('moderate');
    setDraft(initial);
    setBaselineDraft(initial);
    setManageOpen(true);
  };

  const commit = (next: CancellationPolicy | null) => {
    onChange(next);
    setManageOpen(false);
  };

  const requestSave = () => {
    if (!draft || draftError) return;
    if (upcomingCount > 0 && !cancellationPolicyEqual(draft, policy)) {
      setPendingSave(draft);
      setConfirmUpcoming(true);
      return;
    }
    commit(draft);
  };

  const { onOpenChange, requestClose, dialogProps } = useGuardedClose({
    open: manageOpen,
    onOpenChange: setManageOpen,
    isDirty: dirty,
    onSave: async () => {
      if (!draft || draftError) return false;
      commit(draft);
      return true;
    },
    onDiscard: () => setDraft(baselineDraft),
  });

  const controls = draft ? (
    <PolicyFields
      policy={draft}
      disabled={disabled}
      resolveFieldError={resolveFieldError}
      markFieldInteracted={markFieldInteracted}
      onChange={setDraft}
    />
  ) : (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Guests see "Ask the host about cancellation" until you choose a policy.
      </p>
      <PolicyFields
        policy={buildCancellationPreset('moderate')}
        disabled={disabled}
        resolveFieldError={resolveFieldError}
        markFieldInteracted={markFieldInteracted}
        onChange={setDraft}
      />
    </div>
  );

  if (embedded) {
    const embeddedPolicy = policy ?? buildCancellationPreset('moderate');
    return (
      <div className="space-y-4 px-4 py-3">
        {policy === null ? (
          <div className="border-border/70 bg-muted/30 space-y-2 rounded-xl border p-3">
            <p className="text-muted-foreground text-sm">
              Guests see "Ask the host about cancellation" until you choose a policy.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="settings-action"
              onClick={() => onChange(buildCancellationPreset('moderate'))}
            >
              Use Moderate
            </Button>
          </div>
        ) : null}
        <PolicyFields
          policy={embeddedPolicy}
          disabled={disabled}
          resolveFieldError={resolveFieldError}
          markFieldInteracted={markFieldInteracted}
          onChange={onChange}
        />
        <TimelinePreview policy={embeddedPolicy} />
        {validateCancellationPolicy(embeddedPolicy) ? (
          <p className="text-destructive text-xs">{validateCancellationPolicy(embeddedPolicy)}</p>
        ) : null}
      </div>
    );
  }

  return (
    <AdminSection
      id="cancellation"
      title="Cancellation policy"
      icon={Shield}
      description="Refund rules based on what the guest has paid."
    >
      <PreviewCard
        policy={policy}
        action={
          <SettingsManageButton needsAttention={manageNeedsAttention} onClick={openManage} />
        }
      />

      <ResponsiveModal open={manageOpen} onOpenChange={onOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className="flex max-h-[min(92dvh,52rem)] w-[min(calc(100vw-1.5rem),44rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,44rem)] sm:p-0"
        >
          <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5 sm:py-4">
            <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
              Cancellation policy
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
            {controls}
            {draftError ? <p className="text-destructive text-xs">{draftError}</p> : null}
            {upcomingCount > 0 ? (
              <p className="text-muted-foreground text-xs">
                Applies to new bookings only. {upcomingCount} upcoming{' '}
                {upcomingCount === 1 ? 'booking keeps' : 'bookings keep'} the policy they
                booked with.
              </p>
            ) : null}
          </div>

          <ResponsiveModalFooter className="border-border/60 flex shrink-0 gap-2 border-t px-4 py-3 sm:px-5">
            <Button type="button" variant="outline" className="min-h-[44px] flex-1 sm:flex-none" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px] flex-1 sm:ml-auto sm:flex-none"
              onClick={requestSave}
              disabled={Boolean(draftError) || disabled}
            >
              Save
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...dialogProps} />

      <AlertDialog open={confirmUpcoming} onOpenChange={setConfirmUpcoming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply to new bookings only?</AlertDialogTitle>
            <AlertDialogDescription>
              {upcomingCount} upcoming{' '}
              {upcomingCount === 1 ? 'booking keeps' : 'bookings keep'} the policy they booked
              with. New bookings will use this policy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingSave) commit(pendingSave);
                setConfirmUpcoming(false);
                setPendingSave(null);
              }}
            >
              Save policy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminSection>
  );
}
