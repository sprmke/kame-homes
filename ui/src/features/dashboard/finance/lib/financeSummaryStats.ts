import { transactionLedgerStatus } from '@/features/dashboard/finance/lib/financeLedger';
import type { FinanceLineItem, FinanceSummary } from '@/features/dashboard/finance/lib/types';

export type FinanceSummaryCardStats = {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  pendingAmount: number;
  incomeChange?: number;
  expensesChange?: number;
  netChange?: number;
};

export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function positiveStayIncome(summary: FinanceSummary): number {
  const completed = Math.max(0, summary.stays.hostNetCompleted);
  const pipeline = Math.max(0, summary.stays.projectedNetPipeline);
  return completed + pipeline;
}

function stayExpenseTotal(summary: FinanceSummary): number {
  const loss = summary.stays.hostNetCompleted < 0 ? Math.abs(summary.stays.hostNetCompleted) : 0;
  return summary.stays.sdExpenses + loss;
}

export function computeFinanceSummaryCardStats(
  summary: FinanceSummary,
  lineItems: FinanceLineItem[] = []
): FinanceSummaryCardStats {
  const stayIncome = positiveStayIncome(summary);
  const totalIncome = summary.operating.income + stayIncome;
  const totalExpenses = summary.operating.expenses + stayExpenseTotal(summary);
  const netProfit = totalIncome - totalExpenses;

  const pendingTransactions = lineItems
    .filter((item) => transactionLedgerStatus(item) === 'pending')
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    totalIncome,
    totalExpenses,
    netProfit,
    pendingAmount: summary.stays.outstandingGuestBalance + pendingTransactions,
  };
}

export function withPeriodComparison(
  current: FinanceSummaryCardStats,
  previous?: FinanceSummaryCardStats
): FinanceSummaryCardStats {
  if (!previous) return current;
  return {
    ...current,
    incomeChange: calculatePercentageChange(current.totalIncome, previous.totalIncome),
    expensesChange: calculatePercentageChange(current.totalExpenses, previous.totalExpenses),
    netChange: calculatePercentageChange(current.netProfit, previous.netProfit),
  };
}
