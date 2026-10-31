/** Normalize Telegram message template text before save/send. */
export function normalizeTelegramTemplateText(text: string): string {
  let out = text.replace(/\r\n/g, '\n');
  out = out
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}
