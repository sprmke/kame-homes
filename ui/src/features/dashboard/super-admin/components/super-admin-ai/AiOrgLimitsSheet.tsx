import * as React from 'react';

import { Link } from 'react-router-dom';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

import { AiAssignDialog } from '@/features/dashboard/super-admin/components/super-admin-ai/AiAssignDialog';
import { AiOverrideDialog } from '@/features/dashboard/super-admin/components/super-admin-ai/AiOverrideDialog';
import { AiResolvedLimits } from '@/features/dashboard/super-admin/components/super-admin-ai/AiResolvedLimits';
import { useAiLimitsOrgDetail } from '@/features/dashboard/super-admin/hooks/useSuperAdminAiLimits';
import {
  formatLimitValue,
  type AiLimitKey,
  type ResolvedAiLimits,
} from '@/features/dashboard/super-admin/lib/aiLimits';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Skeleton } from '@/components/ui/skeleton';

function overridesOf(limits: ResolvedAiLimits): Partial<Record<AiLimitKey, number | null>> {
  const out: Partial<Record<AiLimitKey, number | null>> = {};
  for (const key of Object.keys(limits) as AiLimitKey[]) {
    if (limits[key].source === 'override') out[key] = limits[key].value;
  }
  return out;
}

type AiOrgLimitsSheetProps = {
  orgId: string | null;
  onOpenChange: (open: boolean) => void;
};

/** One org: resolved limits with provenance, org assignment/overrides, and per-property rows. */
export function AiOrgLimitsSheet({ orgId, onOpenChange }: AiOrgLimitsSheetProps) {
  const { data, isLoading, error } = useAiLimitsOrgDetail(orgId);
  const [assignOrg, setAssignOrg] = React.useState(false);
  const [overrideOrg, setOverrideOrg] = React.useState(false);
  const [propertyAssign, setPropertyAssign] = React.useState<string | null>(null);
  const [propertyOverride, setPropertyOverride] = React.useState<string | null>(null);

  const org = data?.organization;
  const propertyForAssign = data?.properties.find((p) => p.propertyId === propertyAssign);
  const propertyForOverride = data?.properties.find((p) => p.propertyId === propertyOverride);
  const profiles = data?.profiles ?? [];

  return (
    <>
      <ResponsiveModal open={Boolean(orgId)} onOpenChange={onOpenChange}>
        <ResponsiveModalContent className="max-w-2xl" sheetLayout="split">
          <ResponsiveModalHeader className="px-4 sm:px-0">
            <ResponsiveModalTitle>{org?.name ?? 'AI limits'}</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4 sm:px-0">
            {isLoading ? (
              <div className="space-y-2" aria-label="Loading AI limits">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : error || !data || !org ? (
              <p className="text-destructive text-sm">Could not load AI limits.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {(data.resolved?.planTier ?? 'included').replace('_', ' ')}
                  </Badge>
                  {data.assignment?.profileCode ? (
                    <Badge variant="secondary">{data.assignment.profileCode}</Badge>
                  ) : null}
                  {data.resolved?.hasOverrides ? (
                    <Badge variant="destructive">
                      Override
                      {data.resolved.overrideReason ? `: ${data.resolved.overrideReason}` : ''}
                    </Badge>
                  ) : null}
                  <Link
                    to={superAdminPaths.organizationHubSection(org.slug, 'ai')}
                    className="text-primary ml-auto text-sm hover:underline"
                  >
                    Org hub
                  </Link>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAssignOrg(true)}
                  >
                    Assign profile
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setOverrideOrg(true)}
                  >
                    Overrides
                  </Button>
                </div>

                {data.dailySeries.length > 1 ? (
                  <section className="space-y-1">
                    <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      Spend, last 30 days
                    </h4>
                    <div
                      className="h-28 w-full"
                      role="img"
                      aria-label="Daily AI spend, last 30 days"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={data.dailySeries}
                          margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
                        >
                          <XAxis
                            dataKey="date"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v: string) => v.slice(5)}
                            minTickGap={24}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            formatter={(v: number) => [`$${Number(v).toFixed(4)}`, 'Cost']}
                          />
                          <Area
                            type="monotone"
                            dataKey="costUsd"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            fill="#8b5cf6"
                            fillOpacity={0.15}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                ) : null}

                {data.resolved ? <AiResolvedLimits limits={data.resolved.limits} /> : null}

                {data.properties.length > 0 ? (
                  <section className="space-y-2">
                    <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      Properties
                    </h4>
                    <ul className="space-y-2">
                      {data.properties.map((property) => (
                        <li
                          key={property.propertyId}
                          className="border-border/60 space-y-2 rounded-lg border p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{property.name}</p>
                              <p className="text-muted-foreground truncate text-xs">
                                {property.residenceName ?? 'No development'}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {property.propertyProfileCode ? (
                                <Badge variant="secondary">{property.propertyProfileCode}</Badge>
                              ) : null}
                              {property.developmentProfileCode ? (
                                <Badge variant="outline">{property.developmentProfileCode}</Badge>
                              ) : null}
                            </div>
                          </div>
                          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            <span>
                              {formatLimitValue(
                                'dailyCallLimit',
                                property.limits.dailyCallLimit.value
                              )}{' '}
                              calls / day
                            </span>
                            <span>
                              {property.usage.monthCalls} calls · $
                              {property.usage.monthCostUsd.toFixed(2)} this month
                            </span>
                            <span>
                              {formatLimitValue(
                                'voiceMaxSessionSeconds',
                                property.limits.voiceMaxSessionSeconds.value
                              )}
                              s voice
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setPropertyAssign(property.propertyId)}
                            >
                              Profile
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setPropertyOverride(property.propertyId)}
                            >
                              Overrides
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            )}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {org ? (
        <>
          <AiAssignDialog
            open={assignOrg}
            onOpenChange={setAssignOrg}
            scope="organization"
            targets={[{ id: org.id, name: org.name }]}
            profiles={profiles}
            currentProfileId={data?.assignment?.profileId}
          />
          <AiOverrideDialog
            open={overrideOrg}
            onOpenChange={setOverrideOrg}
            scope="organization"
            targets={[{ id: org.id, name: org.name }]}
            initial={data?.resolved ? overridesOf(data.resolved.limits) : undefined}
          />
        </>
      ) : null}
      {propertyForAssign ? (
        <AiAssignDialog
          open
          onOpenChange={(open) => !open && setPropertyAssign(null)}
          scope="property"
          targets={[{ id: propertyForAssign.propertyId, name: propertyForAssign.name }]}
          profiles={profiles}
          currentProfileId={
            profiles.find((p) => p.code === propertyForAssign.propertyProfileCode)?.id
          }
        />
      ) : null}
      {propertyForOverride ? (
        <AiOverrideDialog
          open
          onOpenChange={(open) => !open && setPropertyOverride(null)}
          scope="property"
          targets={[{ id: propertyForOverride.propertyId, name: propertyForOverride.name }]}
          initial={overridesOf(propertyForOverride.limits)}
        />
      ) : null}
    </>
  );
}
