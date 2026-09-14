import * as React from 'react';

import { toast } from 'sonner';

import {
  SuperAdminSettingsCard,
  SuperAdminSettingsRow,
} from '@/features/dashboard/super-admin/components/shared/SuperAdminSettingsCard';
import {
  useAiPlatformGenerationOverrides,
  usePatchAiPlatformGenerationOverrides,
  type MarketingGenerationOverrideRow,
} from '@/features/dashboard/super-admin/hooks/useAiPlatformGenerationOverrides';

import { SectionContentSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

type Draft = {
  imageMonthlyCreditCap: string;
  videoMonthlyCreditCap: string;
  allowPremiumImage: boolean;
  allowPremiumVideo: boolean;
};

function rowToDraft(row: MarketingGenerationOverrideRow): Draft {
  return {
    imageMonthlyCreditCap:
      row.imageMonthlyCreditCap == null ? '' : String(row.imageMonthlyCreditCap),
    videoMonthlyCreditCap:
      row.videoMonthlyCreditCap == null ? '' : String(row.videoMonthlyCreditCap),
    allowPremiumImage: row.allowPremiumImage,
    allowPremiumVideo: row.allowPremiumVideo,
  };
}

function parseCap(
  value: string,
  label: string
): { ok: true; value: number | null } | { ok: false } {
  if (value === '') return { ok: true, value: null };
  const cap = Number(value);
  if (!Number.isFinite(cap) || !Number.isInteger(cap) || cap <= 0) {
    toast.error(`${label} must be a positive integer or blank`);
    return { ok: false };
  }
  return { ok: true, value: cap };
}

function PropertyOverrideRow({
  row,
  orgId,
}: {
  row: MarketingGenerationOverrideRow;
  orgId: string;
}) {
  const patch = usePatchAiPlatformGenerationOverrides(orgId);
  const [draft, setDraft] = React.useState<Draft>(() => rowToDraft(row));
  const baseline = rowToDraft(row);
  const dirty =
    draft.imageMonthlyCreditCap !== baseline.imageMonthlyCreditCap ||
    draft.videoMonthlyCreditCap !== baseline.videoMonthlyCreditCap ||
    draft.allowPremiumImage !== baseline.allowPremiumImage ||
    draft.allowPremiumVideo !== baseline.allowPremiumVideo;

  React.useEffect(() => {
    setDraft(rowToDraft(row));
  }, [
    row.propertyId,
    row.imageMonthlyCreditCap,
    row.videoMonthlyCreditCap,
    row.allowPremiumImage,
    row.allowPremiumVideo,
    row.propertyName,
  ]);

  const handleSave = () => {
    const imageCap = parseCap(draft.imageMonthlyCreditCap, 'Image cap');
    if (!imageCap.ok) return;
    const videoCap = parseCap(draft.videoMonthlyCreditCap, 'Video cap');
    if (!videoCap.ok) return;
    patch.mutate(
      {
        propertyId: row.propertyId,
        imageMonthlyCreditCap: imageCap.value,
        videoMonthlyCreditCap: videoCap.value,
        allowPremiumImage: draft.allowPremiumImage,
        allowPremiumVideo: draft.allowPremiumVideo,
      },
      {
        onSuccess: () => toast.success('Saved'),
        onError: (err: unknown) => toast.error(friendlyToastError(err, 'Could not save')),
      }
    );
  };

  return (
    <div className="border-border/70 space-y-3 rounded-xl border p-3">
      <p className="text-sm font-medium">{row.propertyName || 'Property'}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Image monthly credits</span>
          <Input
            inputMode="numeric"
            value={draft.imageMonthlyCreditCap}
            onChange={(event) =>
              setDraft((current) => ({ ...current, imageMonthlyCreditCap: event.target.value }))
            }
            aria-label={`${row.propertyName} image monthly credit cap`}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Video monthly credits</span>
          <Input
            inputMode="numeric"
            value={draft.videoMonthlyCreditCap}
            onChange={(event) =>
              setDraft((current) => ({ ...current, videoMonthlyCreditCap: event.target.value }))
            }
            aria-label={`${row.propertyName} video monthly credit cap`}
          />
        </label>
      </div>
      <SuperAdminSettingsRow label="Premium image" htmlFor={`premium-image-${row.propertyId}`}>
        <Switch
          id={`premium-image-${row.propertyId}`}
          checked={draft.allowPremiumImage}
          onCheckedChange={(value) =>
            setDraft((current) => ({ ...current, allowPremiumImage: value === true }))
          }
          aria-label={`${row.propertyName} premium image`}
        />
      </SuperAdminSettingsRow>
      <SuperAdminSettingsRow label="Premium video" htmlFor={`premium-video-${row.propertyId}`}>
        <Switch
          id={`premium-video-${row.propertyId}`}
          checked={draft.allowPremiumVideo}
          onCheckedChange={(value) =>
            setDraft((current) => ({ ...current, allowPremiumVideo: value === true }))
          }
          aria-label={`${row.propertyName} premium video`}
        />
      </SuperAdminSettingsRow>
      {dirty ? (
        <Button
          type="button"
          className="min-h-[44px]"
          disabled={patch.isPending}
          onClick={handleSave}
        >
          {patch.isPending ? 'Saving' : 'Save'}
        </Button>
      ) : null}
    </div>
  );
}

export function SuperAdminGenerationOverridesCard({ orgId }: { orgId: string }) {
  const { data, isLoading, isError } = useAiPlatformGenerationOverrides(orgId);

  return (
    <SuperAdminSettingsCard title="Generate caps">
      {isLoading ? (
        <SectionContentSkeleton rows={3} />
      ) : isError || !data ? (
        <p className="text-muted-foreground text-sm">Could not load Generate caps</p>
      ) : data.properties.length === 0 ? (
        <p className="text-muted-foreground text-sm">No properties</p>
      ) : (
        <div className="space-y-3">
          {data.properties.map((row) => (
            <PropertyOverrideRow key={row.propertyId} row={row} orgId={orgId} />
          ))}
        </div>
      )}
    </SuperAdminSettingsCard>
  );
}
