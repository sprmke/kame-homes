import * as React from 'react';

import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import {
  useAiPlatformSettings,
  useAiPlatformUsage,
  useUpdateAiPlatformSettings,
} from '@/features/dashboard/org/hooks/useAiPlatformSettings';
import { PlanUpgradeLink } from '@/features/dashboard/plans/components/PlanUpgradeLink';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';

import { SettingsFormSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

type Draft = {
  enabled: boolean;
  dailyCallLimit: string;
  monthlyCallLimit: string;
  dailyCostUsdLimit: string;
};

export function OrgAiPlatformSection() {
  const { data: settings, isLoading: settingsLoading } = useAiPlatformSettings();
  const { data: usage, isLoading: usageLoading } = useAiPlatformUsage();
  const { data: orgAccess } = useOrgPermissions();
  const update = useUpdateAiPlatformSettings();

  const canEdit = orgAccess?.canEditAiPlatform ?? false;
  const readOnly = !canEdit;

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [baseline, setBaseline] = React.useState<Draft | null>(null);

  React.useEffect(() => {
    if (!settings) return;
    const next: Draft = {
      enabled: settings.enabled,
      dailyCallLimit: String(settings.dailyCallLimit),
      monthlyCallLimit: String(settings.monthlyCallLimit),
      dailyCostUsdLimit: String(settings.dailyCostUsdLimit),
    };
    setDraft((current) => (current === null ? next : current));
    setBaseline((current) => (current === null ? next : current));
  }, [settings]);

  const dirty =
    draft && baseline
      ? draft.enabled !== baseline.enabled ||
        draft.dailyCallLimit !== baseline.dailyCallLimit ||
        draft.monthlyCallLimit !== baseline.monthlyCallLimit ||
        draft.dailyCostUsdLimit !== baseline.dailyCostUsdLimit
      : false;

  const handleSave = () => {
    if (!draft) return;
    const dailyCallLimit = Number(draft.dailyCallLimit);
    const monthlyCallLimit = Number(draft.monthlyCallLimit);
    const dailyCostUsdLimit = Number(draft.dailyCostUsdLimit);
    if (
      !Number.isFinite(dailyCallLimit) ||
      dailyCallLimit <= 0 ||
      !Number.isInteger(dailyCallLimit)
    ) {
      toast.error('Daily limit must be a positive integer');
      return;
    }
    if (
      !Number.isFinite(monthlyCallLimit) ||
      monthlyCallLimit <= 0 ||
      !Number.isInteger(monthlyCallLimit)
    ) {
      toast.error('Monthly limit must be a positive integer');
      return;
    }
    if (!Number.isFinite(dailyCostUsdLimit) || dailyCostUsdLimit <= 0) {
      toast.error('Daily cost limit must be a positive number');
      return;
    }

    update.mutate(
      {
        enabled: draft.enabled,
        dailyCallLimit,
        monthlyCallLimit,
        dailyCostUsdLimit,
      },
      {
        onSuccess: (saved) => {
          const next: Draft = {
            enabled: saved.enabled,
            dailyCallLimit: String(saved.dailyCallLimit),
            monthlyCallLimit: String(saved.monthlyCallLimit),
            dailyCostUsdLimit: String(saved.dailyCostUsdLimit),
          };
          setDraft(next);
          setBaseline(next);
          toast.success('AI limits saved');
        },
        onError: (err: unknown) => toast.error(friendlyToastError(err, 'Could not save AI limits')),
      }
    );
  };

  if (settingsLoading || usageLoading || !draft) {
    return (
      <AdminSection id="ai" title="AI usage" icon={Sparkles}>
        <SettingsFormSkeleton columns={2} fields={4} toggle label="Loading AI usage" />
      </AdminSection>
    );
  }

  const showUpgradeStub = usage?.quotaExceeded || usage?.planTier === 'included';

  return (
    <AdminSection id="ai" title="AI usage" icon={Sparkles}>
      {usage ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Today</dt>
            <dd>
              {usage.todayCallCount} / {usage.dailyCallLimit} calls
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">This month</dt>
            <dd>
              {usage.monthCallCount} / {usage.monthlyCallLimit} calls
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Est. cost today</dt>
            <dd>
              ${usage.todayCostUsd.toFixed(4)} / ${usage.dailyCostUsdLimit}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="capitalize">{usage.planTier.replace('_', ' ')}</dd>
          </div>
        </dl>
      ) : null}

      {usage ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Credits used this month</span>
            <span>
              ~{Math.round(usage.monthCreditsConsumed).toLocaleString()} /{' '}
              {usage.monthlyCreditLimit.toLocaleString()}
            </span>
          </div>
          <Progress
            value={Math.min(
              100,
              (usage.monthCreditsConsumed / Math.max(1, usage.monthlyCreditLimit)) * 100
            )}
            aria-label="Monthly AI credits used"
          />
          {usage.walletBalanceCredits > 0 ? (
            <p className="text-muted-foreground text-sm">
              Top-up wallet balance: {Math.round(usage.walletBalanceCredits).toLocaleString()}{' '}
              credits
            </p>
          ) : null}
        </div>
      ) : null}

      {showUpgradeStub ? (
        <p className="text-muted-foreground text-sm">
          Need more AI capacity?{' '}
          <PlanUpgradeLink feature="aiMonthlyCreditAllowance">Upgrade</PlanUpgradeLink> for higher
          limits — billing integration coming soon.
        </p>
      ) : null}

      {readOnly ? (
        <p className="text-muted-foreground text-sm">
          Contact the organization owner to change AI settings.
        </p>
      ) : null}

      <div className="space-y-3">
        <label className="flex min-h-[44px] items-center gap-2 text-sm">
          <Switch
            checked={draft.enabled}
            disabled={readOnly}
            onCheckedChange={(enabled) =>
              setDraft((current) => (current ? { ...current, enabled } : current))
            }
            aria-label="Enable AI for organization"
          />
          AI enabled
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Daily call limit</span>
            <Input
              inputMode="numeric"
              value={draft.dailyCallLimit}
              disabled={readOnly}
              onChange={(e) =>
                setDraft((current) =>
                  current ? { ...current, dailyCallLimit: e.target.value } : current
                )
              }
              aria-label="Daily AI call limit"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Monthly call limit</span>
            <Input
              inputMode="numeric"
              value={draft.monthlyCallLimit}
              disabled={readOnly}
              onChange={(e) =>
                setDraft((current) =>
                  current ? { ...current, monthlyCallLimit: e.target.value } : current
                )
              }
              aria-label="Monthly AI call limit"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Daily cost USD limit</span>
            <Input
              inputMode="decimal"
              value={draft.dailyCostUsdLimit}
              disabled={readOnly}
              onChange={(e) =>
                setDraft((current) =>
                  current ? { ...current, dailyCostUsdLimit: e.target.value } : current
                )
              }
              aria-label="Daily AI cost USD limit"
            />
          </label>
        </div>
      </div>

      {dirty && !readOnly ? (
        <Button
          type="button"
          className="min-h-[44px]"
          disabled={update.isPending}
          onClick={handleSave}
        >
          {update.isPending ? 'Saving…' : 'Save AI limits'}
        </Button>
      ) : null}
    </AdminSection>
  );
}
