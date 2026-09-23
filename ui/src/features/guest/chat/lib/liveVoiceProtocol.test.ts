import { describe, expect, it } from 'vitest';

import {
  classifyLiveVoiceMessage,
  describeLiveVoiceClose,
  liveVoiceWebSocketUrl,
  SUPPORTED_VOICE_PROTOCOL_VERSION,
} from './liveVoiceProtocol';

const connection = {
  ephemeralToken: 'auth_tokens/test value',
  protocolVersion: SUPPORTED_VOICE_PROTOCOL_VERSION,
  webSocketBaseUrl:
    'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained',
  clientSetup: {},
};

describe('liveVoiceWebSocketUrl', () => {
  it('uses the server connection descriptor and encodes the ephemeral token', () => {
    const url = new URL(liveVoiceWebSocketUrl(connection));

    expect(url.protocol).toBe('wss:');
    expect(url.hostname).toBe('generativelanguage.googleapis.com');
    expect(url.searchParams.get('access_token')).toBe(connection.ephemeralToken);
  });

  it('rejects stale client/server protocol combinations', () => {
    expect(() =>
      liveVoiceWebSocketUrl({ ...connection, protocolVersion: 'gemini-live-v1alpha' })
    ).toThrow('Voice session update required');
  });

  it('rejects an untrusted provider endpoint', () => {
    expect(() =>
      liveVoiceWebSocketUrl({ ...connection, webSocketBaseUrl: 'wss://example.com/live' })
    ).toThrow('Voice connection is unavailable');
  });
});

describe('classifyLiveVoiceMessage', () => {
  it.each([
    [{ setupComplete: {} }, 'setup_complete'],
    [{ toolCall: { functionCalls: [] } }, 'tool_call'],
    [{ goAway: { timeLeft: '5s' } }, 'go_away'],
    [{ sessionResumptionUpdate: { newHandle: 'resume' } }, 'resumption_update'],
    [{ error: { message: 'bad setup' } }, 'provider_error'],
    [{ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'AA==' } }] } } }, 'audio'],
    [{ serverContent: { inputTranscription: { text: 'hello' } } }, 'input_transcription'],
    [{ serverContent: { outputTranscription: { text: 'hi' } } }, 'output_transcription'],
    [{ serverContent: { interrupted: true } }, 'interrupted'],
    [{ serverContent: { generationComplete: true } }, 'generation_complete'],
  ] as const)('classifies fixture %#', (message, expected) => {
    expect(classifyLiveVoiceMessage(message)).toContain(expected);
  });
});

describe('describeLiveVoiceClose', () => {
  it('recognizes a normal close', () => {
    expect(describeLiveVoiceClose({ code: 1000, reason: '', wasClean: true })).toEqual({
      expected: true,
      message: 'Voice connection closed.',
    });
  });

  it('bounds provider close reasons in fallback copy', () => {
    const result = describeLiveVoiceClose({
      code: 1011,
      reason: 'provider restart'.repeat(30),
      wasClean: false,
    });
    expect(result.expected).toBe(false);
    expect(result.message).toContain('Continue in text chat.');
    expect(result.message.length).toBeLessThan(230);
  });
});
