/**
 * ai-platform-credit-wallet — Super-admin GET (wallet balance + recent ledger) and POST
 * (manual credit adjustment) for an org's purchased AI-credit top-up wallet.
 *
 * This is the manual top-up/comp path that ships ahead of any real payment integration
 * (Phase 4, deferred) — it's the exact code path a future payment webhook calls into,
 * just with entry_type 'purchase_credit' instead of 'manual_adjustment'.
 */

import {
  adjustOrgCreditWallet,
  getOrgCreditWalletBalance,
  getRecentCreditLedgerEntries,
} from '../_shared/aiCreditLedger.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';

async function resolveOrganization(
  orgId: string | null,
  orgSlug: string | null
): Promise<{ id: string; name: string } | null> {
  if (!orgId && !orgSlug) return null;
  const sb = createServiceClient();
  const query = sb.from('organizations').select('id, name');
  const { data, error } = orgId
    ? await query.eq('id', orgId).maybeSingle()
    : await query.eq('slug', orgSlug as string).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: data.id as string, name: data.name as string };
}

serveSuperAdmin('ai-platform-credit-wallet', async (req, admin) => {
  const stepUp = await requireSuperAdminStepUp(req, admin, 'ai_credit_wallet');
  if (stepUp) return stepUp;

  const url = new URL(req.url);
  const orgId = url.searchParams.get('org_id')?.trim() || null;
  const orgSlug = url.searchParams.get('org_slug')?.trim() || null;

  const org = await resolveOrganization(orgId, orgSlug);
  if (!org) {
    return jsonError(req, 'Organization not found — provide a valid org_id or org_slug', 404);
  }

  if (req.method === 'GET') {
    const [balanceCredits, ledger] = await Promise.all([
      getOrgCreditWalletBalance(org.id),
      getRecentCreditLedgerEntries(org.id),
    ]);
    return jsonSuccess(req, {
      organizationId: org.id,
      organizationName: org.name,
      balanceCredits,
      ledger,
    });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const creditsDelta = Number(body.creditsDelta);
    if (!Number.isFinite(creditsDelta) || creditsDelta === 0) {
      return jsonError(req, 'creditsDelta must be a non-zero number', 400);
    }
    const description = typeof body.description === 'string' ? body.description.trim() : null;

    const { balanceCredits } = await adjustOrgCreditWallet({
      organizationId: org.id,
      creditsDelta,
      entryType: 'manual_adjustment',
      description: description || null,
      createdBy: admin.id,
    });
    const ledger = await getRecentCreditLedgerEntries(org.id);
    await logSuperAdminAction(admin, {
      action: 'ai_credit_wallet.adjust',
      targetType: 'organization',
      targetId: org.id,
      summary: `Adjusted ${org.name}'s AI credit wallet by ${creditsDelta > 0 ? '+' : ''}${creditsDelta} (balance ${balanceCredits})`,
      metadata: { creditsDelta, description, balanceCredits },
    });
    return jsonSuccess(req, {
      organizationId: org.id,
      organizationName: org.name,
      balanceCredits,
      ledger,
    });
  }

  return jsonError(req, 'Method not allowed', 405);
});
