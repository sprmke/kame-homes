import { AiProvenanceBadge } from '@/features/dashboard/super-admin/components/super-admin-ai/AiProvenanceBadge';
import {
  AI_LIMIT_FIELDS,
  AI_LIMIT_GROUPS,
  formatLimitValue,
  type ResolvedAiLimits,
} from '@/features/dashboard/super-admin/lib/aiLimits';

/** Read-only resolved limits, grouped, each with where the number came from. */
export function AiResolvedLimits({ limits }: { limits: ResolvedAiLimits }) {
  return (
    <div className="space-y-4">
      {AI_LIMIT_GROUPS.map((group) => (
        <section key={group.id} className="space-y-1">
          <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            {group.label}
          </h4>
          <dl className="divide-border/60 divide-y text-sm">
            {group.keys.map((key) => (
              <div key={key} className="flex items-center justify-between gap-3 py-1.5">
                <dt className="text-muted-foreground min-w-0 truncate">
                  {AI_LIMIT_FIELDS[key].label}
                </dt>
                <dd className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums">{formatLimitValue(key, limits[key].value)}</span>
                  <AiProvenanceBadge
                    source={limits[key].source}
                    profileCode={limits[key].profileCode}
                  />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
