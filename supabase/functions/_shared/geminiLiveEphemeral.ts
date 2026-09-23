/**
 * Mint Gemini Live API ephemeral tokens (v1beta).
 * Browser connects directly via BidiGenerateContentConstrained — never expose GEMINI_API_KEY.
 *
 * Docs: https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
 */

/** Current documented Live model as of 2026-09-15. The Live API remains Preview. */
export const GEMINI_LIVE_MODEL = 'gemini-3.8-live';
export const GEMINI_LIVE_PROTOCOL_VERSION = 'gemini-live-v1beta-2026-09';
export const GEMINI_LIVE_WEBSOCKET_BASE_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';

export const GEMINI_LIVE_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'] as const;
export const GEMINI_LIVE_MODEL_REGISTRY = {
  id: GEMINI_LIVE_MODEL,
  rolloutStatus: 'preview-approved',
  reviewAfter: '2026-10-15',
  documentationUrl: 'https://ai.google.dev/gemini-api/docs/live-api',
  voices: GEMINI_LIVE_VOICES,
  capabilities: {
    audioInput: true,
    audioOutput: true,
    transcription: true,
    functionCalling: true,
    sessionResumption: true,
  },
} as const;

export type GeminiLiveVoice = (typeof GEMINI_LIVE_VOICES)[number];

function geminiKeys(): string[] {
  const multi = Deno.env.get('GEMINI_API_KEYS')?.trim();
  if (multi) {
    return multi
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }
  const single = Deno.env.get('GEMINI_API_KEY')?.trim();
  return single ? [single] : [];
}

export type MintLiveEphemeralOptions = {
  voiceName?: string;
  systemInstruction?: string;
  /** When set, locks tools into the token (client cannot swap declarations). */
  tools?: Array<{
    functionDeclarations: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>;
  }>;
  /** Session TTL for sending messages (default 30m). */
  expireMinutes?: number;
  /** Window to start a new session (default 1m). */
  newSessionExpireMinutes?: number;
  /** Test seam; production uses the global fetch implementation. */
  fetchImpl?: typeof fetch;
  /** Test seam for deterministic expiry timestamps. */
  nowMs?: number;
};

export type MintLiveEphemeralResult = {
  ephemeralToken: string;
  model: string;
  voiceName: string;
  expireTime: string;
  newSessionExpireTime: string;
  protocolVersion: string;
  webSocketBaseUrl: string;
  clientSetup: Record<string, unknown>;
  /** True when liveConnectConstraints were included (server-locked config). */
  lockedSessionConfig: boolean;
};

export function buildGeminiLiveClientSetup(
  model: string,
  voiceName: string
): Record<string, unknown> {
  return {
    model: model.startsWith('models/') ? model : `models/${model}`,
    responseModalities: ['AUDIO'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName },
      },
    },
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
        endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
        prefixPaddingMs: 40,
        silenceDurationMs: 900,
      },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
    sessionResumption: {},
    contextWindowCompression: { slidingWindow: {} },
  };
}

export function buildGeminiLiveTokenBody(input: {
  model: string;
  voiceName: string;
  systemInstruction: string;
  tools: MintLiveEphemeralOptions['tools'];
  expireTime: string;
  newSessionExpireTime: string;
}): Record<string, unknown> {
  const clientSetup = buildGeminiLiveClientSetup(input.model, input.voiceName);
  const { model, ...lockedPublicConfig } = clientSetup;
  return {
    uses: 1,
    expireTime: input.expireTime,
    newSessionExpireTime: input.newSessionExpireTime,
    liveConnectConstraints: {
      model,
      config: {
        ...lockedPublicConfig,
        systemInstruction: { parts: [{ text: input.systemInstruction }] },
        tools: input.tools,
      },
    },
  };
}

/** POST /v1beta/auth_tokens — raw REST (no SDK; Deno edge). */
export async function mintGeminiLiveEphemeralToken(
  options: MintLiveEphemeralOptions = {}
): Promise<MintLiveEphemeralResult> {
  const keys = geminiKeys();
  if (!keys.length) {
    throw new Error('GEMINI_API_KEYS or GEMINI_API_KEY not set');
  }

  const model = GEMINI_LIVE_MODEL_REGISTRY.id;
  const voiceName = options.voiceName ?? 'Kore';
  const now = options.nowMs ?? Date.now();
  const expireTime = new Date(now + (options.expireMinutes ?? 30) * 60_000).toISOString();
  const newSessionExpireTime = new Date(
    now + (options.newSessionExpireMinutes ?? 1) * 60_000
  ).toISOString();

  const systemText =
    options.systemInstruction ??
    'You are a helpful property receptionist. Keep answers short. Use getPropertyFact for factual questions.';

  const tools = options.tools ?? [
    {
      functionDeclarations: [
        {
          name: 'getPropertyFact',
          description:
            'ONLY when Known facts do not already answer the guest. Prefer Known facts for amenities, check-in/out, parking, pets, rates, wifi, location/map, house rules, capacity, payment, and cancellation. Use mainly for a fresh availability check or a missing detail.',
          parameters: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'Fact topic, e.g. amenities, check-in, parking, wifi, availability',
              },
            },
            required: ['topic'],
          },
        },
      ],
    },
  ];

  const body = buildGeminiLiveTokenBody({
    model,
    voiceName,
    systemInstruction: systemText,
    tools,
    expireTime,
    newSessionExpireTime,
  });
  const clientSetup = buildGeminiLiveClientSetup(model, voiceName);

  let lastError = 'auth_tokens create failed';
  for (const key of keys) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/auth_tokens';
    const res = await (options.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      name?: string;
      error?: { message?: string };
    };
    if (res.ok && json.name) {
      return {
        ephemeralToken: json.name,
        model,
        voiceName,
        expireTime,
        newSessionExpireTime,
        protocolVersion: GEMINI_LIVE_PROTOCOL_VERSION,
        webSocketBaseUrl: GEMINI_LIVE_WEBSOCKET_BASE_URL,
        clientSetup,
        lockedSessionConfig: true,
      };
    }
    lastError = json.error?.message ?? `HTTP ${res.status}`;
    // Rotate on rate limit / quota
    if (res.status !== 429 && res.status !== 503) break;
  }

  throw new Error(lastError);
}
