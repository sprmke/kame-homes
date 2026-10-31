import * as React from 'react';

import { telegramVerifySucceeded } from '@/features/dashboard/bookings/components/telegram-notifications/telegramCredentials';
import type { PropertyTelegramCredentialsStatus } from '@/features/dashboard/bookings/hooks/useAppSettings';
import {
  telegramConnectionLabelsFromVerify,
  type TelegramConnectionLabels,
} from '@/features/dashboard/bookings/lib/telegramConnectionLabels';
import type { TelegramEnvVerifyDto } from '@/features/dashboard/bookings/lib/telegramEnvVerify';

type VerifyPayload = {
  verify?: Parameters<typeof telegramVerifySucceeded>[0];
};

type VerifyHandlers = {
  silent?: boolean;
  onSuccess: (payload: VerifyPayload) => void;
  onError: () => void;
};

function credentialsDraftDiffersFromServer(
  status: PropertyTelegramCredentialsStatus | undefined,
  botToken: string,
  chatId: string
): boolean {
  if (!status?.tokenConfigured || !status?.chatIdConfigured) {
    return false;
  }
  if (status.botToken == null && status.chatId == null) {
    return false;
  }
  return (
    botToken.trim() !== (status.botToken ?? '').trim() ||
    chatId.trim() !== (status.chatId ?? '').trim()
  );
}

function credentialsComplete(botToken: string, chatId: string): boolean {
  return Boolean(botToken.trim() && chatId.trim());
}

function clearChatLabel(prev: TelegramConnectionLabels): TelegramConnectionLabels {
  if (prev.chatLabel === undefined) return prev;
  return { ...prev, chatLabel: undefined };
}

export function useTelegramModuleConnection(options: {
  scopeKey?: string | null;
  credentialsStatus?: PropertyTelegramCredentialsStatus;
  botToken: string;
  chatId: string;
  /** Stable token when server settings reload (e.g. query dataUpdatedAt). */
  settingsVersion: unknown;
  runVerify: (handlers: VerifyHandlers) => void;
}) {
  const { scopeKey, credentialsStatus, botToken, chatId, settingsVersion, runVerify } = options;
  const [connectionOk, setConnectionOk] = React.useState<boolean | null>(null);
  const [connectionLabels, setConnectionLabels] = React.useState<TelegramConnectionLabels>({});
  const [connectPending, setConnectPending] = React.useState(false);
  const [backgroundVerifyPending, setBackgroundVerifyPending] = React.useState(false);
  const autoVerifiedKeyRef = React.useRef<string | null>(null);
  const scopeKeyRef = React.useRef(scopeKey);
  const prevCredentialFieldsRef = React.useRef({ botToken: '', chatId: '' });
  const runVerifyRef = React.useRef(runVerify);

  runVerifyRef.current = runVerify;

  const applyVerifyResult = React.useCallback((payload: VerifyPayload) => {
    setConnectionOk(telegramVerifySucceeded(payload.verify));
    const next = telegramConnectionLabelsFromVerify(
      payload.verify as TelegramEnvVerifyDto | undefined
    );
    setConnectionLabels((prev) =>
      prev.botLabel === next.botLabel && prev.chatLabel === next.chatLabel ? prev : next
    );
  }, []);

  const resetConnection = React.useCallback(() => {
    autoVerifiedKeyRef.current = null;
    setConnectionOk(null);
    setConnectionLabels({});
  }, []);

  const triggerVerify = React.useCallback(
    (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!credentialsComplete(botToken, chatId)) return;

      if (!silent) setConnectPending(true);
      else setBackgroundVerifyPending(true);

      runVerifyRef.current({
        silent,
        onSuccess: (payload) => {
          applyVerifyResult(payload);
          if (!silent) setConnectPending(false);
          else setBackgroundVerifyPending(false);
        },
        onError: () => {
          setConnectionOk(false);
          if (!silent) setConnectPending(false);
          else setBackgroundVerifyPending(false);
        },
      });
    },
    [applyVerifyResult, botToken, chatId]
  );

  const tokenConfigured = Boolean(credentialsStatus?.tokenConfigured);
  const chatIdConfigured = Boolean(credentialsStatus?.chatIdConfigured);
  const savedOnServer = tokenConfigured && chatIdConfigured;

  React.useEffect(() => {
    autoVerifiedKeyRef.current = null;

    const scopeChanged = scopeKeyRef.current !== scopeKey;
    if (scopeChanged) {
      scopeKeyRef.current = scopeKey;
      setConnectionOk(null);
      setConnectionLabels({});
      return;
    }

    if (!savedOnServer) {
      setConnectionOk(null);
    }
  }, [scopeKey, settingsVersion, savedOnServer]);

  React.useEffect(() => {
    const prev = prevCredentialFieldsRef.current;
    const changed =
      botToken.trim() !== prev.botToken.trim() || chatId.trim() !== prev.chatId.trim();
    prevCredentialFieldsRef.current = { botToken, chatId };

    if (!changed) return;

    if (!savedOnServer) {
      setConnectionOk(null);
      return;
    }

    if (credentialsDraftDiffersFromServer(credentialsStatus, botToken, chatId)) {
      setConnectionOk(null);
    }
  }, [botToken, chatId, credentialsStatus, savedOnServer]);

  React.useEffect(() => {
    if (!savedOnServer || !credentialsComplete(botToken, chatId)) return;

    const serverToken = credentialsStatus?.botToken ?? '';
    const serverChat = credentialsStatus?.chatId ?? '';
    const hasServerValues =
      credentialsStatus?.botToken != null && credentialsStatus?.chatId != null;
    const draftMatchesServer =
      hasServerValues &&
      botToken.trim() === serverToken.trim() &&
      chatId.trim() === serverChat.trim();

    if (hasServerValues && !draftMatchesServer) return;

    const key = String(settingsVersion ?? '');
    if (autoVerifiedKeyRef.current === key) return;
    autoVerifiedKeyRef.current = key;

    triggerVerify({ silent: true });
  }, [
    botToken,
    chatId,
    credentialsStatus?.botToken,
    credentialsStatus?.chatId,
    savedOnServer,
    settingsVersion,
    triggerVerify,
  ]);

  React.useEffect(() => {
    if (!chatId.trim()) {
      setConnectionLabels(clearChatLabel);
    }

    if (!botToken.trim() && !chatId.trim()) {
      setConnectionLabels((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    }
  }, [botToken, chatId]);

  return {
    connectionOk,
    connectionLabels,
    connectPending,
    backgroundVerifyPending,
    setConnectionOk,
    resetConnection,
    triggerVerify,
  };
}
