import { useState } from 'react';

import { Link } from 'react-router-dom';

import { Ban, Gauge, ShieldOff } from 'lucide-react';

import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import {
  useBlockRateLimitIdentity,
  useSuperAdminRateLimits,
  useUnblockRateLimitIdentity,
} from '@/features/dashboard/super-admin/hooks/useSuperAdminRateLimits';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';


function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const IDENTITY_PATTERN = /^(u:[a-zA-Z0-9-]+|ip:.+)$/;

export function SuperAdminRateLimitsPage() {
  const { data, isLoading, error } = useSuperAdminRateLimits();
  const block = useBlockRateLimitIdentity();
  const unblock = useUnblockRateLimitIdentity();

  const [manualIdentity, setManualIdentity] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [unblockTarget, setUnblockTarget] = useState<string | null>(null);

  const activeCounters = data?.activeCounters ?? [];
  const blocks = data?.blocks ?? [];
  const blockedIdentities = new Set(blocks.map((b) => b.identity));

  const manualIdentityValid = IDENTITY_PATTERN.test(manualIdentity.trim());

  return (
    <SuperAdminPage
      title="Rate limits"
      subtitle="Who is close to or over the authenticated-wrapper limit right now, and the manual block list. Enforcement itself is a switch on Platform settings."
      isLoading={isLoading && !data}
      error={error}
      errorMessage="Could not load rate-limit activity."
    >
      <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="text-muted-foreground size-4" aria-hidden />
          <p className="text-sm font-medium">
            Enforcement is{' '}
            <Badge variant={data?.enforceEnabled ? 'success' : 'secondary'}>
              {data?.enforceEnabled ? 'ON — 429 on limit' : 'OFF — log-only'}
            </Badge>
            {typeof data?.limit === 'number' ? (
              <span className="text-muted-foreground ml-2 text-xs">
                {data.limit} requests / 60s per user
              </span>
            ) : null}
          </p>
        </div>
        <Button variant="outline" size="sm" className="min-h-[44px]" asChild>
          <Link to={superAdminPaths.platformSettings}>Change in Platform settings</Link>
        </Button>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Active in the last hour</h2>
        {activeCounters.length === 0 ? (
          <SuperAdminEmptyState icon={Gauge} title="No identity is near the limit right now" />
        ) : (
          <ol className="space-y-2">
            {activeCounters.map((row) => (
              <li key={`${row.scope}::${row.identity}`}>
                <Card padding="sm" className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-mono text-sm">{row.identity}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.scope} · {relativeTime(row.windowStart)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={row.overLimit ? 'destructive' : 'outline'}>
                      {row.count}/{row.limit}
                    </Badge>
                    {blockedIdentities.has(row.identity) ? (
                      <Badge variant="secondary">Blocked</Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px]"
                        disabled={block.isPending}
                        onClick={() =>
                          void block.mutateAsync({
                            identity: row.identity,
                            reason: 'Over the wrapper-default limit',
                          })
                        }
                      >
                        <Ban className="size-3.5" aria-hidden />
                        Block
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Manual block</h2>
        <Card padding="sm" className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Immediately cuts off a specific identity (<code>u:&lt;userId&gt;</code> or{' '}
            <code>ip:&lt;address&gt;</code>) regardless of its current count. Requires step-up
            verification.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={manualIdentity}
              onChange={(event) => setManualIdentity(event.target.value)}
              placeholder="u:… or ip:…"
              aria-label="Identity to block"
              className="font-mono"
            />
            <Input
              value={manualReason}
              onChange={(event) => setManualReason(event.target.value)}
              placeholder="Reason (optional)"
              aria-label="Block reason"
            />
            <Button
              variant="destructive"
              className="min-h-[44px]"
              disabled={!manualIdentityValid || block.isPending}
              onClick={() =>
                void block
                  .mutateAsync({
                    identity: manualIdentity.trim(),
                    reason: manualReason.trim() || undefined,
                  })
                  .then(() => {
                    setManualIdentity('');
                    setManualReason('');
                  })
              }
            >
              <ShieldOff className="size-4" aria-hidden />
              Block
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Blocked identities</h2>
        {blocks.length === 0 ? (
          <SuperAdminEmptyState icon={ShieldOff} title="Nothing is currently blocked" />
        ) : (
          <ol className="space-y-2">
            {blocks.map((b) => (
              <li key={b.id}>
                <Card padding="sm" className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate font-mono text-sm">{b.identity}</p>
                    <p className="text-muted-foreground text-xs">
                      {b.reason ? `${b.reason} · ` : ''}
                      blocked {relativeTime(b.blockedAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] shrink-0"
                    onClick={() => setUnblockTarget(b.identity)}
                  >
                    Unblock
                  </Button>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </div>

      <AlertDialog
        open={Boolean(unblockTarget)}
        onOpenChange={(open) => !open && setUnblockTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock this identity?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{unblockTarget}</span> will immediately be able to reach
              the platform again, subject to the normal rolling-window limit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (unblockTarget) void unblock.mutateAsync(unblockTarget);
                setUnblockTarget(null);
              }}
            >
              Unblock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperAdminPage>
  );
}
