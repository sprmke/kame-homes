import { describe, expect, it } from 'vitest';

import {
  AiQuotaExceededClientError,
  toastAiQuotaExceeded,
  isAiQuotaResponse,
  isAiQuotaError,
  throwIfUpgradeHookFromJson,
  throwIfAiQuota,
  handleAiMutationError,
} from '@/features/dashboard/org/lib/aiQuotaToast';
import { parseTeamApiMutateData } from '@/features/dashboard/team/lib/teamApiJson';

describe('toastAiQuotaExceeded', () => {
  it('toastAiQuotaExceeded is exported', () => {
    expect(typeof toastAiQuotaExceeded).toBe('function');
  });
});

describe('isAiQuotaResponse', () => {
  it('isAiQuotaResponse is exported', () => {
    expect(typeof isAiQuotaResponse).toBe('function');
  });
});

describe('isAiQuotaError', () => {
  it('isAiQuotaError is exported', () => {
    expect(typeof isAiQuotaError).toBe('function');
  });
});

describe('throwIfUpgradeHookFromJson', () => {
  it('throwIfUpgradeHookFromJson is exported', () => {
    expect(typeof throwIfUpgradeHookFromJson).toBe('function');
  });
});

describe('throwIfAiQuota', () => {
  it('throwIfAiQuota is exported', () => {
    expect(typeof throwIfAiQuota).toBe('function');
  });
});

describe('handleAiMutationError', () => {
  it('handleAiMutationError is exported', () => {
    expect(typeof handleAiMutationError).toBe('function');
  });
});

const RATE_LIMIT_MESSAGE = 'Too many requests. Please wait a moment and try again.';

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('throwIfUpgradeHookFromJson behavior', () => {
  it('turns a plan or credit limit into an upgrade error', () => {
    expect(() =>
      throwIfUpgradeHookFromJson(
        { success: false, error: 'Needs Pro', upgradeHook: true, feature: 'aiValidations' },
        jsonResponse({}, 402)
      )
    ).toThrow(AiQuotaExceededClientError);
  });

  it('leaves a plain rate limit alone so it is not shown as an upgrade', () => {
    expect(() =>
      throwIfUpgradeHookFromJson(
        { success: false, error: RATE_LIMIT_MESSAGE },
        jsonResponse({}, 429)
      )
    ).not.toThrow();
  });
});

describe('parseTeamApiMutateData', () => {
  it('surfaces a rate limit as a plain error with the server message', async () => {
    const error = await parseTeamApiMutateData(
      jsonResponse({ success: false, error: RATE_LIMIT_MESSAGE }, 429)
    ).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AiQuotaExceededClientError);
    expect((error as Error).message).toBe(RATE_LIMIT_MESSAGE);
  });

  it('still surfaces a seat limit as an upgrade error', async () => {
    const error = await parseTeamApiMutateData(
      jsonResponse({ success: false, error: 'Seat limit', upgradeHook: true }, 402)
    ).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(AiQuotaExceededClientError);
  });
});
