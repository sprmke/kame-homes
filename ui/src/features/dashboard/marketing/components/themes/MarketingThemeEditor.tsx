import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import { NewThemeDialog } from '@/features/dashboard/marketing/components/themes/NewThemeDialog';
import {
  ThemeBackgroundPicker,
  ThemeColorRoles,
  ThemeCornerPicker,
  ThemeFontPairingPicker,
  ThemeFontSelect,
  ThemePaletteGrid,
  ThemePhotoLookSelect,
} from '@/features/dashboard/marketing/components/themes/ThemeEditorControls';
import { ThemeTypeSpecimen } from '@/features/dashboard/marketing/components/themes/ThemePreview';
import { ThemeShowcase } from '@/features/dashboard/marketing/components/themes/ThemeShowcase';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import {
  useMarketingThemeMutations,
  type MarketingThemeSource,
} from '@/features/dashboard/marketing/hooks/useMarketingThemes';
import {
  marketingThemeContrastIssues,
  marketingThemeHash,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  uniqueThemeName,
  type MarketingThemeEntry,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeLibrary';
import {
  distinctPalettes,
  roleColorSuggestions,
  type PaletteSuggestion,
  type ThemePaletteRole,
} from '@/features/dashboard/marketing/lib/theme/themePaletteSuggestions';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';

export type MarketingThemeEditorRequest =
  | { mode: 'edit'; entry: MarketingThemeEntry }
  | {
      mode: 'create';
      name: string;
      tokens: MarketingThemeTokens;
      source: MarketingThemeSource;
      sourceRef?: string | null;
    };

type EditorContextValue = {
  /** False when the role can't add themes (entry points hide). */
  canCreate: boolean;
  canEdit: boolean;
  openEditor: (request: MarketingThemeEditorRequest) => void;
  /** "New theme": AI or a starting look, then the editor. */
  openNewTheme: () => void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

/** How many whole palettes the editor suggests (near-duplicates are dropped). */
const PALETTE_SUGGESTIONS = 8;

export function MarketingThemeEditorProvider({ children }: { children: ReactNode }) {
  const { canAddTemplate, canEditTemplate } = useMarketingPermissions();
  const [request, setRequest] = useState<MarketingThemeEditorRequest | null>(null);
  const [newThemeOpen, setNewThemeOpen] = useState(false);

  const value = useMemo<EditorContextValue>(
    () => ({
      canCreate: canAddTemplate,
      canEdit: canEditTemplate || canAddTemplate,
      openEditor: setRequest,
      openNewTheme: () => setNewThemeOpen(true),
    }),
    [canAddTemplate, canEditTemplate]
  );

  return (
    <EditorContext.Provider value={value}>
      {children}
      {newThemeOpen ? (
        <NewThemeDialog
          canCreate={canAddTemplate}
          onClose={() => setNewThemeOpen(false)}
          onStart={(next) => {
            setNewThemeOpen(false);
            setRequest(next);
          }}
        />
      ) : null}
      {request ? (
        <ThemeEditorSheet
          key={request.mode === 'edit' ? `edit:${request.entry.key}` : `create:${request.name}`}
          request={request}
          onClose={() => setRequest(null)}
        />
      ) : null}
    </EditorContext.Provider>
  );
}

export function useMarketingThemeEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx)
    throw new Error('useMarketingThemeEditor must be used inside MarketingThemeEditorProvider');
  return ctx;
}

function EditorSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5" aria-labelledby={id}>
      <h3 id={id} className="text-sm font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ThemeEditorSheet({
  request,
  onClose,
}: {
  request: MarketingThemeEditorRequest;
  onClose: () => void;
}) {
  const { property } = useOrgContext();
  const { library, openTheme, coverPhotoUrl } = useMarketingTheme();
  const { create, update } = useMarketingThemeMutations();
  const { canUse: canSaveThemes, isLoading: gateLoading } = useFeatureGate('customTemplates');
  const { open: openUpgradeModal } = useUpgradeModal();
  const editingCustom = request.mode === 'edit' && request.entry.editable;
  const takenNames = library.mine.map((e) => e.name);
  const initialName =
    request.mode === 'edit'
      ? editingCustom
        ? request.entry.name
        : uniqueThemeName(`My ${request.entry.name}`, takenNames)
      : uniqueThemeName(request.name, takenNames);
  const initialTokens = request.mode === 'edit' ? request.entry.tokens : request.tokens;
  const entry = request.mode === 'edit' ? request.entry : null;

  const [open, setOpen] = useState(true);
  const [name, setName] = useState(initialName);
  const [tokens, setTokens] = useState<MarketingThemeTokens>(initialTokens);
  const [fontsOpen, setFontsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty =
    name.trim() !== initialName || marketingThemeHash(tokens) !== marketingThemeHash(initialTokens);

  useEffect(() => {
    if (!open) {
      const timer = window.setTimeout(onClose, 250);
      return () => window.clearTimeout(timer);
    }
  }, [open, onClose]);

  const patch = useCallback(
    (next: Partial<MarketingThemeTokens>) => setTokens((current) => ({ ...current, ...next })),
    []
  );
  const setPalette = useCallback(
    (palette: Partial<MarketingThemeTokens['palette']>) =>
      setTokens((current) => ({ ...current, palette: { ...current.palette, ...palette } })),
    []
  );

  // Palettes from the property, the host's themes and the starter looks.
  const allPalettes = useMemo<PaletteSuggestion[]>(() => {
    const propertyColors = library.byKey.get('property-colors');
    const sources = [
      ...(propertyColors ? [{ ...propertyColors, name: 'Your photos' }] : []),
      ...library.mine.filter((e) => e.kind !== 'property-colors'),
      ...library.starters,
    ];
    return sources.map((source) => ({
      key: source.key,
      label: source.name,
      palette: source.tokens.palette,
    }));
  }, [library]);
  const paletteOptions = useMemo(
    () => distinctPalettes(allPalettes, PALETTE_SUGGESTIONS),
    [allPalettes]
  );
  const roleSuggestions = useCallback(
    (role: ThemePaletteRole) =>
      roleColorSuggestions(
        role,
        allPalettes.map((option) => option.palette)
      ),
    [allPalettes]
  );

  const save = useCallback(async (): Promise<boolean> => {
    const trimmed = name.replace(/\s+/g, ' ').trim();
    if (!trimmed) {
      toast.error('Give your theme a name');
      return false;
    }
    if (!gateLoading && !canSaveThemes) {
      openUpgradeModal('customTemplates');
      return false;
    }
    setSaving(true);
    try {
      if (editingCustom && request.mode === 'edit') {
        await update.mutateAsync({ id: request.entry.key, name: trimmed, tokens });
        toast.success('Theme saved');
      } else {
        const source: MarketingThemeSource =
          request.mode === 'create'
            ? request.source
            : request.entry.kind === 'starter'
              ? 'starter'
              : 'photos';
        const sourceRef =
          request.mode === 'create' ? (request.sourceRef ?? null) : request.entry.key;
        const created = await create.mutateAsync({ name: trimmed, tokens, source, sourceRef });
        toast.success('Theme created');
        openTheme(created.id);
      }
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the theme');
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    name,
    gateLoading,
    canSaveThemes,
    openUpgradeModal,
    editingCustom,
    request,
    update,
    tokens,
    create,
    openTheme,
  ]);

  const { onOpenChange, requestClose, dialogProps } = useGuardedClose({
    open,
    onOpenChange: setOpen,
    isDirty,
    onSave: save,
  });

  const handleSave = async () => {
    if (await save()) setOpen(false);
  };

  const issues = marketingThemeContrastIssues(tokens);
  const title =
    request.mode === 'create'
      ? 'New theme'
      : editingCustom
        ? 'Edit theme'
        : `Customize ${request.entry.name}`;
  const itemCount = entry?.itemCount ?? 0;

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={
          request.mode === 'edit' && !editingCustom
            ? 'Saving makes your own copy. The original stays as it is.'
            : undefined
        }
        sizeClassName="max-w-[min(calc(100vw-1.5rem),62rem)] sm:max-w-[min(94vw,62rem)]"
        heightClassName="max-h-[min(92dvh,52rem)]"
        bodyClassName="lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-6"
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="outline" onClick={requestClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : editingCustom ? 'Save' : 'Save theme'}
            </Button>
          </div>
        }
      >
        {/* Preview: sample post, calendar and clip in the colors being edited. */}
        <div className="bg-card sticky -top-4 z-10 -mx-5 -mt-4 space-y-2 px-5 pb-3 pt-4 sm:-mx-6 sm:px-6 lg:top-0 lg:mx-0 lg:mt-0 lg:px-0 lg:pt-0">
          <ThemeShowcase
            tokens={tokens}
            calendarLayoutId={entry?.calendarLayoutId}
            propertyName={property.name}
            photoUrl={coverPhotoUrl}
            size="large"
            className="rounded-xl"
          />
          <ThemeTypeSpecimen tokens={tokens} className="border-border border max-lg:hidden" />
          {editingCustom && itemCount > 0 ? (
            <p className="text-muted-foreground text-xs max-lg:hidden">
              {itemCount === 1
                ? 'Your saved item updates to match.'
                : `Your ${itemCount} saved items update to match.`}{' '}
              Changes you made by hand stay.
            </p>
          ) : null}
          {issues.length > 0 ? (
            <div
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs"
              role="status"
            >
              <span className="font-medium">Some text may be hard to read: </span>
              <span className="text-muted-foreground">
                {issues.map((issue) => issue.pair.toLowerCase()).join(', ')}. We adjust text colors
                where we can.
              </span>
            </div>
          ) : null}
        </div>

        <div className="space-y-6 pt-1 lg:pt-0">
          <div className="space-y-1.5">
            <Label htmlFor="marketing-theme-name">Name</Label>
            <Input
              id="marketing-theme-name"
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <EditorSection id="theme-palette-heading" title="Palette">
            <ThemePaletteGrid
              current={tokens.palette}
              options={paletteOptions}
              onPick={(palette) => setPalette(palette)}
            />
          </EditorSection>

          <EditorSection id="theme-colors-heading" title="Colors">
            <ThemeColorRoles
              palette={tokens.palette}
              suggestions={roleSuggestions}
              onChange={(role, color) => setPalette({ [role]: color })}
            />
          </EditorSection>

          <EditorSection id="theme-fonts-heading" title="Fonts">
            <ThemeFontPairingPicker value={tokens.fonts} onChange={(fonts) => patch({ fonts })} />
            <Collapsible open={fontsOpen} onOpenChange={setFontsOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground flex min-h-[40px] items-center gap-1 text-xs font-medium"
                >
                  Pick each font
                  <ChevronDown
                    className={cn('size-3.5 transition-transform', fontsOpen && 'rotate-180')}
                    aria-hidden
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
                <ThemeFontSelect
                  label="Headings"
                  value={tokens.fonts.display}
                  onChange={(display) => patch({ fonts: { ...tokens.fonts, display } })}
                />
                <ThemeFontSelect
                  label="Body"
                  value={tokens.fonts.body}
                  onChange={(body) => patch({ fonts: { ...tokens.fonts, body } })}
                />
                <ThemeFontSelect
                  label="Labels"
                  value={tokens.fonts.label}
                  onChange={(label) => patch({ fonts: { ...tokens.fonts, label } })}
                />
              </CollapsibleContent>
            </Collapsible>
          </EditorSection>

          <EditorSection id="theme-background-heading" title="Background">
            <ThemeBackgroundPicker
              tokens={tokens}
              photoUrl={coverPhotoUrl}
              onChange={(background) => patch({ background })}
            />
          </EditorSection>

          <EditorSection id="theme-corners-heading" title="Corners">
            <ThemeCornerPicker
              value={tokens.corners}
              color={tokens.palette.primary}
              onChange={(corners) => patch({ corners })}
            />
          </EditorSection>

          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground border-border flex min-h-[44px] w-full items-center justify-between border-t pt-2 text-sm font-medium"
              >
                More options
                <ChevronDown
                  className={cn('size-4 transition-transform', moreOpen && 'rotate-180')}
                  aria-hidden
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1.5 pt-2">
              <ThemePhotoLookSelect
                value={tokens.photoLook}
                onChange={(photoLook) =>
                  setTokens((current) => {
                    const { photoLook: _previous, ...rest } = current;
                    return photoLook ? { ...rest, photoLook } : rest;
                  })
                }
              />
              <p className="text-muted-foreground text-xs">
                The starting look for AI photos and videos in this theme.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
