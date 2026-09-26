import { useEffect, useState } from 'react';

import { Gift } from 'lucide-react';

import {
  SuperAdminSettingsCard,
  SuperAdminSettingsRow,
} from '@/features/dashboard/super-admin/components/shared/SuperAdminSettingsCard';
import {
  usePlatformSettings,
  useUpdatePlatformSettings,
  type PlatformSettings,
} from '@/features/dashboard/super-admin/hooks/usePlatformSettings';
import {
  useHostVerificationRewardGrants,
  useRevokeHostVerificationReward,
} from '@/features/dashboard/super-admin/hooks/usePricingPlans';

import { SettingsFormSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

type Trigger = PlatformSettings['hostRewardTrigger'];

function formatPeriodEnd(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function HostVerificationRewardCard() {
  const { data, isLoading } = usePlatformSettings();
  const save = useUpdatePlatformSettings();
  const { grants, isLoading: grantsLoading } = useHostVerificationRewardGrants();
  const revoke = useRevokeHostVerificationReward();

  const [enabled, setEnabled] = useState(false);
  const [planCode, setPlanCode] = useState('growth');
  const [durationDays, setDurationDays] = useState('30');
  const [trigger, setTrigger] = useState<Trigger>('recommended_verification_approved');
  const [campaignStart, setCampaignStart] = useState('');
  const [campaignEnd, setCampaignEnd] = useState('');
  const [maxPerOrg, setMaxPerOrg] = useState('1');
  const [applyToPaid, setApplyToPaid] = useState<'skip' | 'extend'>('skip');
  const [ready, setReady] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (!data || ready) return;
    setEnabled(Boolean(data.hostRewardEnabled));
    setPlanCode(data.hostRewardPlanCode ?? 'growth');
    setDurationDays(String(data.hostRewardDurationDays ?? 30));
    setTrigger(data.hostRewardTrigger ?? 'recommended_verification_approved');
    setCampaignStart(data.hostRewardCampaignStart?.slice(0, 16) ?? '');
    setCampaignEnd(data.hostRewardCampaignEnd?.slice(0, 16) ?? '');
    setMaxPerOrg(String(data.hostRewardMaxPerOrg ?? 1));
    setApplyToPaid(data.hostRewardApplyToPaidOrg ?? 'skip');
    setReady(true);
  }, [data, ready]);

  if (isLoading && !data) {
    return (
      <SuperAdminSettingsCard
        title="Host verification reward"
        description="Time-limited plan grant for Recommended verification."
        icon={<Gift className="text-muted-foreground size-4" aria-hidden />}
      >
        <SettingsFormSkeleton
          columns={2}
          fields={6}
          toggle
          label="Loading host verification reward"
        />
      </SuperAdminSettingsCard>
    );
  }

  return (
    <SuperAdminSettingsCard
      title="Host verification reward"
      description="Time-limited plan grant for Recommended verification."
      icon={<Gift className="text-muted-foreground size-4" aria-hidden />}
      onSubmit={() =>
        void save.mutateAsync({
          hostRewardEnabled: enabled,
          hostRewardPlanCode: planCode.trim() || 'growth',
          hostRewardDurationDays: Number(durationDays),
          hostRewardTrigger: trigger,
          hostRewardCampaignStart: campaignStart ? new Date(campaignStart).toISOString() : null,
          hostRewardCampaignEnd: campaignEnd ? new Date(campaignEnd).toISOString() : null,
          hostRewardMaxPerOrg: Number(maxPerOrg),
          hostRewardApplyToPaidOrg: applyToPaid,
        })
      }
      footer={
        <Button type="submit" className="min-h-[44px]" disabled={save.isPending || !ready}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <SuperAdminSettingsRow
        label="Enable reward"
        description="Lets eligible Free hosts submit Recommended without a paid plan."
        htmlFor="host-reward-enabled"
      >
        <Switch
          id="host-reward-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="Enable host verification reward"
        />
      </SuperAdminSettingsRow>

      <div className="grid gap-4 sm:grid-cols-2">
        <SuperAdminSettingsRow stacked label="Plan code" htmlFor="host-reward-plan">
          <Input
            id="host-reward-plan"
            value={planCode}
            onChange={(e) => setPlanCode(e.target.value)}
            placeholder="growth"
          />
        </SuperAdminSettingsRow>
        <SuperAdminSettingsRow stacked label="Duration (days)" htmlFor="host-reward-days">
          <Input
            id="host-reward-days"
            type="number"
            min={1}
            max={366}
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
          />
        </SuperAdminSettingsRow>
      </div>

      <SuperAdminSettingsRow stacked label="Grant when" htmlFor="host-reward-trigger">
        <Select value={trigger} onValueChange={(v) => setTrigger(v as Trigger)}>
          <SelectTrigger id="host-reward-trigger" className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recommended_verification_approved">After approval</SelectItem>
            <SelectItem value="recommended_verification_submitted">On submit</SelectItem>
          </SelectContent>
        </Select>
      </SuperAdminSettingsRow>

      <div className="grid gap-4 sm:grid-cols-2">
        <SuperAdminSettingsRow stacked label="Campaign start" htmlFor="host-reward-start">
          <Input
            id="host-reward-start"
            type="datetime-local"
            value={campaignStart}
            onChange={(e) => setCampaignStart(e.target.value)}
          />
        </SuperAdminSettingsRow>
        <SuperAdminSettingsRow stacked label="Campaign end" htmlFor="host-reward-end">
          <Input
            id="host-reward-end"
            type="datetime-local"
            value={campaignEnd}
            onChange={(e) => setCampaignEnd(e.target.value)}
          />
        </SuperAdminSettingsRow>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SuperAdminSettingsRow stacked label="Max grants per org" htmlFor="host-reward-max">
          <Input
            id="host-reward-max"
            type="number"
            min={1}
            max={100}
            value={maxPerOrg}
            onChange={(e) => setMaxPerOrg(e.target.value)}
          />
        </SuperAdminSettingsRow>
        <SuperAdminSettingsRow stacked label="Paid orgs" htmlFor="host-reward-paid">
          <Select value={applyToPaid} onValueChange={(v) => setApplyToPaid(v as 'skip' | 'extend')}>
            <SelectTrigger id="host-reward-paid" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skip">Skip if subscribed</SelectItem>
              <SelectItem value="extend">Extend period</SelectItem>
            </SelectContent>
          </Select>
        </SuperAdminSettingsRow>
      </div>

      <div className="border-border space-y-3 border-t pt-4">
        <p className="text-sm font-medium">Live reward grants</p>
        {grantsLoading ? (
          <ul
            className="divide-border divide-y rounded-lg border"
            role="status"
            aria-live="polite"
            aria-label="Loading reward grants"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <li
                key={i}
                className="flex min-h-[44px] flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                aria-hidden
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-3 w-52 max-w-full" />
                </div>
                <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
              </li>
            ))}
          </ul>
        ) : grants.length === 0 ? (
          <p className="text-muted-foreground text-sm">None</p>
        ) : (
          <ul className="divide-border divide-y rounded-lg border">
            {grants.map((grant) => (
              <li
                key={grant.orgSubscriptionId}
                className="flex min-h-[44px] flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium">{grant.organizationName}</p>
                  <p className="text-muted-foreground text-xs">
                    {grant.planCode ?? grant.planName ?? 'Plan'} · ends{' '}
                    {formatPeriodEnd(grant.periodEnd)} · {grant.status}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] shrink-0"
                  disabled={revoke.isPending && revokingId === grant.orgSubscriptionId}
                  onClick={() => {
                    setRevokingId(grant.orgSubscriptionId);
                    void revoke
                      .mutateAsync({
                        organizationId: grant.organizationId,
                        orgSubscriptionId: grant.orgSubscriptionId,
                      })
                      .finally(() => setRevokingId(null));
                  }}
                >
                  {revoke.isPending && revokingId === grant.orgSubscriptionId
                    ? 'Revoking…'
                    : 'Revoke'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SuperAdminSettingsCard>
  );
}
