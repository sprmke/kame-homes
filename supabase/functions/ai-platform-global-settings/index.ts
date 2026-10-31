/**
 * ai-platform-global-settings — Super-admin GET/PATCH for platform-wide AI kill switch
 * and quota enforcement toggle.
 */

import {
  getAiPlatformGlobalSettings,
  setAiPlatformGlobalSettings,
} from '../_shared/aiUsageService.ts';
import { isValidAiFeature, type AiFeature } from '../_shared/aiModelRouter.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';
import { getVoiceReceptionistOperationalMetrics } from '../_shared/voiceReceptionistService.ts';

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isValidFeatureList(value: unknown): value is AiFeature[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && isValidAiFeature(item))
  );
}

function isUuidList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item)
    )
  );
}

serveSuperAdmin('ai-platform-global-settings', async (req, user) => {
  const stepUp = await requireSuperAdminStepUp(req, user, 'ai_global_settings');
  if (stepUp) return stepUp;

  if (req.method === 'GET') {
    const [data, voiceReceptionistMetrics] = await Promise.all([
      getAiPlatformGlobalSettings(),
      getVoiceReceptionistOperationalMetrics(7),
    ]);
    return jsonSuccess(req, {
      enabled: data.enabled,
      enforceQuotas: data.enforceQuotas,
      allowedFeatures: data.allowedFeatures,
      defaultDailyCallLimit: data.defaultDailyCallLimit,
      defaultMonthlyCallLimit: data.defaultMonthlyCallLimit,
      defaultDailyCostUsdLimit: data.defaultDailyCostUsdLimit,
      creditUnitUsd: data.creditUnitUsd,
      voiceReceptionistCostPerMinuteUsd: data.voiceReceptionistCostPerMinuteUsd,
      voiceReceptionistRolloutPercentage: data.voiceReceptionistRolloutPercentage,
      voiceReceptionistRolloutPropertyIds: data.voiceReceptionistRolloutPropertyIds,
      voiceReceptionistTranscriptRetentionDays: data.voiceReceptionistTranscriptRetentionDays,
      voiceReceptionistHealthStatus: data.voiceReceptionistHealthStatus,
      voiceReceptionistHealthCheckedAt: data.voiceReceptionistHealthCheckedAt,
      voiceReceptionistHealthFailureCode: data.voiceReceptionistHealthFailureCode,
      voiceReceptionistHealthTokenMintMs: data.voiceReceptionistHealthTokenMintMs,
      voiceReceptionistHealthSetupMs: data.voiceReceptionistHealthSetupMs,
      voiceReceptionistHealthModel: data.voiceReceptionistHealthModel,
      voiceReceptionistHealthProtocolVersion: data.voiceReceptionistHealthProtocolVersion,
      voiceReceptionistMetrics,
      defaultDailyCreditLimit: data.defaultDailyCreditLimit,
      defaultMonthlyCreditLimit: data.defaultMonthlyCreditLimit,
      updatedAt: data.updatedAt,
    });
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
      return jsonError(req, 'enabled must be a boolean when provided', 400);
    }
    if (body.enforceQuotas !== undefined && typeof body.enforceQuotas !== 'boolean') {
      return jsonError(req, 'enforceQuotas must be a boolean when provided', 400);
    }
    if (body.allowedFeatures !== undefined && !isValidFeatureList(body.allowedFeatures)) {
      return jsonError(req, 'allowedFeatures must be an array of strings when provided', 400);
    }
    if (body.defaultDailyCallLimit !== undefined && !isPositiveInt(body.defaultDailyCallLimit)) {
      return jsonError(req, 'defaultDailyCallLimit must be a positive integer', 400);
    }
    if (
      body.defaultMonthlyCallLimit !== undefined &&
      !isPositiveInt(body.defaultMonthlyCallLimit)
    ) {
      return jsonError(req, 'defaultMonthlyCallLimit must be a positive integer', 400);
    }
    if (
      body.defaultDailyCostUsdLimit !== undefined &&
      (typeof body.defaultDailyCostUsdLimit !== 'number' || body.defaultDailyCostUsdLimit <= 0)
    ) {
      return jsonError(req, 'defaultDailyCostUsdLimit must be a positive number', 400);
    }
    if (
      body.creditUnitUsd !== undefined &&
      (typeof body.creditUnitUsd !== 'number' || body.creditUnitUsd <= 0)
    ) {
      return jsonError(req, 'creditUnitUsd must be a positive number', 400);
    }
    if (
      body.voiceReceptionistCostPerMinuteUsd !== undefined &&
      (typeof body.voiceReceptionistCostPerMinuteUsd !== 'number' ||
        body.voiceReceptionistCostPerMinuteUsd <= 0)
    ) {
      return jsonError(req, 'voiceReceptionistCostPerMinuteUsd must be a positive number', 400);
    }
    if (
      body.voiceReceptionistRolloutPercentage !== undefined &&
      (typeof body.voiceReceptionistRolloutPercentage !== 'number' ||
        !Number.isInteger(body.voiceReceptionistRolloutPercentage) ||
        body.voiceReceptionistRolloutPercentage < 0 ||
        body.voiceReceptionistRolloutPercentage > 100)
    ) {
      return jsonError(req, 'voiceReceptionistRolloutPercentage must be from 0 to 100', 400);
    }
    if (
      body.voiceReceptionistRolloutPropertyIds !== undefined &&
      !isUuidList(body.voiceReceptionistRolloutPropertyIds)
    ) {
      return jsonError(req, 'voiceReceptionistRolloutPropertyIds must contain UUIDs', 400);
    }
    if (
      body.voiceReceptionistTranscriptRetentionDays !== undefined &&
      (!isPositiveInt(body.voiceReceptionistTranscriptRetentionDays) ||
        body.voiceReceptionistTranscriptRetentionDays > 90)
    ) {
      return jsonError(req, 'voiceReceptionistTranscriptRetentionDays must be from 1 to 90', 400);
    }
    if (
      body.defaultDailyCreditLimit !== undefined &&
      (typeof body.defaultDailyCreditLimit !== 'number' || body.defaultDailyCreditLimit <= 0)
    ) {
      return jsonError(req, 'defaultDailyCreditLimit must be a positive number', 400);
    }
    if (
      body.defaultMonthlyCreditLimit !== undefined &&
      (typeof body.defaultMonthlyCreditLimit !== 'number' || body.defaultMonthlyCreditLimit <= 0)
    ) {
      return jsonError(req, 'defaultMonthlyCreditLimit must be a positive number', 400);
    }

    const data = await setAiPlatformGlobalSettings({
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      enforceQuotas: typeof body.enforceQuotas === 'boolean' ? body.enforceQuotas : undefined,
      allowedFeatures: isValidFeatureList(body.allowedFeatures) ? body.allowedFeatures : undefined,
      defaultDailyCallLimit: isPositiveInt(body.defaultDailyCallLimit)
        ? body.defaultDailyCallLimit
        : undefined,
      defaultMonthlyCallLimit: isPositiveInt(body.defaultMonthlyCallLimit)
        ? body.defaultMonthlyCallLimit
        : undefined,
      defaultDailyCostUsdLimit:
        typeof body.defaultDailyCostUsdLimit === 'number'
          ? body.defaultDailyCostUsdLimit
          : undefined,
      creditUnitUsd: typeof body.creditUnitUsd === 'number' ? body.creditUnitUsd : undefined,
      voiceReceptionistCostPerMinuteUsd:
        typeof body.voiceReceptionistCostPerMinuteUsd === 'number'
          ? body.voiceReceptionistCostPerMinuteUsd
          : undefined,
      voiceReceptionistRolloutPercentage:
        typeof body.voiceReceptionistRolloutPercentage === 'number'
          ? body.voiceReceptionistRolloutPercentage
          : undefined,
      voiceReceptionistRolloutPropertyIds: isUuidList(body.voiceReceptionistRolloutPropertyIds)
        ? body.voiceReceptionistRolloutPropertyIds
        : undefined,
      voiceReceptionistTranscriptRetentionDays: isPositiveInt(
        body.voiceReceptionistTranscriptRetentionDays
      )
        ? body.voiceReceptionistTranscriptRetentionDays
        : undefined,
      defaultDailyCreditLimit:
        typeof body.defaultDailyCreditLimit === 'number' ? body.defaultDailyCreditLimit : undefined,
      defaultMonthlyCreditLimit:
        typeof body.defaultMonthlyCreditLimit === 'number'
          ? body.defaultMonthlyCreditLimit
          : undefined,
      updatedBy: user.id,
    });
    await logSuperAdminAction(user, {
      action: 'ai_platform.settings_update',
      targetType: 'platform',
      targetId: 'ai_platform_global_settings',
      summary: `Updated platform AI settings (enabled=${data.enabled}, enforceQuotas=${data.enforceQuotas})`,
      metadata: {
        enabled: data.enabled,
        enforceQuotas: data.enforceQuotas,
        allowedFeatures: data.allowedFeatures,
      },
    });
    return jsonSuccess(req, {
      enabled: data.enabled,
      enforceQuotas: data.enforceQuotas,
      allowedFeatures: data.allowedFeatures,
      defaultDailyCallLimit: data.defaultDailyCallLimit,
      defaultMonthlyCallLimit: data.defaultMonthlyCallLimit,
      defaultDailyCostUsdLimit: data.defaultDailyCostUsdLimit,
      creditUnitUsd: data.creditUnitUsd,
      voiceReceptionistCostPerMinuteUsd: data.voiceReceptionistCostPerMinuteUsd,
      voiceReceptionistRolloutPercentage: data.voiceReceptionistRolloutPercentage,
      voiceReceptionistRolloutPropertyIds: data.voiceReceptionistRolloutPropertyIds,
      voiceReceptionistTranscriptRetentionDays: data.voiceReceptionistTranscriptRetentionDays,
      voiceReceptionistHealthStatus: data.voiceReceptionistHealthStatus,
      voiceReceptionistHealthCheckedAt: data.voiceReceptionistHealthCheckedAt,
      voiceReceptionistHealthFailureCode: data.voiceReceptionistHealthFailureCode,
      voiceReceptionistHealthTokenMintMs: data.voiceReceptionistHealthTokenMintMs,
      voiceReceptionistHealthSetupMs: data.voiceReceptionistHealthSetupMs,
      voiceReceptionistHealthModel: data.voiceReceptionistHealthModel,
      voiceReceptionistHealthProtocolVersion: data.voiceReceptionistHealthProtocolVersion,
      defaultDailyCreditLimit: data.defaultDailyCreditLimit,
      defaultMonthlyCreditLimit: data.defaultMonthlyCreditLimit,
      updatedAt: data.updatedAt,
    });
  }

  return jsonError(req, 'Method not allowed', 405);
});
