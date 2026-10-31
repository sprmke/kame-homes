/**
 * superAdminAudit — fire-and-forget writer for `super_admin_audit_events`.
 * Never throws into the caller: an audit-write failure logs and returns, so a
 * mutation is never blocked by the audit layer. Read via `list-super-admin-audit`.
 */

import { createServiceClient } from './orgAuth.ts';
import type { AuthenticatedUser } from './orgAuth.ts';
import {
  type ActivityAction,
  type ActivitySeverity,
  buildActorContext,
  logActivity,
} from './activityLog.ts';

export type SuperAdminAuditInput = {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  /**
   * Opt-in curated mirror: also write an org-scoped `activity_log` row so the org
   * owner sees this platform action in their Activity feed. Only pass this for
   * actions that change a specific org's state (plan overrides, verification
   * decisions, listing authorization). Never throws.
   */
  mirrorToOrgActivity?: {
    organizationId: string;
    action: ActivityAction;
    targetType?: string | null;
    targetId?: string | null;
    targetLabel?: string | null;
    severity?: ActivitySeverity;
    metadata?: Record<string, unknown>;
    req?: Request | null;
  };
};

export async function logSuperAdminAction(
  admin: Pick<AuthenticatedUser, 'id' | 'email'>,
  input: SuperAdminAuditInput
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('super_admin_audit_events').insert({
      actor_user_id: admin.id ?? null,
      actor_email: admin.email ?? 'unknown',
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? {},
    });
    if (error) {
      console.error('[superAdminAudit] insert failed:', error.message);
    }
  } catch (err) {
    console.error('[superAdminAudit] unexpected:', err instanceof Error ? err.message : err);
  }

  const mirror = input.mirrorToOrgActivity;
  if (mirror?.organizationId) {
    try {
      await logActivity({
        action: mirror.action,
        organizationId: mirror.organizationId,
        scope: 'org',
        actor: buildActorContext(
          'dashboard',
          { superAdmin: { id: admin.id, email: admin.email } },
          mirror.req ?? null
        ),
        targetType: mirror.targetType ?? null,
        targetId: mirror.targetId ?? null,
        targetLabel: mirror.targetLabel ?? null,
        severity: mirror.severity,
        metadata: { via: 'platform_action', ...(mirror.metadata ?? {}) },
      });
    } catch (err) {
      console.error('[superAdminAudit] org mirror failed (non-fatal):', err);
    }
  }
}
