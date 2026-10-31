import { useMemo } from 'react';

import { buildGuestChatResourceHubItems } from '@/features/guest/chat/lib/guestChatResourceHubItems';

import { ChatUrlLinkCard } from '@/components/chat/ChatUrlLinkCard';
import { cn } from '@/lib/utils';

type Props = {
  propertySlug: string;
  stayGuideUrl?: string | null;
  tripPath?: string | null;
  className?: string;
  onCalendarLinkClick?: (href: string) => void;
};

/** Horizontal self-serve resource strip for ongoing guest threads. */
export function GuestChatResourceHub({
  propertySlug,
  stayGuideUrl,
  tripPath,
  className,
  onCalendarLinkClick,
}: Props) {
  const items = useMemo(
    () => buildGuestChatResourceHubItems(propertySlug, { stayGuideUrl, tripPath }),
    [propertySlug, stayGuideUrl, tripPath]
  );

  if (items.length === 0) return null;

  return (
    <div
      className={cn('border-border/60 shrink-0 border-t px-3 py-2', className)}
      role="region"
      aria-label="Helpful links"
    >
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <div key={item.id} className="w-[min(14rem,calc(100vw-3rem))] shrink-0">
            <ChatUrlLinkCard
              href={item.href}
              title={item.title}
              subtitle={item.subtitle}
              variant={item.resourceKind === 'calendar' ? 'calendar' : 'generic'}
              resourceKind={item.resourceKind}
              onActivate={
                item.resourceKind === 'calendar' && onCalendarLinkClick
                  ? () => onCalendarLinkClick(item.href)
                  : undefined
              }
              className="my-0"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
