import type { SearchListingsMeta, SearchListingsType } from '@/features/guest/search/types/search';

type CategoryId = Exclude<SearchListingsType, 'all'>;

type Props = {
  focus: CategoryId | null;
  type: SearchListingsType;
  meta?: SearchListingsMeta | null;
  onClearFocus?: () => void;
};

const FOCUS_LABEL: Record<CategoryId, string> = {
  properties: 'Properties',
  developments: 'Developments',
  parkings: 'Parkings',
};

function intentStatus(meta: SearchListingsMeta | null | undefined): string | null {
  if (!meta) return null;
  if (meta.intent === 'nearby') return meta.intentLabel || 'Near you';
  if (meta.usedSmartFallback && meta.intentLabel) {
    return `Related to ${meta.intentLabel}`;
  }
  if (meta.intent === 'concept' && meta.intentLabel) {
    return meta.intentLabel;
  }
  return null;
}

/**
 * Surfaces page-aware focus + smart intent so guests see why results are ordered/expanded.
 * Minimal copy — only when there is something non-obvious to say.
 */
export function SearchStatusBanner({ focus, type, meta, onClearFocus }: Props) {
  const parts: string[] = [];
  const showFocus = Boolean(focus) && (type === 'all' || type === focus);
  if (showFocus && focus) {
    parts.push(
      type === 'all' ? `${FOCUS_LABEL[focus]} shown first` : `Focused on ${FOCUS_LABEL[focus]}`
    );
  }
  const intent = intentStatus(meta);
  if (intent) parts.push(intent);

  if (parts.length === 0) return null;

  return (
    <div
      className="border-border bg-muted/40 mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5"
      role="status"
      aria-live="polite"
    >
      <p className="text-muted-foreground min-w-0 flex-1 text-sm">{parts.join(' · ')}</p>
      {showFocus && focus && onClearFocus ? (
        <button
          type="button"
          onClick={onClearFocus}
          className="text-foreground hover:text-primary min-h-[44px] shrink-0 cursor-pointer text-sm font-medium underline-offset-4 hover:underline"
        >
          Show all equally
        </button>
      ) : null}
    </div>
  );
}
