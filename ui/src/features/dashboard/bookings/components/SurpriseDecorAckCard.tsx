/**
 * Admin confirmation when the guest requested surprise decor (PENDING_REVIEW).
 * Shown below Review pricing; gates Proceed to Pending Documents with WorkflowPanel.
 */

import { useCallback, useState } from 'react';

import {
  focusFirstWorkflowFieldError,
  useRegisterWorkflowProceedValidator,
} from '@/features/dashboard/bookings/components/workflow-panel/WorkflowProceedValidationContext';
import { WorkflowSubFormCard } from '@/features/dashboard/bookings/components/WorkflowSubFormCard';

import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

type Props = {
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
  readOnly?: boolean;
  plain?: boolean;
};

const ACK_ERROR = 'Confirm staff coordination before continuing.';

export function SurpriseDecorAckCard({
  acknowledged,
  onAcknowledgedChange,
  readOnly = false,
  plain = false,
}: Props) {
  const [showError, setShowError] = useState(false);

  const validateForProceed = useCallback(() => {
    if (readOnly) return true;
    if (acknowledged) {
      setShowError(false);
      return true;
    }
    setShowError(true);
    // Defer focus until the error affordance is in the DOM.
    queueMicrotask(() => focusFirstWorkflowFieldError());
    return false;
  }, [acknowledged, readOnly]);

  useRegisterWorkflowProceedValidator('surprise_decor', validateForProceed, !readOnly);

  const content = (
    <div className="space-y-1">
      <div className="text-muted-foreground block text-xs">
        Staff coordination confirmation
        <span className="text-red-600"> *</span>
      </div>
      <label
        className={cn(
          '-mx-1 flex min-h-[44px] items-start gap-3 rounded-lg px-1 py-1',
          readOnly ? undefined : 'hover:bg-muted/50/80 cursor-pointer',
          showError && !acknowledged
            ? 'bg-red-50 ring-1 ring-red-300 dark:bg-red-500/10 dark:ring-red-500/40'
            : undefined
        )}
      >
        <Checkbox
          checked={acknowledged}
          aria-required={!readOnly}
          aria-invalid={showError && !acknowledged ? true : undefined}
          data-workflow-field-error={showError && !acknowledged ? 'true' : undefined}
          disabled={readOnly}
          onCheckedChange={(checked) => {
            const next = checked === true;
            onAcknowledgedChange(next);
            if (next) setShowError(false);
          }}
          className="mt-1.5 disabled:cursor-default"
        />
        <span className="text-foreground text-xs">
          I coordinated surprise decor with staff, including theme and final price.
        </span>
      </label>
      {showError && !acknowledged ? <p className="text-[10px] text-red-600">{ACK_ERROR}</p> : null}
    </div>
  );

  if (plain) {
    return content;
  }

  return <WorkflowSubFormCard title="Surprise decor">{content}</WorkflowSubFormCard>;
}
