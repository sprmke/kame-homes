import type { HelpCopyModule } from '@/lib/help/types';

/**
 * Finance summary cards. Source: `_shared/financeService.ts` and
 * `features/dashboard/finance/lib/financeSummaryStats.ts`.
 */
export const FINANCE_HELP_COPY = {
  netProfit: {
    hint: 'Income minus expenses for the selected dates. Booking amounts and your manual entries are both included.',
  },
  totalIncome: {
    hint: 'Operating income plus what bookings earned in the selected dates, including completed stays and pipeline estimates.',
  },
  totalExpenses: {
    hint: 'Operating expenses plus booking costs and security deposit expenses in the selected dates.',
  },
  pendingPayments: {
    hint: 'Guest balances still unpaid plus ledger entries marked pending. These are not counted in Net Profit yet.',
  },
} satisfies HelpCopyModule;
