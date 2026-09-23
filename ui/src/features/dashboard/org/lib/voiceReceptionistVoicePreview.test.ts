import { describe, expect, it } from 'vitest';

import { geminiLiveVoiceLabel, voicePreviewLine, playVoicePreviewAudio } from '@/features/dashboard/org/lib/voiceReceptionistVoicePreview';

describe('geminiLiveVoiceLabel', () => {

  it('geminiLiveVoiceLabel is exported', () => {
    expect(typeof geminiLiveVoiceLabel).toBe('function');
  });

});

describe('voicePreviewLine', () => {

  it('voicePreviewLine is exported', () => {
    expect(typeof voicePreviewLine).toBe('function');
  });

});

describe('playVoicePreviewAudio', () => {

  it('playVoicePreviewAudio is exported', () => {
    expect(typeof playVoicePreviewAudio).toBe('function');
  });

});
