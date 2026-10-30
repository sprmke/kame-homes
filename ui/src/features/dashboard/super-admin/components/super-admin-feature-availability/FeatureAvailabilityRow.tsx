import { Pencil } from 'lucide-react';

import {
  catalogEntryDepth,
  isoToManilaDateTimeParts,
} from '@/features/dashboard/super-admin/lib/featureAvailabilityAdmin';
import type { FeatureAvailabilityAdminOverride } from '@/features/dashboard/super-admin/hooks/useFeatureAvailabilityAdmin';

import { FeatureStatusDot } from '@/components/feature-availability/FeatureStatusDot';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { FeatureAvailabilityCatalogEntry } from '@/lib/featureAvailability/featureAvailabilityCatalog';
import { featureAvailabilityReasonLabel } from '@/lib/featureAvailability/featureAvailabilityCopy';
import type { ResolvedFeatureAvailability } from '@/lib/featureAvailability/resolveFeatureAvailability';
import { cn } from '@/lib/utils';

type Props = {
  entry: FeatureAvailabilityCatalogEntry;
  resolved: ResolvedFeatureAvailability;
  override: FeatureAvailabilityAdminOverride | null;
  parentOff: boolean;
  onToggle: (nextEnabled: boolean) => void;
  onEdit: () => void;
};

export function FeatureAvailabilityRow({
  entry,
  resolved,
  override,
  parentOff,
  onToggle,
  onEdit,
}: Props) {
  const depth = catalogEntryDepth(entry.key);
  const switchDisabled = parentOff;
  const checked = resolved.available;
  const selfOff = resolved.source === 'self' && !resolved.available;
  const canEdit = selfOff && !resolved.restoredAutomatically;

  let statusLine: string | null = null;
  if (parentOff && !checked) {
    statusLine = 'Off with parent';
  } else if (resolved.restoredAutomatically && override && !override.is_enabled) {
    const { date, time } = isoToManilaDateTimeParts(override.expected_back_at);
    statusLine =
      date && time
        ? `Turned back on automatically at ${date} ${time} (Manila)`
        : 'Turned back on automatically';
  } else if (!checked && resolved.reason) {
    statusLine = featureAvailabilityReasonLabel(resolved.reason);
  }

  return (
    <div
      className={cn(
        'flex min-h-[52px] items-start gap-3 border-b py-3 last:border-b-0',
        depth > 0 && 'pl-4 sm:pl-6'
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          {!checked ? <FeatureStatusDot label={`${entry.label} unavailable`} /> : null}
          <p className="text-sm font-medium leading-snug">{entry.label}</p>
        </div>
        {entry.description ? (
          <p className="text-muted-foreground text-xs leading-snug">{entry.description}</p>
        ) : null}
        {statusLine ? <p className="text-muted-foreground text-xs">{statusLine}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label={`Edit ${entry.label}`}
            onClick={onEdit}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : null}
        <Switch
          checked={checked}
          disabled={switchDisabled}
          aria-label={`${entry.label} ${checked ? 'on' : 'off'}`}
          onCheckedChange={onToggle}
          className="shrink-0"
        />
      </div>
    </div>
  );
}
