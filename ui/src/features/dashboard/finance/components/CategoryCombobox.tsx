import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Check, ChevronDown, Plus, X } from 'lucide-react';

import {
  filterCategorySuggestions,
  normalizeCategoryValue,
  resolveCategoryValue,
  shouldOfferCustomCategory,
} from '@/components/forms/categoryComboboxModel';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (value: string) => void;
  suggestions: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  maxLength?: number;
  ariaLabel?: string;
};

export function CategoryCombobox({
  value,
  onChange,
  suggestions,
  placeholder = 'Select or type',
  disabled = false,
  id,
  maxLength = 80,
  ariaLabel = 'Category',
}: Props) {
  const listboxId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const valueAtOpenRef = useRef(value);
  const skipCloseCommitRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [activeIndex, setActiveIndex] = useState(-1);
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

  useEffect(() => {
    setActiveIndex(-1);
  }, [draft]);

  const trimmedDraft = normalizeCategoryValue(draft);
  const normalizedValue = value.trim().toLowerCase();

  const filtered = useMemo(
    () => filterCategorySuggestions(suggestions, trimmedDraft),
    [suggestions, trimmedDraft]
  );

  const showCustomOption = shouldOfferCustomCategory(suggestions, trimmedDraft);
  const customOptionId = `${listboxId}-option-custom`;
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const optionCount = filtered.length + (showCustomOption ? 1 : 0);
  const activeOptionId =
    activeIndex < 0 || activeIndex >= optionCount
      ? undefined
      : activeIndex < filtered.length
        ? optionId(activeIndex)
        : customOptionId;

  useEffect(() => {
    if (!open || !activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
  }, [activeOptionId, open]);

  function commit(next: string) {
    const normalized = resolveCategoryValue(suggestions, next);
    onChange(normalized);
    setDraft(normalized);
    setActiveIndex(-1);
    setOpen(false);
  }

  function commitDraft() {
    if (!trimmedDraft) return;
    commit(trimmedDraft);
  }

  /** Keep typed text when leaving the field, using preset casing when it matches. */
  function normalizeDraft() {
    const normalized = resolveCategoryValue(suggestions, trimmedDraft);
    if (normalized !== value) onChange(normalized);
    if (normalized !== draft) setDraft(normalized);
  }

  function clearValue() {
    onChange('');
    setDraft('');
    setActiveIndex(-1);
    setOpen(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (!skipCloseCommitRef.current) normalizeDraft();
      skipCloseCommitRef.current = false;
      setActiveIndex(-1);
    } else {
      setActiveIndex(-1);
    }
    setOpen(next);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative w-full">
          <input
            id={id}
            type="text"
            role="combobox"
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={open ? activeOptionId : undefined}
            autoComplete="off"
            maxLength={maxLength}
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
            onFocus={() => {
              if (!open) {
                valueAtOpenRef.current = value;
                setOpen(true);
              }
            }}
            onBlur={normalizeDraft}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!open) {
                  valueAtOpenRef.current = value;
                  setActiveIndex(optionCount === 0 ? -1 : 0);
                  setOpen(true);
                  return;
                }
                setActiveIndex((current) =>
                  optionCount === 0 ? -1 : Math.min(current + 1, optionCount - 1)
                );
                return;
              }

              if (e.key === 'ArrowUp') {
                if (!open) return;
                e.preventDefault();
                setActiveIndex((current) => (current <= 0 ? -1 : current - 1));
                return;
              }

              if (e.key === 'Enter') {
                if (!open) return;
                e.preventDefault();
                const active = filtered[activeIndex];
                if (active) commit(active);
                else if (showCustomOption && activeIndex === filtered.length) commit(trimmedDraft);
                else commitDraft();
                return;
              }

              if (e.key === 'Escape') {
                if (!open) return;
                e.preventDefault();
                skipCloseCommitRef.current = true;
                setDraft(valueAtOpenRef.current);
                onChange(valueAtOpenRef.current);
                setActiveIndex(-1);
                setOpen(false);
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
              onClick={() => {
                if (!open) {
                  valueAtOpenRef.current = value;
                  setActiveIndex(-1);
                }
                setOpen((current) => !current);
              }}
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
            ? { width: panelWidth, maxHeight: 'min(60vh, 20rem)' }
            : { maxHeight: 'min(60vh, 20rem)' }
        }
        onOpenAutoFocus={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div
          className="max-h-[min(60vh,20rem)] touch-pan-y overflow-y-auto overscroll-contain p-1 [-webkit-overflow-scrolling:touch]"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <ul id={listboxId} role="listbox" aria-label={ariaLabel} className="space-y-0.5">
            {filtered.map((item, index) => {
              const selected = normalizedValue === item.toLowerCase();
              const active = activeIndex === index;
              return (
                <li
                  key={item}
                  id={optionId(index)}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(item)}
                  className={cn(
                    'flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors',
                    active
                      ? 'bg-muted text-foreground'
                      : selected
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted/60'
                  )}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    {selected ? <Check className="text-primary size-4" aria-hidden /> : null}
                  </span>
                  <span className="min-w-0 truncate">{item}</span>
                </li>
              );
            })}

            {filtered.length === 0 && !showCustomOption ? (
              <li className="text-muted-foreground px-3 py-2.5 text-sm">No matching categories</li>
            ) : null}

            {showCustomOption ? (
              <li
                id={customOptionId}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(trimmedDraft)}
                className={cn(
                  'bg-popover border-border/60 sticky bottom-0 z-10 mt-1 flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-xl border-t px-3 py-2 text-left text-sm font-medium transition-colors',
                  activeIndex === filtered.length ? 'bg-muted' : 'hover:bg-muted/60'
                )}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  <Plus className="text-muted-foreground size-4" aria-hidden />
                </span>
                <span className="min-w-0 truncate">Use &ldquo;{trimmedDraft}&rdquo;</span>
              </li>
            ) : null}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
