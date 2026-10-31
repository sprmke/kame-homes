/**
 * ai-platform-usage — Org GET for AI usage summary (calls + estimated USD).
 */

import { getOrgCreditWalletBalance } from '../_shared/aiCreditLedger.ts';
import {
  getOrgAiUsageBreakdown,
  getOrgAiPropertyUsageBreakdown,
  getOrgAiUsageSummary,
} from '../_shared/aiUsageService.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { resolveOrgAccessContext } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('ai-platform-usage', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const ctx = await resolveOrgAccessContext(req, 'org:dashboard:view');
  const [summary, featureBreakdown, propertyBreakdown, walletBalanceCredits] = await Promise.all([
    getOrgAiUsageSummary(ctx.org.id),
    getOrgAiUsageBreakdown(ctx.org.id),
    getOrgAiPropertyUsageBreakdown(ctx.org.id),
    getOrgCreditWalletBalance(ctx.org.id),
  ]);

  return jsonSuccess(req, {
    ...summary,
    walletBalanceCredits,
    featureBreakdown: featureBreakdown,
    propertyBreakdown: propertyBreakdown,
  });
});
