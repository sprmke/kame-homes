import { useId } from 'react';

import { MarketingSidebarSection } from '@/features/dashboard/marketing/components/shared/MarketingSidebarSection';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { useCalendarBuilderStore } from '../stores/calendarBuilderStore';

const SHOW_ITEMS = [
  { path: 'header.propertyName.show', label: 'Property name' },
  { path: 'header.monthYear.show', label: 'Month' },
  { path: 'header.subtitle.show', label: 'Subtitle' },
  { path: 'dayNames.show', label: 'Day names' },
  { path: 'legend.show', label: 'Legend' },
  { path: 'watermark.show', label: 'Watermark' },
] as const;

function readPath(root: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
      root
    );
}

/** Everyday calendar controls. Colors and fonts come from the theme; deep styling lives in Advanced. */
export function CalendarQuickSettings({ bare = false }: { bare?: boolean } = {}) {
  const styles = useCalendarBuilderStore((state) => state.styles);
  const updateStyles = useCalendarBuilderStore((state) => state.updateStyles);
  const saveToHistory = useCalendarBuilderStore((state) => state.saveToHistory);
  const subtitleId = useId();
  const bookedId = useId();

  const set = (path: string, value: unknown) => {
    updateStyles(path, value);
    saveToHistory();
  };

  const body = (
    <>
      <ul className="divide-border/60 divide-y">
        {SHOW_ITEMS.map((item) => {
          const checked = readPath(styles, item.path) === true;
          return (
            <li key={item.path}>
              <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 text-sm">
                <span>{item.label}</span>
                <Switch checked={checked} onCheckedChange={(next) => set(item.path, next)} />
              </label>
            </li>
          );
        })}
      </ul>

      <div className="space-y-3 pt-3">
        {styles.header.subtitle.show ? (
          <div className="space-y-1.5">
            <Label htmlFor={subtitleId}>Subtitle</Label>
            <Input
              id={subtitleId}
              value={styles.header.subtitle.text}
              maxLength={60}
              onChange={(event) => updateStyles('header.subtitle.text', event.target.value)}
              onBlur={saveToHistory}
            />
          </div>
        ) : null}
        {styles.booked.text.show ? (
          <div className="space-y-1.5">
            <Label htmlFor={bookedId}>Booked label</Label>
            <Input
              id={bookedId}
              value={styles.booked.text.content}
              maxLength={16}
              onChange={(event) => updateStyles('booked.text.content', event.target.value)}
              onBlur={saveToHistory}
            />
          </div>
        ) : null}
      </div>
    </>
  );

  // `bare`: the editor rail already titles the panel.
  if (bare) return body;
  return (
    <MarketingSidebarSection title="Show on calendar" defaultOpen={false}>
      {body}
    </MarketingSidebarSection>
  );
}
