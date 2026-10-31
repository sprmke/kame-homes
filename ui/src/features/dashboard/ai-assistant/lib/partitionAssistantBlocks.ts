import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { humanizeAssistantQuickActions } from '@/features/dashboard/ai-assistant/lib/humanizeAssistantLabels';

export type PartitionedAssistantBlocks = {
  /** Collapsible step log (activity timeline preferred over task plan). */
  stepEntries: Extract<ChatBlock, { type: 'activity_timeline' }>['entries'] | null;
  /** Main answer — text, cards, stepper, confirmations, etc. */
  content: ChatBlock[];
  /** Follow-up chips shown in the card footer. */
  quickActions: Array<{ label: string; prompt: string }>;
};

/** Splits a flat assistant turn into steps, answer body, and suggested actions. */
export function partitionAssistantBlocks(blocks: ChatBlock[]): PartitionedAssistantBlocks {
  let stepEntries: PartitionedAssistantBlocks['stepEntries'] = null;
  const content: ChatBlock[] = [];
  const quickActions: Array<{ label: string; prompt: string }> = [];
  let hasActivityTimeline = false;

  for (const block of blocks) {
    if (block.type === 'activity_timeline') {
      hasActivityTimeline = true;
      stepEntries = block.entries ?? [];
      continue;
    }
    if (block.type === 'task_plan') {
      if (!hasActivityTimeline && block.steps?.length) {
        stepEntries = block.steps.map((step) => ({
          id: step.id,
          phase: 'tool' as const,
          label: step.label,
          toolName: step.toolName,
          status: step.status === 'failed' ? 'failed' : 'done',
        }));
      }
      continue;
    }
    if (block.type === 'quick_actions') {
      for (const action of block.actions ?? []) {
        if (action.label?.trim() && action.prompt?.trim()) {
          quickActions.push({ label: action.label, prompt: action.prompt });
        }
      }
      continue;
    }
    content.push(block);
  }

  return {
    stepEntries: stepEntries && stepEntries.length > 0 ? stepEntries : null,
    content,
    quickActions: humanizeAssistantQuickActions(quickActions, content),
  };
}
