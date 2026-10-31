import type { AdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';
import { scopedAssetFunctionsUrl } from '@/features/dashboard/org/lib/adminAssetScope';

import { supabase } from '@/lib/supabase/client';

export type TelegramPreviewBot =
  'marketing' | 'staff' | 'admin' | 'finance' | 'maintenance' | 'chat';

export type TelegramPreviewContext = {
  bot: TelegramPreviewBot;
  scenario?: string;
  checkInYmd?: string;
  checkOutYmd?: string;
};

export type TelegramDraftPreviewResult = {
  renderedText: string;
  placeholders?: Record<string, string>;
  previewGuestName?: string;
  todayBookingCount?: number;
};

const SETTINGS_ENDPOINT: Record<TelegramPreviewBot, string> = {
  marketing: 'telegram-marketing-settings',
  staff: 'telegram-staff-settings',
  admin: 'telegram-admin-settings',
  finance: 'telegram-finance-settings',
  maintenance: 'telegram-maintenance-settings',
  chat: 'telegram-chat-settings',
};

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

export async function fetchTelegramDraftPreview(
  text: string,
  context: TelegramPreviewContext,
  scope: AdminAssetScope
): Promise<TelegramDraftPreviewResult> {
  const jwt = await getAdminJwt();
  const endpoint = SETTINGS_ENDPOINT[context.bot];
  const res = await fetch(scopedAssetFunctionsUrl(`/${endpoint}`, scope), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'render_draft_preview',
      text,
      ...(context.scenario ? { scenario: context.scenario } : {}),
      ...(context.checkInYmd ? { checkInYmd: context.checkInYmd } : {}),
      ...(context.checkOutYmd ? { checkOutYmd: context.checkOutYmd } : {}),
    }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    renderedText?: string;
    placeholders?: Record<string, string>;
    previewGuestName?: string;
    todayBookingCount?: number;
  };
  if (!res.ok || json.success === false || !json.renderedText) {
    throw new Error(json.error ?? `Preview failed (${res.status})`);
  }
  return {
    renderedText: json.renderedText,
    placeholders: json.placeholders,
    previewGuestName: json.previewGuestName,
    todayBookingCount: json.todayBookingCount,
  };
}
