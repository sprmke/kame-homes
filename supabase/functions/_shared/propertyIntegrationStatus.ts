/**
 * Per-property integration readiness (DB) + platform-only env secrets.
 */

import { createServiceClient } from './orgAuth.ts';

import {
  getPropertyTelegramCredentialsStatus,
  type TelegramCredentialsStatus,
} from './propertyTelegramCredentials.ts';

export type IntegrationFieldSource = 'db' | 'none';

export type IntegrationFieldStatus = {
  configured: boolean;
  source: IntegrationFieldSource;
};

export type PropertyIntegrationStatus = {
  telegram: {
    marketing: TelegramCredentialsStatus;
    staff: TelegramCredentialsStatus;
    admin: TelegramCredentialsStatus;
    finance: TelegramCredentialsStatus;
    maintenance: TelegramCredentialsStatus;
    chat?: TelegramCredentialsStatus;
  };
};

export type PlatformSecretsStatus = {
  resendApiKeyConfigured: boolean;
  secretsEncryptionKeyConfigured: boolean;
  geminiApiKeyConfigured: boolean;
  groqApiKeyConfigured: boolean;
};

export function buildPlatformSecretsStatus(): PlatformSecretsStatus {
  const trim = (v: string | undefined) => (v ?? '').trim();
  return {
    resendApiKeyConfigured: !!trim(Deno.env.get('RESEND_API_KEY')),
    secretsEncryptionKeyConfigured: !!trim(Deno.env.get('GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY')),
    geminiApiKeyConfigured:
      !!trim(Deno.env.get('GEMINI_API_KEYS')) || !!trim(Deno.env.get('GEMINI_API_KEY')),
    groqApiKeyConfigured: !!trim(Deno.env.get('GROQ_API_KEY')),
  };
}

export async function buildParkingIntegrationStatus(
  parkingId: string
): Promise<PropertyIntegrationStatus> {
  if (!parkingId.trim()) {
    throw new Error('parkingId required for integration status');
  }

  const scope = { parkingId };
  const [parkingTelegram, financeTelegram] = await Promise.all([
    getPropertyTelegramCredentialsStatus('parking', scope),
    getPropertyTelegramCredentialsStatus('finance', scope),
  ]);

  return {
    telegram: {
      marketing: parkingTelegram,
      staff: parkingTelegram,
      admin: parkingTelegram,
      finance: financeTelegram,
      maintenance: parkingTelegram,
    },
  };
}

export async function buildPropertyIntegrationStatus(
  propertyId: string
): Promise<PropertyIntegrationStatus> {
  if (!propertyId.trim()) {
    throw new Error('propertyId required for integration status');
  }

  const [marketing, staff, admin, finance, maintenance, chat] = await Promise.all([
    getPropertyTelegramCredentialsStatus('marketing', propertyId),
    getPropertyTelegramCredentialsStatus('staff', propertyId),
    getPropertyTelegramCredentialsStatus('admin', propertyId),
    getPropertyTelegramCredentialsStatus('finance', propertyId),
    getPropertyTelegramCredentialsStatus('maintenance', propertyId),
    getPropertyTelegramCredentialsStatus('chat', propertyId),
  ]);

  return {
    telegram: { marketing, staff, admin, finance, maintenance, chat },
  };
}
