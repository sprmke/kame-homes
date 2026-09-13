import { toast, type ExternalToast } from 'sonner';

const GENERIC_TOAST_ERROR = 'Something went wrong. Try again.';

/** Shared Telegram bot + group verify shape (marketing, staff, admin, finance). */
export type TelegramVerifyDto = {
  credentials: {
    chatIdConfigured?: boolean;
    tokenConfigured?: boolean;
    normalizeError?: string;
  };
  getMe: { ok: boolean; username?: string; error?: string };
  getChat: {
    ok: boolean;
    type?: string;
    title?: string;
    username?: string;
    error?: string;
  };
};

function telegramVerifyToastContent(
  verify: TelegramVerifyDto,
  groupLabel = 'Telegram group'
): { ok: boolean; title: string; description?: string } {
  if (verify.credentials.normalizeError) {
    const err = verify.credentials.normalizeError.toLowerCase();
    if (err.includes('token') || err.includes('chat id') || err.includes('incomplete')) {
      return {
        ok: false,
        title: 'Credentials incomplete',
        description: 'Enter valid bot token and chat ID, then try Connect again.',
      };
    }
    return {
      ok: false,
      title: 'Invalid group setup',
      description: verify.credentials.normalizeError,
    };
  }
  if (!verify.getMe.ok) {
    return {
      ok: false,
      title: 'Bot not reachable',
      description:
        verify.getMe.error ?? 'Invalid bot token. Please double-check your token and try again.',
    };
  }
  if (!verify.getChat.ok) {
    return {
      ok: false,
      title: `Cannot access ${groupLabel}`,
      description: verify.getChat.error ?? 'Add the bot to the group and try again.',
    };
  }
  const groupName = verify.getChat.title ?? verify.getChat.username ?? groupLabel;
  const bot = verify.getMe.username ? `@${verify.getMe.username}` : 'Bot';
  return {
    ok: true,
    title: 'Connection looks good',
    description: `${bot} can post to “${groupName}”.`,
  };
}

export function showTelegramVerifyToast(
  verify: TelegramVerifyDto | undefined,
  groupLabel: string
): void {
  if (!verify) {
    toast.error('Could not verify the connection');
    return;
  }
  const msg = telegramVerifyToastContent(verify, groupLabel);
  if (msg.ok) {
    toast.success(msg.title, msg.description ? { description: msg.description } : undefined);
  } else {
    toast.error(msg.title, msg.description ? { description: msg.description } : undefined);
  }
}

function messageFromUnknown(error: unknown): string {
  if (typeof error === 'string') return error.trim();
  if (error instanceof Error) return error.message.trim();
  return '';
}

/** True when copy looks like a provider dump, stack, URL, or HTTP jargon. */
export function isTechnicalToastMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  const lower = text.toLowerCase();

  if (text.length > 140) return true;
  if (/https?:\/\//i.test(text)) return true;
  if (/\b[\w.-]+\.(com|dev|io|ai|google)\b/i.test(text)) return true;
  if (/\b(gemini-|veo-|gpt-|claude-|llama-)/i.test(text)) return true;
  if (
    /\b(googleapis|generativelanguage|resource_exhausted|quota exceeded|free_tier|rate[- ]limits?|retry in \d)/i.test(
      text
    )
  ) {
    return true;
  }
  if (/\b(api[_ ]?key|x-goog|token_count|input_token|output_token)\b/i.test(text)) return true;
  if (/\b(status|http)\s*[:=]?\s*\d{3}\b/i.test(text)) return true;
  if (/\(\d{3}\)/.test(text)) return true;
  if (/[{}[\]]/.test(text) && /[:"]/.test(text)) return true;
  if (/\bat\s+\S+\s+\(/.test(text)) return true;
  if (/\.(ts|js|tsx)(:\d+)/i.test(text)) return true;
  if (/\b(enoent|econnreset|pgrst|postgres|sqlstate|typeerror|referenceerror)\b/i.test(lower)) {
    return true;
  }
  if (/\b(deno\.|node:|supabase\/functions|stack trace)\b/i.test(lower)) return true;
  if (/\b(getme|getchat|chat_id|codepoint|payload|cron sync)\b/i.test(lower)) return true;
  if (/^[a-z][a-z0-9_]+$/.test(text)) return true;
  if (/^(unauthorized|forbidden|bad request|internal server error|not found)(:|\s|$)/i.test(text)) {
    return true;
  }
  if (/\bmethod\s+[a-z]+\s+not allowed\b/i.test(text)) return true;
  return false;
}

function isProviderBusyMessage(lower: string): boolean {
  return (
    /\b(quota exceeded|resource_exhausted|free_tier|rate[- ]limits?|retry in \d)/i.test(lower) ||
    lower.includes('generativelanguage') ||
    lower.includes('googleapis.com')
  );
}

/**
 * Host-facing toast copy. Known cases get a specific line; anything technical
 * becomes a short fallback so provider dumps never reach the UI.
 */
export function sanitizeToastMessage(
  message: string | null | undefined,
  fallback = GENERIC_TOAST_ERROR
): string {
  const text = (message ?? '').trim();
  if (!text) return fallback;

  const lower = text.toLowerCase();

  if (
    lower.includes('no active session') ||
    lower.includes('please sign in') ||
    lower.includes('jwt')
  ) {
    return 'Please sign in again';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed')
  ) {
    return 'Network error. Check your connection';
  }
  if (
    lower === 'you do not have permission to do that' ||
    lower.includes('you do not have permission') ||
    lower.includes('not allowed to') ||
    lower === 'not allowed'
  ) {
    return 'You do not have permission to do that';
  }
  if (isProviderBusyMessage(lower)) {
    return 'This is busy right now. Try again in a moment.';
  }
  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('took too long')) {
    return text.length <= 140 && !isTechnicalToastMessage(text)
      ? text
      : 'This took too long. Try again.';
  }
  if (lower.includes('not configured')) {
    return 'This is temporarily unavailable.';
  }
  if (isTechnicalToastMessage(text)) {
    return fallback;
  }
  return text;
}

/** Map raw errors to short, operator-friendly copy. */
export function friendlyToastError(error: unknown, fallback = GENERIC_TOAST_ERROR): string {
  return sanitizeToastMessage(messageFromUnknown(error), fallback);
}

type ToastMessage = Parameters<typeof toast.error>[0];

function sanitizeToastTitle(message: ToastMessage): ToastMessage {
  if (typeof message !== 'string') return message;
  return sanitizeToastMessage(message);
}

function sanitizeToastOptions(data: ExternalToast | undefined): ExternalToast | undefined {
  if (!data || typeof data.description !== 'string') return data;
  if (!isTechnicalToastMessage(data.description)) return data;
  const next = { ...data };
  delete next.description;
  return next;
}

let friendlyToastsInstalled = false;

/**
 * Intercepts every `toast.error` / `toast.warning` so raw API dumps cannot leak,
 * even when a call site passes `error.message` directly.
 */
export function installFriendlyToasts(): void {
  if (friendlyToastsInstalled) return;
  friendlyToastsInstalled = true;

  const originalError = toast.error.bind(toast);
  const originalWarning = toast.warning.bind(toast);

  toast.error = ((message: ToastMessage, data?: ExternalToast) =>
    originalError(sanitizeToastTitle(message), sanitizeToastOptions(data))) as typeof toast.error;

  toast.warning = ((message: ToastMessage, data?: ExternalToast) =>
    originalWarning(
      sanitizeToastTitle(message),
      sanitizeToastOptions(data)
    )) as typeof toast.warning;
}

export function telegramScheduleSyncError(
  fallback = 'Reminder schedule could not be updated. Your other changes were saved.'
): string {
  return fallback;
}

export function sdRefundCronSuccessMessage(result: {
  transitioned?: number;
  checkoutEmailsSent?: number;
}): string | null {
  const transitioned = result.transitioned ?? 0;
  const checkoutOnly = result.checkoutEmailsSent ?? 0;

  if (transitioned > 0) {
    return transitioned === 1
      ? '1 booking moved to Ready for Check-out'
      : `${transitioned} bookings moved to Ready for Check-out`;
  }
  if (checkoutOnly > 0) {
    return checkoutOnly === 1
      ? 'Check-out Instructions email sent'
      : `${checkoutOnly} Check-out Instructions emails sent`;
  }
  return null;
}
