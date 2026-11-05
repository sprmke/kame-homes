import { useState } from 'react';

import { ChevronDown } from 'lucide-react';

import type { MarketingThemeEditorRequest } from '@/features/dashboard/marketing/components/themes/MarketingThemeEditor';
import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import { ThemeAiDescribe } from '@/features/dashboard/marketing/components/themes/ThemeAiDescribe';
import { ThemeShowcase } from '@/features/dashboard/marketing/components/themes/ThemeShowcase';
import {
  uniqueThemeName,
  type MarketingThemeEntry,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeLibrary';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { Button } from '@/components/ui/button';

type CreateRequest = Extract<MarketingThemeEditorRequest, { mode: 'create' }>;

function LookCard({
  entry,
  label,
  caption,
  propertyName,
  photoUrl,
  onPick,
}: {
  entry: MarketingThemeEntry;
  label: string;
  caption?: string;
  propertyName: string;
  photoUrl?: string;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-label={`Start from ${label}`}
        className="border-border bg-card hover:border-primary/60 focus-visible:ring-ring block w-full overflow-hidden rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
      >
        <ThemeShowcase
          tokens={entry.tokens}
          calendarLayoutId={entry.calendarLayoutId}
          propertyName={propertyName}
          photoUrl={photoUrl}
        />
        <span className="flex items-baseline justify-between gap-2 px-3 py-2">
          <span className="truncate text-sm font-medium">{label}</span>
          {caption ? (
            <span className="text-muted-foreground shrink-0 text-xs">{caption}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

/**
 * "New theme": describe it to AI or start from a look. Starter looks live only
 * here, so the theme library stays a short list of the host's own themes.
 */
export function NewThemeDialog({
  canCreate,
  onStart,
  onClose,
}: {
  /** False for roles that can't add themes: looks open as they are. */
  canCreate: boolean;
  /** Hands the draft to the theme editor (create mode). */
  onStart: (request: CreateRequest) => void;
  onClose: () => void;
}) {
  const { property } = useOrgContext();
  const { library, openTheme, coverPhotoUrl } = useMarketingTheme();
  const { canUse: canSaveThemes, isLoading: gateLoading } = useFeatureGate('customTemplates');
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Plans (or roles) without saved themes can still work in any starter look as it is.
  const canSave = canCreate && (gateLoading || canSaveThemes);
  const takenNames = library.mine.map((entry) => entry.name);
  const propertyColors = library.byKey.get('property-colors');
  const featured = library.starters.filter((entry) => entry.featured);
  const more = library.starters.filter((entry) => !entry.featured);
  const looks = showAll ? [...featured, ...more] : featured;

  const close = () => {
    setOpen(false);
    window.setTimeout(onClose, 200);
  };

  const pick = (entry: MarketingThemeEntry, name: string) => {
    if (!canSave) {
      close();
      openTheme(entry.key);
      return;
    }
    onStart({
      mode: 'create',
      name: uniqueThemeName(name, takenNames),
      tokens: entry.tokens,
      source: entry.kind === 'starter' ? 'starter' : 'photos',
      sourceRef: entry.key,
    });
  };

  return (
    <AdminDialogShell
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      title={canCreate ? 'New theme' : 'More looks'}
      description={
        canSave
          ? 'Pick a starting look. You can change colors and fonts next.'
          : 'Pick a look to work in.'
      }
      sizeClassName="max-w-[min(calc(100vw-1.5rem),56rem)] sm:max-w-[min(94vw,56rem)]"
      heightClassName="max-h-[min(92dvh,56rem)]"
      bodyClassName="space-y-5"
      footer={
        <Button variant="outline" onClick={close} className="max-sm:w-full">
          Cancel
        </Button>
      }
    >
      {canSave ? (
        <ThemeAiDescribe
          brandColor={propertyColors?.tokens.palette.primary ?? '#2f6f5e'}
          onGenerated={(theme) =>
            onStart({
              mode: 'create',
              name: uniqueThemeName(theme.name, takenNames),
              tokens: theme.tokens,
              source: 'ai',
            })
          }
        />
      ) : null}

      <section aria-labelledby="new-theme-looks" className="space-y-3">
        <h3 id="new-theme-looks" className="text-sm font-semibold">
          Start from a look
        </h3>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {propertyColors ? (
            <LookCard
              entry={propertyColors}
              label="Your property colors"
              caption="From your photos"
              propertyName={property.name}
              photoUrl={coverPhotoUrl}
              onPick={() => pick(propertyColors, `${property.name} colors`)}
            />
          ) : null}
          {looks.map((entry) => (
            <LookCard
              key={entry.key}
              entry={entry}
              label={entry.name}
              caption={entry.group}
              propertyName={property.name}
              photoUrl={coverPhotoUrl}
              onPick={() => pick(entry, entry.name)}
            />
          ))}
        </ul>
        {!showAll && more.length > 0 ? (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
              More looks
              <ChevronDown className="size-4" aria-hidden />
            </Button>
          </div>
        ) : null}
      </section>
    </AdminDialogShell>
  );
}
