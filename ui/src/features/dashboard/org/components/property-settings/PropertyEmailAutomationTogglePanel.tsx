import type { AppSettingsFormValues } from '@/features/dashboard/bookings/hooks/useAppSettings';
import {
  PROPERTY_AUTOMATION_TOGGLE_GROUPS,
  type PropertyAutomationToggleKey,
} from '@/features/dashboard/org/lib/propertyEmailAutomation';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';

import { cn } from '@/lib/utils';

/** Mirrors `_shared/propertyAutomationToggles.ts#PLAN_GATED_AUTOMATION_TOGGLE_KEYS`. */
const PLAN_GATED_AUTOMATION_TOGGLE_KEYS = new Set<PropertyAutomationToggleKey>([
  'emailGafRequest',
  'emailBookingAcknowledgement',
  'emailPetRequest',
  'emailReadyForCheckin',
  'emailSdRefundCheckout',
]);

function SettingsToggle({
  id,
  checked,
  disabled,
  label,
  onCheckedChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
          'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-muted'
        )}
      >
        <span
          aria-hidden
          className={cn(
            'bg-background pointer-events-none block size-5 rounded-full shadow-sm transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}

function AutomationToggleRow({
  id,
  label,
  recipient,
  trigger,
  checked,
  disabled,
  planLocked,
  onCheckedChange,
  onUpgrade,
}: {
  id: string;
  label: string;
  recipient: string;
  trigger: string;
  checked: boolean;
  disabled?: boolean;
  planLocked?: boolean;
  onCheckedChange: (checked: boolean) => void;
  onUpgrade?: () => void;
}) {
  return (
    <div className="border-border/40 bg-muted/15 flex min-h-[44px] items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="text-foreground text-sm font-medium leading-snug">
            {label}
          </label>
          {planLocked ? <TierBadge feature="automatedBookingFlow" /> : null}
        </div>
        <p className="text-xs leading-snug">
          <span className="text-foreground/90 font-medium">To:</span>{' '}
          <span className="text-muted-foreground break-all">{recipient}</span>
        </p>
        <p className="text-xs leading-snug">
          <span className="text-foreground/90 font-medium">When:</span>{' '}
          <span className="text-muted-foreground">{trigger}</span>
        </p>
      </div>
      <SettingsToggle
        id={id}
        label={label}
        checked={planLocked ? false : checked}
        disabled={disabled}
        onCheckedChange={(value) => {
          if (planLocked) {
            onUpgrade?.();
            return;
          }
          onCheckedChange(value);
        }}
      />
    </div>
  );
}

function resolveToggleRecipient(
  key: PropertyAutomationToggleKey,
  draft: AppSettingsFormValues,
  fallback: string
): string {
  const propertyEmail = draft.emailReplyTo.trim();
  const pmoEmail = draft.emailTo.trim();

  switch (key) {
    case 'emailNewBookingRequest':
      return propertyEmail || `${fallback} (set in Recipients above)`;
    case 'emailGafRequest':
    case 'emailPetRequest':
      return pmoEmail || 'Configure in platform development settings';
    default:
      return fallback;
  }
}

export function PropertyEmailAutomationTogglePanel({
  draft,
  disabled,
  automatedBookingFlowAllowed,
  onToggleChange,
}: {
  draft: AppSettingsFormValues;
  disabled: boolean;
  /** When false, plan-gated toggles are locked off (Free). */
  automatedBookingFlowAllowed: boolean;
  onToggleChange: (key: PropertyAutomationToggleKey, value: boolean) => void;
}) {
  const toggles = draft.automationToggles;
  const { open: openUpgrade } = useUpgradeModal();

  return (
    <div className="space-y-5">
      {PROPERTY_AUTOMATION_TOGGLE_GROUPS.map((group) => (
        <div key={group.id} className="space-y-2.5">
          <p className="text-muted-foreground/90 text-[11px] font-semibold uppercase tracking-wider">
            {group.title}
          </p>
          <div className="space-y-2">
            {group.items.map((item) => {
              const planLocked =
                !automatedBookingFlowAllowed && PLAN_GATED_AUTOMATION_TOGGLE_KEYS.has(item.key);
              return (
                <AutomationToggleRow
                  key={item.key}
                  id={`property-automation-${item.key}`}
                  label={item.label}
                  recipient={resolveToggleRecipient(item.key, draft, item.recipient)}
                  trigger={item.trigger}
                  checked={toggles[item.key]}
                  disabled={disabled}
                  planLocked={planLocked}
                  onUpgrade={() => openUpgrade('automatedBookingFlow')}
                  onCheckedChange={(value) => onToggleChange(item.key, value)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
