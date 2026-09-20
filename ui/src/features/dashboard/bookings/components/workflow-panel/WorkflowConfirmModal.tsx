/**
 * Confirm dialog for workflow Proceed / Back / Cancel actions.
 */

import type { ReactNode } from 'react';

import { AlertTriangle } from 'lucide-react';

import { statusLabel, type BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import type {
  WorkflowEmailDevControlKey,
  WorkflowEmailEffect,
} from '@/features/dashboard/bookings/lib/workflowTransitionEmailControls';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

/** Opt-in row labels — name the document and who receives it. */
const WORKFLOW_EMAIL_ACTION_LABEL: Record<WorkflowEmailDevControlKey, string> = {
  sendGafRequestEmail: 'Email GAF request to building management',
  sendBookingAcknowledgementEmail: 'Email guest acknowledgement to guest',
  sendPetRequestEmail: 'Email pet request to building management',
  sendReadyForCheckinEmail: 'Email ready-for-check-in email to guest',
  sendSdRefundFormEmail: 'Email Check-out Instructions to guest',
};

/** One-line summary for transition confirms — status names in semibold, not quotes. */
export function WorkflowStatusTransitionDescription({
  fromStatus,
  toStatus,
}: {
  fromStatus: BookingStatus;
  toStatus: BookingStatus;
}) {
  return (
    <>
      Move from <span className="text-foreground font-semibold">{statusLabel(fromStatus)}</span>
      {' to '}
      <span className="text-foreground font-semibold">{statusLabel(toStatus)}</span>.
    </>
  );
}

export function WorkflowConfirmModal({
  title,
  description,
  effectLines,
  emailEffects,
  emailChoices,
  onEmailChoiceChange,
  banner,
  secondaryLabel = 'Back',
  onConfirm,
  onCancel,
  isLoading,
  destructive = false,
}: {
  title: string;
  description: ReactNode;
  /** Short host-facing bullets describing what will happen on confirm. */
  effectLines?: string[];
  /** Optional email opt-in rows (past stay / re-forward). */
  emailEffects?: WorkflowEmailEffect[];
  emailChoices?: Partial<Record<WorkflowEmailDevControlKey, boolean>>;
  onEmailChoiceChange?: (key: WorkflowEmailDevControlKey, checked: boolean) => void;
  banner?: ReactNode;
  /** Dismiss control (e.g. `Cancel` for transitions, `Keep booking` when cancelling a booking). */
  secondaryLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  destructive?: boolean;
}) {
  const showEmailChoices =
    emailEffects != null && emailEffects.length > 0 && onEmailChoiceChange != null;

  return (
    <ResponsiveModal
      open
      onOpenChange={(next) => {
        if (!next && !isLoading) onCancel();
      }}
    >
      <ResponsiveModalContent
        sheetLayout="split"
        className="flex max-h-[min(90dvh,calc(100dvh-1.5rem))] w-full max-w-[min(calc(100vw-1.5rem),28rem)] flex-col gap-0 overflow-hidden p-5 sm:max-w-[min(calc(100vw-1.5rem),28rem)]"
      >
        <ResponsiveModalHeader className="sr-only">
          <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex items-start gap-3">
            {destructive && (
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/10">
                <AlertTriangle className="size-4 text-rose-600" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-foreground text-base font-semibold sm:text-lg">{title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{description}</p>
              {effectLines && effectLines.length > 0 ? (
                <>
                  <p className="text-muted-foreground mt-3 text-sm">This will:</p>
                  <ul className="mt-2 space-y-1">
                    {effectLines.map((line) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <span
                          className="flex w-[18px] shrink-0 justify-center pt-[7px]"
                          aria-hidden
                        >
                          <span className="bg-muted-foreground/40 size-1.5 rounded-full" />
                        </span>
                        <span className="text-foreground min-w-0 text-[13px] leading-5">
                          {line}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {showEmailChoices ? (
                <div className="mt-3" role="group" aria-label="Optional actions">
                  <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                    Optional actions
                  </p>
                  <div className="ml-0.5 mt-1 space-y-0.5">
                    {emailEffects.map((effect) => {
                      const checkboxId = `workflow-email-${effect.key}`;
                      return (
                        <label
                          key={effect.key}
                          htmlFor={checkboxId}
                          className="hover:bg-muted/50 flex cursor-pointer items-start gap-2.5 rounded-md py-1.5 pr-1.5 transition-colors sm:py-1"
                        >
                          <Checkbox
                            id={checkboxId}
                            checked={emailChoices?.[effect.key] === true}
                            onCheckedChange={(value) => {
                              onEmailChoiceChange(effect.key, value === true);
                            }}
                            className="mt-px shrink-0"
                          />
                          <span className="text-foreground min-w-0 text-[13px] leading-5">
                            {WORKFLOW_EMAIL_ACTION_LABEL[effect.key]}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {banner ? <div className="mt-2.5">{banner}</div> : null}
            </div>
          </div>
        </div>
        <div className="mt-5 flex shrink-0 justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="min-h-[44px]"
          >
            {secondaryLabel}
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'min-h-[44px] rounded-xl px-5 py-2 text-sm font-bold transition-all duration-200 disabled:opacity-50 motion-safe:active:scale-[0.98]',
              destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-destructive/20 shadow-sm'
                : 'gradient-primary text-primary-foreground shadow-soft hover:shadow-primary-glow hover:brightness-[1.03]'
            )}
          >
            {isLoading ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
