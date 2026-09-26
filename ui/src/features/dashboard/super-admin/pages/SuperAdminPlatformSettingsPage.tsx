import { useEffect, useState } from 'react';

import { Link } from 'react-router-dom';

import { Gauge, Settings } from 'lucide-react';

import { HostVerificationRewardCard } from '@/features/dashboard/super-admin/components/HostVerificationRewardCard';
import { SuperAdminPage } from '@/features/dashboard/super-admin/components/shared/SuperAdminPage';
import {
  SuperAdminSettingsCard,
  SuperAdminSettingsRow,
} from '@/features/dashboard/super-admin/components/shared/SuperAdminSettingsCard';
import {
  usePlatformSettings,
  useUpdatePlatformSettings,
} from '@/features/dashboard/super-admin/hooks/usePlatformSettings';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export function SuperAdminPlatformSettingsPage() {
  const { data, isLoading, error } = usePlatformSettings();
  const save = useUpdatePlatformSettings();

  const [signupsEnabled, setSignupsEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [defaultPlanCode, setDefaultPlanCode] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [legalTermsUrl, setLegalTermsUrl] = useState('');
  const [legalPrivacyUrl, setLegalPrivacyUrl] = useState('');
  const [rateLimit, setRateLimit] = useState('60');
  const [authRateLimitEnforce, setAuthRateLimitEnforce] = useState(false);
  const [authRateLimit, setAuthRateLimit] = useState('300');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!data || initialized) return;
    setSignupsEnabled(data.signupsEnabled);
    setMaintenanceMode(data.maintenanceMode);
    setMaintenanceMessage(data.maintenanceMessage ?? '');
    setDefaultPlanCode(data.defaultPlanCode ?? '');
    setSupportEmail(data.supportEmail ?? '');
    setLegalTermsUrl(data.legalTermsUrl ?? '');
    setLegalPrivacyUrl(data.legalPrivacyUrl ?? '');
    setRateLimit(String(data.publicRateLimitPerMin ?? 60));
    setAuthRateLimitEnforce(data.authenticatedRateLimitEnforce);
    setAuthRateLimit(String(data.authenticatedRateLimitPerMin ?? 300));
    setInitialized(true);
  }, [data, initialized]);

  return (
    <SuperAdminPage
      title="Platform settings"
      subtitle="Operational knobs for the whole platform. Changes take effect on the next request that reads them."
      isLoading={isLoading && !data}
      loadingMetricCount={2}
      error={error}
      errorMessage="Could not load platform settings."
    >
      <SuperAdminSettingsCard
        title="Access"
        icon={<Settings className="text-muted-foreground size-4" aria-hidden />}
        onSubmit={() =>
          void save.mutateAsync({
            signupsEnabled,
            maintenanceMode,
            maintenanceMessage: maintenanceMessage.trim() || null,
            defaultPlanCode: defaultPlanCode.trim() || null,
            supportEmail: supportEmail.trim() || null,
            legalTermsUrl: legalTermsUrl.trim() || null,
            legalPrivacyUrl: legalPrivacyUrl.trim() || null,
            publicRateLimitPerMin: Number(rateLimit),
          })
        }
        footer={
          <Button type="submit" className="min-h-[44px]" disabled={save.isPending || !initialized}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        }
      >
        <SuperAdminSettingsRow
          label="Self-serve signups"
          description="When off, the public sign-up flow is blocked."
          htmlFor="signups-enabled"
        >
          <Switch
            id="signups-enabled"
            checked={signupsEnabled}
            onCheckedChange={setSignupsEnabled}
            aria-label="Self-serve signups"
          />
        </SuperAdminSettingsRow>

        <SuperAdminSettingsRow
          label="Maintenance mode"
          description="Shows a platform-wide banner. Super admins keep full access."
          htmlFor="maintenance-mode"
        >
          <Switch
            id="maintenance-mode"
            checked={maintenanceMode}
            onCheckedChange={setMaintenanceMode}
            aria-label="Maintenance mode"
          />
        </SuperAdminSettingsRow>

        <SuperAdminSettingsRow stacked label="Maintenance message" htmlFor="maintenance-message">
          <Textarea
            id="maintenance-message"
            value={maintenanceMessage}
            onChange={(event) => setMaintenanceMessage(event.target.value)}
            placeholder="We're doing scheduled maintenance and will be back shortly."
          />
        </SuperAdminSettingsRow>

        <div className="grid gap-4 sm:grid-cols-2">
          <SuperAdminSettingsRow
            stacked
            label="Default plan code"
            htmlFor="default-plan-code"
            description="Plan new organizations start on."
          >
            <Input
              id="default-plan-code"
              value={defaultPlanCode}
              onChange={(event) => setDefaultPlanCode(event.target.value)}
              placeholder="e.g. free"
            />
          </SuperAdminSettingsRow>
          <SuperAdminSettingsRow stacked label="Public rate limit (req/min)" htmlFor="rate-limit">
            <Input
              id="rate-limit"
              type="number"
              min={1}
              max={10000}
              value={rateLimit}
              onChange={(event) => setRateLimit(event.target.value)}
            />
          </SuperAdminSettingsRow>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SuperAdminSettingsRow stacked label="Support email" htmlFor="support-email">
            <Input
              id="support-email"
              type="email"
              value={supportEmail}
              onChange={(event) => setSupportEmail(event.target.value)}
              placeholder="support@example.com"
            />
          </SuperAdminSettingsRow>
          <SuperAdminSettingsRow stacked label="Terms URL" htmlFor="legal-terms-url">
            <Input
              id="legal-terms-url"
              type="url"
              value={legalTermsUrl}
              onChange={(event) => setLegalTermsUrl(event.target.value)}
            />
          </SuperAdminSettingsRow>
          <SuperAdminSettingsRow stacked label="Privacy URL" htmlFor="legal-privacy-url">
            <Input
              id="legal-privacy-url"
              type="url"
              value={legalPrivacyUrl}
              onChange={(event) => setLegalPrivacyUrl(event.target.value)}
            />
          </SuperAdminSettingsRow>
        </div>
      </SuperAdminSettingsCard>

      <SuperAdminSettingsCard
        title="Authenticated rate limiting"
        description="Applies to every signed-in dashboard request by default. Off = observe only (console warning); on = the caller gets a 429. Flip off instantly if the limit misfires on real traffic — no deploy needed."
        icon={<Gauge className="text-muted-foreground size-4" aria-hidden />}
        headerAction={
          <Button variant="outline" size="sm" className="min-h-[44px]" asChild>
            <Link to={superAdminPaths.rateLimits}>View activity</Link>
          </Button>
        }
        onSubmit={() =>
          void save.mutateAsync({
            authenticatedRateLimitEnforce: authRateLimitEnforce,
            authenticatedRateLimitPerMin: Number(authRateLimit),
          })
        }
        footer={
          <Button type="submit" className="min-h-[44px]" disabled={save.isPending || !initialized}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        }
      >
        <SuperAdminSettingsRow
          label="Enforce (return 429)"
          description="Off keeps the original log-only rollout — nothing is ever blocked."
          htmlFor="auth-rate-limit-enforce"
        >
          <Switch
            id="auth-rate-limit-enforce"
            checked={authRateLimitEnforce}
            onCheckedChange={setAuthRateLimitEnforce}
            aria-label="Enforce authenticated rate limit"
          />
        </SuperAdminSettingsRow>

        <SuperAdminSettingsRow
          stacked
          label="Limit (requests / 60s per user)"
          htmlFor="auth-rate-limit"
          description="No measured hosted-traffic baseline exists yet — 300 is a reasoned, deliberately loose starting point. Raise it here if a legitimate workflow (bulk pricing edits, multi-tab polling) trips it."
        >
          <Input
            id="auth-rate-limit"
            type="number"
            min={1}
            max={100000}
            value={authRateLimit}
            onChange={(event) => setAuthRateLimit(event.target.value)}
          />
        </SuperAdminSettingsRow>
      </SuperAdminSettingsCard>

      <HostVerificationRewardCard />
    </SuperAdminPage>
  );
}
