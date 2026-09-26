import { ActionConfirmationBlock } from '@/features/dashboard/ai-assistant/components/blocks/ActionConfirmationBlock';
import { ActivityTimelineBlock } from '@/features/dashboard/ai-assistant/components/blocks/ActivityTimelineBlock';
import { BookingCardBlock } from '@/features/dashboard/ai-assistant/components/blocks/BookingCardBlock';
import { ChatCanvasCompactCard } from '@/features/dashboard/ai-assistant/components/blocks/ChatCanvasCompactCard';
import { DataTableBlock } from '@/features/dashboard/ai-assistant/components/blocks/DataTableBlock';
import { DiagramBlock } from '@/features/dashboard/ai-assistant/components/blocks/DiagramBlock';
import { DynamicFormBlock } from '@/features/dashboard/ai-assistant/components/blocks/DynamicFormBlock';
import { FileListBlock } from '@/features/dashboard/ai-assistant/components/blocks/FileListBlock';
import { FlowBlock } from '@/features/dashboard/ai-assistant/components/blocks/FlowBlock';
import { ImageBlock } from '@/features/dashboard/ai-assistant/components/blocks/ImageBlock';
import { LinkListBlock } from '@/features/dashboard/ai-assistant/components/blocks/LinkListBlock';
import { MapBlock } from '@/features/dashboard/ai-assistant/components/blocks/MapBlock';
import { QuickActionsBlock } from '@/features/dashboard/ai-assistant/components/blocks/QuickActionsBlock';
import { StatListBlock } from '@/features/dashboard/ai-assistant/components/blocks/StatListBlock';
import { StepperBlock } from '@/features/dashboard/ai-assistant/components/blocks/StepperBlock';
import { TaskPlanBlock } from '@/features/dashboard/ai-assistant/components/blocks/TaskPlanBlock';
import { TextBlock } from '@/features/dashboard/ai-assistant/components/blocks/TextBlock';
import type {
  ChatBlock,
  ConfirmActionResponse,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { isCanvasWorthyBlock } from '@/features/dashboard/ai-assistant/lib/chatBlockDisplay';

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
  variant?: 'inline' | 'canvas';
};

/** Dispatches on block.type — unknown block types are dropped, never rendered raw. */
export function ChatBlockRenderer({
  blocks,
  onResolveAction,
  onRunQuickAction,
  quickActionsDisabled,
  onOpenCanvas,
  onSubmitForm,
  variant = 'inline',
}: Props) {
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        if (variant === 'inline' && isCanvasWorthyBlock(block) && onOpenCanvas) {
          return <ChatCanvasCompactCard key={i} block={block} onOpen={() => onOpenCanvas(block)} />;
        }
        switch (block.type) {
          case 'text':
            return <TextBlock key={i} text={block.text} />;
          case 'booking_card':
            return <BookingCardBlock key={i} {...block} />;
          case 'stat_list':
            return <StatListBlock key={i} {...block} />;
          case 'data_table':
            return <DataTableBlock key={i} {...block} />;
          case 'link_list':
            return <LinkListBlock key={i} {...block} />;
          case 'file_list':
            return <FileListBlock key={i} {...block} />;
          case 'image':
            return <ImageBlock key={i} {...block} />;
          case 'flow':
            return <FlowBlock key={i} {...block} />;
          case 'diagram':
            return <DiagramBlock key={i} {...block} />;
          case 'map':
            return <MapBlock key={i} {...block} />;
          case 'stepper':
            return <StepperBlock key={i} {...block} onResolveAction={onResolveAction} />;
          case 'activity_timeline':
            return <ActivityTimelineBlock key={i} entries={block.entries} />;
          case 'task_plan':
            return <TaskPlanBlock key={i} title={block.title} steps={block.steps} />;
          case 'quick_actions':
            return (
              <QuickActionsBlock
                key={i}
                actions={block.actions}
                disabled={quickActionsDisabled}
                onRunAction={onRunQuickAction}
              />
            );
          case 'dynamic_form':
            return (
              <DynamicFormBlock
                key={i}
                {...block}
                onSubmit={onSubmitForm}
                disabled={quickActionsDisabled || block.status === 'submitted'}
              />
            );
          case 'action_confirmation':
            return <ActionConfirmationBlock key={i} {...block} onResolve={onResolveAction} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
