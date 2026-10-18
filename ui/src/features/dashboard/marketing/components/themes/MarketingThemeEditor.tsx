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
import { ThemeMiniPreviews } from '@/features/dashboard/marketing/components/themes/ThemePreview';
import {
  ThemeColorField,
  ThemeFontPairingPicker,
  ThemeFontSelect,
  ThemeOptionGrid,
  ThemePalettePicker,
} from '@/features/dashboard/marketing/components/themes/ThemeEditorControls';
import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import {
  useMarketingThemeMutations,
  type MarketingThemeSource,
} from '@/features/dashboard/marketing/hooks/useMarketingThemes';
import {
  marketingThemeContrastIssues,
  marketingThemeHash,
  type MarketingThemeBackground,
  type MarketingThemeCorners,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import {
  uniqueThemeName,
  type MarketingThemeEntry,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeLibrary';
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
};

const EditorContext = createContext<EditorContextValue | null>(null);

const BACKGROUND_OPTIONS: Array<{ value: MarketingThemeBackground; label: string }> = [
  { value: 'solid', label: 'Solid' },
  { value: 'soft-gradient', label: 'Gradient' },
  { value: 'pattern', label: 'Pattern' },
  { value: 'photo-wash', label: 'Photo' },
];

const CORNER_OPTIONS: Array<{ value: MarketingThemeCorners; label: string }> = [
  { value: 'sharp', label: 'Sharp' },
  { value: 'soft', label: 'Soft' },
  { value: 'round', label: 'Round' },
];

export function MarketingThemeEditorProvider({ children }: { children: ReactNode }) {
  const { canAddTemplate, canEditTemplate } = useMarketingPermissions();
  const [request, setRequest] = useState<MarketingThemeEditorRequest | null>(null);

  const value = useMemo<EditorContextValue>(
    () => ({
      canCreate: canAddTemplate,
      canEdit: canEditTemplate || canAddTemplate,
      openEditor: setRequest,
    }),
    [canAddTemplate, canEditTemplate]
  );

  return (
    <EditorContext.Provider value={value}>
      {children}
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
  const initialName =
    request.mode === 'edit'
      ? editingCustom
        ? request.entry.name
        : uniqueThemeName(
            `My ${request.entry.name}`,
            library.mine.map((e) => e.name)
          )
      : uniqueThemeName(
          request.name,
          library.mine.map((e) => e.name)
        );
  const initialTokens = request.mode === 'edit' ? request.entry.tokens : request.tokens;

  const [open, setOpen] = useState(true);
  const [name, setName] = useState(initialName);
  const [tokens, setTokens] = useState<MarketingThemeTokens>(initialTokens);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty =
    name.trim() !== initialName ||
    marketingThemeHash(tokens) !== marketingThemeHash(initialTokens);

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

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={
          request.mode === 'edit' && !editingCustom
            ? 'Built-in themes stay as they are. Saving makes your own copy.'
            : undefined
        }
        sizeClassName="max-w-[min(calc(100vw-1.5rem),40rem)] sm:max-w-[min(92vw,40rem)]"
        heightClassName="max-h-[min(92dvh,52rem)]"
        bodyClassName="space-y-5"
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
        <div className="bg-card/95 sticky top-0 z-10 -mx-1 px-1 pb-1 pt-0.5 backdrop-blur">
          <ThemeMiniPreviews
            tokens={tokens}
            propertyName={property.name}
            photoUrl={coverPhotoUrl}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="marketing-theme-name">Name</Label>
          <Input
            id="marketing-theme-name"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <section className="space-y-3" aria-labelledby="theme-colors-heading">
          <h3 id="theme-colors-heading" className="text-sm font-semibold">
            Colors
          </h3>
          <ThemePalettePicker current={tokens} onPick={(palette) => setPalette(palette)} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ThemeColorField
              label="Main"
              value={tokens.palette.primary}
              onChange={(primary) => setPalette({ primary })}
            />
            <ThemeColorField
              label="Soft"
              value={tokens.palette.secondary}
              onChange={(secondary) => setPalette({ secondary })}
            />
            <ThemeColorField
              label="Highlight"
              value={tokens.palette.accent}
              onChange={(accent) => setPalette({ accent })}
            />
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="theme-fonts-heading">
          <h3 id="theme-fonts-heading" className="text-sm font-semibold">
            Fonts
          </h3>
          <ThemeFontPairingPicker value={tokens.fonts} onChange={(fonts) => patch({ fonts })} />
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ThemeOptionGrid
            label="Background"
            value={tokens.background}
            options={BACKGROUND_OPTIONS}
            onChange={(background) => patch({ background })}
          />
          <ThemeOptionGrid
            label="Corners"
            value={tokens.corners}
            options={CORNER_OPTIONS}
            onChange={(corners) => patch({ corners })}
          />
        </section>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground flex min-h-[44px] w-full items-center justify-between rounded-lg text-sm font-medium"
            >
              Advanced
              <ChevronDown
                className={cn('size-4 transition-transform', advancedOpen && 'rotate-180')}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ThemeColorField
                label="Background"
                value={tokens.palette.surface}
                onChange={(surface) => setPalette({ surface })}
              />
              <ThemeColorField
                label="Text"
                value={tokens.palette.ink}
                onChange={(ink) => setPalette({ ink })}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
            </div>
          </CollapsibleContent>
        </Collapsible>

        {issues.length > 0 ? (
          <div
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs"
            role="status"
          >
            <p className="font-medium">Some text may be hard to read</p>
            <ul className="text-muted-foreground mt-1 space-y-0.5">
              {issues.map((issue) => (
                <li key={issue.pair}>{issue.pair}</li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-1">
              We adjust text colors automatically where we can.
            </p>
          </div>
        ) : null}
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
