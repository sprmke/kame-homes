import type {
  OrgApprovalSummary,
  OrgApprovalVerification,
} from '@/features/dashboard/super-admin/types/approval';

export type ApprovalReviewTier = 'base' | 'enhanced';

export function approvalHasDualTierQueue(approval: OrgApprovalSummary): boolean {
  return approval.baseStatus !== 'none' && approval.enhancedStatus !== 'none';
}

export function defaultApprovalReviewTier(
  approval: OrgApprovalSummary,
  verification?: OrgApprovalVerification | null
): ApprovalReviewTier {
  const base = verification?.baseStatus ?? approval.baseStatus;
  const enhanced = verification?.enhancedStatus ?? approval.enhancedStatus;

  if (base === 'pending' && enhanced === 'pending') {
    const enhancedAt = verification?.enhancedSubmittedAt ?? approval.enhancedSubmittedAt ?? '';
    const baseAt = verification?.baseSubmittedAt ?? approval.baseSubmittedAt ?? '';
    if (enhancedAt && baseAt) {
      return enhancedAt.localeCompare(baseAt) > 0 ? 'enhanced' : 'base';
    }
    return 'base';
  }
  if (base === 'pending') return 'base';
  if (enhanced === 'pending') return 'enhanced';
  return 'base';
}

export function latestApprovalSubmittedAt(approval: OrgApprovalSummary): string | null {
  const candidates = [approval.enhancedSubmittedAt, approval.baseSubmittedAt].filter(
    (value): value is string => Boolean(value)
  );
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.localeCompare(a))[0] ?? null;
}
