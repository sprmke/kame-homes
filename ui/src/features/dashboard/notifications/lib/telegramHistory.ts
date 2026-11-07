import {
  Bell,
  Car,
  DollarSign,
  HardHat,
  Megaphone,
  MessageCircle,
  Radio,
  Wrench,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

/** Modules the delivery pipeline logs. `broadcast` is the parking request fan-out. */
export const TELEGRAM_HISTORY_MODULES = [
  'chat',
  'marketing',
  'staff',
  'operations',
  'finance',
  'maintenance',
  'parking',
  'broadcast',
] as const;

export type TelegramHistoryModule = (typeof TELEGRAM_HISTORY_MODULES)[number];

export const TELEGRAM_MODULE_META: Record<
  TelegramHistoryModule,
  { label: string; icon: LucideIcon }
> = {
  chat: { label: 'Chat', icon: MessageCircle },
  marketing: { label: 'Marketing', icon: Megaphone },
  staff: { label: 'Staff', icon: HardHat },
  operations: { label: 'Operations', icon: Bell },
  finance: { label: 'Finance', icon: DollarSign },
  maintenance: { label: 'Maintenance', icon: Wrench },
  parking: { label: 'Parking', icon: Car },
  broadcast: { label: 'Parking request', icon: Radio },
};

export function telegramModuleMeta(module: string): { label: string; icon: LucideIcon } {
  return (
    TELEGRAM_MODULE_META[module as TelegramHistoryModule] ?? { label: 'Telegram', icon: Radio }
  );
}

/** Long messages are clamped in the list; this is the text the detail view shows. */
export const TELEGRAM_HISTORY_PREVIEW_CHARS = 220;

export function telegramHistoryPreview(text: string): { preview: string; truncated: boolean } {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= TELEGRAM_HISTORY_PREVIEW_CHARS) {
    return { preview: normalized, truncated: false };
  }
  return {
    preview: `${normalized.slice(0, TELEGRAM_HISTORY_PREVIEW_CHARS).trimEnd()}…`,
    truncated: true,
  };
}
