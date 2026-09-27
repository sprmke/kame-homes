import type { LucideIcon } from 'lucide-react';
import { CreditCard, Landmark, QrCode, Receipt, Wallet } from 'lucide-react';

import type { OrgBundlePlanDto } from '@/features/dashboard/plans/lib/orgPlanApi';
import { planDisplayName } from '@/features/dashboard/plans/lib/planPresentation';

export type TransactionStatusTone = 'success' | 'secondary' | 'destructive';

export type TransactionStatusMeta = {
  label: string;
  tone: TransactionStatusTone;
};

const STATUS_META: Record<string, TransactionStatusMeta> = {
  paid: { label: 'Paid', tone: 'success' },
  pending: { label: 'Pending', tone: 'secondary' },
  failed: { label: 'Failed', tone: 'destructive' },
  expired: { label: 'Expired', tone: 'secondary' },
  cancelled: { label: 'Cancelled', tone: 'secondary' },
};

const METHOD_LABELS: Record<string, string> = {
  qrph: 'QRPH',
  gcash: 'GCash',
  paymaya: 'Maya',
  card: 'Card',
  dob: 'Online banking',
  dob_ubp: 'UnionBank',
  brankas: 'Online banking',
};

export function transactionStatusMeta(status: string): TransactionStatusMeta {
  return STATUS_META[status] ?? { label: status, tone: 'secondary' };
}

export function paymentMethodLabel(method: string | null): string | null {
  if (!method) return null;
  return METHOD_LABELS[method] ?? method.replace(/_/g, ' ');
}

export function paymentMethodIcon(method: string | null): LucideIcon {
  const key = method?.toLowerCase() ?? '';
  if (key === 'qrph') return QrCode;
  if (key === 'gcash' || key === 'paymaya') return Wallet;
  if (key === 'card') return CreditCard;
  if (key === 'dob' || key === 'dob_ubp' || key === 'brankas') return Landmark;
  return Receipt;
}

export function transactionTitle(planId: string, plans: OrgBundlePlanDto[]): string {
  const plan = plans.find((entry) => entry.id === planId);
  if (plan) return `${planDisplayName(plan)} plan`;
  return 'Subscription payment';
}
