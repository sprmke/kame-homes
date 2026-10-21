import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  formatSuperAdminApprovalDate,
  superAdminApprovalDialogBodyClass,
  superAdminApprovalDialogContentClass,
  superAdminApprovalDialogFooterClass,
  superAdminApprovalDialogHeaderClass,
  SuperAdminApprovalInfoRow,
} from '@/features/dashboard/super-admin/components/super-admin-approvals/SuperAdminApprovalDialogLayout';
import { useModerateReviewReport } from '@/features/dashboard/super-admin/hooks/useApprovals';
import type { ReportedReviewApprovalSummary } from '@/features/dashboard/super-admin/types/approval';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type Props = {
  approval: ReportedReviewApprovalSummary | null;
  onOpenChange: (open: boolean) => void;
};

export function SuperAdminReportedReviewDialog({ approval, onOpenChange }: Props) {
  const moderate = useModerateReviewReport();
  const open = approval != null;
  const isPending = approval?.moderationStatus === 'pending';
  const pendingDecision = moderate.isPending ? moderate.variables?.decision : undefined;

  const close = () => onOpenChange(false);

  const decide = async (decision: 'upheld' | 'rejected') => {
    if (!approval) return;
    try {
      await moderate.mutateAsync({ reportId: approval.reportId, decision });
      toast.success(decision === 'upheld' ? 'Review removed' : 'Report closed');
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not decide report');
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className={superAdminApprovalDialogContentClass}>
        <ResponsiveModalHeader className={superAdminApprovalDialogHeaderClass}>
          <ResponsiveModalTitle>Reported review</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className={superAdminApprovalDialogBodyClass}>
          {approval ? (
            <div className="space-y-3">
              <SuperAdminApprovalInfoRow label="Property" value={approval.propertyName} />
              <SuperAdminApprovalInfoRow label="Organization" value={approval.organizationName} />
              <SuperAdminApprovalInfoRow
                label="Reported"
                value={formatSuperAdminApprovalDate(approval.submittedAt)}
              />
              <SuperAdminApprovalInfoRow
                label="Reason"
                value={approval.reason.split('_').join(' ')}
              />
              <p className="text-sm">{approval.reviewText || 'No public text.'}</p>
              <p className="text-muted-foreground text-sm">{approval.details}</p>
            </div>
          ) : null}
        </div>
        {isPending ? (
          <ResponsiveModalFooter className={superAdminApprovalDialogFooterClass}>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={moderate.isPending}
              onClick={() => void decide('rejected')}
            >
              {pendingDecision === 'rejected' ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Keep review
            </Button>
            <Button
              type="button"
              className="min-h-[44px]"
              disabled={moderate.isPending}
              onClick={() => void decide('upheld')}
            >
              {pendingDecision === 'upheld' ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Remove review
            </Button>
          </ResponsiveModalFooter>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
