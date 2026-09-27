import * as React from 'react';

import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

import { TelegramNotificationModuleLayout } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationModuleLayout';
import { TelegramSettingsManageCard } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramSettingsManageCard';
import { TelegramSettingsModuleGate } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramSettingsModuleGate';
import {
  TELEGRAM_TEMPLATE_EDITOR_ROWS,
  TELEGRAM_TEMPLATE_MIN_HEIGHT,
  TelegramTemplatesManageDialog,
} from '@/features/dashboard/bookings/components/telegram-notifications/TelegramTemplatesManageDialog';
import { TelegramTemplateEditor } from '@/features/dashboard/bookings/components/TelegramTemplateEditor';
import {
  useTelegramChatSettings,
  useTelegramChatTestSend,
  useUpdateTelegramChatSettings,
} from '@/features/dashboard/bookings/hooks/useTelegramChatSettings';
import { useTelegramNotificationModuleBase } from '@/features/dashboard/bookings/hooks/useTelegramNotificationModuleBase';
import { CHAT_TEMPLATE_DEFAULTS } from '@/features/dashboard/bookings/lib/telegramNotificationDefaults';
import {
  buildValidPlaceholderKeySet,
  placeholderLinesFromKeys,
} from '@/features/dashboard/bookings/lib/telegramPlaceholderGroups';
import { TELEGRAM_CHAT_PLACEHOLDER_KEYS } from '@/features/dashboard/bookings/lib/templatePlaceholderCatalog';

import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

export function TelegramChatSettingsCard({ embedded: _embedded = true }: { embedded?: boolean }) {
  const {
    draft,
    setDraft,
    isDirty,
    discardDraft,
    markDraftSaved,
    botToken,
    setBotToken,
    chatId,
    setChatId,
    busy,
    connectionOk,
    connectionLabels,
    connectPending,
    backgroundVerifyPending,
    resetConnection,
    onTestConnection,
    onEnabledChange,
    update,
    testSend,
    isError,
    error,
    isLoading,
    isReady,
  } = useTelegramNotificationModuleBase({
    useSettings: useTelegramChatSettings,
    useUpdate: useUpdateTelegramChatSettings,
    useTestSend: useTelegramChatTestSend,
    verify: { action: 'verify_chat_telegram_env', groupLabel: 'Chat group' },
  });

  const [templatesOpen, setTemplatesOpen] = React.useState(false);

  const placeholderLines = React.useMemo(
    () => placeholderLinesFromKeys(TELEGRAM_CHAT_PLACEHOLDER_KEYS),
    []
  );
  const validKeys = React.useMemo(
    () => buildValidPlaceholderKeySet(placeholderLines),
    [placeholderLines]
  );

  const persistSettings = React.useCallback(async (): Promise<boolean> => {
    if (!draft) return false;
    try {
      await update.mutateAsync({
        enabled: draft.enabled,
        newMessageTemplate: draft.newMessageTemplate,
      });
      markDraftSaved(draft);
      toast.success('Settings saved');
      return true;
    } catch (e) {
      toast.error(friendlyToastError(e, 'Could not save settings'));
      return false;
    }
  }, [draft, markDraftSaved, update]);

  useUnsavedChangesGuard({ isDirty, onSave: persistSettings, enabled: !templatesOpen });

  return (
    <TelegramSettingsModuleGate
      isError={isError}
      error={error}
      loadErrorFallback="Could not load chat notification settings"
      isLoading={isLoading}
      draft={isReady ? draft : null}
      skeleton={{ manageRows: 1, ariaLabel: 'Loading chat notification settings' }}
    >
      {draft ? (
        <>
          <TelegramNotificationModuleLayout
            moduleId="chat"
            enabled={draft.enabled}
            onEnabledChange={onEnabledChange}
            enableLabel="Enable chat notifications"
            disabled={busy}
            botToken={botToken}
            chatId={chatId}
            credentialsStatus={draft.credentials}
            onBotTokenChange={setBotToken}
            onChatIdChange={setChatId}
            onTestConnection={onTestConnection}
            testPending={connectPending}
            connectionOk={connectionOk}
            connectionLabels={connectionLabels}
            chatLabelLoading={backgroundVerifyPending}
            onBotTokenValidated={resetConnection}
            manageSectionTitle="New message"
          >
            <TelegramSettingsManageCard
              icon={MessageCircle}
              title="New message"
              summary="Template for inbound guest chats"
              disabled={busy}
              onManage={() => setTemplatesOpen(true)}
            />
          </TelegramNotificationModuleLayout>

          <TelegramTemplatesManageDialog
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            title="New message"
            placeholdersByTabId={{ default: placeholderLines }}
            previewSampleSet="chat"
            disabled={busy}
            onSave={persistSettings}
            isDirty={isDirty}
            onDiscard={discardDraft}
            tabs={[
              {
                id: 'default',
                label: 'Default message',
                content: (
                  <TelegramTemplateEditor
                    id="chat-tg-template"
                    label="Default message"
                    rows={TELEGRAM_TEMPLATE_EDITOR_ROWS}
                    minHeightClassName={TELEGRAM_TEMPLATE_MIN_HEIGHT}
                    value={draft.newMessageTemplate}
                    disabled={busy}
                    previewSampleSet="chat"
                    validPlaceholderKeys={validKeys}
                    previewContext={{ bot: 'chat' }}
                    sendPreviewTitle="Send test with sample guest chat data."
                    onChange={(v) => setDraft({ ...draft, newMessageTemplate: v })}
                    onReset={() =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              newMessageTemplate: CHAT_TEMPLATE_DEFAULTS.newMessageTemplate,
                            }
                          : d
                      )
                    }
                    onSendDraft={() =>
                      testSend.mutate(
                        {
                          action: 'send_draft_preview',
                          text: draft.newMessageTemplate,
                        },
                        {
                          onSuccess: (result: unknown) => {
                            const j = (result ?? {}) as { sent?: boolean; error?: string };
                            if (j.sent) toast.success('Preview sent');
                            else toast.error(friendlyToastError(j.error, 'Could not send preview'));
                          },
                          onError: (e: unknown) =>
                            toast.error(friendlyToastError(e, 'Could not send preview')),
                        }
                      )
                    }
                  />
                ),
              },
            ]}
          />
        </>
      ) : null}
    </TelegramSettingsModuleGate>
  );
}
