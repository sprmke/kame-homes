import { useEffect, useState } from 'react';

import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Plus, Ticket } from 'lucide-react';

import { HelpEmptyState } from '@/features/dashboard/help-support/components/HelpEmptyState';
import { NewTicketModal } from '@/features/dashboard/help-support/components/NewTicketModal';
import { SupportTicketStatusBadge } from '@/features/dashboard/help-support/components/SupportTicketStatusBadge';
import { TicketThreadPanel } from '@/features/dashboard/help-support/components/TicketThreadPanel';
import { useSupportTickets } from '@/features/dashboard/help-support/hooks/useSupportTickets';
import {
  helpSupportTicketDetailPath,
  helpSupportTicketsPath,
  isSupportTicketId,
  resolveTicketsRouteSegment,
  ticketsComposeSearchParam,
  useHelpSupportBasePath,
} from '@/features/dashboard/help-support/lib/helpSupportPaths';
import type { SupportTicketCategory } from '@/features/dashboard/help-support/lib/supportTicketSchema';
import { SUPPORT_TICKET_CATEGORY_LABELS } from '@/features/dashboard/help-support/lib/supportTicketSchema';
import { MANAGED_PLAN_INQUIRY_SUBJECT } from '@/features/dashboard/plans/lib/planPresentation';

import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

function formatTicketDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
  });
}

type TicketsWorkspacePageProps = {
  /** When set (e.g. `/account`), skip admin Help & Support base-path resolution. */
  basePathOverride?: string;
};

export function TicketsWorkspacePage({ basePathOverride }: TicketsWorkspacePageProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const adminBasePath = useHelpSupportBasePath();
  const basePath = basePathOverride ?? adminBasePath;
  const isMobile = useIsBelowLg();
  const splatParam = useParams()['*'];
  const segment = resolveTicketsRouteSegment(basePath, location.pathname, splatParam);
  const composeOpen = searchParams.get('compose') === '1';
  const isNew = segment === 'new' || composeOpen;
  const ticketId = !isNew && segment && isSupportTicketId(segment) ? segment : null;
  const draftSubjectParam = searchParams.get('subject')?.trim() ?? '';
  const newTicketDefaults =
    isNew && draftSubjectParam
      ? {
          subject: draftSubjectParam,
          category:
            draftSubjectParam === MANAGED_PLAN_INQUIRY_SUBJECT
              ? ('business_inquiry' as SupportTicketCategory)
              : undefined,
        }
      : null;
  const [backgroundTicketId, setBackgroundTicketId] = useState<string | null>(null);

  const { data, isPending, isError, refetch } = useSupportTickets();
  const tickets = data?.tickets ?? [];
  const firstTicketId = tickets[0]?.id;
  const listReady = !isPending && !isError;
  const isEmpty = listReady && tickets.length === 0;
  const visibleTicketId = ticketId ?? (!isMobile && isNew ? backgroundTicketId : null);
  const paneOpen = Boolean(visibleTicketId);

  useEffect(() => {
    if (ticketId) setBackgroundTicketId(ticketId);
  }, [ticketId]);

  useEffect(() => {
    if (!basePath || !segment || segment === 'new' || isSupportTicketId(segment)) return;
    navigate(helpSupportTicketsPath(basePath), { replace: true });
  }, [basePath, segment, navigate]);

  useEffect(() => {
    if (!basePath || segment !== 'new' || composeOpen) return;
    navigate(`${helpSupportTicketsPath(basePath)}?${ticketsComposeSearchParam().toString()}`, {
      replace: true,
    });
  }, [basePath, segment, composeOpen, navigate]);

  useEffect(() => {
    if (isMobile || ticketId || !basePath || isPending || !firstTicketId) return;
    if (isNew) {
      setBackgroundTicketId((current) => current ?? firstTicketId);
      return;
    }
    navigate(helpSupportTicketDetailPath(basePath, firstTicketId), { replace: true });
  }, [isMobile, isNew, ticketId, basePath, isPending, firstTicketId, navigate]);

  const goToTickets = () => {
    if (basePath) navigate(helpSupportTicketsPath(basePath));
  };

  const openCompose = () => {
    if (!basePath) return;
    const ticketsRoot = helpSupportTicketsPath(basePath);
    if (location.pathname === ticketsRoot || location.pathname.startsWith(`${ticketsRoot}/`)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('compose', '1');
          return next;
        },
        { replace: false }
      );
      return;
    }
    navigate(`${ticketsRoot}?${ticketsComposeSearchParam().toString()}`);
  };

  const closeCompose = () => {
    if (!basePath) return;

    if (composeOpen) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('compose');
          next.delete('subject');
          return next;
        },
        { replace: true }
      );
      return;
    }

    if (searchParams.has('subject')) {
      setSearchParams({}, { replace: true });
    }
    if (backgroundTicketId) {
      navigate(helpSupportTicketDetailPath(basePath, backgroundTicketId), { replace: true });
      return;
    }
    navigate(helpSupportTicketsPath(basePath), { replace: true });
  };

  const newTicketButton = (
    <Button
      type="button"
      size="sm"
      className="min-h-11 shrink-0 gap-1.5 sm:min-h-9"
      onClick={openCompose}
      aria-haspopup="dialog"
      aria-expanded={isNew}
    >
      <Plus className="size-4" aria-hidden />
      New
    </Button>
  );

  const newTicketCta = basePath ? (
    <Button type="button" className="min-h-11 gap-1.5" onClick={openCompose}>
      <Plus className="size-4" aria-hidden />
      New ticket
    </Button>
  ) : null;

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden lg:min-h-[480px]',
        bottomTabBarOffsetClassName()
      )}
    >
      <div className="border-border/80 bg-card flex min-h-0 flex-1 overflow-hidden rounded-xl border shadow-sm">
        <div
          className={cn(
            'border-border/80 flex h-full min-h-0 shrink-0 flex-col',
            isEmpty
              ? 'w-full'
              : cn(
                  'w-full lg:w-[min(100%,400px)]',
                  paneOpen ? 'hidden lg:flex lg:border-r' : 'flex'
                )
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2.5">
            <h3
              id="my-tickets-heading"
              className="text-foreground min-w-0 truncate text-sm font-semibold tracking-tight"
            >
              My Tickets
            </h3>
            {basePath ? newTicketButton : null}
          </div>

          <div
            className={cn(
              'min-h-0 flex-1 overscroll-contain',
              isEmpty || isError
                ? 'flex flex-col items-center justify-center overflow-hidden p-4'
                : 'overflow-y-auto'
            )}
          >
            {isPending ? (
              <div className="space-y-1 p-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : isError ? (
              <HelpEmptyState
                icon={Ticket}
                title="Couldn't load tickets"
                action={
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => void refetch()}
                  >
                    Try again
                  </Button>
                }
              />
            ) : isEmpty ? (
              <HelpEmptyState icon={Ticket} title="No tickets yet" action={newTicketCta} />
            ) : (
              <ul aria-labelledby="my-tickets-heading">
                {tickets.map((ticket) => {
                  const selected = ticket.id === visibleTicketId;
                  return (
                    <li key={ticket.id} className="min-w-0">
                      <Link
                        to={basePath ? helpSupportTicketDetailPath(basePath, ticket.id) : '#'}
                        aria-current={selected ? 'page' : undefined}
                        className={cn(
                          'relative flex min-h-[44px] w-full touch-manipulation flex-col gap-1 px-3 py-3 text-left transition-colors',
                          'hover:bg-muted/40',
                          selected && 'bg-muted/60',
                          ticket.status === 'closed' && !selected && 'opacity-70'
                        )}
                      >
                        {selected ? (
                          <span
                            className="bg-primary absolute inset-y-2 left-0 w-0.5 rounded-full"
                            aria-hidden
                          />
                        ) : null}
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className="text-foreground line-clamp-2 min-w-0 text-sm font-medium [overflow-wrap:anywhere]"
                            title={ticket.subject}
                          >
                            {ticket.subject}
                          </p>
                          <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                            {formatTicketDate(ticket.updated_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-muted-foreground min-w-0 truncate text-xs">
                            {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]}
                          </p>
                          <SupportTicketStatusBadge status={ticket.status} compact />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
            isEmpty ? 'hidden' : paneOpen ? 'flex' : 'hidden lg:flex'
          )}
        >
          {visibleTicketId ? (
            <TicketThreadPanel ticketId={visibleTicketId} onBack={goToTickets} />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <HelpEmptyState icon={Ticket} title="Pick a ticket" compact />
            </div>
          )}
        </div>
      </div>

      <NewTicketModal
        open={isNew}
        defaultSubject={newTicketDefaults?.subject}
        defaultCategory={newTicketDefaults?.category}
        onOpenChange={(open) => {
          if (open) openCompose();
          else if (isNew) closeCompose();
        }}
        onSubmitted={(id) => {
          if (basePath) {
            navigate(helpSupportTicketDetailPath(basePath, id), { replace: true });
          }
        }}
      />
    </div>
  );
}
