import { useEffect, useState } from 'react';

import { useParams, useSearchParams } from 'react-router-dom';

import { fetchGuestBookingDocument } from '@/features/guest/booking-documents/lib/api';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const NOT_AVAILABLE_MESSAGE = 'This link is not available.';

function isDocKind(value: string): value is 'gaf' | 'pet' {
  return value === 'gaf' || value === 'pet';
}

function BookingDocumentUnavailable({ message }: { message: string }) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div
        className={cn(
          'border-border bg-muted max-w-md rounded-2xl border p-8 text-center shadow-sm'
        )}
      >
        <p className="text-foreground text-base font-medium">{message}</p>
      </div>
    </div>
  );
}

/** Fetches a token-gated approved-document URL and redirects to it — no rendered content of its own. */
export function GuestBookingDocumentPage() {
  const { propertySlug = '' } = useParams<{ propertySlug: string }>();
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') ?? '').trim();
  const docParam = (searchParams.get('doc') ?? '').trim();
  const doc = isDocKind(docParam) ? docParam : null;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!propertySlug || !token || !doc) return;
    let cancelled = false;
    void fetchGuestBookingDocument(propertySlug, token, doc)
      .then((data) => {
        if (!cancelled) window.location.replace(data.url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [propertySlug, token, doc]);

  if (!token || !doc || failed) {
    return <BookingDocumentUnavailable message={NOT_AVAILABLE_MESSAGE} />;
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <Skeleton className="h-24 w-full max-w-sm rounded-2xl" />
    </div>
  );
}
