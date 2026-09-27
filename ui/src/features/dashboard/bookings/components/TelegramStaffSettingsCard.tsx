import * as React from 'react';

import { Clock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

import {
  ManilaTimeField,
  formatManilaTimeLabel,
} from '@/features/dashboard/bookings/components/ManilaReminderTimesEditor';
import { TelegramGroupedModalSections } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramGroupedModalSections';
import { TelegramManageDialog } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramManageDialog';
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
import { useTelegramNotificationModuleBase } from '@/features/dashboard/bookings/hooks/useTelegramNotificationModuleBase';
import {
  useTelegramStaffSettings,
  useTelegramStaffTestSend,
  useUpdateTelegramStaffSettings,
  type StaffScenarioMeta,
  type StaffDraftScenario,
} from '@/features/dashboard/bookings/hooks/useTelegramStaffSettings';
import {
  DEFAULT_STAFF_DAILY_SUMMARY_TIME,
  STAFF_TEMPLATE_DEFAULTS,
} from '@/features/dashboard/bookings/lib/telegramNotificationDefaults';
import {
  buildValidPlaceholderKeySet,
  placeholderLinesFromKeys,
} from '@/features/dashboard/bookings/lib/telegramPlaceholderGroups';
import {
  TELEGRAM_STAFF_PLACEHOLDERS_BY_TAB,
  telegramPlaceholderLinesByTab,
} from '@/features/dashboard/bookings/lib/templatePlaceholderCatalog';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { friendlyToastError, telegramScheduleSyncError } from '@/lib/feedback/toastMessages';

const STAFF_TEMPLATES = [
  {
    id: 'daily_summary',
    label: 'Daily Summary',
    templateKey: 'dailySummaryTemplate' as const,
    scenario: 'daily_summary' as const,
    toggleKey: 'notifyOnDailySummary' as const,
    toggleLabel: 'Send daily summary',
    toggleHint: 'Sent at the configured daily summary time when there are check-ins today.',
  },
  {
    id: 'daily_summary_no_bookings',
    label: 'No Bookings',
    templateKey: 'dailySummaryNoBookingsTemplate' as const,
    scenario: 'daily_summary_no_bookings' as const,
    toggleKey: 'notifyOnDailySummaryNoBookings' as const,
    toggleLabel: 'Send no-bookings summary',
    toggleHint: 'Sent instead of the daily summary when there are no check-ins today.',
  },
  {
    id: 'same_day_checkin',
    label: 'Same-Day Check-In',
    templateKey: 'sameDayCheckinTemplate' as const,
    scenario: 'same_day_checkin' as const,
    toggleKey: 'notifyOnSameDayCheckin' as const,
    toggleLabel: 'Send same-day alert',
    toggleHint: 'Instant alert from the daily summary time on check-in day.',
  },
] as const;

function scenarioBadge(type: StaffScenarioMeta['type']) {
  return type === 'event' ? 'Instant' : 'Daily';
}

export function TelegramStaffSettingsCard({ embedded: _embedded = true }: { embedded?: boolean }) {
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
    useSettings: useTelegramStaffSettings,
    useUpdate: useUpdateTelegramStaffSettings,
    useTestSend: useTelegramStaffTestSend,
    verify: { action: 'verify_staff_telegram_env', groupLabel: 'Staff group' },
  });
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);

  const staffPlaceholdersByTab = React.useMemo(
    () => telegramPlaceholderLinesByTab(TELEGRAM_STAFF_PLACEHOLDERS_BY_TAB),
    []
  );

  const scenarioMetaById = React.useMemo(() => {
    const map = new Map<string, StaffScenarioMeta>();
    for (const s of draft?.scenarios ?? []) map.set(s.id, s);
    return map;
  }, [draft?.scenarios]);

  const persistSettings = async (): Promise<boolean> => {
    if (!draft) return false;
    try {
      const result = await update.mutateAsync({
        enabled: draft.enabled,
        notifyOnSameDayCheckin: draft.notifyOnSameDayCheckin,
        notifyOnDailySummary: draft.notifyOnDailySummary,
        notifyOnDailySummaryNoBookings: draft.notifyOnDailySummaryNoBookings,
        dailySummaryTemplate: draft.dailySummaryTemplate,
        dailySummaryNoBookingsTemplate: draft.dailySummaryNoBookingsTemplate,
        sameDayCheckinTemplate: draft.sameDayCheckinTemplate,
        dailySummaryTimeManila: draft.dailySummaryTimeManila,
      });
      markDraftSaved(draft);
      const { cronSync } = (result ?? {}) as { cronSync?: { ok?: boolean } };
      toast.success('Staff settings saved');
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

  const onSendDraftPreview = (scenario: StaffDraftScenario, text: string) => {
    if (!text.trim()) {
      toast.error('Template is empty');
      return;
    }
    testSend.mutate(
      { action: 'send_draft_preview', text, scenario },
      {
        onSuccess: (j: { sent?: boolean; error?: string }) => {
          if (j.sent) toast.success('Preview sent');
          else toast.error(friendlyToastError(j.error, 'Could not send preview'));
        },
        onError: (e: unknown) => toast.error(friendlyToastError(e, 'Could not send preview')),
      }
    );
  };

  const templateActiveCount = draft
    ? STAFF_TEMPLATES.filter((def) => draft[def.toggleKey]).length
    : 0;
  const scheduleSummary = draft
    ? `Daily ${formatManilaTimeLabel(draft.dailySummaryTimeManila)}`
    : '';
  const templatesSummary = draft
    ? `${templateActiveCount} of ${STAFF_TEMPLATES.length} active`
    : '';

  const resetScheduleDraft = () => {
    setDraft((d) =>
      d
        ? {
            ...d,
            dailySummaryTimeManila: { ...DEFAULT_STAFF_DAILY_SUMMARY_TIME },
          }
        : d
    );
  };

  return (
    <TelegramSettingsModuleGate
      isError={isError}
      error={error}
      loadErrorFallback="Failed to load staff settings"
      isLoading={isLoading}
      draft={isReady ? draft : null}
      skeleton={{ manageRows: 2, ariaLabel: 'Loading staff notification settings' }}
    >
      {draft ? (
        <>
          <TelegramNotificationModuleLayout
            moduleId="staff"
            enabled={draft.enabled}
            onEnabledChange={onEnabledChange}
            enableLabel="Enable staff notifications"
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
              sections={[
                {
                  label: 'Daily summary',
                  children: (
                    <ManilaTimeField
                      inputId="staff-slot-time"
                      slot={draft.dailySummaryTimeManila}
                      disabled={busy}
                      onChange={(dailySummaryTimeManila) =>
                        setDraft((d) => (d ? { ...d, dailySummaryTimeManila } : d))
                      }
                    />
                  ),
                },
              ]}
            />
          </TelegramManageDialog>

          <UnsavedChangesDialog {...scheduleUnsavedProps} />

          <TelegramTemplatesManageDialog
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            placeholdersByTabId={staffPlaceholdersByTab}
            previewSampleSet="staff"
            disabled={busy}
            onSave={persistSettings}
            isDirty={isDirty}
            onDiscard={discardDraft}
            tabs={STAFF_TEMPLATES.map((def) => {
              const { id, label, templateKey, scenario, toggleKey } = def;
              const meta = scenarioMetaById.get(id);
              const templateValue = String(draft[templateKey] ?? '');
              const toggleChecked = Boolean(draft[toggleKey]);
              const tabPlaceholderLines = placeholderLinesFromKeys(
                TELEGRAM_STAFF_PLACEHOLDERS_BY_TAB[id] ?? []
              );
              const tabValidKeys = buildValidPlaceholderKeySet(tabPlaceholderLines);
              const triggerHint =
                meta?.trigger ??
                (id === 'same_day_checkin'
                  ? `From ${formatManilaTimeLabel(draft.dailySummaryTimeManila)} on check-in day.`
                  : def.toggleHint);

              return {
                id,
                label,
                badge: meta ? scenarioBadge(meta.type) : undefined,
                active: toggleChecked,
                content: (
                  <TelegramTemplateTabPanel
                    alert={{
                      id: `${id}-toggle`,
                      label: def.toggleLabel,
                      hint: triggerHint,
                      checked: toggleChecked,
                      disabled: busy,
                      onChange: (v) => setDraft((d) => (d ? { ...d, [toggleKey]: v } : d)),
                    }}
                  >
                    <TelegramTemplateEditor
                      id={`staff-template-${id}`}
                      label={label}
                      labelClassName="sr-only"
                      value={templateValue}
                      disabled={busy}
                      rows={TELEGRAM_TEMPLATE_EDITOR_ROWS}
                      minHeightClassName={TELEGRAM_TEMPLATE_MIN_HEIGHT}
                      mono
                      previewSampleSet="staff"
                      validPlaceholderKeys={tabValidKeys}
                      previewContext={{ bot: 'staff', scenario }}
                      sendPreviewTitle="Send test with live booking data."
                      onChange={(v) => setDraft((d) => (d ? { ...d, [templateKey]: v } : d))}
                      onReset={() =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                [templateKey]: STAFF_TEMPLATE_DEFAULTS[templateKey],
                              }
                            : d
                        )
                      }
                      onSendDraft={() => onSendDraftPreview(scenario, templateValue)}
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
