import { toast } from 'sonner';

/** Stub until PayMongo checkout ships — mirrors aiQuotaToast two-step pattern. */
export function toastPlanPaymentComingSoon(): void {
  toast.message('Subscription checkout is coming soon', {
    action: {
      label: 'Contact support',
      onClick: () => {
        toast.message('Paid plan billing is coming soon. Contact support to upgrade.');
      },
    },
  });
}
