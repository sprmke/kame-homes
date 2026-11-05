import { ArrowDownRight, ArrowUpRight, Clock, Wallet } from 'lucide-react';

import { FINANCE_HELP_COPY } from '@/features/dashboard/finance/lib/financeHelpCopy';
import type { FinanceSummaryCardStats } from '@/features/dashboard/finance/lib/financeSummaryStats';

import { InfoHint } from '@/components/help/InfoHint';
import { MoneyStatCard, StatCardGrid } from '@/components/shared/StatCard';

import type { LucideIcon } from 'lucide-react';

type MoneyStatProps = {
  title: string;
  value: number;
  change?: number;
  icon: LucideIcon;
  iconClassName: string;
  iconBgClassName: string;
  valueClassName?: string;
  hint?: string;
};

function SummaryMoneyStat({
  title,
  value,
  change,
  icon,
  iconClassName,
  iconBgClassName,
  valueClassName,
  hint,
}: MoneyStatProps) {
  return (
    <MoneyStatCard
      title={title}
      value={value}
      change={change}
      icon={icon}
      iconClassName={iconClassName}
      iconBgClassName={iconBgClassName}
      valueClassName={valueClassName}
      titleAdornment={hint ? <InfoHint label={title} text={hint} variant="metric" /> : undefined}
    />
  );
}

type Props = FinanceSummaryCardStats;

export function FinanceSummaryCards({
  totalIncome,
  totalExpenses,
  netProfit,
  pendingAmount,
  incomeChange,
  expensesChange,
  netChange,
}: Props) {
  return (
    <StatCardGrid>
      <SummaryMoneyStat
        title="Net Profit"
        value={netProfit}
        change={netChange}
        icon={Wallet}
        iconClassName="text-blue-600 dark:text-blue-400"
        iconBgClassName="bg-blue-100 dark:bg-blue-900/30"
        valueClassName={netProfit >= 0 ? 'text-foreground' : 'text-red-600 dark:text-red-400'}
        hint={FINANCE_HELP_COPY.netProfit.hint}
      />
      <SummaryMoneyStat
        title="Total Income"
        value={totalIncome}
        change={incomeChange}
        icon={ArrowUpRight}
        iconClassName="text-emerald-600 dark:text-emerald-400"
        iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
        valueClassName="text-emerald-600 dark:text-emerald-400"
        hint={FINANCE_HELP_COPY.totalIncome.hint}
      />
      <SummaryMoneyStat
        title="Total Expenses"
        value={totalExpenses}
        change={expensesChange}
        icon={ArrowDownRight}
        iconClassName="text-red-600 dark:text-red-400"
        iconBgClassName="bg-red-100 dark:bg-red-900/30"
        valueClassName="text-red-600 dark:text-red-400"
        hint={FINANCE_HELP_COPY.totalExpenses.hint}
      />
      <SummaryMoneyStat
        title="Pending Payments"
        value={pendingAmount}
        icon={Clock}
        iconClassName="text-amber-600 dark:text-amber-400"
        iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
        valueClassName="text-amber-600 dark:text-amber-400"
        hint={FINANCE_HELP_COPY.pendingPayments.hint}
      />
    </StatCardGrid>
  );
}
