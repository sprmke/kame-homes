import { ChatRichBody } from '@/components/chat/ChatRichBody';

import { humanizeAssistantStatusText } from '@/features/dashboard/ai-assistant/lib/chatBlockDisplay';

export function TextBlock({ text }: { text: string }) {
  return <ChatRichBody text={humanizeAssistantStatusText(text)} className="text-foreground" />;
}
