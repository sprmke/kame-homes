import {
  BookOpen,
  CalendarDays,
  Car,
  ClipboardList,
  ExternalLink,
  FileText,
  Home,
  Link2,
  Luggage,
  MessageSquare,
  Sparkles,
  Star,
  Wallet,
} from 'lucide-react';

import type { ChatUrlLinkResourceKind } from '@/lib/chat/parseChatRichBlocks';
import { cn } from '@/lib/utils';

type Props = {
  href: string;
  title: string;
  subtitle?: string;
  variant?: 'calendar' | 'generic';
  resourceKind?: ChatUrlLinkResourceKind;
  outbound?: boolean;
  className?: string;
  /** When set, renders as a button that calls this instead of navigating to `href`. */
  onActivate?: () => void;
};

function resourceIcon(kind: ChatUrlLinkResourceKind) {
  switch (kind) {
    case 'calendar':
      return CalendarDays;
    case 'stayGuide':
      return BookOpen;
    case 'trip':
      return Luggage;
    case 'document':
      return FileText;
    case 'form':
      return ClipboardList;
    case 'messages':
      return MessageSquare;
    case 'showcase':
      return Sparkles;
    case 'property':
      return Home;
    case 'parking':
      return Car;
    case 'review':
      return Star;
    case 'sdForm':
      return Wallet;
    default:
      return Link2;
  }
}

/**
 * Compact tap target for https links in chat (Airbnb-style action chip — not a raw URL wrap).
 */
export function ChatUrlLinkCard({
  href,
  title,
  subtitle = 'Open link',
  variant = 'generic',
  resourceKind,
  outbound = false,
  className,
  onActivate,
}: Props) {
  const Icon = resourceIcon(resourceKind ?? (variant === 'calendar' ? 'calendar' : 'generic'));

  const cardClass = cn(
    'my-1.5 flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left no-underline transition-opacity hover:opacity-95',
    'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
    outbound
      ? 'border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground'
      : 'border-border/70 bg-muted/50 text-foreground',
    className
  );

  const content = (
    <>
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          outbound ? 'bg-primary-foreground/15' : 'bg-muted'
        )}
      >
        <Icon className="size-4 opacity-80" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-snug">{title}</span>
        <span
          className={cn(
            'block truncate text-[11px] leading-snug',
            outbound ? 'text-primary-foreground/75' : 'text-muted-foreground'
          )}
        >
          {subtitle}
        </span>
      </span>
      <ExternalLink className="size-4 shrink-0 opacity-70" aria-hidden />
    </>
  );

  if (onActivate) {
    return (
      <button type="button" onClick={onActivate} className={cardClass}>
        {content}
      </button>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cardClass}>
      {content}
    </a>
  );
}
