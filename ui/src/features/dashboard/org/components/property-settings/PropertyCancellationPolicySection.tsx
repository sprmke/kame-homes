import { useMemo, useState } from 'react';

import { addDays, format } from 'date-fns';
import { CalendarDays, Check, Plus, Shield, Trash2 } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import {
  SettingsField,
  SettingsManageButton,
} from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  CANCELLATION_POLICY_MAX_TIERS,
  CANCELLATION_PRESETS,
  buildCancellationPreset,
  cancellationPolicyEqual,
  resolveCancellationPolicyDisplay,
  validateCancellationPolicy,
  type CancellationPolicy,
  type CancellationPresetId,
  type CancellationTier,
} from '@/features/dashboard/org/lib/cancellationPolicy';

import { NoticeCallout } from '@/components/help/NoticeCallout';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { formatMoney } from '@/utils/format/currency';
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
};

/** Sample payment used only to illustrate the policy. */
const SAMPLE_PAYMENT = {
  downPayment: 1500,
  petFee: 300,
  parkingFee: 200,
  additionalFee: 0,
} as const;

const SAMPLE_TOTAL_PAID =
  SAMPLE_PAYMENT.downPayment +
  SAMPLE_PAYMENT.petFee +
  SAMPLE_PAYMENT.parkingFee +
  SAMPLE_PAYMENT.additionalFee;

function sampleRefund(percent: number): number {
  return Math.round((SAMPLE_TOTAL_PAID * percent) / 100);
}

function PaymentRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{formatMoney(amount)}</dd>
    </div>
  );
}

function RefundRow({
  label,
  amount,
  percent,
  tone,
}: {
  label: string;
  amount: number;
  percent: number;
  tone: 'green' | 'amber' | 'muted';
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          tone === 'green'
            ? 'bg-emerald-500'
            : tone === 'amber'
              ? 'bg-amber-500'
              : 'bg-muted-foreground/40'
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm">{label}</span>
          <span className="text-sm font-semibold tabular-nums">{formatMoney(amount)}</span>
        </div>
        <p className="text-muted-foreground text-xs">{percent}% of paid</p>
      </div>
    </div>
  );
}

function ExampleCard({ policy }: { policy: CancellationPolicy }) {
  const sampleCheckIn = useMemo(() => addDays(new Date(), 60), []);
  const rows = policy.tiers.map((tier) => ({
    ...tier,
    deadline: addDays(sampleCheckIn, -tier.daysBefore),
  }));
  const lastDeadline = rows[rows.length - 1]?.deadline;

  return (
    <div className="border-border/70 bg-muted/30 space-y-4 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Example</p>
        <div className="bg-background inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
          <CalendarDays className="text-muted-foreground size-3.5" aria-hidden />
          <span className="text-muted-foreground">Check-in</span>
          <span className="font-medium">{format(sampleCheckIn, 'MMM d, yyyy')}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="bg-background/70 rounded-xl border p-3">
          <p className="text-xs font-medium">What they paid</p>
          <dl className="mt-2 space-y-1 text-sm">
            <PaymentRow label="Down payment" amount={SAMPLE_PAYMENT.downPayment} />
            <PaymentRow label="Pet fee" amount={SAMPLE_PAYMENT.petFee} />
            <PaymentRow label="Parking fee (if bundled)" amount={SAMPLE_PAYMENT.parkingFee} />
            <PaymentRow label="Additional fee" amount={SAMPLE_PAYMENT.additionalFee} />
            <div className="border-border/70 mt-1 flex items-baseline justify-between gap-3 border-t pt-2 font-medium">
              <dt>Total paid for stay</dt>
              <dd className="tabular-nums">{formatMoney(SAMPLE_TOTAL_PAID)}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-background/70 rounded-xl border p-3">
          <p className="text-xs font-medium">What they get back</p>
          <div className="mt-2 space-y-3">
            {rows.length === 0 ? (
              <RefundRow
                label="After booking"
                amount={0}
                percent={0}
                tone="muted"
              />
            ) : (
              rows.map((row) => (
                <RefundRow
                  key={row.daysBefore}
                  label={`Cancel by ${format(row.deadline, 'MMM d')}`}
                  amount={sampleRefund(row.refundPercent)}
                  percent={row.refundPercent}
                  tone={
                    row.refundPercent >= 100
                      ? 'green'
                      : row.refundPercent > 0
                        ? 'amber'
                        : 'muted'
                  }
                />
              ))
            )}
            {lastDeadline ? (
              <RefundRow
                label={`After ${format(lastDeadline, 'MMM d')}`}
                amount={sampleRefund(policy.fallbackRefundPercent)}
                percent={policy.fallbackRefundPercent}
                tone={policy.fallbackRefundPercent > 0 ? 'amber' : 'muted'}
              />
            ) : null}
          </div>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Down payment, pet fee, parking fee and additional fees follow this policy when they
        are part of the stay payment.
      </p>
    </div>
  );
}

function TierBuilder({
  policy,
  disabled,
  error,
  onChange,
}: {
  policy: CancellationPolicy;
  disabled?: boolean;
  error?: string | null;
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
    <div className="border-border/70 bg-background/60 space-y-3 rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Refund deadlines</p>
          <p className="text-muted-foreground text-xs">After the last deadline, no refund.</p>
        </div>
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
      {policy.tiers.map((tier, index) => (
        <div
          key={`${tier.daysBefore}-${index}`}
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        >
          <SettingsField id={`cancellation-tier-days-${index}`} label="Days before check-in">
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
          <SettingsField id={`cancellation-tier-percent-${index}`} label="Refund %">
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
            className="justify-self-end sm:mb-0.5 sm:justify-self-auto"
            aria-label={`Remove row ${index + 1}`}
            onClick={() => onChange(policy.tiers.filter((_, i) => i !== index))}
            disabled={disabled}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ))}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

function PolicyFields({
  policy,
  disabled,
  error,
  onChange,
}: {
  policy: CancellationPolicy;
  disabled?: boolean;
  error?: string | null;
  onChange: (policy: CancellationPolicy) => void;
}) {
  const setPreset = (presetId: CancellationPresetId) => {
    onChange(buildCancellationPreset(presetId, policy));
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
                <span className="text-muted-foreground block text-xs leading-snug">
                  {preset.summary}
                </span>
              </span>
            </label>
          );
        })}
      </RadioGroup>

      {policy.presetId === 'custom' && !policy.needsReview ? (
        <TierBuilder
          policy={policy}
          disabled={disabled}
          error={error}
          onChange={(tiers) => onChange({ ...policy, tiers })}
        />
      ) : null}

      {policy.needsReview ? (
        <NoticeCallout tone="warning">
          This policy was written as free text. Choose a preset to make it enforceable.
        </NoticeCallout>
      ) : (
        <ExampleCard policy={policy} />
      )}
    </>
  );
}

function PreviewCard({
  policy,
  action,
}: {
  policy: CancellationPolicy | null;
  action?: React.ReactNode;
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
  resolveFieldError: _resolveFieldError,
  markFieldInteracted: _markFieldInteracted,
  onChange,
  embedded = false,
  manageNeedsAttention = false,
}: Props) {
  const [manageOpen, setManageOpen] = useState(false);
  const [draft, setDraft] = useState<CancellationPolicy | null>(
    policy ?? buildCancellationPreset('moderate')
  );
  const [baselineDraft, setBaselineDraft] = useState<CancellationPolicy | null>(policy);

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
          error={validateCancellationPolicy(embeddedPolicy)}
          onChange={onChange}
        />
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
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium">Guest preview</p>
        <PreviewCard
          policy={policy}
          action={
            <SettingsManageButton needsAttention={manageNeedsAttention} onClick={openManage} />
          }
        />
      </div>

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
            {draft ? (
              <PolicyFields
                policy={draft}
                disabled={disabled}
                error={draftError}
                onChange={setDraft}
              />
            ) : null}
          </div>

          <ResponsiveModalFooter className="border-border/60 flex shrink-0 gap-2 border-t px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] flex-1 sm:flex-none"
              onClick={requestClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-[44px] flex-1 sm:ml-auto sm:flex-none"
              onClick={() => {
                if (draft && !draftError) commit(draft);
              }}
              disabled={Boolean(draftError) || disabled}
            >
              Save
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...dialogProps} />
    </AdminSection>
  );
}
