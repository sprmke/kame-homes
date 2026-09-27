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
import {
  useTelegramAdminSettings,
  useTelegramAdminTestSend,
  useUpdateTelegramAdminSettings,
  type AdminDraftScenario,
  type AdminScenarioMeta,
  type TelegramAdminSettingsDto,
} from '@/features/dashboard/bookings/hooks/useTelegramAdminSettings';
import { useTelegramNotificationModuleBase } from '@/features/dashboard/bookings/hooks/useTelegramNotificationModuleBase';
import { ADMIN_TEMPLATE_DEFAULTS } from '@/features/dashboard/bookings/lib/telegramNotificationDefaults';
import {
  buildValidPlaceholderKeySet,
  placeholderLinesFromKeys,
} from '@/features/dashboard/bookings/lib/telegramPlaceholderGroups';
import {
  TELEGRAM_ADMIN_PLACEHOLDERS_BY_TAB,
  telegramPlaceholderLinesByTab,
} from '@/features/dashboard/bookings/lib/templatePlaceholderCatalog';

import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { friendlyToastError, telegramScheduleSyncError } from '@/lib/feedback/toastMessages';

type ScenarioKey =
  | 'newBooking'
  | 'pendingDocs'
  | 'balanceReceipt'
  | 'balanceReceiptUploaded'
  | 'sdFormSubmitted'
  | 'sdRefundPending';

const SCENARIO_CONFIG: Record<
  ScenarioKey,
  {
    scenarioId: AdminDraftScenario;
    toggleKey: keyof TelegramAdminSettingsDto;
    templateKey: keyof TelegramAdminSettingsDto;
    patchToggleKey:
      | 'notifyOnNewBooking'
      | 'notifyOnSdFormSubmitted'
      | 'notifyOnBalanceReceiptUploaded'
      | 'notifyPendingDocsHourly'
      | 'notifyBalanceReceiptHourly'
      | 'notifySdRefundPendingHourly';
    patchTemplateKey:
      | 'newBookingTemplate'
      | 'pendingDocsTemplate'
      | 'balanceReceiptTemplate'
      | 'balanceReceiptUploadedTemplate'
      | 'sdFormSubmittedTemplate'
      | 'sdRefundPendingTemplate';
  }
> = {
  newBooking: {
    scenarioId: 'new_booking',
    toggleKey: 'notifyOnNewBooking',
    templateKey: 'newBookingTemplate',
    patchToggleKey: 'notifyOnNewBooking',
    patchTemplateKey: 'newBookingTemplate',
  },
  pendingDocs: {
    scenarioId: 'pending_docs',
    toggleKey: 'notifyPendingDocsHourly',
    templateKey: 'pendingDocsTemplate',
    patchToggleKey: 'notifyPendingDocsHourly',
    patchTemplateKey: 'pendingDocsTemplate',
  },
  balanceReceipt: {
    scenarioId: 'balance_receipt',
    toggleKey: 'notifyBalanceReceiptHourly',
    templateKey: 'balanceReceiptTemplate',
    patchToggleKey: 'notifyBalanceReceiptHourly',
    patchTemplateKey: 'balanceReceiptTemplate',
  },
  balanceReceiptUploaded: {
    scenarioId: 'balance_receipt_uploaded',
    toggleKey: 'notifyOnBalanceReceiptUploaded',
    templateKey: 'balanceReceiptUploadedTemplate',
    patchToggleKey: 'notifyOnBalanceReceiptUploaded',
    patchTemplateKey: 'balanceReceiptUploadedTemplate',
  },
  sdFormSubmitted: {
    scenarioId: 'sd_form_submitted',
    toggleKey: 'notifyOnSdFormSubmitted',
    templateKey: 'sdFormSubmittedTemplate',
    patchToggleKey: 'notifyOnSdFormSubmitted',
    patchTemplateKey: 'sdFormSubmittedTemplate',
  },
  sdRefundPending: {
    scenarioId: 'sd_refund_pending',
    toggleKey: 'notifySdRefundPendingHourly',
    templateKey: 'sdRefundPendingTemplate',
    patchToggleKey: 'notifySdRefundPendingHourly',
    patchTemplateKey: 'sdRefundPendingTemplate',
  },
};

const SCENARIO_ORDER: ScenarioKey[] = [
  'newBooking',
  'pendingDocs',
  'balanceReceipt',
  'balanceReceiptUploaded',
  'sdFormSubmitted',
  'sdRefundPending',
];

function scenarioBadge(type: AdminScenarioMeta['type']) {
  return type === 'event' ? 'Instant' : 'Hourly';
}

export function TelegramAdminSettingsCard({ embedded: _embedded = true }: { embedded?: boolean }) {
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
    useSettings: useTelegramAdminSettings,
    useUpdate: useUpdateTelegramAdminSettings,
    useTestSend: useTelegramAdminTestSend,
    verify: { action: 'verify_admin_telegram_env', groupLabel: 'Operations group' },
  });
  const [templatesOpen, setTemplatesOpen] = React.useState(false);

  const adminPlaceholdersByTab = React.useMemo(
    () => telegramPlaceholderLinesByTab(TELEGRAM_ADMIN_PLACEHOLDERS_BY_TAB),
    []
  );

  const scenarioMetaById = React.useMemo(() => {
    const map = new Map<string, AdminScenarioMeta>();
    for (const s of draft?.scenarios ?? []) map.set(s.id, s);
    return map;
  }, [draft?.scenarios]);

  const persistSettings = async (): Promise<boolean> => {
    if (!draft) return false;
    try {
      const result = await update.mutateAsync({
        enabled: draft.enabled,
        notifyOnNewBooking: draft.notifyOnNewBooking,
        notifyOnSdFormSubmitted: draft.notifyOnSdFormSubmitted,
        notifyOnBalanceReceiptUploaded: draft.notifyOnBalanceReceiptUploaded,
        notifyPendingDocsHourly: draft.notifyPendingDocsHourly,
        notifyBalanceReceiptHourly: draft.notifyBalanceReceiptHourly,
        notifySdRefundPendingHourly: draft.notifySdRefundPendingHourly,
        newBookingTemplate: draft.newBookingTemplate,
        pendingDocsTemplate: draft.pendingDocsTemplate,
        balanceReceiptTemplate: draft.balanceReceiptTemplate,
        balanceReceiptUploadedTemplate: draft.balanceReceiptUploadedTemplate,
        sdFormSubmittedTemplate: draft.sdFormSubmittedTemplate,
        sdRefundPendingTemplate: draft.sdRefundPendingTemplate,
        resyncHourlyCron: true,
      });
      markDraftSaved(draft);
      const { cronSync } = (result ?? {}) as { cronSync?: { ok?: boolean } };
      toast.success('Operations settings saved');
      if (cronSync && cronSync.ok !== true) {
        toast.error(
          telegramScheduleSyncError(
            'Hourly reminders could not be updated. Your other changes were saved.'
          )
        );
      }
      return true;
    } catch (e) {
      toast.error(friendlyToastError(e, 'Could not save settings'));
      return false;
    }
  };

  useUnsavedChangesGuard({ isDirty, onSave: persistSettings, enabled: !templatesOpen });

  const onSendDraftPreview = (scenario: AdminDraftScenario, text: string) => {
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

  const activeAlerts = draft
    ? SCENARIO_ORDER.filter((key) => draft[SCENARIO_CONFIG[key].toggleKey]).length
    : 0;

  return (
    <TelegramSettingsModuleGate
      isError={isError}
      error={error}
      loadErrorFallback="Failed to load operations settings"
      isLoading={isLoading}
      draft={isReady ? draft : null}
      skeleton={{ manageRows: 1, ariaLabel: 'Loading operations notification settings' }}
    >
      {draft ? (
        <>
          <TelegramNotificationModuleLayout
            moduleId="operations"
            enabled={draft.enabled}
            onEnabledChange={onEnabledChange}
            enableLabel="Enable operations notifications"
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
            manageSectionTitle="Workflow alerts"
          >
            <TelegramSettingsManageCard
              icon={MessageSquare}
              title="Message templates"
              summary={`${activeAlerts} of ${SCENARIO_ORDER.length} alerts active`}
              disabled={busy}
              onManage={() => setTemplatesOpen(true)}
            />
          </TelegramNotificationModuleLayout>

          <TelegramTemplatesManageDialog
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            title="Message templates"
            placeholdersByTabId={adminPlaceholdersByTab}
            previewSampleSet="admin"
            disabled={busy}
            onSave={persistSettings}
            isDirty={isDirty}
            onDiscard={discardDraft}
            tabs={SCENARIO_ORDER.map((key) => {
              const cfg = SCENARIO_CONFIG[key];
              const meta = scenarioMetaById.get(cfg.scenarioId);
              const toggleChecked = Boolean(draft[cfg.toggleKey]);
              const templateValue = String(draft[cfg.templateKey] ?? '');
              const sectionId = `admin-scenario-${cfg.scenarioId}`;
              const tabPlaceholderLines = placeholderLinesFromKeys(
                TELEGRAM_ADMIN_PLACEHOLDERS_BY_TAB[cfg.scenarioId] ?? []
              );
              const tabValidKeys = buildValidPlaceholderKeySet(tabPlaceholderLines);

              return {
                id: cfg.scenarioId,
                label: meta?.label ?? cfg.scenarioId,
                badge: meta ? scenarioBadge(meta.type) : undefined,
                active: toggleChecked,
                content: (
                  <TelegramTemplateTabPanel
                    alert={{
                      id: `${sectionId}-toggle`,
                      label: meta?.type === 'event' ? 'Send on event' : 'Send hourly while active',
                      hint: meta?.trigger,
                      checked: toggleChecked,
                      disabled: busy,
                      onChange: (v) => setDraft((d) => (d ? { ...d, [cfg.toggleKey]: v } : d)),
                    }}
                  >
                    <TelegramTemplateEditor
                      id={`${sectionId}-template`}
                      label="Message template"
                      value={templateValue}
                      disabled={busy}
                      rows={TELEGRAM_TEMPLATE_EDITOR_ROWS}
                      minHeightClassName={TELEGRAM_TEMPLATE_MIN_HEIGHT}
                      previewSampleSet="admin"
                      validPlaceholderKeys={tabValidKeys}
                      previewContext={{ bot: 'admin', scenario: cfg.scenarioId }}
                      onChange={(v) => setDraft((d) => (d ? { ...d, [cfg.templateKey]: v } : d))}
                      onReset={() =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                [cfg.templateKey]: ADMIN_TEMPLATE_DEFAULTS[cfg.patchTemplateKey],
                              }
                            : d
                        )
                      }
                      onSendDraft={() => onSendDraftPreview(cfg.scenarioId, templateValue)}
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
