import { useMemo, useState } from 'react';

import { AssistantAiOffCard } from '@/features/dashboard/ai-assistant/components/AssistantAiOffCard';
import { AssistantMemoryDialog } from '@/features/dashboard/ai-assistant/components/AssistantMemoryDialog';
import { ChatComposer } from '@/features/dashboard/ai-assistant/components/ChatComposer';
import { useAiAssistantSession } from '@/features/dashboard/ai-assistant/lib/aiAssistantSessionContext';
import { useAssistantSurface } from '@/features/dashboard/ai-assistant/lib/assistantSurfaceContext';
import {
  SLASH_COMMANDS,
  type SlashCommand,
} from '@/features/dashboard/ai-assistant/lib/composerTriggers';
import { useDashboardMode } from '@/features/dashboard/ai-assistant/lib/dashboardModeContext';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';

type Props = {
  overlayContainer?: HTMLElement | null;
  autoFocus?: boolean;
  className?: string;
};

/**
 * The composer bound to the shared session (draft, pins, send, stop, edit last, `/`, `@`).
 * While AI is switched off it becomes the turn-on card, so a host never types into a dead end.
 */
export function SessionChatComposer({ overlayContainer, autoFocus, className }: Props) {
  const session = useAiAssistantSession();
  const { surface } = useAssistantSurface();
  const { availability, toggleMode } = useDashboardMode();
  const online = useOnlineStatus();
  const [memoryOpen, setMemoryOpen] = useState(false);

  // `/mode` only when the switch is usable; locked plans reach the upgrade modal via the toggle.
  const slashCommands = useMemo(
    () =>
      SLASH_COMMANDS.filter(
        (command) =>
          command.kind !== 'action' ||
          command.action !== 'toggle_mode' ||
          availability === 'available'
      ),
    [availability]
  );

  const runSlashCommand = (command: SlashCommand) => {
    if (command.kind === 'prompt') {
      session.pickSuggestion(command.prompt);
      return;
    }
    if (command.action === 'new_chat') session.newChat();
    if (command.action === 'toggle_mode') toggleMode();
    if (command.action === 'open_memory') setMemoryOpen(true);
  };

  if (session.aiOffReason) {
    return surface === 'full' ? (
      <AssistantAiOffCard className="shadow-elevated" />
    ) : (
      <div className="border-border/60 shrink-0 border-t p-3">
        <AssistantAiOffCard />
      </div>
    );
  }

  return (
    <>
      <ChatComposer
        key={session.composerKey}
        value={session.draft.text}
        onValueChange={session.setDraftText}
        attachedContext={session.draft.context}
        onAttachedContextChange={session.setDraftContext}
        onSend={session.send}
        sending={session.sending}
        onCancel={session.cancelTurn}
        disabled={session.pending || !online}
        overlayContainer={overlayContainer}
        onPickSuggestion={(prompt, attachedContext) =>
          session.pickSuggestion(prompt, attachedContext)
        }
        onEditLast={session.editLastMessage}
        maxRows={surface === 'full' ? 8 : 10}
        autoFocus={autoFocus}
        className={className}
        slashCommands={slashCommands}
        onSlashCommand={runSlashCommand}
      />
      <AssistantMemoryDialog open={memoryOpen} onOpenChange={setMemoryOpen} />
    </>
  );
}
