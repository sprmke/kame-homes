/**
 * voice-receptionist-voice-preview — Short Gemini TTS sample for the selected Live voice.
 * Auth: org member with `org.settings.aiPlatform:edit` — preview spends API tokens.
 * The sample greets with the organization name (voice config is org-wide).
 */

import {
  assertOrgAndPropertyAiQuota,
  isAiPlatformDisabledError,
  isAiQuotaError,
  recordAiUsage,
} from '../_shared/aiUsageService.ts';
import { jsonError, jsonSuccess, jsonUpgradeHook, readJsonBody } from '../_shared/httpResponse.ts';
import { previewGeminiLiveVoice } from '../_shared/geminiLiveVoicePreview.ts';
import { resolvePropertyGuestName } from '../_shared/propertyGuestName.ts';
import { resolveOrgAccessContext } from '../_shared/propertyScope.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('voice-receptionist-voice-preview', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const limited = await rateLimitGate(req, {
    scope: 'voice-receptionist-voice-preview',
    identity: identityFromRequest(req, user),
    limit: 20,
    windowSec: 3600,
  });
  if (limited) return limited;

  const ctx = await resolveOrgAccessContext(req, 'org.settings.aiPlatform:edit');

  try {
    await assertOrgAndPropertyAiQuota(ctx.org.id, null, 'voice_receptionist');
  } catch (err) {
    if (isAiQuotaError(err) || isAiPlatformDisabledError(err)) {
      return jsonUpgradeHook(req, err.message, { feature: 'aiReceptionist' });
    }
    throw err;
  }

  const body = await readJsonBody(req);
  const voiceId = String(body.voiceId ?? body.voice_id ?? '').trim();
  if (!voiceId) {
    return jsonError(req, 'voiceId is required', 400);
  }

  const greetingName = resolvePropertyGuestName({ name: ctx.org.name ?? null });

  try {
    const data = await previewGeminiLiveVoice(voiceId, greetingName);
    try {
      await recordAiUsage({
        organizationId: ctx.org.id,
        propertyId: null,
        feature: 'voice_receptionist',
        provider: 'gemini',
        model: 'gemini-2.5-flash-preview-tts',
        durationSeconds: 4,
        actorUserId: user.id,
        actorType: 'staff',
      });
    } catch (usageErr) {
      console.warn('[voice-receptionist-voice-preview] usage record failed:', usageErr);
    }
    return jsonSuccess(req, data);
  } catch (e) {
    const message = (e as Error).message || 'Could not preview voice';
    const status = message.includes('voiceId must be') || message.includes('not set') ? 400 : 502;
    return jsonError(req, message, status);
  }
});
