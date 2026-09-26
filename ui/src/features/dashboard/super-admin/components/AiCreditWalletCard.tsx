import * as React from 'react';

import { Wallet } from 'lucide-react';
import { toast } from 'sonner';

import {
  useAdjustAiCreditWallet,
  useAiCreditWallet,
} from '@/features/dashboard/super-admin/hooks/useAiCreditWallet';

import { WalletResultSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

const CARD_CLASS = 'border-border bg-card flex h-full min-w-0 flex-col gap-5 rounded-xl border p-5';

const ENTRY_TYPE_LABEL: Record<string, string> = {
  usage_debit: 'Usage debit',
  purchase_credit: 'Purchase',
  manual_adjustment: 'Manual adjustment',
};

export function AiCreditWalletCard({ initialOrgId }: { initialOrgId?: string } = {}) {
  const [orgQuery, setOrgQuery] = React.useState(initialOrgId ?? '');
  const [activeOrgId, setActiveOrgId] = React.useState<string | null>(initialOrgId ?? null);
  const [creditsDelta, setCreditsDelta] = React.useState('');
  const [description, setDescription] = React.useState('');

  const { data: wallet, isLoading, isError, error } = useAiCreditWallet(activeOrgId);
  const adjust = useAdjustAiCreditWallet(activeOrgId);

  const handleLoad = () => {
    const trimmed = orgQuery.trim();
    if (!trimmed) return;
    setActiveOrgId(trimmed);
  };

  const handleAdjust = () => {
    const delta = Number(creditsDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error('Credits must be a non-zero number');
      return;
    }
    adjust.mutate(
      { creditsDelta: delta, description: description.trim() || undefined },
      {
        onSuccess: () => {
          setCreditsDelta('');
          setDescription('');
          toast.success('Wallet updated');
        },
        onError: (err: unknown) => toast.error(friendlyToastError(err, 'Could not update wallet')),
      }
    );
  };

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-start gap-3">
        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Wallet className="text-muted-foreground size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="font-medium">AI credit wallet</p>
          <p className="text-muted-foreground text-xs">
            Manual top-up/comp — ahead of real billing
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          value={orgQuery}
          onChange={(e) => setOrgQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
          placeholder="Org ID or slug"
          className="h-10"
          aria-label="Organization ID or slug"
        />
        <Button type="button" variant="outline" className="h-10 shrink-0" onClick={handleLoad}>
          Load
        </Button>
      </div>

      {isLoading ? <WalletResultSkeleton /> : null}

      {isError ? (
        <p className="text-destructive text-sm">{friendlyToastError(error, 'Org not found')}</p>
      ) : null}

      {wallet ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">{wallet.organizationName}</p>
            <p className="truncate text-base font-bold tabular-nums tracking-tight sm:text-2xl">
              {Math.round(wallet.balanceCredits).toLocaleString()}{' '}
              <span className="text-muted-foreground text-sm font-normal">credits</span>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm sm:col-span-1">
              <span className="text-muted-foreground">Adjust by</span>
              <Input
                inputMode="numeric"
                value={creditsDelta}
                onChange={(e) => setCreditsDelta(e.target.value)}
                placeholder="e.g. 1000 or -500"
                className="h-10"
                aria-label="Credits to add or remove"
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-muted-foreground">Reason</span>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional note"
                className="h-10"
                aria-label="Adjustment reason"
              />
            </label>
          </div>
          <Button
            type="button"
            className="min-h-[44px]"
            disabled={adjust.isPending || !creditsDelta.trim()}
            onClick={handleAdjust}
          >
            {adjust.isPending ? 'Applying…' : 'Apply adjustment'}
          </Button>

          {wallet.ledger.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Recent ledger entries</p>
              <ul className="divide-border divide-y text-sm">
                {wallet.ledger.slice(0, 10).map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p>{ENTRY_TYPE_LABEL[entry.entryType] ?? entry.entryType}</p>
                      {entry.description ? (
                        <p className="text-muted-foreground truncate text-xs">
                          {entry.description}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={
                        entry.creditsDelta >= 0
                          ? 'shrink-0 tabular-nums text-emerald-700 dark:text-emerald-300'
                          : 'shrink-0 tabular-nums text-red-600 dark:text-red-400'
                      }
                    >
                      {entry.creditsDelta >= 0 ? '+' : ''}
                      {entry.creditsDelta.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
