import { SettingsManageButton } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import type { SettingsSummaryLabels } from '@/features/dashboard/org/lib/propertySettingsSummaryLabels';

/**
 * Compact preview of a long settings list: real item names, then a `+N` pill,
 * then **Manage**. Used by Amenities and House Rules so a host can see what is
 * on the listing without opening the editor.
 */
export function PropertySettingsSummaryRow({
  labels,
  emptyLabel,
  countNoun,
  disabled,
  needsAttention = false,
  onManage,
}: {
  labels: SettingsSummaryLabels;
  /** Shown when nothing is selected, e.g. "No amenities selected". */
  emptyLabel: string;
  /** Singular noun for the trailing count, e.g. "amenity". */
  countNoun: string;
  disabled?: boolean;
  needsAttention?: boolean;
  onManage: () => void;
}) {
  const total = labels.shown.length + labels.hiddenCount;
  const nameLine = labels.shown.join(' · ');

  return (
    <div className="bg-muted/40 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="min-w-0 flex-1">
        {total === 0 ? (
          <p className="text-muted-foreground min-w-0 truncate text-xs sm:text-sm">{emptyLabel}</p>
        ) : (
          <p className="text-foreground line-clamp-2 text-xs font-medium leading-snug sm:text-sm">
            {nameLine}
            {labels.hiddenCount > 0 ? (
              <>
                {' '}
                <span
                  className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold tabular-nums"
                  title={`${total} ${countNoun}${total === 1 ? '' : 's'} selected`}
                >
                  +{labels.hiddenCount}
                  <span className="sr-only">
                    {' '}
                    more {countNoun}
                    {labels.hiddenCount === 1 ? '' : 's'}
                  </span>
                </span>
              </>
            ) : null}
          </p>
        )}
      </div>
      <SettingsManageButton
        disabled={disabled}
        needsAttention={needsAttention}
        onClick={onManage}
      />
    </div>
  );
}
