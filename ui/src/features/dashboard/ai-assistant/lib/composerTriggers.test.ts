import { describe, expect, it } from 'vitest';

import {
  SLASH_COMMANDS,
  detectComposerTrigger,
  filterSlashCommands,
  rankMentionCandidates,
  removeTriggerToken,
} from '@/features/dashboard/ai-assistant/lib/composerTriggers';

describe('detectComposerTrigger', () => {
  it('detects a slash command only as the first token', () => {
    expect(detectComposerTrigger('/rev', 4)).toEqual({
      kind: 'slash',
      query: 'rev',
      start: 0,
      end: 4,
    });
    expect(detectComposerTrigger('/', 1)).toEqual({ kind: 'slash', query: '', start: 0, end: 1 });
    expect(detectComposerTrigger('see /rev', 8)).toBeNull();
    expect(detectComposerTrigger('/review now', 11)).toBeNull();
  });

  it('detects @mentions after whitespace or at the start', () => {
    expect(detectComposerTrigger('call @mar', 9)).toEqual({
      kind: 'mention',
      query: 'mar',
      start: 5,
      end: 9,
    });
    expect(detectComposerTrigger('@', 1)).toEqual({ kind: 'mention', query: '', start: 0, end: 1 });
    expect(detectComposerTrigger('mail a@b.com', 12)).toBeNull();
    expect(detectComposerTrigger('call @maria now', 15)).toBeNull();
  });

  it('uses the caret, not the end of the text', () => {
    expect(detectComposerTrigger('call @ma now', 8)).toEqual({
      kind: 'mention',
      query: 'ma',
      start: 5,
      end: 8,
    });
  });
});

describe('removeTriggerToken', () => {
  it('removes the token and a following space', () => {
    const trigger = detectComposerTrigger('call @ma now', 8)!;
    expect(removeTriggerToken('call @ma now', trigger)).toEqual({ value: 'call now', caret: 5 });
    expect(removeTriggerToken('@ma', detectComposerTrigger('@ma', 3)!)).toEqual({
      value: '',
      caret: 0,
    });
  });
});

describe('filterSlashCommands', () => {
  it('returns everything for an empty query and ranks prefixes first', () => {
    expect(filterSlashCommands('')).toHaveLength(SLASH_COMMANDS.length);
    expect(filterSlashCommands('re').map((c) => c.id)[0]).toBe('review');
    expect(filterSlashCommands('income').map((c) => c.id)).toEqual(['finance']);
    expect(filterSlashCommands('zzz')).toEqual([]);
    expect(filterSlashCommands('mem').map((c) => c.id)).toEqual(['memory']);
  });
});

describe('rankMentionCandidates', () => {
  const candidates = [
    { entry: 'a', label: 'John Maria Cruz', keywords: '' },
    { entry: 'b', label: 'Maria Santos', keywords: 'pending review' },
    { entry: 'c', label: 'Solea Mactan', keywords: 'property' },
  ];

  it('ranks label prefix, then word prefix, then keyword substring', () => {
    expect(rankMentionCandidates(candidates, 'mar')).toEqual(['b', 'a']);
    expect(rankMentionCandidates(candidates, 'review')).toEqual(['b']);
    expect(rankMentionCandidates(candidates, '')).toEqual(['a', 'b', 'c']);
    expect(rankMentionCandidates(candidates, '', 2)).toEqual(['a', 'b']);
  });
});
