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
import { TelegramTemplateTabPanel } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramTemplateTabPanel';
import { TelegramTemplateEditor } from '@/features/dashboard/bookings/components/TelegramTemplateEditor';
import { useTelegramNotificationModuleBase } from '@/features/dashboard/bookings/hooks/useTelegramNotificationModuleBase';
import {
  buildValidPlaceholderKeySet,
  placeholderLinesFromKeys,
} from '@/features/dashboard/bookings/lib/telegramPlaceholderGroups';
import {
  useTelegramParkingSettings,
  useTelegramParkingTestSend,
  useUpdateTelegramParkingSettings,
  type TelegramParkingSettingsDto,
} from '@/features/dashboard/parking/hooks/useTelegramParkingSettings';
import { PARKING_TELEGRAM_PLACEHOLDER_KEYS } from '@/features/dashboard/parking/lib/parkingTelegramPlaceholders';

import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

const TEMPLATE_DEFAULTS = {
  reservationRequestTemplate: 'New parking reservation request for {{slot_label}}.',
  checkInReminderTemplate: 'Parking check-in reminder: {{slot_label}} on {{check_in_date}}.',
  paymentReceivedTemplate: 'Payment received for parking {{slot_label}}.',
} as const;

type TemplateKey = keyof typeof TEMPLATE_DEFAULTS;

const TEMPLATE_TABS: {
  id: TemplateKey;
  label: string;
  notifyKey: keyof TelegramParkingSettingsDto;
}[] = [
  {
    id: 'reservationRequestTemplate',
    label: 'Reservation request',
    notifyKey: 'notifyOnReservationRequest',
  },
  {
    id: 'checkInReminderTemplate',
    label: 'Check-in reminder',
    notifyKey: 'notifyOnCheckInReminder',
  },
  {
    id: 'paymentReceivedTemplate',
    label: 'Payment received',
    notifyKey: 'notifyOnPaymentReceived',
  },
];

export function TelegramParkingSettingsCard() {
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
    useSettings: useTelegramParkingSettings,
    useUpdate: useUpdateTelegramParkingSettings,
    useTestSend: useTelegramParkingTestSend,
    verify: { action: 'verify_parking_telegram_env', groupLabel: 'Parking group' },
  });

  const [templatesOpen, setTemplatesOpen] = React.useState(false);

  const placeholderLines = React.useMemo(
    () => placeholderLinesFromKeys(PARKING_TELEGRAM_PLACEHOLDER_KEYS),
    []
  );
  const validKeys = React.useMemo(
    () => buildValidPlaceholderKeySet(placeholderLines),
    [placeholderLines]
  );

  const activeTemplates = draft
    ? TEMPLATE_TABS.filter((tab) => Boolean(draft[tab.notifyKey])).length
    : 0;

  const persistSettings = async (): Promise<boolean> => {
    if (!draft) return false;
    try {
      await update.mutateAsync({
        enabled: draft.enabled,
        reservationRequestTemplate: draft.reservationRequestTemplate,
        checkInReminderTemplate: draft.checkInReminderTemplate,
        paymentReceivedTemplate: draft.paymentReceivedTemplate,
        notifyOnReservationRequest: draft.notifyOnReservationRequest,
        notifyOnCheckInReminder: draft.notifyOnCheckInReminder,
        notifyOnPaymentReceived: draft.notifyOnPaymentReceived,
      });
      markDraftSaved(draft);
      toast.success('Parking notifications saved');
      return true;
    } catch (e) {
      toast.error(friendlyToastError(e, 'Could not save parking notifications'));
      return false;
    }
  };

  useUnsavedChangesGuard({ isDirty, onSave: persistSettings, enabled: !templatesOpen });

  const onSendDraftPreview = (text: string) => {
    if (!text.trim()) {
      toast.error('Template is empty');
      return;
    }
    testSend.mutate(
      { action: 'send_draft_preview', text },
      {
        onSuccess: (j: { sent?: boolean; error?: string }) => {
          if (j.sent) toast.success('Preview sent');
          else toast.error(friendlyToastError(j.error, 'Could not send preview'));
        },
        onError: (e: unknown) => toast.error(friendlyToastError(e, 'Could not send preview')),
      }
    );
  };

  return (
    <TelegramSettingsModuleGate
      isError={isError}
      error={error}
      loadErrorFallback="Failed to load parking notification settings"
      isLoading={isLoading}
      draft={isReady ? draft : null}
      skeleton={{ manageRows: 1, ariaLabel: 'Loading parking notification settings' }}
    >
      {draft ? (
        <>
          <TelegramNotificationModuleLayout
            moduleId="parking"
            enabled={draft.enabled}
            onEnabledChange={onEnabledChange}
            enableLabel="Enable parking notifications"
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
            manageSectionTitle="Message templates"
          >
            <TelegramSettingsManageCard
              icon={MessageSquare}
              title="Message templates"
              summary={`${activeTemplates} of ${TEMPLATE_TABS.length} alerts active`}
              disabled={busy}
              onManage={() => setTemplatesOpen(true)}
            />
          </TelegramNotificationModuleLayout>

          <TelegramTemplatesManageDialog
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            title="Parking messages"
            placeholdersByTabId={{ parking: placeholderLines }}
            previewSampleSet="parking"
            disabled={busy}
            onSave={persistSettings}
            isDirty={isDirty}
            onDiscard={discardDraft}
            tabs={TEMPLATE_TABS.map((tab) => ({
              id: tab.id,
              label: tab.label,
              content: (
                <TelegramTemplateTabPanel
                  alert={{
                    id: `parking-notify-${tab.id}`,
                    label: `Send ${tab.label.toLowerCase()}`,
                    checked: Boolean(draft[tab.notifyKey]),
                    disabled: busy,
                    onChange: (value) =>
                      setDraft((current) =>
                        current ? { ...current, [tab.notifyKey]: value } : current
                      ),
                  }}
                >
                  <TelegramTemplateEditor
                    id={`parking-template-${tab.id}`}
                    label={tab.label}
                    rows={TELEGRAM_TEMPLATE_EDITOR_ROWS}
                    minHeightClassName={TELEGRAM_TEMPLATE_MIN_HEIGHT}
                    value={draft[tab.id]}
                    disabled={busy}
                    previewSampleSet="parking"
                    validPlaceholderKeys={validKeys}
                    sendPreviewTitle="Send test message with sample parking data."
                    onChange={(value) =>
                      setDraft((current) => (current ? { ...current, [tab.id]: value } : current))
                    }
                    onReset={() =>
                      setDraft((current) =>
                        current ? { ...current, [tab.id]: TEMPLATE_DEFAULTS[tab.id] } : current
                      )
                    }
                    onSendDraft={() => onSendDraftPreview(draft[tab.id])}
                  />
                </TelegramTemplateTabPanel>
              ),
            }))}
          />
        </>
      ) : null}
    </TelegramSettingsModuleGate>
  );
}
