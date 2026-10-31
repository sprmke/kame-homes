import { Link } from 'react-router-dom';

import type { SuperAdminOverview } from '@/features/dashboard/super-admin/hooks/useSuperAdminOverview';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const day = 86_400_000;
  if (diffMs < day) return 'today';
  const days = Math.floor(diffMs / day);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function SuperAdminRecentActivity({ recent }: { recent: SuperAdminOverview['recent'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <section className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            New organizations
          </p>
          {recent.organizations.length === 0 ? (
            <p className="text-muted-foreground text-sm">None yet.</p>
          ) : (
            <ul className="space-y-1">
              {recent.organizations.map((org) => (
                <li key={org.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link
                    to={superAdminPaths.organizationHub(org.slug)}
                    className="min-w-0 truncate font-medium hover:underline"
                  >
                    {org.name}
                  </Link>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {relativeTime(org.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Subscription changes
          </p>
          {recent.subscriptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">None yet.</p>
          ) : (
            <ul className="space-y-1">
              {recent.subscriptions.map((sub, index) => (
                <li
                  key={`${sub.planLabel}-${sub.createdAt}-${index}`}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {sub.planLabel}{' '}
                    <span className="text-muted-foreground capitalize">· {sub.status}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {relativeTime(sub.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Support tickets
          </p>
          {recent.tickets.length === 0 ? (
            <p className="text-muted-foreground text-sm">None yet.</p>
          ) : (
            <ul className="space-y-1">
              {recent.tickets.map((ticket) => (
                <li key={ticket.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link
                    to={superAdminPaths.support}
                    className="min-w-0 truncate hover:underline"
                    title={ticket.subject}
                  >
                    {ticket.subject}
                  </Link>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {relativeTime(ticket.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
