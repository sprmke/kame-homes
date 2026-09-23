export const SUPPORTED_VOICE_PROTOCOL_VERSION = 'gemini-live-v1beta-2026-09';

export type LiveVoiceConnectionDescriptor = {
  ephemeralToken: string;
  protocolVersion: string;
  webSocketBaseUrl: string;
  clientSetup: Record<string, unknown>;
};

export type LiveVoiceEventKind =
  | 'setup_complete'
  | 'audio'
  | 'input_transcription'
  | 'output_transcription'
  | 'interrupted'
  | 'generation_complete'
  | 'tool_call'
  | 'go_away'
  | 'resumption_update'
  | 'provider_error'
  | 'unknown';

export function classifyLiveVoiceMessage(message: Record<string, unknown>): LiveVoiceEventKind[] {
  const kinds: LiveVoiceEventKind[] = [];
  if (message.setupComplete) kinds.push('setup_complete');
  if (message.toolCall) kinds.push('tool_call');
  if (message.goAway) kinds.push('go_away');
  if (message.sessionResumptionUpdate) kinds.push('resumption_update');
  if (message.error) kinds.push('provider_error');

  const content = message.serverContent as
    | {
        modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> };
        inputTranscription?: { text?: string };
        outputTranscription?: { text?: string };
        interrupted?: boolean;
        generationComplete?: boolean;
        turnComplete?: boolean;
      }
    | undefined;
  if (content?.modelTurn?.parts?.some((part) => Boolean(part.inlineData?.data)))
    kinds.push('audio');
  if (content?.inputTranscription?.text) kinds.push('input_transcription');
  if (content?.outputTranscription?.text) kinds.push('output_transcription');
  if (content?.interrupted) kinds.push('interrupted');
  if (content?.generationComplete || content?.turnComplete) kinds.push('generation_complete');
  return kinds.length ? kinds : ['unknown'];
}

export function liveVoiceWebSocketUrl(connection: LiveVoiceConnectionDescriptor): string {
  if (connection.protocolVersion !== SUPPORTED_VOICE_PROTOCOL_VERSION) {
    throw new Error('Voice session update required. Refresh and try again.');
  }
  const url = new URL(connection.webSocketBaseUrl);
  if (url.protocol !== 'wss:' || url.hostname !== 'generativelanguage.googleapis.com') {
    throw new Error('Voice connection is unavailable.');
  }
  url.searchParams.set('access_token', connection.ephemeralToken);
  return url.toString();
}

export function describeLiveVoiceClose(input: {
  code: number;
  reason: string;
  wasClean: boolean;
}): { expected: boolean; message: string } {
  const expected = input.wasClean && input.code === 1000;
  const reason = input.reason.trim().slice(0, 160);
  return {
    expected,
    message: expected
      ? 'Voice connection closed.'
      : `Voice connection closed unexpectedly${reason ? ` (${reason})` : ''}. Continue in text chat.`,
  };
}
