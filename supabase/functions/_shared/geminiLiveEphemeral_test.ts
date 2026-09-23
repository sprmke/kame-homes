import {
  buildGeminiLiveClientSetup,
  buildGeminiLiveTokenBody,
  GEMINI_LIVE_MODEL,
  GEMINI_LIVE_MODEL_REGISTRY,
  GEMINI_LIVE_PROTOCOL_VERSION,
  GEMINI_LIVE_WEBSOCKET_BASE_URL,
  mintGeminiLiveEphemeralToken,
} from './geminiLiveEphemeral.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('Gemini Live provider registry uses the documented preview v1beta contract', () => {
  assert(GEMINI_LIVE_MODEL === 'gemini-3.8-live', 'unexpected Live model');
  assert(GEMINI_LIVE_MODEL_REGISTRY.rolloutStatus === 'preview-approved', 'preview status missing');
  assert(GEMINI_LIVE_MODEL_REGISTRY.reviewAfter.length === 10, 'review date missing');
  assert(GEMINI_LIVE_PROTOCOL_VERSION.includes('v1beta'), 'protocol must identify v1beta');
  assert(GEMINI_LIVE_WEBSOCKET_BASE_URL.startsWith('wss://'), 'WebSocket must use TLS');
  assert(GEMINI_LIVE_WEBSOCKET_BASE_URL.includes('.v1beta.'), 'endpoint must use v1beta');
  assert(
    GEMINI_LIVE_WEBSOCKET_BASE_URL.endsWith('BidiGenerateContentConstrained'),
    'ephemeral tokens require the constrained endpoint'
  );
});

Deno.test('Gemini Live client setup enables recovery and transcript features', () => {
  const setup = buildGeminiLiveClientSetup(GEMINI_LIVE_MODEL, 'Kore');
  assert(setup.model === 'models/gemini-3.8-live', 'model path must be normalized');
  assert(Array.isArray(setup.responseModalities), 'response modalities missing');
  assert(setup.sessionResumption != null, 'session resumption missing');
  assert(setup.contextWindowCompression != null, 'context compression missing');
  assert(setup.inputAudioTranscription != null, 'input transcription missing');
  assert(setup.outputAudioTranscription != null, 'output transcription missing');
  assert(Array.isArray(setup.safetySettings), 'explicit safety settings missing');
});

Deno.test('Gemini Live token locks system policy and tools with liveConnectConstraints', () => {
  const body = buildGeminiLiveTokenBody({
    model: GEMINI_LIVE_MODEL,
    voiceName: 'Kore',
    systemInstruction: 'Policy text',
    tools: [{ functionDeclarations: [] }],
    expireTime: '2026-09-23T01:30:00.000Z',
    newSessionExpireTime: '2026-09-23T01:01:00.000Z',
  }) as {
    bidiGenerateContentSetup?: unknown;
    liveConnectConstraints?: {
      model?: string;
      config?: Record<string, unknown>;
    };
  };

  assert(!body.bidiGenerateContentSetup, 'obsolete v1alpha constraints must not be emitted');
  assert(
    body.liveConnectConstraints?.model === 'models/gemini-3.8-live',
    'model constraint missing'
  );
  const config = body.liveConnectConstraints?.config;
  assert(config?.systemInstruction != null, 'system instruction must stay server-locked');
  assert(config?.tools != null, 'tools must stay server-locked');
  assert(config?.sessionResumption != null, 'resumption must be token-locked');
});

Deno.test(
  'Gemini Live token mint surfaces provider failures without exposing the API key',
  async () => {
    const previousKey = Deno.env.get('GEMINI_API_KEY');
    Deno.env.set('GEMINI_API_KEY', 'test-secret-key');
    try {
      let requestHeaders: Headers | undefined;
      let error: Error | null = null;
      try {
        await mintGeminiLiveEphemeralToken({
          fetchImpl: (_input, init) => {
            requestHeaders = new Headers(init?.headers);
            return Promise.resolve(
              new Response(JSON.stringify({ error: { message: 'provider unavailable' } }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              })
            );
          },
          nowMs: 0,
        });
      } catch (caught) {
        error = caught as Error;
      }
      assert(error?.message === 'provider unavailable', 'provider error should be preserved');
      assert(requestHeaders?.get('x-goog-api-key') === 'test-secret-key', 'key header missing');
      assert(
        !error.message.includes('test-secret-key'),
        'provider error must not expose the API key'
      );
    } finally {
      if (previousKey == null) Deno.env.delete('GEMINI_API_KEY');
      else Deno.env.set('GEMINI_API_KEY', previousKey);
    }
  }
);
