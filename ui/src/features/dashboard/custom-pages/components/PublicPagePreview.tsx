import type { ReactNode } from 'react';

import { BookOpen, ChevronLeft, Home } from 'lucide-react';

import type { PropertyGuestPublicPage } from '@/features/dashboard/property/lib/propertyGuestPublicPages';

import { cn } from '@/lib/utils';

type Props = {
  pageId: PropertyGuestPublicPage['id'];
  propertyName: string;
  coverUrl: string | null;
};

/** Static fallback when live iframe preview is unavailable. */
export function PublicPagePreview({ pageId, propertyName, coverUrl }: Props) {
  switch (pageId) {
    case 'listing':
      return <ListingPreview propertyName={propertyName} coverUrl={coverUrl} />;
    case 'calendar':
      return <CalendarPreview propertyName={propertyName} />;
    case 'form':
      return <FormPreview propertyName={propertyName} />;
    case 'messages':
      return <MessagesPreview propertyName={propertyName} />;
    case 'sd-form':
      return <SdFormPreview propertyName={propertyName} />;
    case 'guest-review':
      return <GuestReviewPreview propertyName={propertyName} />;
    case 'pay-parking':
      return <PayParkingPreview propertyName={propertyName} />;
    case 'stay-guide':
      return <StayGuidePreview propertyName={propertyName} coverUrl={coverUrl} />;
    default:
      return null;
  }
}

function PreviewChrome({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-background flex size-full flex-col text-[10px]', className)}>
      <div className="border-border/60 flex h-7 shrink-0 items-center gap-1 border-b px-2">
        <ChevronLeft className="text-muted-foreground size-3" aria-hidden />
        <span className="text-foreground truncate font-semibold">{title}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function ListingPreview({
  propertyName,
  coverUrl,
}: {
  propertyName: string;
  coverUrl: string | null;
}) {
  return (
    <div className="bg-background flex size-full flex-col">
      <div className="relative h-[42%] shrink-0 overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="from-primary/20 to-muted flex size-full items-center justify-center bg-gradient-to-br">
            <Home className="text-primary/40 size-8" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <span className="text-foreground truncate text-[11px] font-bold">{propertyName}</span>
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="bg-muted h-1.5 flex-1 rounded-sm" />
          ))}
        </div>
        <div className="border-border mt-auto rounded-lg border p-2 shadow-sm">
          <span className="bg-primary block h-2 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

function CalendarPreview({ propertyName }: { propertyName: string }) {
  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const booked = new Set([5, 6, 12, 13, 19, 20]);

  return (
    <PreviewChrome title="Check Availability">
      <div className="flex flex-col gap-2 p-2.5">
        <span className="text-muted-foreground truncate text-[9px]">{propertyName}</span>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {weekdays.map((d, i) => (
            <span key={`${d}-${i}`} className="text-muted-foreground text-[8px] font-medium">
              {d}
            </span>
          ))}
          {Array.from({ length: 35 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'aspect-square rounded-[3px] text-[8px] leading-none',
                booked.has(i) ? 'bg-primary-strong text-primary-foreground' : 'bg-muted/80'
              )}
            />
          ))}
        </div>
        <span className="bg-primary mt-1 block h-2.5 w-full rounded-md" />
      </div>
    </PreviewChrome>
  );
}

function FormPreview({ propertyName }: { propertyName: string }) {
  const steps = ['Stay', 'Guest', 'Parking', 'Payment', 'Review'];

  return (
    <PreviewChrome title="Booking Form">
      <div className="flex flex-col gap-2 p-2.5">
        <span className="text-muted-foreground truncate text-[9px]">{propertyName}</span>
        <div className="flex gap-1">
          {steps.map((step, i) => (
            <span
              key={step}
              className={cn('h-1 flex-1 rounded-full', i === 0 ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>
        <span className="bg-muted h-2 w-3/4 rounded-sm" />
        <span className="bg-muted h-6 w-full rounded-md" />
        <span className="bg-muted h-6 w-full rounded-md" />
        <span className="bg-primary mt-auto h-2.5 w-full rounded-md" />
      </div>
    </PreviewChrome>
  );
}

function MessagesPreview({ propertyName }: { propertyName: string }) {
  return (
    <PreviewChrome title="Messages">
      <div className="flex h-full flex-col">
        <div className="border-border/60 flex items-center gap-2 border-b px-2 py-1.5">
          <span className="bg-primary/15 text-primary flex size-5 items-center justify-center rounded-full text-[8px] font-bold">
            H
          </span>
          <span className="truncate font-medium">{propertyName}</span>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-1.5 p-2">
          <span className="bg-muted text-muted-foreground max-w-[72%] self-start rounded-2xl rounded-bl-sm px-2 py-1.5 text-[9px] leading-snug">
            Hi, is this available?
          </span>
          <span className="bg-primary-strong text-primary-foreground max-w-[68%] self-end rounded-2xl rounded-br-sm px-2 py-1.5 text-[9px] leading-snug">
            Yes — send dates and we&apos;ll confirm.
          </span>
        </div>
        <div className="border-border/60 border-t p-1.5">
          <span className="bg-muted block h-4 w-full rounded-full" />
        </div>
      </div>
    </PreviewChrome>
  );
}

function SdFormPreview({ propertyName }: { propertyName: string }) {
  const steps = ['Review', 'Surprise', 'Refund'];

  return (
    <PreviewChrome title="SD Refund Form">
      <div className="flex flex-col gap-2 p-2.5">
        <span className="text-muted-foreground truncate text-[9px]">{propertyName}</span>
        <div className="flex gap-1">
          {steps.map((step, i) => (
            <span
              key={step}
              className={cn('h-1 flex-1 rounded-full', i === 0 ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>
        <div className="flex justify-center gap-0.5 py-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="bg-primary/25 size-2 rounded-full" />
          ))}
        </div>
        <span className="bg-muted h-10 w-full rounded-md" />
      </div>
    </PreviewChrome>
  );
}

function GuestReviewPreview({ propertyName }: { propertyName: string }) {
  return (
    <PreviewChrome title="Guest Review">
      <div className="flex flex-col gap-2 p-2.5">
        <span className="text-muted-foreground truncate text-[9px]">{propertyName}</span>
        <div className="flex justify-center gap-0.5 py-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="bg-primary/25 size-2.5 rounded-full" />
          ))}
        </div>
        <span className="bg-muted h-12 w-full rounded-md" />
      </div>
    </PreviewChrome>
  );
}

function PayParkingPreview({ propertyName }: { propertyName: string }) {
  return (
    <PreviewChrome title="Pay Parking Form">
      <div className="flex flex-col gap-2 p-2.5">
        <span className="text-muted-foreground truncate text-[9px]">{propertyName}</span>
        <span className="bg-muted h-5 w-full rounded-md" />
        <span className="bg-muted h-5 w-full rounded-md" />
        <span className="bg-muted h-5 w-full rounded-md" />
        <span className="bg-primary mt-1 block h-2.5 w-full rounded-md" />
      </div>
    </PreviewChrome>
  );
}

function StayGuidePreview({
  propertyName,
  coverUrl,
}: {
  propertyName: string;
  coverUrl: string | null;
}) {
  return (
    <div className="flex size-full flex-col bg-[hsl(32_28%_96%)] dark:bg-[hsl(32_12%_14%)]">
      <div className="relative h-[38%] shrink-0 overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="from-primary/25 to-muted flex size-full items-center justify-center bg-gradient-to-br">
            <BookOpen className="text-primary/40 size-8" aria-hidden />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
        <span className="absolute bottom-2 left-2 text-[10px] font-semibold text-white">
          Stay guide
        </span>
      </div>
      <div className="dark:bg-card relative z-[1] mx-2 -mt-3 rounded-lg border border-black/5 bg-white p-2 shadow-sm dark:border-white/10">
        <span className="text-foreground block truncate text-[10px] font-semibold">
          {propertyName}
        </span>
        <div className="mt-1 flex justify-between gap-2 text-[8px]">
          <span className="text-muted-foreground">Check-in</span>
          <span className="text-muted-foreground">Check-out</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3 pt-2">
        <span className="text-muted-foreground text-[8px] font-medium uppercase tracking-wide">
          Getting in
        </span>
        <span className="bg-foreground/10 h-1 w-full rounded-full" />
        <span className="bg-foreground/10 h-1 w-[85%] rounded-full" />
      </div>
    </div>
  );
}
