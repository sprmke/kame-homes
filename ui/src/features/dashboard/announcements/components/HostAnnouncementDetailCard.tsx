import { ArrowUpRight } from 'lucide-react';

import { StayGuideRichContent } from '@/features/guest/stay-guide/components/StayGuideRichContent';

import { HostAnnouncementStatusCard } from '@/features/dashboard/announcements/components/HostAnnouncementStatusCard';
import { HOST_ANNOUNCEMENT_SEVERITY_MARKER_CLASS } from '@/features/dashboard/announcements/lib/hostAnnouncementSeverity';
import type { HostAnnouncement } from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type HostAnnouncementDetailCardProps = {
  announcement: HostAnnouncement;
};

export function HostAnnouncementDetailCard({ announcement }: HostAnnouncementDetailCardProps) {
  const linkLabel = announcement.linkLabel?.trim() || 'Open link';

  return (
    <article className="surface-card overflow-hidden">
      <div className="border-border/50 border-b px-4 py-3 sm:px-5 sm:py-3.5">
        <HostAnnouncementStatusCard
          announcement={announcement}
          className="bg-transparent px-0 py-0"
        />
      </div>

      <div className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5">
        <span
          className={cn(
            'w-0.5 shrink-0 self-stretch rounded-full',
            HOST_ANNOUNCEMENT_SEVERITY_MARKER_CLASS[announcement.severity]
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-4">
          <h2 className="text-foreground text-sm font-semibold leading-snug tracking-tight sm:text-[15px]">
            {announcement.title}
          </h2>
          <StayGuideRichContent
            html={announcement.body}
            className="text-sm leading-relaxed sm:text-[15px] sm:leading-7"
          />
          {announcement.linkUrl ? (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <a href={announcement.linkUrl} target="_blank" rel="noreferrer">
                {linkLabel}
                <ArrowUpRight className="size-4" aria-hidden />
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
