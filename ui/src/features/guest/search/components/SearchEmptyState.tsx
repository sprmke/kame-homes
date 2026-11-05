import { MapPin, Search } from 'lucide-react';

type Props = {
  where: string;
  onClearDates?: () => void;
  onClearWhere?: () => void;
  onSearchNearby?: () => void;
  /** Nearby without browser coords — prompt for permission. */
  needsLocation?: boolean;
  onRequestLocation?: () => void;
  locationRequesting?: boolean;
  /** Soft concept expansion note when literal + expanded both empty. */
  smartFallbackLabel?: string | null;
};

export function SearchEmptyState({
  where,
  onClearDates,
  onClearWhere,
  onSearchNearby,
  needsLocation = false,
  onRequestLocation,
  locationRequesting = false,
  smartFallbackLabel,
}: Props) {
  if (needsLocation) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20 text-center sm:py-24">
        <span className="bg-muted text-muted-foreground mb-5 flex size-14 items-center justify-center rounded-2xl">
          <MapPin className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="text-foreground text-base font-semibold sm:text-lg">Location needed</h2>
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
          Allow location to see stays and parking near you.
        </p>
        {onRequestLocation ? (
          <button
            type="button"
            onClick={onRequestLocation}
            disabled={locationRequesting}
            className="bg-primary-strong text-primary-foreground hover:bg-primary-strong/90 mt-5 min-h-[44px] cursor-pointer rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {locationRequesting ? 'Checking…' : 'Use my location'}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center sm:py-24">
      <span className="bg-muted text-muted-foreground mb-5 flex size-14 items-center justify-center rounded-2xl">
        <Search className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="text-foreground text-base font-semibold sm:text-lg">No matches</h2>
      {where ? (
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
          Nothing available for “{where}”. Try another place or dates.
        </p>
      ) : (
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
          Try a city, development, or different dates.
        </p>
      )}
      {smartFallbackLabel ? (
        <p className="text-muted-foreground mt-2 max-w-md text-xs">
          Also checked related matches for {smartFallbackLabel}.
        </p>
      ) : null}
      <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        {onSearchNearby ? (
          <button
            type="button"
            onClick={onSearchNearby}
            className="bg-primary-strong text-primary-foreground hover:bg-primary-strong/90 min-h-[44px] cursor-pointer rounded-full px-5 text-sm font-semibold"
          >
            Search nearby
          </button>
        ) : null}
        {onClearWhere && where ? (
          <button
            type="button"
            onClick={onClearWhere}
            className="text-foreground hover:text-primary min-h-[44px] cursor-pointer px-3 text-sm font-medium underline-offset-4 hover:underline"
          >
            Clear place
          </button>
        ) : null}
        {onClearDates ? (
          <button
            type="button"
            onClick={onClearDates}
            className="text-foreground hover:text-primary min-h-[44px] cursor-pointer px-3 text-sm font-medium underline-offset-4 hover:underline"
          >
            Clear dates
          </button>
        ) : null}
      </div>
    </div>
  );
}
