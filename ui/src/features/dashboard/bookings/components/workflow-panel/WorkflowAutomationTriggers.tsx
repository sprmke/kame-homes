/**
 * Automation-triggers collapsible — rail only.
 *
 * Manual workflow email sends (Free escape hatch / paid resend) + SD check-out automation.
 * Buttons stay visible but disabled with tooltips until prerequisites are met.
 * Free tier: after a successful send, Resend stays locked for 1 hour.
 */

import { useEffect, useState } from 'react';

import { ChevronDown, ChevronRight, Loader2, Mail, RefreshCw, Timer } from 'lucide-react';

import { WorkflowTriggerActionButton } from '@/features/dashboard/bookings/components/workflow-panel/WorkflowTriggerActionButton';
import {
  BOOKING_WORKFLOW_EMAIL_LABELS,
  type BookingWorkflowEmailKind,
} from '@/features/dashboard/bookings/lib/bookingWorkflowEmail';
import type { BookingForManualWorkflowEmail } from '@/features/dashboard/bookings/lib/bookingWorkflowEmail';
import { formatSdRefundLeadPhrase } from '@/features/dashboard/bookings/lib/workflowAdvanceMode';
import { resolveWorkflowEmailManualSendUi } from '@/features/dashboard/bookings/lib/workflowEmailManualSendCooldown';
import {
  resolveWorkflowEmailTriggerAvailability,
  visibleManualWorkflowEmailKinds,
} from '@/features/dashboard/bookings/lib/workflowEmailTriggerAvailability';
import {
  buildWorkflowEmailTriggerTooltip,
  resolveWorkflowEmailTriggerBlocker,
  SD_CHECKOUT_AUTOMATION_TRIGGER_HELP,
  SD_CHECKOUT_INSTRUCTIONS_RESEND_HELP,
  workflowEmailTriggerTooltip,
} from '@/features/dashboard/bookings/lib/workflowEmailTriggerTooltip';
import { PlanGatedText } from '@/features/dashboard/plans/components/PlanUpgradeLink';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DEFAULT_LEAD_MINUTES = 120;

type Props = {
  isModal: boolean;
  booking: BookingForManualWorkflowEmail;
  showSdCron: boolean;
  showSdFormResend: boolean;
  pendingDocumentsComplete?: boolean;
  planSkipHint: boolean;
  sdRefundEmailLeadMinutes?: number;
  automationHelpOpen: boolean;
  onToggleAutomationHelp: () => void;
  sdCronPending: boolean;
  resendSdFormPending: boolean;
  sendingKind: BookingWorkflowEmailKind | null;
  onRunSdCron: () => void;
  onResendSdFormEmail: () => void;
  onSendWorkflowEmail: (kind: BookingWorkflowEmailKind) => void;
};

export function WorkflowAutomationTriggers({
  isModal,
  booking,
  showSdCron,
  showSdFormResend,
  pendingDocumentsComplete,
  planSkipHint,
  sdRefundEmailLeadMinutes = DEFAULT_LEAD_MINUTES,
  automationHelpOpen,
  onToggleAutomationHelp,
  sdCronPending,
  resendSdFormPending,
  sendingKind,
  onRunSdCron,
  onResendSdFormEmail,
  onSendWorkflowEmail,
}: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!planSkipHint || !automationHelpOpen) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [planSkipHint, automationHelpOpen]);

  const visibleKinds = visibleManualWorkflowEmailKinds(booking);
  const kindsForButtons = visibleKinds.filter((kind) => {
    if (kind === 'sd_refund_form_request' && showSdFormResend) return false;
    return true;
  });

  const hasContent = showSdCron || showSdFormResend || kindsForButtons.length > 0;
  if (isModal || !hasContent) return null;

  const leadPhrase = formatSdRefundLeadPhrase(sdRefundEmailLeadMinutes);
  const sdCronButtonLabel = planSkipHint
    ? 'Run check-out move (no email on Free)'
    : 'Run check-out automation';

  const sdResendUi = resolveWorkflowEmailManualSendUi('sd_refund_form_request', {
    enforceCooldown: planSkipHint,
    sentAtMap: booking.workflow_email_manual_sent_at,
    sdRefundFormEmailedAt: booking.sd_refund_form_emailed_at,
    nowMs,
    preferResendLabel: true,
  });

  const sendManuallyBadge = planSkipHint ? (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-label="Automated workflow emails are not on your plan. Send them below when ready, or Upgrade for automatic sends."
            className="bg-warning/15 text-warning rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          >
            Send manually
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[min(90vw,18rem)] text-xs leading-snug">
          <PlanGatedText
            feature="automatedBookingFlow"
            text="Automated workflow emails are not on your plan. Send them below when ready, or Upgrade for automatic sends."
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;

  return (
    <div className="border-separator border-b">
      <button
        type="button"
        aria-expanded={automationHelpOpen}
        onClick={onToggleAutomationHelp}
        className="hover:bg-muted/50 flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left transition-colors"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Timer className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <span className="text-overline text-muted-foreground font-semibold">
            Automation Triggers
          </span>
          {sendManuallyBadge}
        </span>
        {automationHelpOpen ? (
          <ChevronDown className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
        )}
      </button>

      {automationHelpOpen && (
        <div className="text-muted-foreground space-y-2 px-4 pb-3 text-[11.5px] leading-relaxed">
          {showSdCron ? (
            planSkipHint ? (
              <p>
                <PlanGatedText
                  feature="automatedBookingFlow"
                  text="After guest balance is settled, run check-out move below when the cron has not run yet. On Free it does not send email. Use Send Check-out Instructions when enabled, or Upgrade for automatic emails."
                />
              </p>
            ) : (
              <>
                <p>
                  {leadPhrase}, the guest gets the Check-out Instructions email automatically, even
                  if the balance is unpaid. If the remaining balance is settled with a receipt
                  uploaded, the booking also moves automatically to Ready for Check-out at that
                  time.
                </p>
                <p>If the email or move did not happen, run the check-out automation below.</p>
              </>
            )
          ) : null}
          {showSdFormResend ? (
            <p>
              Resend the Check-out Instructions email. It does not move the booking to the next
              step.
            </p>
          ) : null}
          {kindsForButtons.length > 0 && !planSkipHint ? (
            <p>Resend a workflow email without changing status.</p>
          ) : null}

          <div className="border-separator flex flex-col gap-1.5 border-t pt-3">
            {kindsForButtons.map((kind) => {
              const pending = sendingKind === kind;
              const blockedByAnotherSend = sendingKind != null && !pending;
              const { enabled, disabledReason } = resolveWorkflowEmailTriggerAvailability(
                kind,
                booking,
                {
                  pendingDocumentsComplete,
                }
              );
              const sendUi = resolveWorkflowEmailManualSendUi(kind, {
                enforceCooldown: planSkipHint,
                sentAtMap: booking.workflow_email_manual_sent_at,
                sdRefundFormEmailedAt: booking.sd_refund_form_emailed_at,
                nowMs,
              });
              const cooldownBlocks = sendUi.inCooldown;
              const sendDisabled = !enabled || blockedByAnotherSend || cooldownBlocks;
              const blocker = resolveWorkflowEmailTriggerBlocker({
                enabled,
                disabledReason,
                blockedByAnotherSend,
                cooldownBlocks,
                cooldownReason: sendUi.cooldownReason,
              });
              const tooltip = workflowEmailTriggerTooltip(kind, blocker);

              return (
                <WorkflowTriggerActionButton
                  key={kind}
                  disabled={sendDisabled}
                  tooltip={tooltip}
                  pending={pending}
                  onClick={() => onSendWorkflowEmail(kind)}
                  trailing={
                    pending ? (
                      <Loader2 className="size-3.5 shrink-0 animate-spin" />
                    ) : (
                      <Mail className="size-3.5 shrink-0" aria-hidden />
                    )
                  }
                >
                  {sendUi.labelPrefix} {BOOKING_WORKFLOW_EMAIL_LABELS[kind]}
                </WorkflowTriggerActionButton>
              );
            })}
            {showSdCron ? (
              <WorkflowTriggerActionButton
                disabled={sdCronPending}
                tooltip={
                  planSkipHint
                    ? SD_CHECKOUT_AUTOMATION_TRIGGER_HELP.free
                    : SD_CHECKOUT_AUTOMATION_TRIGGER_HELP.paid
                }
                pending={sdCronPending}
                onClick={onRunSdCron}
                trailing={
                  sdCronPending ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5 shrink-0" aria-hidden />
                  )
                }
              >
                {sdCronButtonLabel}
              </WorkflowTriggerActionButton>
            ) : null}
            {showSdFormResend ? (
              <WorkflowTriggerActionButton
                disabled={sdResendUi.inCooldown}
                tooltip={buildWorkflowEmailTriggerTooltip(
                  SD_CHECKOUT_INSTRUCTIONS_RESEND_HELP,
                  sdResendUi.inCooldown ? sdResendUi.cooldownReason : null
                )}
                pending={resendSdFormPending}
                onClick={onResendSdFormEmail}
                trailing={
                  resendSdFormPending ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Mail className="size-3.5 shrink-0" aria-hidden />
                  )
                }
              >
                {sdResendUi.labelPrefix} Check-out Instructions email
              </WorkflowTriggerActionButton>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
