import { normalizeChatText } from '@/lib/chat/parseChatRichBlocks';

export function normalizeVoiceTranscriptText(raw: string): string {
  return normalizeChatText(raw)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Merge provider chunks that may be deltas or growing cumulative text. */
export function mergeVoiceTranscription(prev: string, incoming: string): string {
  const chunk = normalizeVoiceTranscriptText(incoming);
  if (!chunk) return prev;
  if (!prev) return chunk;

  if (chunk.startsWith(prev) || prev.startsWith(chunk)) {
    return chunk.length >= prev.length ? chunk : prev;
  }
  if (prev.includes(chunk)) return prev;
  if (chunk.includes(prev) && chunk.length > prev.length) return chunk;

  const needsSpace = !/\s$/.test(prev) && !/^\s/.test(chunk) && !/^[.,!?;:'")]/.test(chunk);
  return prev + (needsSpace ? ' ' : '') + chunk;
}
