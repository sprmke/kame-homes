import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Check, ChevronDown, X } from 'lucide-react';

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (value: string) => void;
  suggestions: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
};

export function CategoryCombobox({
  value,
  onChange,
  suggestions,
  placeholder = 'Select or type',
  disabled = false,
  id,
}: Props) {
  const listboxId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [panelWidth, setPanelWidth] = useState<number | undefined>();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const syncWidth = () => {
      setPanelWidth(anchorRef.current?.offsetWidth);
    };
    syncWidth();
    window.addEventListener('resize', syncWidth);
    return () => window.removeEventListener('resize', syncWidth);
  }, [open]);

  const trimmedDraft = draft.trim();
  const normalizedValue = value.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!trimmedDraft) return [...suggestions];
    const needle = trimmedDraft.toLowerCase();
    return suggestions.filter((item) => item.toLowerCase().includes(needle));
  }, [suggestions, trimmedDraft]);

  const hasExactSuggestion = suggestions.some(
    (item) => item.toLowerCase() === trimmedDraft.toLowerCase()
  );

  const showCustomOption = trimmedDraft.length > 0 && !hasExactSuggestion;

  function commit(next: string) {
    onChange(next);
    setDraft(next);
    setOpen(false);
  }

  function clearValue() {
    onChange('');
    setDraft('');
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative w-full">
          <input
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            disabled={disabled}
            value={draft}
            placeholder={placeholder}
            className={cn(
              'border-input bg-card text-foreground field-focus h-10 min-h-[44px] w-full rounded-lg border py-2 pl-3 pr-[5.5rem] text-sm transition-colors',
              'placeholder:text-muted-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
            onChange={(e) => {
              setDraft(e.target.value);
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                setDraft(value);
              }
            }}
          />
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            {value ? (
              <button
                type="button"
                className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors"
                aria-label="Clear category"
                disabled={disabled}
                onClick={clearValue}
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors"
              aria-label={open ? 'Close categories' : 'Open categories'}
              disabled={disabled}
              onClick={() => setOpen((current) => !current)}
            >
              <ChevronDown
                className={cn('size-4 transition-transform duration-150', open && 'rotate-180')}
                aria-hidden
              />
            </button>
          </div>
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="overflow-hidden p-0"
        style={
          panelWidth
            ? { width: panelWidth, maxHeight: 'min(60vh, 16rem)' }
            : { maxHeight: 'min(60vh, 16rem)' }
        }
        onOpenAutoFocus={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div
          className="max-h-[min(60vh,16rem)] touch-pan-y overflow-y-auto overscroll-contain p-1 [-webkit-overflow-scrolling:touch]"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <ul id={listboxId} role="listbox" className="space-y-0.5">
            {filtered.map((item) => {
              const selected = normalizedValue === item.toLowerCase();
              return (
                <li key={item} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    className={cn(
                      'flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors',
                      selected ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/60'
                    )}
                    onClick={() => commit(item)}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      {selected ? <Check className="text-primary size-4" aria-hidden /> : null}
                    </span>
                    <span className="min-w-0 truncate">{item}</span>
                  </button>
                </li>
              );
            })}

            {showCustomOption ? (
              <li role="option" aria-selected={false}>
                <button
                  type="button"
                  className="text-foreground hover:bg-muted/60 flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors"
                  onClick={() => commit(trimmedDraft)}
                >
                  <span className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">Use &ldquo;{trimmedDraft}&rdquo;</span>
                </button>
              </li>
            ) : null}

            {filtered.length === 0 && !showCustomOption ? (
              <li className="text-muted-foreground px-3 py-2.5 text-sm">No matching categories</li>
            ) : null}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
