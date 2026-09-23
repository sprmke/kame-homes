/** Staging-only provider canary. Connects and completes setup without sending audio. */

import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { mintGeminiLiveEphemeralToken } from '../_shared/geminiLiveEphemeral.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

function verifyCanarySecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'VOICE_RECEPTIONIST_CANARY_SECRET',
    headerName: 'x-voice-receptionist-canary-secret',
  });
}

serveCronPost('voice-receptionist-canary', verifyCanarySecret, async () => {
  const environment = (Deno.env.get('ENVIRONMENT') ?? Deno.env.get('DENO_ENV') ?? 'development')
    .trim()
    .toLowerCase();
  if (environment === 'production') {
    return { ok: true, skipped: true, reason: 'production_disabled' };
  }

  const sb = createServiceClient();
  const checkedAt = new Date().toISOString();
  const recordHealth = async (patch: Record<string, unknown>) => {
    const { error } = await sb
      .from('ai_platform_global_settings')
      .update({ voice_receptionist_health_checked_at: checkedAt, ...patch })
      .eq('id', 1);
    if (error) console.warn('[voice-receptionist-canary] health write failed:', error.message);
  };

  const startedAt = performance.now();
  let tokenMintMs: number | null = null;
  let socket: WebSocket | null = null;
  try {
    const minted = await mintGeminiLiveEphemeralToken({
      systemInstruction: 'Provider health check. Do not produce audio unless prompted.',
      tools: [],
      expireMinutes: 5,
    });
    tokenMintMs = Math.round(performance.now() - startedAt);
    const url = new URL(minted.webSocketBaseUrl);
    url.searchParams.set('access_token', minted.ephemeralToken);
    socket = new WebSocket(url);

    const setupStartedAt = performance.now();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Provider setup timed out')), 10_000);
      socket!.onopen = () => socket!.send(JSON.stringify({ setup: minted.clientSetup }));
      socket!.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as Record<string, unknown>;
          if (message.setupComplete) {
            clearTimeout(timeout);
            resolve();
          } else if (message.error) {
            clearTimeout(timeout);
            reject(new Error('Provider returned a setup error'));
          }
        } catch {
          // Ignore non-JSON frames until setup completes.
        }
      };
      socket!.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Provider WebSocket failed'));
      };
      socket!.onclose = (event) => {
        if (event.code !== 1000) {
          clearTimeout(timeout);
          reject(new Error(`Provider closed during setup (${event.code})`));
        }
      };
    });
    const setupMs = Math.round(performance.now() - setupStartedAt);
    socket.close(1000, 'canary complete');
    await recordHealth({
      voice_receptionist_health_status: 'healthy',
      voice_receptionist_health_failure_code: null,
      voice_receptionist_health_token_mint_ms: tokenMintMs,
      voice_receptionist_health_setup_ms: setupMs,
      voice_receptionist_health_model: minted.model,
      voice_receptionist_health_protocol_version: minted.protocolVersion,
    });

    return {
      ok: true,
      model: minted.model,
      protocolVersion: minted.protocolVersion,
      tokenMintMs,
      setupMs,
    };
  } catch (error) {
    socket?.close();
    await recordHealth({
      voice_receptionist_health_status: 'unhealthy',
      voice_receptionist_health_failure_code:
        tokenMintMs === null ? 'token_mint_failed' : 'setup_failed',
      voice_receptionist_health_token_mint_ms: tokenMintMs,
      voice_receptionist_health_setup_ms: null,
    });
    throw error;
  }
});
