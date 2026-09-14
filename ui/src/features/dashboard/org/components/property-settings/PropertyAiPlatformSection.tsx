import * as React from 'react';

import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import {
  useAiPlatformPropertySettings,
  useUpdateAiPlatformPropertySettings,
  type AiPlatformPropertySettingsDto,
} from '@/features/dashboard/org/hooks/useAiPlatformSettings';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { SectionContentSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

type Draft = {
  enabled: boolean;
  dailyCallLimit: string;
  monthlyCallLimit: string;
  dailyCostUsdLimit: string;
  imageMonthlyCreditCap: string;
  videoMonthlyCreditCap: string;
};

function settingsToDraft(settings: AiPlatformPropertySettingsDto): Draft {
  return {
    enabled: settings.enabled,
    dailyCallLimit: settings.dailyCallLimit == null ? '' : String(settings.dailyCallLimit),
    monthlyCallLimit: settings.monthlyCallLimit == null ? '' : String(settings.monthlyCallLimit),
    dailyCostUsdLimit: settings.dailyCostUsdLimit == null ? '' : String(settings.dailyCostUsdLimit),
    imageMonthlyCreditCap:
      settings.imageMonthlyCreditCap == null ? '' : String(settings.imageMonthlyCreditCap),
    videoMonthlyCreditCap:
      settings.videoMonthlyCreditCap == null ? '' : String(settings.videoMonthlyCreditCap),
  };
}

export function PropertyAiPlatformSection() {
  const { data: settings, isLoading: settingsLoading } = useAiPlatformPropertySettings();
  const { data: propertyAccess } = usePropertyPermissions();
  const update = useUpdateAiPlatformPropertySettings();

  const canEdit = hasPropertyPermission(propertyAccess?.permissions, 'settings.aiOverrides:edit');
  const readOnly = !canEdit;

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [baseline, setBaseline] = React.useState<Draft | null>(null);

  React.useEffect(() => {
    if (!settings) return;
    const next = settingsToDraft(settings);
    setDraft((current) => (current === null ? next : current));
    setBaseline((current) => (current === null ? next : current));
  }, [settings]);

  const dirty =
    draft && baseline
      ? draft.enabled !== baseline.enabled ||
        draft.dailyCallLimit !== baseline.dailyCallLimit ||
        draft.monthlyCallLimit !== baseline.monthlyCallLimit ||
        draft.dailyCostUsdLimit !== baseline.dailyCostUsdLimit ||
        draft.imageMonthlyCreditCap !== baseline.imageMonthlyCreditCap ||
        draft.videoMonthlyCreditCap !== baseline.videoMonthlyCreditCap
      : false;

  const handleSave = () => {
    if (!draft) return;
    const dailyCallLimit = draft.dailyCallLimit === '' ? null : Number(draft.dailyCallLimit);
    const monthlyCallLimit = draft.monthlyCallLimit === '' ? null : Number(draft.monthlyCallLimit);
    const dailyCostUsdLimit =
      draft.dailyCostUsdLimit === '' ? null : Number(draft.dailyCostUsdLimit);
    const imageMonthlyCreditCap =
      draft.imageMonthlyCreditCap === '' ? null : Number(draft.imageMonthlyCreditCap);
    const videoMonthlyCreditCap =
      draft.videoMonthlyCreditCap === '' ? null : Number(draft.videoMonthlyCreditCap);

    if (
      dailyCallLimit != null &&
      (!Number.isFinite(dailyCallLimit) || dailyCallLimit <= 0 || !Number.isInteger(dailyCallLimit))
    ) {
      toast.error('Daily limit must be a positive integer or blank');
      return;
    }
    if (
      monthlyCallLimit != null &&
      (!Number.isFinite(monthlyCallLimit) ||
        monthlyCallLimit <= 0 ||
        !Number.isInteger(monthlyCallLimit))
    ) {
      toast.error('Monthly limit must be a positive integer or blank');
      return;
    }
    if (
      dailyCostUsdLimit != null &&
      (!Number.isFinite(dailyCostUsdLimit) || dailyCostUsdLimit <= 0)
    ) {
      toast.error('Daily cost limit must be a positive number or blank');
      return;
    }
    if (
      imageMonthlyCreditCap != null &&
      (!Number.isFinite(imageMonthlyCreditCap) ||
        imageMonthlyCreditCap <= 0 ||
        !Number.isInteger(imageMonthlyCreditCap))
    ) {
      toast.error('Image credit cap must be a positive integer or blank');
      return;
    }
    if (
      videoMonthlyCreditCap != null &&
      (!Number.isFinite(videoMonthlyCreditCap) ||
        videoMonthlyCreditCap <= 0 ||
        !Number.isInteger(videoMonthlyCreditCap))
    ) {
      toast.error('Video credit cap must be a positive integer or blank');
      return;
    }

    update.mutate(
      {
        enabled: draft.enabled,
        dailyCallLimit,
        monthlyCallLimit,
        dailyCostUsdLimit,
        imageMonthlyCreditCap,
        videoMonthlyCreditCap,
      },
      {
        onSuccess: (saved) => {
          const next = settingsToDraft(saved);
          setDraft(next);
          setBaseline(next);
          toast.success('Property AI settings saved');
        },
        onError: (err: unknown) =>
          toast.error(friendlyToastError(err, 'Could not save property AI settings')),
      }
    );
  };

  if (settingsLoading || !draft) {
    return (
      <AdminSection
        id="ai"
        title="AI overrides"
        icon={Sparkles}
        description="AI usage limits for this property."
      >
        <SectionContentSkeleton rows={4} />
      </AdminSection>
    );
  }

  return (
    <AdminSection
      id="ai"
      title="AI overrides"
      icon={Sparkles}
      description="AI usage limits for this property."
    >
      {readOnly ? (
        <p className="text-muted-foreground text-sm">
          Contact the property manager to change AI overrides.
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
            aria-label="Enable AI for this property"
          />
          AI enabled for this property
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Daily call limit (blank = inherit)</span>
            <Input
              inputMode="numeric"
              value={draft.dailyCallLimit}
              disabled={readOnly}
              onChange={(e) =>
                setDraft((current) =>
                  current ? { ...current, dailyCallLimit: e.target.value } : current
                )
              }
              aria-label="Daily AI call limit override"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Monthly call limit (blank = inherit)</span>
            <Input
              inputMode="numeric"
              value={draft.monthlyCallLimit}
              disabled={readOnly}
              onChange={(e) =>
                setDraft((current) =>
                  current ? { ...current, monthlyCallLimit: e.target.value } : current
                )
              }
              aria-label="Monthly AI call limit override"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Daily cost USD limit (blank = inherit)</span>
            <Input
              inputMode="decimal"
              value={draft.dailyCostUsdLimit}
              disabled={readOnly}
              onChange={(e) =>
                setDraft((current) =>
                  current ? { ...current, dailyCostUsdLimit: e.target.value } : current
                )
              }
              aria-label="Daily AI cost USD limit override"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Image monthly credits (blank = 60%)</span>
            <Input
              inputMode="numeric"
              value={draft.imageMonthlyCreditCap}
              disabled={readOnly}
              onChange={(e) =>
                setDraft((current) =>
                  current ? { ...current, imageMonthlyCreditCap: e.target.value } : current
                )
              }
              aria-label="Image monthly credit cap"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Video monthly credits (blank = 60%)</span>
            <Input
              inputMode="numeric"
              value={draft.videoMonthlyCreditCap}
              disabled={readOnly}
              onChange={(e) =>
                setDraft((current) =>
                  current ? { ...current, videoMonthlyCreditCap: e.target.value } : current
                )
              }
              aria-label="Video monthly credit cap"
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
          {update.isPending ? 'Saving…' : 'Save property AI overrides'}
        </Button>
      ) : null}
    </AdminSection>
  );
}
