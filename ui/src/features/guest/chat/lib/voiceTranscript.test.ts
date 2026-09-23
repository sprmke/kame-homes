import { describe, expect, it } from 'vitest';

import { mergeVoiceTranscription } from './voiceTranscript';

describe('mergeVoiceTranscription', () => {
  it('prefers a growing cumulative provider transcript', () => {
    expect(mergeVoiceTranscription('Where is', 'Where is the pool?')).toBe('Where is the pool?');
  });

  it('joins delta chunks without gluing words', () => {
    expect(mergeVoiceTranscription('Breakfast', 'starts at eight.')).toBe(
      'Breakfast starts at eight.'
    );
  });

  it('keeps non-Latin captions', () => {
    expect(mergeVoiceTranscription('', 'プールはどこですか？')).toBe('プールはどこですか？');
    expect(mergeVoiceTranscription('Nasaan', 'ang pool?')).toBe('Nasaan ang pool?');
  });
});
