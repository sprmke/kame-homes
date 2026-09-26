import * as React from 'react';

import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import {
  useAiDashboardAssistantSettings,
  useUpdateAiDashboardAssistantSettings,
} from '@/features/dashboard/ai-assistant/hooks/useAiDashboardAssistantSettings';
import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useOrgSlugParam } from '@/features/dashboard/org/lib/adminApiScope';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';

import { SettingsFormSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

type Draft = {
  enabled: boolean;
  disabledPropertyIds: string[];
  dailyMessageLimit: string;
  monthlyMessageLimit: string;
  dailyWriteActionLimit: string;
};

export function OrgAiDashboardAssistantSection() {
  const orgSlug = useOrgSlugParam();
  const { data: settings, isLoading: settingsLoading } = useAiDashboardAssistantSettings({
    includeUsage: true,
  });
  const { data: propertiesData } = useProperties(orgSlug ?? undefined);
  const { data: orgAccess } = useOrgPermissions();
  const update = useUpdateAiDashboardAssistantSettings();

  const canEdit = orgAccess?.canEditAiAssistant ?? false;
  const readOnly = !canEdit;

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [baseline, setBaseline] = React.useState<Draft | null>(null);

  React.useEffect(() => {
    if (!settings) return;
    const next: Draft = {
      enabled: settings.enabled,
      disabledPropertyIds: settings.disabledPropertyIds,
      dailyMessageLimit: String(settings.dailyMessageLimit),
      monthlyMessageLimit: String(settings.monthlyMessageLimit),
      dailyWriteActionLimit: String(settings.dailyWriteActionLimit),
    };
    setDraft((current) => (current === null ? next : current));
    setBaseline((current) => (current === null ? next : current));
  }, [settings]);

  const dirty =
    draft && baseline
      ? draft.enabled !== baseline.enabled ||
        draft.dailyMessageLimit !== baseline.dailyMessageLimit ||
        draft.monthlyMessageLimit !== baseline.monthlyMessageLimit ||
        draft.dailyWriteActionLimit !== baseline.dailyWriteActionLimit ||
        draft.disabledPropertyIds.join(',') !== baseline.disabledPropertyIds.join(',')
      : false;

  const handleSave = () => {
    if (!draft) return;
    const dailyMessageLimit = Number(draft.dailyMessageLimit);
    const monthlyMessageLimit = Number(draft.monthlyMessageLimit);
    const dailyWriteActionLimit = Number(draft.dailyWriteActionLimit);
    if (
      !Number.isFinite(dailyMessageLimit) ||
      dailyMessageLimit <= 0 ||
      !Number.isInteger(dailyMessageLimit)
    ) {
      toast.error('Daily message limit must be a positive integer');
      return;
    }
    if (
      !Number.isFinite(monthlyMessageLimit) ||
      monthlyMessageLimit <= 0 ||
      !Number.isInteger(monthlyMessageLimit)
    ) {
      toast.error('Monthly message limit must be a positive integer');
      return;
    }
    if (
      !Number.isFinite(dailyWriteActionLimit) ||
      dailyWriteActionLimit <= 0 ||
      !Number.isInteger(dailyWriteActionLimit)
    ) {
      toast.error('Daily write-action limit must be a positive integer');
      return;
    }

    update.mutate(
      {
        enabled: draft.enabled,
        disabledPropertyIds: draft.disabledPropertyIds,
        dailyMessageLimit,
        monthlyMessageLimit,
        dailyWriteActionLimit,
      },
      {
        onSuccess: (saved) => {
          const next: Draft = {
            enabled: saved.enabled,
            disabledPropertyIds: saved.disabledPropertyIds,
            dailyMessageLimit: String(saved.dailyMessageLimit),
            monthlyMessageLimit: String(saved.monthlyMessageLimit),
            dailyWriteActionLimit: String(saved.dailyWriteActionLimit),
          };
          setDraft(next);
          setBaseline(next);
          toast.success('AI assistant settings saved');
        },
        onError: (err: unknown) =>
          toast.error(friendlyToastError(err, 'Could not save AI assistant settings')),
      }
    );
  };

  if (settingsLoading || !draft) {
    return (
      <AdminSection id="ai-assistant" title="AI dashboard assistant" icon={Sparkles}>
        <SettingsFormSkeleton columns={2} fields={4} toggle label="Loading AI assistant" />
      </AdminSection>
    );
  }

  const properties = propertiesData?.properties ?? [];

  return (
    <AdminSection id="ai-assistant" title="AI dashboard assistant" icon={Sparkles}>
      {!settings?.platformEnabled ? (
        <p className="text-muted-foreground text-sm">
          The AI assistant is currently off platform-wide.
        </p>
      ) : null}

      {settings?.usage ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">This month</dt>
            <dd>
              {settings.usage.monthMessageCount} / {settings.monthlyMessageLimit} messages
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Write actions this month</dt>
            <dd>{settings.usage.monthWriteActionCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Credits used this month</dt>
            <dd>~{Math.round(settings.usage.monthCreditsConsumed).toLocaleString()}</dd>
          </div>
        </dl>
      ) : null}

      {readOnly ? (
        <p className="text-muted-foreground text-sm">
          Contact the organization owner to change these settings.
        </p>
      ) : null}

      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <Switch
          checked={draft.enabled}
          disabled={readOnly}
          onCheckedChange={(enabled) =>
            setDraft((current) => (current ? { ...current, enabled } : current))
          }
          aria-label="Enable AI assistant for organization"
        />
        Assistant enabled
      </label>

      {properties.length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">Disable on specific properties</p>
          <div className="space-y-2">
            {properties.map((property) => (
              <label key={property.id} className="flex min-h-[44px] items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.disabledPropertyIds.includes(property.id)}
                  disabled={readOnly}
                  onCheckedChange={(checked) =>
                    setDraft((current) => {
                      if (!current) return current;
                      const next = checked
                        ? [...current.disabledPropertyIds, property.id]
                        : current.disabledPropertyIds.filter((id) => id !== property.id);
                      return { ...current, disabledPropertyIds: next };
                    })
                  }
                  aria-label={`Disable AI assistant on ${property.name}`}
                />
                {property.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Daily message limit</span>
          <Input
            inputMode="numeric"
            value={draft.dailyMessageLimit}
            disabled={readOnly}
            onChange={(e) =>
              setDraft((current) =>
                current ? { ...current, dailyMessageLimit: e.target.value } : current
              )
            }
            aria-label="Daily assistant message limit"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Monthly message limit</span>
          <Input
            inputMode="numeric"
            value={draft.monthlyMessageLimit}
            disabled={readOnly}
            onChange={(e) =>
              setDraft((current) =>
                current ? { ...current, monthlyMessageLimit: e.target.value } : current
              )
            }
            aria-label="Monthly assistant message limit"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Daily write-action limit</span>
          <Input
            inputMode="numeric"
            value={draft.dailyWriteActionLimit}
            disabled={readOnly}
            onChange={(e) =>
              setDraft((current) =>
                current ? { ...current, dailyWriteActionLimit: e.target.value } : current
              )
            }
            aria-label="Daily assistant write-action limit"
          />
        </label>
      </div>

      {dirty && !readOnly ? (
        <Button
          type="button"
          className="min-h-[44px]"
          disabled={update.isPending}
          onClick={handleSave}
        >
          {update.isPending ? 'Saving…' : 'Save assistant settings'}
        </Button>
      ) : null}
    </AdminSection>
  );
}
