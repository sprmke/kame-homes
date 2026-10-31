import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { mintGeminiLiveEphemeralToken } from './geminiLiveEphemeral.ts';

const enabled = Deno.env.get('VOICE_RECEPTIONIST_LIVE_TEST') === '1';

Deno.test({
  name: 'Gemini Live staging canary reaches setupComplete',
  ignore: !enabled,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    if (Deno.env.get('ENVIRONMENT') === 'production') {
      throw new Error('Voice provider live test is disabled in production');
    }

    const minted = await mintGeminiLiveEphemeralToken({
      systemInstruction: 'Identify yourself as a test assistant. Do not request or retain data.',
      tools: [],
      expireMinutes: 5,
    });
    const url = new URL(minted.webSocketBaseUrl);
    url.searchParams.set('access_token', minted.ephemeralToken);
    const ws = new WebSocket(url);

    const outcome = await new Promise<'setup' | 'error'>((resolve) => {
      const timeout = setTimeout(() => resolve('error'), 10_000);
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ setup: minted.clientSetup }));
      });
      ws.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as Record<string, unknown>;
        if (message.setupComplete) {
          clearTimeout(timeout);
          resolve('setup');
        }
        if (message.error) {
          clearTimeout(timeout);
          resolve('error');
        }
      });
      ws.addEventListener('error', () => {
        clearTimeout(timeout);
        resolve('error');
      });
    });

    ws.close();
    assertEquals(outcome, 'setup');
  },
});
