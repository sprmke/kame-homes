import * as React from 'react';

import { toast } from 'sonner';

import {
  buildTelegramVerifyBody,
  telegramVerifySucceeded,
} from '@/features/dashboard/bookings/components/telegram-notifications/telegramCredentials';
import { useTelegramNotificationsGlobalBot } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationsGlobalBotContext';
import type { PropertyTelegramCredentialsStatus } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useTelegramCredentialAutoSave } from '@/features/dashboard/bookings/hooks/useTelegramCredentialAutoSave';
import { useTelegramCredentialFields } from '@/features/dashboard/bookings/hooks/useTelegramCredentialFields';
import { useTelegramModuleConnection } from '@/features/dashboard/bookings/hooks/useTelegramModuleConnection';
import type { TelegramEnvVerifyDto } from '@/features/dashboard/bookings/lib/telegramEnvVerify';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';
import { handleAiMutationError, isAiQuotaError } from '@/features/dashboard/org/lib/aiQuotaToast';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { friendlyToastError, showTelegramVerifyToast } from '@/lib/feedback/toastMessages';

type TelegramSettingsDtoBase = {
  enabled: boolean;
  credentials?: PropertyTelegramCredentialsStatus;
};

type VerifyHandlers = {
  silent?: boolean;
  onSuccess: (payload: { verify?: TelegramEnvVerifyDto }) => void;
  onError: () => void;
};

export type UpdateMutate = {
  mutate: (...args: any[]) => void;
  mutateAsync: (...args: any[]) => Promise<any>;
  isPending: boolean;
};

export type TestSendMutate = {
  mutate: (...args: any[]) => void;
  isPending: boolean;
};

/** Compare drafts ignoring fields that autosave on their own (credentials, master toggle). */
function telegramDraftSnapshot(dto: TelegramSettingsDtoBase | null) {
  if (!dto) return '';
  const { credentials: _credentials, enabled: _enabled, ...rest } = dto;
  return JSON.stringify(rest);
}

export function useTelegramNotificationModuleBase<TDto extends TelegramSettingsDtoBase>(config: {
  useSettings: () => {
    data?: TDto;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    dataUpdatedAt?: number;
  };
  useUpdate: () => UpdateMutate;
  useTestSend: () => TestSendMutate;
  verify: { action: string; groupLabel: string };
}) {
  const { useSettings, useUpdate, useTestSend, verify } = config;
  const { data, isLoading, isError, error, dataUpdatedAt } = useSettings();
  const globalBot = useTelegramNotificationsGlobalBot();
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  const update = useUpdate();
  const testSend = useTestSend();
  const { canUse: canEnableTelegram, isLoading: telegramEntitlementsLoading } =
    useFeatureGate('telegramNotifications');
  const { open: openUpgradeModal } = useUpgradeModal();
  const [draft, setDraft] = React.useState<TDto | null>(null);
  const [baseline, setBaseline] = React.useState<TDto | null>(null);
  const { botToken, setBotToken, chatId, setChatId } = useTelegramCredentialFields(
    data?.credentials,
    globalBot.token
  );
  const saveCredentials = useTelegramCredentialAutoSave(botToken, chatId, update);

  React.useEffect(() => {
    if (data) {
      setDraft(data);
      setBaseline(data);
    }
  }, [data]);

  const isDirty = React.useMemo(
    () => telegramDraftSnapshot(draft) !== telegramDraftSnapshot(baseline),
    [draft, baseline]
  );
  const discardDraft = React.useCallback(() => setDraft(baseline), [baseline]);
  /** Call after a successful save so `isDirty` clears before the refetch lands. */
  const markDraftSaved = React.useCallback((saved: TDto) => setBaseline(saved), []);

  const runVerify = React.useCallback(
    (handlers: VerifyHandlers) => {
      testSend.mutate(
        {
          action: verify.action,
          ...buildTelegramVerifyBody(botToken, chatId),
        },
        {
          onSuccess: (j: { verify?: TelegramEnvVerifyDto }) => {
            const verifyResult = j.verify as TelegramEnvVerifyDto | undefined;
            if (!handlers.silent) {
              showTelegramVerifyToast(verifyResult, verify.groupLabel);
            }
            handlers.onSuccess({ verify: verifyResult });
            if (
              !handlers.silent &&
              telegramVerifySucceeded(verifyResult) &&
              (botToken.trim() || chatId.trim())
            ) {
              saveCredentials();
            }
          },
          onError: (e: unknown) => {
            if (!handlers.silent) {
              toast.error(friendlyToastError(e, 'Could not verify the connection'));
            }
            handlers.onError();
          },
        }
      );
    },
    [testSend, verify.action, verify.groupLabel, botToken, chatId, saveCredentials]
  );

  const {
    connectionOk,
    connectionLabels,
    connectPending,
    backgroundVerifyPending,
    resetConnection,
    triggerVerify,
  } = useTelegramModuleConnection({
    scopeKey,
    credentialsStatus: data?.credentials,
    botToken,
    chatId,
    settingsVersion: dataUpdatedAt ?? 0,
    runVerify,
  });

  const busy = isLoading || update.isPending || connectPending;

  const onTestConnection = React.useCallback(() => {
    triggerVerify({ silent: false });
  }, [triggerVerify]);

  const onEnabledChange = React.useCallback(
    (enabled: boolean) => {
      if (enabled && !canEnableTelegram) {
        if (!telegramEntitlementsLoading) openUpgradeModal('telegramNotifications');
        return;
      }
      if (enabled && !botToken.trim() && globalBot.token) {
        setBotToken(globalBot.token);
      }
      setDraft((d) => (d ? { ...d, enabled } : d));
      update.mutate(
        { enabled },
        {
          onError: (e: unknown) => {
            if (isAiQuotaError(e)) {
              handleAiMutationError(e as Error);
              return;
            }
            toast.error(friendlyToastError(e, 'Could not save settings'));
          },
        }
      );
    },
    [
      botToken,
      canEnableTelegram,
      globalBot.token,
      openUpgradeModal,
      setBotToken,
      telegramEntitlementsLoading,
      update,
    ]
  );

  return {
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
    isReady: !isLoading && draft != null,
  };
}
