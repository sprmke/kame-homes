import type {
  OrgBundlePlanDto,
  OrgPaymentTransactionDto,
} from '@/features/dashboard/plans/lib/orgPlanApi';
import {
  paymentMethodIcon,
  paymentMethodLabel,
  transactionStatusMeta,
  transactionTitle,
} from '@/features/dashboard/plans/lib/orgPlanTransactionFormat';
import {
  PLANS_TAB_SECTION_TITLES,
  planTabCardHeadingClass,
} from '@/features/dashboard/plans/lib/planPresentation';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { Badge } from '@/components/ui/badge';
import { formatManilaLongDate } from '@/utils/format/dates';
import { formatMoneyCompact } from '@/utils/format/currency';

type OrgPlanTransactionsProps = {
  transactions: OrgPaymentTransactionDto[];
  plans?: OrgBundlePlanDto[];
};

export function OrgPlanTransactions({ transactions, plans = [] }: OrgPlanTransactionsProps) {
  if (transactions.length === 0) return null;

  return (
    <FloatingPanel as="section" padding="lg" aria-labelledby="plans-billing-heading">
      <h2 id="plans-billing-heading" className={planTabCardHeadingClass}>
        {PLANS_TAB_SECTION_TITLES.billing}
      </h2>
      <div className="max-h-[min(40vh,20rem)] overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
        <ul className="divide-border divide-y">
          {transactions.map((txn) => {
            const status = transactionStatusMeta(txn.status);
            const method = paymentMethodLabel(txn.paymentMethodType);
            const Icon = paymentMethodIcon(txn.paymentMethodType);
            const title = transactionTitle(txn.planId, plans);
            /* An unpaid row has no paid_at — dating it by creation keeps the timeline honest. */
            const date = formatManilaLongDate(txn.paidAt ?? txn.createdAt);

            return (
              <li key={txn.id} className="flex items-start gap-3 py-3.5 last:pb-0">
                <span
                  className="bg-muted text-muted-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">{title}</p>
                  <p className="text-meta mt-0.5 truncate">
                    {date}
                    {method ? (
                      <>
                        <span aria-hidden> · </span>
                        {method}
                      </>
                    ) : null}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1 pl-3">
                  <p className="text-foreground text-sm font-semibold tabular-nums">
                    {formatMoneyCompact(txn.amount)}
                  </p>
                  <Badge
                    variant={status.tone}
                    className="h-5 shrink-0 px-1.5 text-[10px] leading-none"
                  >
                    {status.label}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </FloatingPanel>
  );
}
