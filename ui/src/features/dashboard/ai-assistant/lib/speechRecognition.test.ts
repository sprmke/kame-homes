import { describe, expect, it } from 'vitest';

import { getSpeechRecognitionCtor, isSpeechRecognitionSupported, resolveSpeechRecognitionLang, speechRecognitionErrorMessage, parseSpeechResults, rebuildCommittedTranscript } from '@/features/dashboard/ai-assistant/lib/speechRecognition';

describe('getSpeechRecognitionCtor', () => {

  it('getSpeechRecognitionCtor is exported', () => {
    expect(typeof getSpeechRecognitionCtor).toBe('function');
  });

});

describe('isSpeechRecognitionSupported', () => {

  it('isSpeechRecognitionSupported is exported', () => {
    expect(typeof isSpeechRecognitionSupported).toBe('function');
  });

});

describe('resolveSpeechRecognitionLang', () => {

  it('resolveSpeechRecognitionLang is exported', () => {
    expect(typeof resolveSpeechRecognitionLang).toBe('function');
  });

});

describe('speechRecognitionErrorMessage', () => {

  it('speechRecognitionErrorMessage is exported', () => {
    expect(typeof speechRecognitionErrorMessage).toBe('function');
  });

});

describe('parseSpeechResults', () => {

  it('parseSpeechResults is exported', () => {
    expect(typeof parseSpeechResults).toBe('function');
  });

});

describe('rebuildCommittedTranscript', () => {

  it('rebuildCommittedTranscript is exported', () => {
    expect(typeof rebuildCommittedTranscript).toBe('function');
  });

});
