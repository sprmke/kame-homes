import { usePropertySettingsCopyLogs } from '@/features/dashboard/org/hooks/usePropertySettingsCopyLogs';
import type { PropertySettingsCopyLogEntry } from '@/features/dashboard/org/lib/copyPropertySettingsApi';
import { COPY_PROPERTY_SETTINGS_GROUPS } from '@/features/dashboard/org/lib/copyPropertySettingsGroups';

type Props = {
  orgSlug: string;
  propertyNameById: Map<string, string>;
};

function groupLabel(id: string): string {
  return COPY_PROPERTY_SETTINGS_GROUPS.find((g) => g.id === id)?.label ?? id;
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Manila',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function summarizeLog(
  log: PropertySettingsCopyLogEntry,
  propertyNameById: Map<string, string>
): string {
  const source = propertyNameById.get(log.source_property_id) ?? 'Source';
  const targetCount = log.target_property_ids.length;
  const groupCount = log.groups.length;
  return `${source} → ${targetCount} ${targetCount === 1 ? 'property' : 'properties'} · ${groupCount} ${groupCount === 1 ? 'group' : 'groups'}`;
}

export function CopyPropertySettingsHistory({ orgSlug, propertyNameById }: Props) {
  const { data, isPending, isError } = usePropertySettingsCopyLogs(orgSlug);

  // Optional section: stay blank until we know there is history (avoids a title flash on empty orgs).
  if (isPending || isError) return null;

  const logs = data?.logs ?? [];
  if (logs.length === 0) return null;

  return (
    <section className="mt-8 space-y-3" aria-label="Copy history">
      <h2 className="text-sm font-medium">Copy history</h2>
      <ul className="divide-border border-border divide-y rounded-lg border">
        {logs.map((log) => {
          const groupPreview = log.groups.slice(0, 4).map(groupLabel).join(', ');
          const more = log.groups.length > 4 ? ` +${log.groups.length - 4}` : '';
          return (
            <li
              key={log.id}
              className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {summarizeLog(log, propertyNameById)}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {groupPreview}
                  {more}
                </p>
              </div>
              <time
                className="text-muted-foreground shrink-0 text-xs tabular-nums"
                dateTime={log.created_at}
              >
                {formatWhen(log.created_at)}
              </time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
