import * as React from 'react';

import { MessageSquare } from 'lucide-react';
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
import type { PropertyTelegramCredentialsStatus } from '@/features/dashboard/bookings/hooks/useAppSettings';
import {
  useTelegramNotificationModuleBase,
  type TestSendMutate,
  type UpdateMutate,
} from '@/features/dashboard/bookings/hooks/useTelegramNotificationModuleBase';
import {
  buildValidPlaceholderKeySet,
  placeholderLinesFromKeys,
} from '@/features/dashboard/bookings/lib/telegramPlaceholderGroups';

import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { friendlyToastError, telegramScheduleSyncError } from '@/lib/feedback/toastMessages';

import type { LucideIcon } from 'lucide-react';

type TelegramSingleTemplateDto = {
  enabled: boolean;
  credentials?: PropertyTelegramCredentialsStatus;
  defaultReminderTemplate: string;
  dailyCheckTimeManila: { hour: number; minute: number };
};

type Props<TDto extends TelegramSingleTemplateDto> = {
  embedded?: boolean;
  moduleId: 'finance' | 'maintenance';
  enableLabel: string;
  manageSummary: string;
  editorId: string;
  previewSampleSet: 'finance' | 'maintenance';
  previewContextBot: 'finance' | 'maintenance';
  sendPreviewTitle: string;
  placeholderKeys: readonly string[];
  templateDefaults: { defaultReminderTemplate: string };
  loadErrorFallback: string;
  skeletonAriaLabel: string;
  manageIcon?: LucideIcon;
  useSettings: () => {
    data?: TDto;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
  };
  useUpdate: () => UpdateMutate;
  useTestSend: () => TestSendMutate;
  verify: { action: string; groupLabel: string };
};

export function TelegramSingleTemplateSettingsCard<TDto extends TelegramSingleTemplateDto>({
  embedded: _embedded = true,
  moduleId,
  enableLabel,
  manageSummary,
  editorId,
  previewSampleSet,
  previewContextBot,
  sendPreviewTitle,
  placeholderKeys,
  templateDefaults,
  loadErrorFallback,
  skeletonAriaLabel,
  manageIcon: ManageIcon = MessageSquare,
  useSettings,
  useUpdate,
  useTestSend,
  verify,
}: Props<TDto>) {
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
    useSettings,
    useUpdate,
    useTestSend,
    verify,
  });

  const [templatesOpen, setTemplatesOpen] = React.useState(false);

  const placeholderLines = React.useMemo(
    () => placeholderLinesFromKeys(placeholderKeys),
    [placeholderKeys]
  );
  const validKeys = React.useMemo(
    () => buildValidPlaceholderKeySet(placeholderLines),
    [placeholderLines]
  );

  const persistSettings = React.useCallback(async (): Promise<boolean> => {
    if (!draft) return false;
    try {
      const result = await update.mutateAsync({
        enabled: draft.enabled,
        defaultReminderTemplate: draft.defaultReminderTemplate,
        dailyCheckTimeManila: draft.dailyCheckTimeManila,
      });
      markDraftSaved(draft);
      const { cronSync } = (result ?? {}) as { cronSync?: { ok?: boolean } };
      toast.success('Settings saved');
      if (cronSync && cronSync.ok !== true) {
        toast.error(telegramScheduleSyncError());
      }
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
      loadErrorFallback={loadErrorFallback}
      isLoading={isLoading}
      draft={isReady ? draft : null}
      skeleton={{ manageRows: 1, ariaLabel: skeletonAriaLabel }}
    >
      {draft ? (
        <>
          <TelegramNotificationModuleLayout
            moduleId={moduleId}
            enabled={draft.enabled}
            onEnabledChange={onEnabledChange}
            enableLabel={enableLabel}
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
            manageSectionTitle="Reminder message"
          >
            <TelegramSettingsManageCard
              icon={ManageIcon}
              title="Reminder message"
              summary={manageSummary}
              disabled={busy}
              onManage={() => setTemplatesOpen(true)}
            />
          </TelegramNotificationModuleLayout>

          <TelegramTemplatesManageDialog
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            title="Reminder message"
            placeholdersByTabId={{ default: placeholderLines }}
            previewSampleSet={previewSampleSet}
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
                    id={editorId}
                    label="Default message"
                    rows={TELEGRAM_TEMPLATE_EDITOR_ROWS}
                    minHeightClassName={TELEGRAM_TEMPLATE_MIN_HEIGHT}
                    value={draft.defaultReminderTemplate}
                    disabled={busy}
                    previewSampleSet={previewSampleSet}
                    validPlaceholderKeys={validKeys}
                    previewContext={{ bot: previewContextBot }}
                    sendPreviewTitle={sendPreviewTitle}
                    onChange={(v) => setDraft({ ...draft, defaultReminderTemplate: v })}
                    onReset={() =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              defaultReminderTemplate: templateDefaults.defaultReminderTemplate,
                            }
                          : d
                      )
                    }
                    onSendDraft={() =>
                      testSend.mutate(
                        {
                          action: 'send_draft_preview',
                          text: draft.defaultReminderTemplate,
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
