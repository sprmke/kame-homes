import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import { markdownToPlainText, stripInlineMarkdown } from '@/lib/chat/inlineMarkdown';

/**
 * Plain-text copy of one assistant turn ("Copy" action). Keeps what a host would paste into a
 * message or note; progress / plan / form chrome and markdown markers are dropped.
 */
export function assistantBlocksToPlainText(blocks: ChatBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        if (block.text.trim()) parts.push(markdownToPlainText(block.text.trim()));
        break;
      case 'stat_list':
        parts.push(
          [
            block.title,
            ...block.items.map(
              (item) => `- ${stripInlineMarkdown(item.label)}: ${stripInlineMarkdown(item.value)}`
            ),
          ]
            .filter(Boolean)
            .join('\n')
        );
        break;
      case 'data_table': {
        const header = block.columns.join('\t');
        const rows = block.rows.map((row) =>
          block.columns.map((column) => stripInlineMarkdown(String(row[column] ?? ''))).join('\t')
        );
        parts.push([block.title, header, ...rows].filter(Boolean).join('\n'));
        break;
      }
      case 'link_list':
        parts.push(
          [block.title, ...block.links.map((link) => `- ${link.label}`)].filter(Boolean).join('\n')
        );
        break;
      case 'booking_card':
        parts.push(
          `${block.guestName} (${block.propertyName}): ${block.checkIn} to ${block.checkOut}`
        );
        break;
      case 'flow':
        parts.push(
          [block.title, ...block.steps.map((step, i) => `${i + 1}. ${stripInlineMarkdown(step)}`)]
            .filter(Boolean)
            .join('\n')
        );
        break;
      case 'stepper':
        parts.push(
          [block.title, ...block.steps.map((step, i) => `${i + 1}. ${step.label}`)]
            .filter(Boolean)
            .join('\n')
        );
        break;
      case 'action_confirmation':
        parts.push(block.summary);
        break;
      case 'open_page':
        parts.push(block.label);
        break;
      default:
        break;
    }
  }
  return parts.join('\n\n').trim();
}
