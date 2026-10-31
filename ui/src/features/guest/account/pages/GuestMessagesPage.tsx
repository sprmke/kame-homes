import { GuestAccountEmptyState } from '@/features/guest/account/components/GuestAccountEmptyState';
import {
  GUEST_MESSAGES_HUB_SHELL_CLASS,
  GuestMessagesHub,
} from '@/features/guest/account/components/GuestMessagesHub';
import { useGuestMessages } from '@/features/guest/account/hooks/useGuestMessages';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';

function GuestMessagesHubSkeleton() {
  return (
    <div className={GUEST_MESSAGES_HUB_SHELL_CLASS} aria-hidden>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="border-border flex h-full min-h-0 w-full shrink-0 flex-col border-r lg:w-[min(100%,320px)]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-3 py-3">
                <div className="bg-muted mt-0.5 size-11 shrink-0 animate-pulse rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="bg-muted h-3 w-24 animate-pulse rounded-full" />
                    <div className="bg-muted h-2.5 w-8 animate-pulse rounded-full" />
                  </div>
                  <div className="bg-muted h-2.5 w-16 animate-pulse rounded-full" />
                  <div className="bg-muted h-2.5 w-full animate-pulse rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden h-full min-h-0 flex-1 flex-col overflow-hidden lg:flex">
          <div className="border-border shrink-0 border-b px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="bg-muted size-10 shrink-0 animate-pulse rounded-lg" />
              <div className="space-y-1.5">
                <div className="bg-muted h-3 w-32 animate-pulse rounded-full" />
                <div className="bg-muted h-2.5 w-24 animate-pulse rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-hidden p-4">
            <div className="bg-muted h-12 w-2/3 animate-pulse rounded-2xl" />
            <div className="bg-muted ml-auto h-10 w-1/2 animate-pulse rounded-2xl" />
            <div className="bg-muted h-14 w-3/4 animate-pulse rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function GuestMessagesPage() {
  usePageTitle(publicPageTitle('Stays'));
  const { data, isLoading, isError } = useGuestMessages();
  const threads = data?.threads ?? [];

  if (isLoading) {
    return <GuestMessagesHubSkeleton />;
  }

  if (isError) {
    return <p className="text-destructive text-sm">Could not load messages.</p>;
  }

  if (threads.length === 0) {
    return (
      <GuestAccountEmptyState
        message="No messages yet."
        actionLabel="Browse properties"
        actionHref="/properties"
      />
    );
  }

  return <GuestMessagesHub threads={threads} />;
}
