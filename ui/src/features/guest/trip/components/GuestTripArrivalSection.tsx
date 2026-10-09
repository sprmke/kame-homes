import { useState } from 'react';

import {
  Ban,
  BookOpen,
  Car,
  Check,
  ChevronRight,
  FileText,
  Info,
  MapPin,
  Navigation,
} from 'lucide-react';

import { guestParkingRequestStatusPath } from '@/features/guest/lib/guestPublicPaths';
import type { PublicHouseRule } from '@/features/guest/marketing/properties/types/publicProperty';
import {
  GuestTripLinkRow,
  GuestTripSection,
} from '@/features/guest/trip/components/GuestTripSection';
import { GuestTripSmartLink } from '@/features/guest/trip/components/GuestTripSmartLink';
import type { GuestTrip, GuestTripDocument } from '@/features/guest/trip/lib/guestTripApi';
import {
  guestTripParkingStatusLabel,
  isGuestTripTimeRule,
} from '@/features/guest/trip/lib/guestTripPhase';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const RULES_COLLAPSED = 4;

const ROW_LINK =
  'hover:bg-muted/60 focus-visible:ring-ring -mx-2 block rounded-xl px-2 transition-colors focus-visible:outline-none focus-visible:ring-2';

function TimeTile({ label, date, time }: { label: string; date: string; time: string | null }) {
  return (
    <div className="bg-muted/50 rounded-2xl p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{date}</p>
      {time ? <p className="text-foreground/80 text-sm tabular-nums">{time}</p> : null}
    </div>
  );
}

/** GAF is a building-admin acronym; name it for guests and keep the acronym for recognition. */
function documentLabel(doc: GuestTripDocument): string {
  if (doc.kind === 'gaf') return 'Guest access form (GAF)';
  if (doc.kind === 'pet') return 'Pet approval';
  if (doc.kind === 'parking') return 'Parking endorsement';
  return doc.label.replace(/^approved\s+/i, '');
}

function DocumentRow({ doc }: { doc: GuestTripDocument }) {
  const ready = doc.status === 'ready';
  const row = (
    <GuestTripLinkRow
      icon={<FileText className="size-4" aria-hidden />}
      title={documentLabel(doc)}
      detail={ready ? 'Approved' : 'Waiting for approval'}
      trailing={
        ready && doc.href ? (
          <span className="text-foreground flex items-center gap-1 text-sm font-semibold">
            Open
            <ChevronRight className="size-4" aria-hidden />
          </span>
        ) : ready ? (
          <Check className="size-4" aria-label="Approved" />
        ) : null
      }
    />
  );
  return (
    <li>
      {ready && doc.href ? (
        <GuestTripSmartLink
          to={doc.href}
          className={ROW_LINK}
          aria-label={`Open ${documentLabel(doc)}`}
        >
          {row}
        </GuestTripSmartLink>
      ) : (
        row
      )}
    </li>
  );
}

function HouseRules({ rules }: { rules: PublicHouseRule[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rules : rules.slice(0, RULES_COLLAPSED);
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">House rules</h3>
      <ul className="space-y-2">
        {shown.map((rule) => {
          const Icon = rule.type === 'prohibited' ? Ban : rule.type === 'allowed' ? Check : Info;
          return (
            <li key={rule.id} className="flex items-start gap-2.5 text-sm">
              <Icon
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  rule.type === 'prohibited' ? 'text-destructive' : 'text-muted-foreground'
                )}
                aria-hidden
              />
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {rule.type === 'prohibited' ? <span className="sr-only">Not allowed: </span> : null}
                {rule.text}
              </span>
            </li>
          );
        })}
      </ul>
      {rules.length > RULES_COLLAPSED ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="text-foreground mt-1 inline-flex min-h-[44px] items-center text-sm font-semibold underline underline-offset-4"
        >
          {expanded ? 'Show fewer' : `All ${rules.length} rules`}
        </button>
      ) : null}
    </div>
  );
}

/** Everything about getting there and staying: where, when, guide, documents, parking, rules. */
export function GuestTripArrivalSection({
  trip,
  address,
  directionsUrl,
  checkInDateLabel,
  checkOutDateLabel,
  checkInTimeLabel,
  checkOutTimeLabel,
  documents,
  houseRules,
  showRules,
  title = 'Getting there',
}: {
  trip: GuestTrip;
  address: string;
  directionsUrl: string | null;
  checkInDateLabel: string;
  checkOutDateLabel: string;
  checkInTimeLabel: string | null;
  checkOutTimeLabel: string | null;
  documents: GuestTripDocument[];
  houseRules: PublicHouseRule[];
  showRules: boolean;
  title?: string;
}) {
  const rules = houseRules.filter((rule) => rule.text.trim() && !isGuestTripTimeRule(rule.text));
  const showParking =
    trip.parking.requested && (trip.parking.linkedBookingId || trip.parking.findPath);

  return (
    <GuestTripSection id="trip-arrival" title={title}>
      <div className="space-y-5">
        {address ? (
          <div className="flex items-start gap-3">
            <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1 text-sm">{address}</p>
            {directionsUrl ? (
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                  <Navigation aria-hidden />
                  Directions
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <TimeTile
            label="Check-in"
            date={checkInDateLabel}
            time={checkInTimeLabel ? `From ${checkInTimeLabel}` : null}
          />
          <TimeTile
            label="Check-out"
            date={checkOutDateLabel}
            time={checkOutTimeLabel ? `By ${checkOutTimeLabel}` : null}
          />
        </div>

        {trip.stayGuidePath || documents.length > 0 || showParking ? (
          <ul className="divide-border/70 divide-y" id="trip-documents">
            {trip.stayGuidePath ? (
              <li>
                <GuestTripSmartLink to={trip.stayGuidePath} className={ROW_LINK}>
                  <GuestTripLinkRow
                    icon={<BookOpen className="size-4" aria-hidden />}
                    title="Stay guide"
                    detail="Check-in steps, Wi-Fi, and house info"
                    trailing={<ChevronRight className="text-muted-foreground size-4" aria-hidden />}
                  />
                </GuestTripSmartLink>
              </li>
            ) : null}
            {documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
            {showParking ? (
              <li>
                <GuestTripSmartLink
                  to={
                    trip.parking.linkedBookingId
                      ? guestParkingRequestStatusPath(trip.parking.linkedBookingId)
                      : (trip.parking.findPath ?? '/parkings')
                  }
                  className={ROW_LINK}
                >
                  <GuestTripLinkRow
                    icon={<Car className="size-4" aria-hidden />}
                    title="Parking"
                    detail={
                      trip.parking.linkedBookingId
                        ? [
                            guestTripParkingStatusLabel(trip.parking.linkedStatus),
                            trip.parking.carPlate,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : 'Not reserved yet. Find a slot near your stay.'
                    }
                    trailing={<ChevronRight className="text-muted-foreground size-4" aria-hidden />}
                  />
                </GuestTripSmartLink>
              </li>
            ) : null}
          </ul>
        ) : null}

        {showRules && rules.length > 0 ? <HouseRules rules={rules} /> : null}
      </div>
    </GuestTripSection>
  );
}
