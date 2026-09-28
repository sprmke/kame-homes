import { ActivityTimelineBlock } from '@/features/dashboard/ai-assistant/components/blocks/ActivityTimelineBlock';
import { QuickActionsBlock } from '@/features/dashboard/ai-assistant/components/blocks/QuickActionsBlock';
import { ChatBlockRenderer } from '@/features/dashboard/ai-assistant/components/ChatBlockRenderer';
import type {
  ChatBlock,
  ConfirmActionResponse,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { partitionAssistantBlocks } from '@/features/dashboard/ai-assistant/lib/partitionAssistantBlocks';

import { cn } from '@/lib/utils';

type Props = {
  blocks: ChatBlock[];
  onResolveAction: (actionId: string, confirm: boolean) => Promise<ConfirmActionResponse | null>;
  onRunQuickAction?: (action: { label: string; prompt: string }) => void;
  quickActionsDisabled?: boolean;
  onOpenCanvas?: (block: ChatBlock) => void;
  onSubmitForm?: (
    block: Extract<ChatBlock, { type: 'dynamic_form' }>,
    values: Record<string, string>
  ) => void;
  className?: string;
  /** Full-page surface: no card chrome, full column width. */
  unboxed?: boolean;
};

/** Groups steps, answer, and suggested actions into one assistant turn card. */
export function AssistantMessageCard({
  blocks,
  onResolveAction,
  onRunQuickAction,
  quickActionsDisabled,
  onOpenCanvas,
  onSubmitForm,
  className,
  unboxed = false,
}: Props) {
  const { stepEntries, content, quickActions } = partitionAssistantBlocks(blocks);
  const hasContent = content.length > 0;
  const hasFooter = quickActions.length > 0;
  const hasDynamicForm = blocks.some((block) => block.type === 'dynamic_form');

  if (!stepEntries && !hasContent && !hasFooter) return null;

  return (
    <div
      className={cn(
        unboxed
          ? 'w-full max-w-full'
          : cn(
              'border-border/60 bg-card w-full overflow-hidden rounded-2xl rounded-bl-md border shadow-sm',
              hasDynamicForm ? 'max-w-full' : 'max-w-[92%]'
            ),
        className
      )}
    >
      {stepEntries ? (
        <ActivityTimelineBlock entries={stepEntries} variant="embedded" defaultOpen={false} />
      ) : null}

      {hasContent ? (
        <div className={cn('space-y-2', unboxed ? 'py-1' : 'p-3', stepEntries && 'pt-2')}>
          <ChatBlockRenderer
            blocks={content}
            onResolveAction={onResolveAction}
            onRunQuickAction={onRunQuickAction}
            quickActionsDisabled={quickActionsDisabled}
            onOpenCanvas={onOpenCanvas}
            onSubmitForm={onSubmitForm}
            variant="inline"
          />
        </div>
      ) : null}

      {hasFooter ? (
        <div
          className={cn(
            'border-border/60 border-t py-2.5',
            unboxed ? 'px-0' : 'px-3',
            !hasContent && !stepEntries && 'border-t-0'
          )}
        >
          <QuickActionsBlock
            actions={quickActions}
            disabled={quickActionsDisabled}
            onRunAction={onRunQuickAction}
            showHeading
          />
        </div>
      ) : null}
    </div>
  );
}
