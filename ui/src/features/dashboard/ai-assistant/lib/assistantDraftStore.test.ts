import { describe, expect, it } from 'vitest';

import {
  EMPTY_ASSISTANT_DRAFT,
  assistantDraftKey,
  readActiveConversationId,
  readAssistantDraft,
  writeActiveConversationId,
  writeAssistantDraft,
} from '@/features/dashboard/ai-assistant/lib/assistantDraftStore';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe('assistant draft store', () => {
  it('round-trips a draft per conversation', () => {
    const storage = memoryStorage();
    const key = assistantDraftKey('acme', 'c1');
    const draft = {
      text: 'hello',
      context: [{ type: 'booking' as const, id: 'b1', label: 'Ana' }],
    };
    writeAssistantDraft(key, draft, storage);
    expect(readAssistantDraft(key, storage)).toEqual(draft);
    expect(readAssistantDraft(assistantDraftKey('acme', null), storage)).toEqual(
      EMPTY_ASSISTANT_DRAFT
    );
  });

  it('removes empty drafts instead of storing them', () => {
    const storage = memoryStorage();
    const key = assistantDraftKey('acme', null);
    writeAssistantDraft(key, { text: 'x', context: [] }, storage);
    writeAssistantDraft(key, { text: '  ', context: [] }, storage);
    expect(storage.map.has(key)).toBe(false);
  });

  it('survives corrupt JSON', () => {
    const storage = memoryStorage();
    storage.setItem('k', '{nope');
    expect(readAssistantDraft('k', storage)).toEqual(EMPTY_ASSISTANT_DRAFT);
  });

  it('tracks the active conversation per org', () => {
    const storage = memoryStorage();
    writeActiveConversationId('acme', 'c9', storage);
    expect(readActiveConversationId('acme', storage)).toBe('c9');
    writeActiveConversationId('acme', null, storage);
    expect(readActiveConversationId('acme', storage)).toBeNull();
  });
});
