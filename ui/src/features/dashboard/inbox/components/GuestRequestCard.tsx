import { useState } from 'react';

import { CalendarPlus, CheckCircle2, Clock, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { GuestRequestDto } from '@/features/dashboard/inbox/types/inbox';

type Props = {
  request: GuestRequestDto;
  onResolve: (requestId: string, status: 'approved' | 'declined') => Promise<void>;
  resolving: boolean;
};

function summaryFor(request: GuestRequestDto): string {
  const p = request.payload;
  if (request.kind === 'booking_inquiry') {
    const checkIn = String(p.checkIn ?? '');
    const checkOut = String(p.checkOut ?? '');
    const guestCount = Number(p.guestCount ?? 0);
    return `Booking inquiry: ${checkIn} to ${checkOut}, ${guestCount} guest${guestCount === 1 ? '' : 's'}`;
  }
  const requestType = p.requestType === 'early_checkin' ? 'Early check-in' : 'Late check-out';
  return `${requestType} requested: ${String(p.requestedTime ?? '')}`;
}

export function GuestRequestCard({ request, onResolve, resolving }: Props) {
  const [busy, setBusy] = useState<'approved' | 'declined' | null>(null);
  const notes = typeof request.payload.notes === 'string' ? request.payload.notes.trim() : '';
  const likelyUnavailable =
    request.kind === 'booking_inquiry' && request.payload.likelyAvailable === false;

  const handle = async (status: 'approved' | 'declined') => {
    setBusy(status);
    await onResolve(request.id, status);
    setBusy(null);
  };

  return (
    <div className="border-border/60 bg-card mx-auto max-w-[min(100%,28rem)] space-y-2 rounded-xl border p-3">
      <div className="flex items-start gap-2">
        {request.status === 'approved' ? (
          <CheckCircle2 className="text-success mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        ) : request.status === 'declined' ? (
          <XCircle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <CalendarPlus className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{summaryFor(request)}</p>
          {notes ? <p className="text-muted-foreground text-xs">{notes}</p> : null}
          {likelyUnavailable ? (
            <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              Those dates may already be booked.
            </p>
          ) : null}
        </div>
      </div>
      {request.status === 'pending' ? (
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            className="h-10 min-h-[44px] flex-1"
            disabled={resolving}
            onClick={() => void handle('approved')}
          >
            {busy === 'approved' ? 'Approving…' : 'Approve'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 min-h-[44px] flex-1"
            disabled={resolving}
            onClick={() => void handle('declined')}
          >
            {busy === 'declined' ? 'Declining…' : 'Decline'}
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          {request.status === 'approved' ? 'Approved' : 'Declined'}
        </p>
      )}
    </div>
  );
}
