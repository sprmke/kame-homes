import { useMemo, useState } from 'react';

import { ScrollText } from 'lucide-react';

import { ActivityDetailSheet } from '@/features/dashboard/activity/components/ActivityDetailSheet';
import { ActivityFeedList } from '@/features/dashboard/activity/components/ActivityFeedList';
import type { ActivityEvent } from '@/features/dashboard/activity/lib/activityCatalog';
import { SuperAdminEmptyState } from '@/features/dashboard/super-admin/components/shared/SuperAdminEmptyState';
import { useSuperAdminOrgContext } from '@/features/dashboard/super-admin/components/super-admin-orgs/superAdminOrgContext';
import { useSuperAdminAudit } from '@/features/dashboard/super-admin/hooks/useSuperAdminAudit';
import { useSuperAdminOrgActivity } from '@/features/dashboard/super-admin/hooks/useSuperAdminOrgActivity';

import { SuperAdminAuditBodySkeleton } from '@/components/skeletons/SuperAdminSkeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Platform actions taken on this org — the existing super_admin_audit_events view. */
function PlatformActionsView({ orgId }: { orgId: string }) {
  const { data, isLoading, error } = useSuperAdminAudit({
    page: 1,
    limit: 50,
    targetType: 'organization',
    targetId: orgId,
  });
  const events = data?.events ?? [];

  if (isLoading) return <SuperAdminAuditBodySkeleton />;
  if (error) return <p className="text-destructive text-sm">Could not load activity.</p>;

  return events.length === 0 ? (
    <SuperAdminEmptyState icon={ScrollText} title="No recorded super-admin actions for this org" />
  ) : (
    <ol className="space-y-2">
      {events.map((event) => (
        <li key={event.id}>
          <Card padding="sm" className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{event.summary}</p>
              <span className="text-muted-foreground shrink-0 text-xs">
                {relativeTime(event.createdAt)}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              <span className="font-mono">{event.action}</span> · {event.actorEmail}
            </p>
          </Card>
        </li>
      ))}
    </ol>
  );
}

/** Everything the org's own team / guests / crons did — the org `activity_log`. */
function OrgActivityView({ orgId }: { orgId: string }) {
  const query = useSuperAdminOrgActivity(orgId);
  const [selected, setSelected] = useState<ActivityEvent | null>(null);
  const events = useMemo(() => query.data?.pages.flatMap((p) => p.events) ?? [], [query.data]);

  if (query.isLoading) return <SuperAdminAuditBodySkeleton />;
  if (query.isError) return <p className="text-destructive text-sm">Could not load activity.</p>;

  return events.length === 0 ? (
    <SuperAdminEmptyState icon={ScrollText} title="No recorded org activity yet" />
  ) : (
    <div className="space-y-2">
      <ActivityFeedList events={events} onSelect={setSelected} />
      {query.hasNextPage ? (
        <div className="pt-1 text-center">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
      <ActivityDetailSheet event={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}

export function SuperAdminOrgActivitySection() {
  const { org } = useSuperAdminOrgContext();
  const [view, setView] = useState<'platform' | 'org'>('platform');

  return (
    <div className="space-y-3">
      <Tabs value={view} onValueChange={(v) => setView(v as 'platform' | 'org')}>
        <TabsList>
          <TabsTrigger value="platform">Platform actions</TabsTrigger>
          <TabsTrigger value="org">Org activity</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === 'platform' ? (
        <PlatformActionsView orgId={org.id} />
      ) : (
        <OrgActivityView orgId={org.id} />
      )}
    </div>
  );
}
