import { Link } from 'react-router-dom';

import { Mail, MessageCircle, Phone } from 'lucide-react';

import { GuestTripSection } from '@/features/guest/trip/components/GuestTripSection';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const ICON_BUTTON =
  'bg-muted/70 hover:bg-muted text-foreground focus-visible:ring-ring flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2';

/** One row: who the host is and the three ways to reach them. */
export function GuestTripHostRow({
  name,
  organizationName,
  avatarUrl,
  messagePath,
  phone,
  email,
}: {
  name: string;
  organizationName: string | null;
  avatarUrl: string | null;
  messagePath: string;
  phone: string;
  email: string;
}) {
  return (
    <GuestTripSection id="trip-host" title="Your host">
      <div className="flex items-center gap-3">
        <Avatar className="size-11 shrink-0">
          <AvatarImage src={avatarUrl ?? undefined} alt="" className="object-cover" />
          <AvatarFallback className="bg-muted text-foreground text-sm font-semibold">
            {name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          {organizationName && organizationName !== name ? (
            <p className="text-muted-foreground truncate text-xs">{organizationName}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Link to={messagePath} className={ICON_BUTTON} aria-label={`Message ${name}`}>
            <MessageCircle className="size-[18px]" aria-hidden />
          </Link>
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s+/g, '')}`}
              className={ICON_BUTTON}
              aria-label={`Call ${name}`}
            >
              <Phone className="size-[18px]" aria-hidden />
            </a>
          ) : null}
          {email ? (
            <a href={`mailto:${email}`} className={ICON_BUTTON} aria-label={`Email ${name}`}>
              <Mail className="size-[18px]" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </GuestTripSection>
  );
}
