import { CalendarX2 } from 'lucide-react';

/** Shown instead of the booking form when the listing is not taking new bookings. */
export function GuestBookingsClosedNotice({
  propertyName,
  organizationName,
}: {
  propertyName?: string | null;
  organizationName?: string | null;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="bg-muted text-muted-foreground mb-4 flex size-14 items-center justify-center rounded-full">
        <CalendarX2 className="size-7" aria-hidden />
      </div>
      <h2 className="text-lg font-bold sm:text-xl">Not taking new bookings</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        {propertyName?.trim()
          ? `${propertyName.trim()} isn't taking new bookings right now.`
          : "This place isn't taking new bookings right now."}
      </p>
      {organizationName?.trim() ? (
        <p className="text-muted-foreground mt-1 text-xs">
          Contact {organizationName.trim()} if you need to book.
        </p>
      ) : null}
    </div>
  );
}
