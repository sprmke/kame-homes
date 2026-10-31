import { createContext, useContext } from 'react';

import type { AiAssistantChatState } from '@/features/dashboard/ai-assistant/hooks/useAiAssistantChat';
import type {
  ChatBlock,
  ConfirmActionResponse,
  PageContext,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import type { AssistantAiOffReason } from '@/features/dashboard/ai-assistant/lib/assistantAiOff';
import type { AssistantDraft } from '@/features/dashboard/ai-assistant/lib/assistantDraftStore';
import type { AssistantSuggestion } from '@/features/dashboard/ai-assistant/lib/assistantSuggestions';
import type { AttachedContextItem } from '@/features/dashboard/ai-assistant/lib/attachedContext';
import type { ChatSendInput } from '@/features/dashboard/ai-assistant/lib/chatAttachments';

/**
 * One assistant session per admin shell, shared by the sheet (Advanced mode) and the full-page
 * workspace (AI mode). Every behavior lives here so both surfaces stay identical; surfaces only
 * choose layout. Docs: docs/workflow/in-progress/ai-chat-mode.md §3a.
 */
export type AiAssistantSessionValue = AiAssistantChatState & {
  pageContext: PageContext;
  /** Kill switches on but plan blocks new messages: history stays readable. */
  readOnly: boolean;
  /** AI is off at a layer the host (or a super admin) must switch on; replaces the composer. */
  aiOffReason: AssistantAiOffReason | null;
  usageLabel: string | null;

  draft: AssistantDraft;
  setDraftText: (text: string) => void;
  setDraftContext: (context: AttachedContextItem[]) => void;
  /** Bumps when the composer must drop transient state (files, voice) — new chat, load. */
  composerKey: number;

  questions: AssistantSuggestion[];
  actions: AssistantSuggestion[];

  /** Block opened in the sheet's canvas overlay (tables, forms, diagrams). */
  canvasBlock: ChatBlock | null;
  setCanvasBlock: (block: ChatBlock | null) => void;

  /** User message currently being edited in place (edit & resend). */
  editingMessageId: string | null;
  setEditingMessageId: (id: string | null) => void;
  /** Up arrow in an empty composer: edit the last user message. */
  editLastMessage: () => boolean;

  send: (input: ChatSendInput) => void;
  pickSuggestion: (prompt: string, attachedContext?: AttachedContextItem[]) => void;
  runQuickAction: (action: { label: string; prompt: string }) => void;
  submitForm: (
    block: Extract<ChatBlock, { type: 'dynamic_form' }>,
    values: Record<string, string>
  ) => void;
  regenerate: () => void;
  submitEdit: (messageId: string, text: string) => void;
  confirmAction: (actionId: string, confirm: boolean) => Promise<ConfirmActionResponse | null>;
  newChat: () => void;
  selectConversation: (conversationId: string) => void;
  onConversationDeleted: (conversationId: string) => void;
};

export const AiAssistantSessionContext = createContext<AiAssistantSessionValue | null>(null);

export function useAiAssistantSession(): AiAssistantSessionValue {
  const value = useContext(AiAssistantSessionContext);
  if (!value)
    throw new Error('useAiAssistantSession must be used inside AiAssistantSessionProvider');
  return value;
}

export function useOptionalAiAssistantSession(): AiAssistantSessionValue | null {
  return useContext(AiAssistantSessionContext);
}
