export function formatTelegramChatTypeLabel(type: string): string {
  if (type === 'supergroup') return 'Supergroup';
  if (type === 'group') return 'Group';
  if (type === 'channel') return 'Channel';
  if (type === 'private') return 'Private';
  return type;
}
