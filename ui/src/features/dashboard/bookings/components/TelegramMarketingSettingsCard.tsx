import * as React from 'react';

import { Clock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

import {
  ManilaReminderTimesEditor,
  sanitizeReminderSlots,
} from '@/features/dashboard/bookings/components/ManilaReminderTimesEditor';
import { TelegramGroupedModalSections } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramGroupedModalSections';
import { TelegramManageDialog } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramManageDialog';
import { TelegramModalNumberField } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramModalNumberField';
import { TelegramModalSaveFooter } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramModalSaveFooter';
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
import {
  useTelegramMarketingSettings,
  useTelegramMarketingTestSend,
  useUpdateTelegramMarketingSettings,
} from '@/features/dashboard/bookings/hooks/useTelegramMarketingSettings';
import { useTelegramNotificationModuleBase } from '@/features/dashboard/bookings/hooks/useTelegramNotificationModuleBase';
import type { TelegramPreviewContext } from '@/features/dashboard/bookings/lib/telegramDraftPreviewApi';
import {
  DEFAULT_MARKETING_NEW_BOOKING_DATES_LIMIT,
  DEFAULT_MARKETING_REMINDER_SLOTS,
  DEFAULT_MARKETING_URGENCY_DAYS,
  MARKETING_TEMPLATE_DEFAULTS,
} from '@/features/dashboard/bookings/lib/telegramNotificationDefaults';
import {
  buildValidPlaceholderKeySet,
  placeholderLinesFromKeys,
} from '@/features/dashboard/bookings/lib/telegramPlaceholderGroups';
import {
  TELEGRAM_MARKETING_PLACEHOLDERS_BY_TAB,
  telegramPlaceholderLinesByTab,
} from '@/features/dashboard/bookings/lib/templatePlaceholderCatalog';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { friendlyToastError, telegramScheduleSyncError } from '@/lib/feedback/toastMessages';
import { getManilaYmdToday, getManilaYmdTomorrow } from '@/utils/format/dates';

function marketingPreviewContext(template: string): TelegramPreviewContext {
  const needsCancelDates = /\{\{cancellation_dates\}\}/.test(template);
  return {
    bot: 'marketing',
    ...(needsCancelDates
      ? {
          checkInYmd: getManilaYmdToday(),
          checkOutYmd: getManilaYmdTomorrow(),
        }
      : {}),
  };
}

const TEMPLATE_DEFS = [
  {
    id: 'tpl-daily-default',
    label: 'Daily Default',
    badge: 'Daily',
    templateKey: 'dailyDefaultTemplate' as const,
    previewLabel: 'Daily default',
    toggleKey: 'notifyOnDailyDefault' as const,
    toggleLabel: 'Send daily default',
    toggleHint: 'Sent at each configured daily time.',
  },
  {
    id: 'tpl-daily-urgency',
    label: 'Daily Urgency',
    badge: 'Daily',
    templateKey: 'dailyUrgencyTemplate' as const,
    previewLabel: 'Daily urgency',
    toggleKey: 'notifyOnDailyUrgency' as const,
    toggleLabel: 'Send daily urgency',
    toggleHint: 'Also sent when the next open check-in is within the urgency threshold.',
  },
  {
    id: 'tpl-new',
    label: 'New Booking',
    badge: 'Instant',
    templateKey: 'newBookingTemplate' as const,
    previewLabel: 'New booking',
    toggleKey: 'notifyOnNewBooking' as const,
    toggleLabel: 'Send on new booking',
    toggleHint: 'When a guest submits a new booking.',
  },
  {
    id: 'tpl-cancel',
    label: 'Cancellation',
    badge: 'Instant',
    templateKey: 'cancellationTemplate' as const,
    previewLabel: 'Cancellation',
    toggleKey: 'notifyOnCancellation' as const,
    toggleLabel: 'Send on cancellation',
    toggleHint: 'When a booking is cancelled in admin.',
  },
] as const;

export function TelegramMarketingSettingsCard({
  embedded: _embedded = true,
}: {
  embedded?: boolean;
}) {
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
    useSettings: useTelegramMarketingSettings,
    useUpdate: useUpdateTelegramMarketingSettings,
    useTestSend: useTelegramMarketingTestSend,
    verify: { action: 'verify_telegram_env', groupLabel: 'Marketing group' },
  });
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);

  const marketingPlaceholdersByTab = React.useMemo(
    () => telegramPlaceholderLinesByTab(TELEGRAM_MARKETING_PLACEHOLDERS_BY_TAB),
    []
  );

  const persistSettings = async (): Promise<boolean> => {
    if (!draft) return false;
    try {
      const result = await update.mutateAsync({
        enabled: draft.enabled,
        notifyOnNewBooking: draft.notifyOnNewBooking,
        notifyOnCancellation: draft.notifyOnCancellation,
        notifyOnDailyDefault: draft.notifyOnDailyDefault,
        notifyOnDailyUrgency: draft.notifyOnDailyUrgency,
        urgencyDaysThreshold: draft.urgencyDaysThreshold,
        newBookingDatesLimit: draft.newBookingDatesLimit,
        dailyReminderTimesManila: sanitizeReminderSlots(draft.dailyReminderTimesManila),
        dailyDefaultTemplate: draft.dailyDefaultTemplate,
        dailyUrgencyTemplate: draft.dailyUrgencyTemplate,
        newBookingTemplate: draft.newBookingTemplate,
        cancellationTemplate: draft.cancellationTemplate,
      });
      markDraftSaved(draft);
      const { cronSync } = (result ?? {}) as { cronSync?: { ok?: boolean } };
      toast.success('Marketing settings saved');
      if (cronSync && cronSync.ok !== true) {
        toast.error(telegramScheduleSyncError());
      }
      return true;
    } catch (e) {
      toast.error(friendlyToastError(e, 'Could not save settings'));
      return false;
    }
  };

  useUnsavedChangesGuard({
    isDirty,
    onSave: persistSettings,
    enabled: !templatesOpen && !scheduleOpen,
  });
  const { onOpenChange: onScheduleOpenChange, dialogProps: scheduleUnsavedProps } = useGuardedClose(
    {
      open: scheduleOpen,
      onOpenChange: setScheduleOpen,
      isDirty,
      onSave: persistSettings,
      onDiscard: discardDraft,
    }
  );

  const runDraftPreview = (text: string) => {
    const needsCancelDates = /\{\{cancellation_dates\}\}/.test(text);
    testSend.mutate(
      {
        action: 'send_draft_preview',
        text,
        ...(needsCancelDates
          ? {
              checkInYmd: getManilaYmdToday(),
              checkOutYmd: getManilaYmdTomorrow(),
            }
          : {}),
      },
      {
        onSuccess: () => toast.success('Preview sent'),
        onError: (e: unknown) => toast.error(friendlyToastError(e, 'Could not send preview')),
      }
    );
  };

  const templateActiveCount = draft
    ? TEMPLATE_DEFS.filter((def) => draft[def.toggleKey]).length
    : 0;
  const scheduleSummary = draft
    ? `${draft.dailyReminderTimesManila.length} daily · urgency ${draft.urgencyDaysThreshold}d · ${draft.newBookingDatesLimit} dates`
    : '';
  const templatesSummary = draft ? `${templateActiveCount} of ${TEMPLATE_DEFS.length} active` : '';

  const resetScheduleDraft = () => {
    setDraft((d) =>
      d
        ? {
            ...d,
            dailyReminderTimesManila: sanitizeReminderSlots(
              DEFAULT_MARKETING_REMINDER_SLOTS.map((slot) => ({ ...slot }))
            ),
            urgencyDaysThreshold: DEFAULT_MARKETING_URGENCY_DAYS,
            newBookingDatesLimit: DEFAULT_MARKETING_NEW_BOOKING_DATES_LIMIT,
          }
        : d
    );
  };

  return (
    <TelegramSettingsModuleGate
      isError={isError}
      error={error}
      loadErrorFallback="Failed to load Telegram settings"
      isLoading={isLoading}
      draft={isReady ? draft : null}
      skeleton={{ manageRows: 2, ariaLabel: 'Loading marketing notification settings' }}
    >
      {draft ? (
        <>
          <TelegramNotificationModuleLayout
            moduleId="marketing"
            enabled={draft.enabled}
            onEnabledChange={onEnabledChange}
            enableLabel="Enable marketing notifications"
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
            manageSectionTitle="Notification controls"
          >
            <TelegramSettingsManageCard
              icon={Clock}
              title="Schedule alerts"
              summary={scheduleSummary}
              disabled={busy}
              onManage={() => setScheduleOpen(true)}
            />
            <TelegramSettingsManageCard
              icon={MessageSquare}
              title="Message templates"
              summary={templatesSummary}
              disabled={busy}
              onManage={() => setTemplatesOpen(true)}
            />
          </TelegramNotificationModuleLayout>

          <TelegramManageDialog
            open={scheduleOpen}
            onOpenChange={onScheduleOpenChange}
            nestedOverlayOpen={scheduleUnsavedProps.open}
            title="Schedule alerts"
            size="wide"
            footer={
              <TelegramModalSaveFooter
                onReset={resetScheduleDraft}
                onClick={() => {
                  persistSettings();
                  setScheduleOpen(false);
                }}
              />
            }
          >
            <TelegramGroupedModalSections
              layout="stacked"
              sections={[
                {
                  label: 'Daily schedule',
                  children: (
                    <ManilaReminderTimesEditor
                      slots={draft.dailyReminderTimesManila}
                      disabled={busy}
                      onChange={(dailyReminderTimesManila) =>
                        setDraft((d) => (d ? { ...d, dailyReminderTimesManila } : d))
                      }
                    />
                  ),
                },
                {
                  label: 'Calendar content',
                  children: (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <TelegramModalNumberField
                        id="urgency-days"
                        label="Urgency threshold (days)"
                        description="When the next open check-in is within this many days, daily broadcasts also send the Daily Urgency template."
                        min={1}
                        max={30}
                        disabled={busy}
                        value={draft.urgencyDaysThreshold}
                        onChange={(urgencyDaysThreshold) =>
                          setDraft((d) => (d ? { ...d, urgencyDaysThreshold } : d))
                        }
                      />
                      <TelegramModalNumberField
                        id="dates-limit"
                        label="New booking date limit"
                        description="Maximum open days in the current month listed in new-booking and availability alerts."
                        min={1}
                        max={31}
                        disabled={busy}
                        value={draft.newBookingDatesLimit}
                        onChange={(newBookingDatesLimit) =>
                          setDraft((d) => (d ? { ...d, newBookingDatesLimit } : d))
                        }
                      />
                    </div>
                  ),
                },
              ]}
            />
          </TelegramManageDialog>

          <UnsavedChangesDialog {...scheduleUnsavedProps} />

          <TelegramTemplatesManageDialog
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            placeholdersByTabId={marketingPlaceholdersByTab}
            previewSampleSet="marketing"
            disabled={busy}
            onSave={persistSettings}
            isDirty={isDirty}
            onDiscard={discardDraft}
            tabs={TEMPLATE_DEFS.map((def) => {
              const { id, label, badge, templateKey } = def;
              const toggleKey = def.toggleKey;
              const toggleChecked = Boolean(draft[toggleKey]);
              const tabPlaceholderLines = placeholderLinesFromKeys(
                TELEGRAM_MARKETING_PLACEHOLDERS_BY_TAB[id] ?? []
              );
              const tabValidKeys = buildValidPlaceholderKeySet(tabPlaceholderLines);

              return {
                id,
                label,
                badge,
                active: toggleChecked,
                content: (
                  <TelegramTemplateTabPanel
                    alert={{
                      id: `${id}-toggle`,
                      label: def.toggleLabel,
                      hint: def.toggleHint,
                      checked: toggleChecked,
                      disabled: busy,
                      onChange: (v) => setDraft((d) => (d ? { ...d, [toggleKey]: v } : d)),
                    }}
                  >
                    <TelegramTemplateEditor
                      id={id}
                      label={label}
                      labelClassName="sr-only"
                      rows={TELEGRAM_TEMPLATE_EDITOR_ROWS}
                      minHeightClassName={TELEGRAM_TEMPLATE_MIN_HEIGHT}
                      value={draft[templateKey]}
                      disabled={busy}
                      previewSampleSet="marketing"
                      validPlaceholderKeys={tabValidKeys}
                      previewContext={marketingPreviewContext(draft[templateKey])}
                      onChange={(v) => setDraft((d) => (d ? { ...d, [templateKey]: v } : d))}
                      onReset={() =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                [templateKey]: MARKETING_TEMPLATE_DEFAULTS[templateKey],
                              }
                            : d
                        )
                      }
                      sendPreviewTitle="Send test with live calendar data."
                      onSendDraft={() => runDraftPreview(draft[templateKey])}
                    />
                  </TelegramTemplateTabPanel>
                ),
              };
            })}
          />
        </>
      ) : null}
    </TelegramSettingsModuleGate>
  );
}
