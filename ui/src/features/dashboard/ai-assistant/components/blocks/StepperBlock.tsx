import { Check } from 'lucide-react';

import { ActionConfirmationBlock } from '@/features/dashboard/ai-assistant/components/blocks/ActionConfirmationBlock';
import type {
  ChatBlock,
  ConfirmActionResponse,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { cn } from '@/lib/utils';

type Props = Extract<ChatBlock, { type: 'stepper' }> & {
  onResolveAction: (actionId: string, confirm: boolean) => Promise<ConfirmActionResponse | null>;
};

export function StepperBlock({ title, steps, onResolveAction }: Props) {
  const safeSteps = steps ?? [];
  if (safeSteps.length === 0) return null;

  return (
    <div className="border-border/60 bg-card space-y-3 rounded-xl border p-3">
      {title ? <p className="text-foreground text-sm font-semibold">{title}</p> : null}
      <ol className="flex flex-col">
        {safeSteps.map((step, index) => {
          const isLast = index === safeSteps.length - 1;
          const isCompleted = step.status === 'done';
          const isCurrent = step.status === 'current';
          return (
            <li key={`${step.label}-${index}`} className="flex gap-3">
              <div className="flex w-6 shrink-0 flex-col items-center">
                <div className="flex size-6 shrink-0 items-center justify-center">
                  <div
                    className={cn(
                      'flex items-center justify-center rounded-full',
                      isCurrent
                        ? 'border-primary size-6 border'
                        : isCompleted
                          ? 'gradient-primary text-primary-foreground size-5'
                          : 'bg-card ring-border/60 size-5 ring-1'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : isCurrent ? (
                      <span className="bg-primary size-2 rounded-full" />
                    ) : null}
                  </div>
                </div>
                {!isLast ? (
                  <div
                    className={cn(
                      'mb-0.5 mt-0.5 min-h-[14px] w-px flex-1',
                      isCompleted ? 'bg-primary/40' : 'bg-muted'
                    )}
                  />
                ) : null}
              </div>
              <div className={cn('min-w-0 flex-1', isLast ? 'pb-0' : 'pb-3')}>
                <p
                  className={cn(
                    'text-sm leading-tight',
                    isCurrent
                      ? 'text-primary font-semibold'
                      : isCompleted
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground font-medium'
                  )}
                >
                  {step.label}
                </p>
                {step.description ? (
                  <p className="text-muted-foreground mt-1 text-xs leading-snug">
                    {step.description}
                  </p>
                ) : null}
                {step.actionBlock ? (
                  <div className="mt-2">
                    <ActionConfirmationBlock {...step.actionBlock} onResolve={onResolveAction} />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
