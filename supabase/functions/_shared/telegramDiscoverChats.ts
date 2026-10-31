import { trimOrEmpty } from './stringUtils.ts';
import { fetchTelegramJson } from './telegramApi.ts';
import {
  verifyTelegramBotTokenOnly,
  type TelegramBotTokenVerifyResult,
} from './telegramGlobalBotToken.ts';

export type TelegramDiscoveredChat = {
  chatId: string;
  title: string;
  type: string;
  username?: string;
  lastUpdateId: number;
};

export type DiscoverTelegramChatsResult = {
  getMe: TelegramBotTokenVerifyResult;
  chats: TelegramDiscoveredChat[];
  hint?: string;
  error?: string;
};

const TEAM_CHAT_TYPES = new Set(['group', 'supergroup', 'channel']);

function chatFromUpdate(update: Record<string, unknown>): Record<string, unknown> | null {
  const sources = [
    update.message,
    update.edited_message,
    update.channel_post,
    update.edited_channel_post,
    update.my_chat_member,
    update.chat_member,
    update.callback_query,
  ];

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const record = source as Record<string, unknown>;
    const chat = record.chat ?? (record.message as Record<string, unknown> | undefined)?.chat;
    if (chat && typeof chat === 'object') {
      return chat as Record<string, unknown>;
    }
  }

  return null;
}

function formatChatTitle(chat: Record<string, unknown>): string {
  const title = typeof chat.title === 'string' ? chat.title.trim() : '';
  if (title) return title;

  const first = typeof chat.first_name === 'string' ? chat.first_name.trim() : '';
  const last = typeof chat.last_name === 'string' ? chat.last_name.trim() : '';
  const name = [first, last].filter(Boolean).join(' ').trim();
  if (name) return name;

  const username = typeof chat.username === 'string' ? chat.username.trim() : '';
  if (username) return `@${username}`;

  return 'Unnamed chat';
}

function formatChatType(type: string): string {
  if (type === 'supergroup') return 'Supergroup';
  if (type === 'group') return 'Group';
  if (type === 'channel') return 'Channel';
  if (type === 'private') return 'Private';
  return type;
}

export { formatChatType };

/** Admin-only: list recent group/channel chats from Telegram getUpdates. */
export async function discoverTelegramChats(
  rawToken: string
): Promise<DiscoverTelegramChatsResult> {
  const getMe = await verifyTelegramBotTokenOnly(rawToken);
  if (!getMe.ok) {
    return {
      getMe,
      chats: [],
      error: getMe.error ?? 'Invalid bot token',
    };
  }

  const token = trimOrEmpty(rawToken);
  const url = `https://api.telegram.org/bot${token}/getUpdates?limit=100`;
  const fetched = await fetchTelegramJson<{
    ok?: boolean;
    description?: string;
    result?: Record<string, unknown>[];
  }>(url);

  if (!fetched.ok) {
    return {
      getMe,
      chats: [],
      error: fetched.error,
    };
  }

  const { response: res, json } = fetched;

  if (!json.ok) {
    return {
      getMe,
      chats: [],
      error: String(json.description ?? res.statusText ?? 'getUpdates failed'),
    };
  }

  const chatMap = new Map<string, TelegramDiscoveredChat>();

  for (const update of json.result ?? []) {
    const updateId =
      typeof update.update_id === 'number' ? update.update_id : Number(update.update_id ?? 0);
    const chat = chatFromUpdate(update);
    if (!chat) continue;

    const id = chat.id;
    if (typeof id !== 'number' && typeof id !== 'string') continue;

    const chatId = String(id);
    const type = typeof chat.type === 'string' ? chat.type : 'unknown';
    if (!TEAM_CHAT_TYPES.has(type)) continue;

    const existing = chatMap.get(chatId);
    const title = formatChatTitle(chat);
    const username = typeof chat.username === 'string' ? chat.username.trim() : undefined;

    if (!existing || updateId >= existing.lastUpdateId) {
      chatMap.set(chatId, {
        chatId,
        title,
        type,
        username: username || undefined,
        lastUpdateId: updateId,
      });
    }
  }

  const chats = [...chatMap.values()].sort((a, b) => b.lastUpdateId - a.lastUpdateId);

  if (chats.length === 0) {
    return {
      getMe,
      chats: [],
      hint: 'No group chats found. Make sure the bot is added to your group, send a test message, then scan again.',
    };
  }

  return { getMe, chats };
}
