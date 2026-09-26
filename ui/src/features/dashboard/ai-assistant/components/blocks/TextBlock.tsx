import { humanizeAssistantStatusText } from '@/features/dashboard/ai-assistant/lib/chatBlockDisplay';

import { ChatRichBody } from '@/components/chat/ChatRichBody';


export function TextBlock({ text }: { text: string }) {
  return <ChatRichBody text={humanizeAssistantStatusText(text)} className="text-foreground" />;
}
