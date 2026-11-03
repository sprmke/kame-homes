import { useState } from 'react';

import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { ComparisonBlock } from '@/features/dashboard/ai-assistant/components/blocks/ComparisonBlock';
import type {
  ActionPlanStep,
  ChatBlock,
  ConfirmPlanResponse,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import {
  humanizeAssistantConfirmationCopy,
  humanizeAssistantStatusText,
} from '@/features/dashboard/ai-assistant/lib/chatBlockDisplay';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

type Props = Extract<ChatBlock, { type: 'action_plan' }> & {
  onResolve: (
    planId: string,
    confirm: boolean,
    selectedStepIds?: string[]
  ) => Promise<ConfirmPlanResponse | null>;
};

function StepIcon({ status }: { status: ActionPlanStep['status'] }) {
  if (status === 'executed')
    return <CheckCircle2 className="text-success h-4 w-4 shrink-0" aria-hidden />;
  if (status === 'failed')
    return <XCircle className="text-destructive h-4 w-4 shrink-0" aria-hidden />;
  if (status === 'denied' || status === 'skipped' || status === 'expired') {
    return <AlertCircle className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />;
  }
  return (
    <div className="border-border mt-0.5 h-4 w-4 shrink-0 rounded-full border-2" aria-hidden />
  );
}

function StepRow({
  step,
  index,
  selected,
  editable,
  onToggle,
}: {
  step: ActionPlanStep;
  index: number;
  selected: boolean;
  editable: boolean;
  onToggle: (stepId: string) => void;
}) {
  const summary = humanizeAssistantConfirmationCopy(step.summary);
  const details = (step.details ?? []).map((d) => ({
    label: humanizeAssistantConfirmationCopy(d.label),
    value: humanizeAssistantConfirmationCopy(d.value),
  }));

  return (
    <div className="border-border/50 flex items-start gap-2 border-t pt-2 first:border-t-0 first:pt-0">
      {editable ? (
        <Checkbox
          id={`plan-step-${step.stepId}`}
          checked={selected}
          onCheckedChange={() => onToggle(step.stepId)}
          className="mt-0.5 h-5 w-5 shrink-0"
          aria-label={`Include step ${index + 1}: ${summary}`}
        />
      ) : (
        <div className="mt-0.5 shrink-0">
          <StepIcon status={step.status} />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-foreground text-sm font-medium">
            {index + 1}. {summary}
          </p>
          {step.riskTier === 'tier2_confirmed' ? (
            <span className="bg-warning/10 text-warning shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
              Confirm
            </span>
          ) : (
            <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
              Low risk
            </span>
          )}
        </div>

        {step.isExternalSend && (
          <p className="text-destructive text-xs font-medium">This sends or publishes for real.</p>
        )}

        {step.dependsOn.length > 0 && (
          <p className="text-muted-foreground text-xs">
            Runs after step{step.dependsOn.length > 1 ? 's' : ''}{' '}
            {step.dependsOn.map((d) => d + 1).join(', ')}.
          </p>
        )}

        {step.diff ? <ComparisonBlock {...step.diff} /> : null}

        {details.length > 0 && (
          <dl className="space-y-0.5">
            {details.map((d) => (
              <div key={d.label} className="flex gap-2 text-xs">
                <dt className="text-muted-foreground">{d.label}:</dt>
                <dd className="text-foreground">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {!editable && step.status === 'failed' && step.errorMessage && (
          <p className="text-destructive text-xs leading-snug">
            {humanizeAssistantStatusText(step.errorMessage)}
          </p>
        )}
        {!editable && (step.status === 'denied' || step.status === 'skipped') && (
          <p className="text-muted-foreground text-xs">
            {step.errorMessage ? humanizeAssistantStatusText(step.errorMessage) : 'Not run.'}
          </p>
        )}
      </div>
    </div>
  );
}

export function ActionPlanBlock({ planId, status, steps, onResolve }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(steps.filter((s) => s.selected).map((s) => s.stepId))
  );
  const [busy, setBusy] = useState<'approve' | 'cancel' | null>(null);

  const editable = status === 'proposed';

  const toggle = (stepId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const handle = async (confirm: boolean) => {
    setBusy(confirm ? 'approve' : 'cancel');
    await onResolve(planId, confirm, confirm ? [...selectedIds] : undefined);
    setBusy(null);
  };

  const selectedCount = steps.filter((s) => selectedIds.has(s.stepId)).length;
  const hasExternalSend = steps.some((s) => s.isExternalSend);

  return (
    <div
      className={
        hasExternalSend && editable
          ? 'border-destructive/50 bg-destructive/5 mx-auto max-w-[min(100%,28rem)] space-y-3 rounded-xl border p-3'
          : 'border-border/60 bg-card mx-auto max-w-[min(100%,28rem)] space-y-3 rounded-xl border p-3'
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-foreground text-sm font-semibold">
          {steps.length} step{steps.length === 1 ? '' : 's'} to review
        </p>
        {status === 'completed' && (
          <span className="text-success flex items-center gap-1 text-xs font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Completed
          </span>
        )}
        {status === 'partially_failed' && (
          <span className="text-destructive flex items-center gap-1 text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Partly failed
          </span>
        )}
        {status === 'cancelled' && (
          <span className="text-muted-foreground text-xs font-medium">Cancelled</span>
        )}
        {status === 'expired' && (
          <span className="text-muted-foreground text-xs font-medium">Expired</span>
        )}
      </div>

      <div className="space-y-2">
        {steps.map((step, index) => (
          <StepRow
            key={step.stepId}
            step={step}
            index={index}
            selected={selectedIds.has(step.stepId)}
            editable={editable}
            onToggle={toggle}
          />
        ))}
      </div>

      {editable && (
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            className="h-10 min-h-[44px] flex-1"
            variant={hasExternalSend ? 'destructive' : 'default'}
            disabled={busy !== null || selectedCount === 0}
            onClick={() => void handle(true)}
          >
            {busy === 'approve' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              `Approve selected (${selectedCount})`
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10 min-h-[44px] flex-1"
            disabled={busy !== null}
            onClick={() => void handle(false)}
          >
            {busy === 'cancel' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              'Cancel'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
