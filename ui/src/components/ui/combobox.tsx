import * as React from 'react';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type ComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Allow entering a value that isn't in `options` (renders a "Create …" row). */
  creatable?: boolean;
  /** Max length for the search/create input, when `creatable`. */
  maxLength?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
};

/** Standard app dropdown for a searchable list of options — optionally creatable free text. */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results.',
  creatable = false,
  maxLength,
  disabled,
  className,
  id,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const trimmedQuery = query.trim();
  const filteredOptions = trimmedQuery
    ? options.filter((option) => option.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : options;
  const hasExactMatch = options.some(
    (option) => option.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const showCreate = creatable && trimmedQuery.length > 0 && !hasExactMatch;

  const select = (next: string) => {
    onChange(next);
    setQuery('');
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'border-border/50 bg-card hover:border-primary/25 field-focus h-11 w-full justify-between px-4 py-2 text-sm font-medium max-lg:h-10 max-lg:px-3',
            !value && 'text-muted-foreground/70 font-normal',
            className
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
            maxLength={maxLength}
          />
          <CommandList className="max-h-[min(20rem,var(--radix-popover-content-available-height))]">
            {filteredOptions.length === 0 && !showCreate ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : null}
            {showCreate ? (
              <CommandGroup>
                <CommandItem
                  value={`__create__${trimmedQuery}`}
                  onSelect={() => select(trimmedQuery)}
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  Create &ldquo;{trimmedQuery}&rdquo;
                </CommandItem>
              </CommandGroup>
            ) : null}
            {filteredOptions.length > 0 ? (
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem key={option} value={option} onSelect={() => select(option)}>
                    <Check
                      className={cn(
                        'size-4 shrink-0',
                        value === option ? 'opacity-100' : 'opacity-0'
                      )}
                      aria-hidden
                    />
                    <span className="truncate">{option}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
