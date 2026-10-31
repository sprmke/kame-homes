import { useEffect, useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { BadgeCheck, Building, Building2, Car, LifeBuoy } from 'lucide-react';

import { useSuperAdminSearch } from '@/features/dashboard/super-admin/hooks/useSuperAdminSearch';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

const ICON = {
  organization: Building2,
  property: Building,
  parking: Car,
  ticket: LifeBuoy,
  approval: BadgeCheck,
} as const;

/** ⌘K / Ctrl-K jump palette for `/admin/*`. Mounted once in the admin shell. */
export function SuperAdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { data: results, isFetching } = useSuperAdminSearch(query);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const grouped = useMemo(() => {
    const byType = new Map<string, NonNullable<typeof results>>();
    for (const hit of results ?? []) {
      const list = byType.get(hit.type) ?? [];
      list.push(hit);
      byType.set(hit.type, list);
    }
    return Array.from(byType.entries());
  }, [results]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Jump to an org, property, parking, or ticket…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query.trim().length < 2
            ? 'Type at least 2 characters.'
            : isFetching
              ? 'Searching…'
              : 'No matches.'}
        </CommandEmpty>
        {grouped.map(([type, hits]) => {
          const Icon = ICON[type as keyof typeof ICON] ?? Building2;
          return (
            <CommandGroup key={type} heading={`${type.charAt(0).toUpperCase()}${type.slice(1)}`}>
              {hits.map((hit) => (
                <CommandItem
                  key={`${hit.type}-${hit.href}-${hit.label}`}
                  value={`${hit.label} ${hit.sublabel ?? ''}`}
                  onSelect={() => {
                    setOpen(false);
                    navigate(hit.href);
                  }}
                >
                  <Icon className="text-muted-foreground mr-2 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">{hit.label}</span>
                  {hit.sublabel ? (
                    <span className="text-muted-foreground ml-2 truncate text-xs">
                      {hit.sublabel}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
