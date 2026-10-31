import { Check, Loader2, X } from 'lucide-react';

import { StepFailureHint } from '@/features/dashboard/ai-assistant/components/StepFailureHint';
import type { TaskPlanStepStatus } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { cn } from '@/lib/utils';

type TaskPlanStep = {
  id: string;
  label: string;
  status: TaskPlanStepStatus;
  toolName?: string;
  reason?: string;
};

type Props = {
  title: string;
  steps: TaskPlanStep[];
};

function StepIcon({ status }: { status: TaskPlanStepStatus }) {
  if (status === 'done') return <Check className="text-primary size-3.5" aria-hidden />;
  if (status === 'failed') return <X className="text-destructive size-3.5" aria-hidden />;
  if (status === 'running') {
    return <Loader2 className="text-primary size-3.5 motion-safe:animate-spin" aria-hidden />;
  }
  return <span className="bg-muted size-1.5 rounded-full" aria-hidden />;
}

export function TaskPlanBlock({ title, steps }: Props) {
  const safeSteps = steps ?? [];
  if (safeSteps.length === 0) return null;

  return (
    <div className="border-border/60 bg-card space-y-3 rounded-xl border p-3">
      {title ? <p className="text-foreground text-sm font-semibold">{title}</p> : null}
      <ol className="space-y-2">
        {safeSteps.map((step) => (
          <li key={step.id} className="flex items-start gap-2.5 text-xs">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
              <StepIcon status={step.status} />
            </span>
            <span
              className={cn(
                'min-w-0 leading-snug',
                step.status === 'running' && 'text-foreground font-medium',
                step.status === 'done' && 'text-muted-foreground',
                step.status === 'pending' && 'text-muted-foreground/70',
                step.status === 'failed' && 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
            {step.status === 'failed' ? (
              <StepFailureHint reason={step.reason} className="-my-0.5" />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
