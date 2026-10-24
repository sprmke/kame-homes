import * as React from 'react';

import {
  Braces,
  ChevronLeft,
  Eye,
  FolderInput,
  Pencil,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from 'lucide-react';

import { extractLeadingSectionHeading } from '@/features/guest/stay-guide/lib/stayGuideContent';

import { PropertyTemplatePlaceholdersDialog } from '@/features/dashboard/bookings/components/property-templates/PropertyTemplatePlaceholdersDialog';
import {
  RichTextDisplay,
  RichTextEditor,
  richTextChromeIconButtonClassName,
  type RichTextEditorHandle,
} from '@/features/dashboard/bookings/components/property-templates/RichTextEditor';
import { SendCustomTemplateDialog } from '@/features/dashboard/bookings/components/property-templates/SendCustomTemplateDialog';
import { TemplateSectionImageField } from '@/features/dashboard/bookings/components/property-templates/TemplateSectionImageField';
import { usePropertyTemplatePreview } from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import { useUploadPropertyTemplateAsset } from '@/features/dashboard/bookings/hooks/useUploadPropertyTemplateAsset';
import { normalizePropertyTemplateEditorContent } from '@/features/dashboard/bookings/lib/normalizePropertyTemplateEditorContent';
import {
  applyPropertyTemplatePlaceholders,
  PROPERTY_TEMPLATE_SAMPLE_VARS,
} from '@/features/dashboard/bookings/lib/propertyTemplatePlaceholders';
import { withStorageUrlCacheBust } from '@/features/dashboard/bookings/lib/storageUrls';
import { buildValidPlaceholderKeySet } from '@/features/dashboard/bookings/lib/telegramPlaceholderGroups';
import {
  templateMetaParts,
  type TemplateLibraryEntry,
} from '@/features/dashboard/bookings/lib/templateLibrary';
import { propertyPlaceholderLinesForTemplate } from '@/features/dashboard/bookings/lib/templatePlaceholderCatalog';
import {
  attachTemplatePreviewActionBlocker,
  blockTemplatePreviewAction,
  blockTemplatePreviewKeydown,
} from '@/features/dashboard/bookings/lib/templatePreviewReadonly';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { ResponsiveOverflowMenu } from '@/components/mobile/ResponsiveOverflowMenu';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import {
  SegmentedControl,
  cardHeaderSegmentedListClassName,
  cardHeaderSegmentedTriggerClassName,
} from '@/components/ui/sliding-tabs';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { cn } from '@/lib/utils';

type EditorTab = 'edit' | 'preview';

const EDITOR_VIEW_OPTIONS = [
  {
    value: 'edit' as const,
    label: <span className="hidden sm:inline">Edit</span>,
    ariaLabel: 'Edit',
    icon: Pencil,
  },
  {
    value: 'preview' as const,
    label: <span className="hidden sm:inline">Preview</span>,
    ariaLabel: 'Preview',
    icon: Eye,
  },
];

const editorChromeActionClassName = cn(
  richTextChromeIconButtonClassName,
  'border-input bg-card hover:bg-accent sm:h-8 sm:w-auto sm:gap-1.5 sm:px-2.5'
);

type Props = {
  entry: TemplateLibraryEntry;
  onSave: (input: { content: string; sectionImageUrl?: string | null }) => Promise<void>;
  onReset?: () => void;
  onDelete?: () => void;
  /** Custom templates only — opens the rename prompt the page owns. */
  onRename?: () => void;
  /** Custom templates only — opens the folder picker the page owns. */
  onMove?: () => void;
  /** Phone only — returns to the library list. */
  onBack?: () => void;
  saving?: boolean;
  /** When false, hides the section image uploader (Stay Guide images live in Page Editor). */
  showSectionImage?: boolean;
  /** When false, content is preview-only (no edit/save/reset/delete). */
  canEdit?: boolean;
};

export function PropertyTemplateEditorPane({
  entry,
  onSave,
  onReset,
  onDelete,
  onRename,
  onMove,
  onBack,
  saving,
  showSectionImage = true,
  canEdit = true,
}: Props) {
  const { template, icon: Icon } = entry;
  const [content, setContent] = React.useState(() =>
    normalizePropertyTemplateEditorContent(template)
  );
  const [sectionImageUrl, setSectionImageUrl] = React.useState(template.sectionImageUrl);
  const [sectionImagePreviewBust, setSectionImagePreviewBust] = React.useState(() =>
    template.updatedAt ? Date.parse(template.updatedAt) || 0 : 0
  );
  const [activeTab, setActiveTab] = React.useState<EditorTab>(canEdit ? 'edit' : 'preview');
  const [previewHtml, setPreviewHtml] = React.useState<string | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [placeholdersOpen, setPlaceholdersOpen] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const editorRef = React.useRef<RichTextEditorHandle>(null);
  const previewIframeRef = React.useRef<HTMLIFrameElement>(null);
  const { mutateAsync: fetchPreview, isPending: previewPending } = usePropertyTemplatePreview();
  const { canUse: canUseCustomTemplates, isLoading: customTemplatesLoading } =
    useFeatureGate('customTemplates');
  const { open: openUpgradeModal } = useUpgradeModal();

  React.useEffect(() => {
    if (!canEdit) setActiveTab('preview');
  }, [canEdit]);

  const baselineContent = React.useMemo(
    () => normalizePropertyTemplateEditorContent(template),
    [template.content, template.templateKey, template.category]
  );

  React.useEffect(() => {
    setContent(baselineContent);
    setSectionImageUrl(template.sectionImageUrl);
    setSectionImagePreviewBust(template.updatedAt ? Date.parse(template.updatedAt) || 0 : 0);
  }, [baselineContent, template.sectionImageUrl, template.updatedAt]);

  const handleSectionImageUrlChange = React.useCallback((url: string | null) => {
    setSectionImageUrl(url);
    setSectionImagePreviewBust(url ? Date.now() : 0);
  }, []);

  const sectionImageDisplayUrl = sectionImageUrl
    ? withStorageUrlCacheBust(sectionImageUrl, sectionImagePreviewBust || null)
    : null;

  const hasChanges = content !== baselineContent || sectionImageUrl !== template.sectionImageUrl;
  const isEmail = template.category === 'email';
  const isCustom = template.category === 'custom';
  const isStandard = template.category === 'standard';
  /** Email + custom saves need Starter+; standard templates are free. */
  const requiresStarterToPersist = isEmail || isCustom;
  const allowSectionImage = isStandard && showSectionImage;
  const uploadTemplateAsset = useUploadPropertyTemplateAsset();

  const metaLine = React.useMemo(() => templateMetaParts(entry).join(' · '), [entry]);

  const openStarterUpgradeIfNeeded = React.useCallback((): boolean => {
    if (!requiresStarterToPersist || canUseCustomTemplates) return false;
    if (!customTemplatesLoading) openUpgradeModal('customTemplates');
    return true;
  }, [canUseCustomTemplates, customTemplatesLoading, openUpgradeModal, requiresStarterToPersist]);

  useUnsavedChangesGuard({
    isDirty: hasChanges,
    enabled: canEdit,
    /* Selecting another template is a `?template=` change that unmounts this
     * editor, so the guard has to block on the full location, not just the path. */
    blocksOn: 'location',
    onSave: async () => {
      if (openStarterUpgradeIfNeeded()) return false;
      try {
        await onSave({ content, sectionImageUrl });
        return true;
      } catch {
        return false;
      }
    },
  });

  const placeholderLines = React.useMemo(
    () => propertyPlaceholderLinesForTemplate(template.templateKey, template.category),
    [template.templateKey, template.category]
  );

  const validPlaceholderKeys = React.useMemo(
    () => buildValidPlaceholderKeySet(placeholderLines),
    [placeholderLines]
  );

  const previewContent = React.useMemo(() => applyPropertyTemplatePlaceholders(content), [content]);
  const previewHeading = React.useMemo(() => {
    const { heading } = extractLeadingSectionHeading(previewContent);
    return heading || template.name;
  }, [previewContent, template.name]);
  const previewBody = React.useMemo(() => {
    const { heading, bodyHtml } = extractLeadingSectionHeading(previewContent);
    return heading ? bodyHtml : previewContent;
  }, [previewContent]);

  const handleInlineImageUpload = React.useCallback(
    async (file: File) => {
      const result = await uploadTemplateAsset.mutateAsync({
        assetType: 'inline_image',
        file,
      });
      return result.url;
    },
    [uploadTemplateAsset]
  );

  const handleInsertPlaceholder = React.useCallback(
    (token: string) => {
      if (activeTab !== 'edit') {
        setActiveTab('edit');
      }
      window.setTimeout(() => {
        editorRef.current?.insertToken(token);
      }, 0);
    },
    [activeTab]
  );

  const loadPreview = React.useCallback(async () => {
    if (!isEmail) return;
    setPreviewHtml(null);
    try {
      const result = await fetchPreview({
        templateKey: template.templateKey,
        category: template.category,
        content,
        name: template.name,
      });
      setPreviewHtml(result.html);
    } catch {
      setPreviewHtml(null);
    }
  }, [content, fetchPreview, isEmail, template.category, template.name, template.templateKey]);

  React.useEffect(() => {
    if (activeTab !== 'preview' || !isEmail || !previewHtml) return;

    const iframe = previewIframeRef.current;
    if (!iframe) return;

    let detach: (() => void) | undefined;

    const bind = () => {
      detach?.();
      const doc = iframe.contentDocument;
      if (!doc) return;
      detach = attachTemplatePreviewActionBlocker(doc);
    };

    iframe.addEventListener('load', bind);
    bind();

    return () => {
      iframe.removeEventListener('load', bind);
      detach?.();
    };
  }, [activeTab, isEmail, previewHtml]);

  const handlePreviewCapture = React.useCallback((event: React.SyntheticEvent) => {
    blockTemplatePreviewAction(event.nativeEvent);
  }, []);

  const handlePreviewKeyCapture = React.useCallback((event: React.KeyboardEvent) => {
    blockTemplatePreviewKeydown(event.nativeEvent);
  }, []);

  const handleTabChange = (tab: EditorTab) => {
    setActiveTab(tab);
    if (tab === 'preview') {
      if (isEmail) void loadPreview();
    } else {
      setPreviewHtml(null);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Header and chrome stay put so Save is reachable from anywhere in a long template. */}
      <div className="bg-card border-separator shrink-0 border-b">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground flex min-h-[44px] w-full items-center gap-1 px-2 text-[13px] font-medium lg:hidden"
          >
            <ChevronLeft className="size-4 shrink-0" aria-hidden />
            All templates
          </button>
        ) : null}

        <div className="flex min-w-0 items-start gap-3 px-3 pb-2.5 pt-3 sm:px-4">
          {/* The open template is the one brand-tinted mark on the page; rail rows stay quiet. */}
          <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10">
            <Icon className="text-primary size-4 sm:size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-card-title min-w-0 truncate">{template.name}</h2>
              {isEmail || isCustom ? <TierBadge feature="customTemplates" /> : null}
              {hasChanges ? (
                <span className="inline-flex items-center rounded-md border border-amber-500/50 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  Unsaved
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground truncate text-xs">{metaLine}</p>
            {template.description ? (
              <p className="text-muted-foreground mt-1 hidden text-xs sm:block">
                {template.description}
              </p>
            ) : null}
          </div>
        </div>

        {/* Wraps rather than clips: at `lg` the pane can be ~400px wide, which is
         * not enough for the view switch and every action on one row. */}
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-2 sm:gap-2 sm:px-4">
          <SegmentedControl
            value={activeTab}
            onChange={handleTabChange}
            options={EDITOR_VIEW_OPTIONS}
            size="dense"
            aria-label={`${template.name} view`}
            listClassName={cn(cardHeaderSegmentedListClassName, 'shrink-0')}
            triggerClassName={cn(cardHeaderSegmentedTriggerClassName, 'px-2 sm:px-2.5')}
          />
          <div className="ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-1 sm:gap-1.5">
            {canEdit ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className={editorChromeActionClassName}
                  onClick={() => setPlaceholdersOpen(true)}
                  aria-label="Placeholders"
                  title="Placeholders"
                >
                  <Braces className="size-3.5 shrink-0" aria-hidden />
                  <span className="hidden text-xs font-semibold sm:inline">Placeholders</span>
                </Button>
                {!isCustom && onReset ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className={editorChromeActionClassName}
                    onClick={() => setResetOpen(true)}
                    aria-label="Reset"
                    title="Reset"
                  >
                    <RotateCcw className="size-3.5 shrink-0" aria-hidden />
                    <span className="hidden text-xs font-semibold sm:inline">Reset</span>
                  </Button>
                ) : null}
                {/* One ⋯ for the custom-template actions: four inline buttons never
                 * fit beside Save on a phone. */}
                {isCustom ? (
                  <ResponsiveOverflowMenu
                    label={`Actions for ${template.name}`}
                    sheetTitle={template.name}
                    triggerClassName="admin-overflow-trigger shrink-0"
                    actionGroups={[
                      [
                        {
                          key: 'send',
                          label: 'Send to guest',
                          icon: <Send className="size-4" aria-hidden />,
                          /* Sending uses the saved copy, so hide it while edits are pending. */
                          disabled: hasChanges,
                          onSelect: () => setSendOpen(true),
                        },
                      ],
                      [
                        {
                          key: 'rename',
                          label: 'Rename',
                          icon: <Pencil className="size-4" aria-hidden />,
                          disabled: !onRename,
                          onSelect: () => onRename?.(),
                        },
                        {
                          key: 'move',
                          label: 'Move',
                          icon: <FolderInput className="size-4" aria-hidden />,
                          disabled: !onMove,
                          onSelect: () => onMove?.(),
                        },
                      ],
                      [
                        {
                          key: 'delete',
                          label: 'Delete template',
                          icon: <Trash2 className="size-4" aria-hidden />,
                          destructive: true,
                          disabled: !onDelete,
                          onSelect: () => setDeleteOpen(true),
                        },
                      ],
                    ]}
                  />
                ) : null}
                {hasChanges ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    className={cn(
                      richTextChromeIconButtonClassName,
                      'sm:h-8 sm:w-auto sm:gap-1.5 sm:px-2.5'
                    )}
                    disabled={saving}
                    onClick={() => {
                      if (openStarterUpgradeIfNeeded()) return;
                      void onSave({ content, sectionImageUrl });
                    }}
                    aria-label={saving ? 'Saving' : 'Save'}
                    title={saving ? 'Saving…' : 'Save'}
                  >
                    <Save className="size-3.5 shrink-0" aria-hidden />
                    <span className="hidden text-xs font-semibold sm:inline">
                      {saving ? 'Saving…' : 'Save'}
                    </span>
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* The pane owns the only scroll here, so the editor no longer chains into a page scrollport. */}
      <div
        data-template-pane-scroll
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overscroll-contain p-3 sm:p-4',
          activeTab === 'preview' && isEmail ? 'min-h-[280px] overflow-hidden' : 'overflow-y-auto',
          bottomTabBarOffsetClassName()
        )}
      >
        {activeTab === 'preview' ? (
          isEmail ? (
            previewPending || !previewHtml ? (
              <div className="bg-muted/20 text-muted-foreground flex min-h-0 flex-1 items-center justify-center rounded-lg border text-sm">
                Loading preview…
              </div>
            ) : (
              <div className="bg-muted/20 flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-hidden rounded-lg border">
                <iframe
                  ref={previewIframeRef}
                  title={`${template.name} preview`}
                  srcDoc={previewHtml}
                  className="min-h-0 w-full min-w-[320px] flex-1 border-0 bg-white"
                  sandbox=""
                />
              </div>
            )
          ) : (
            <div
              onClickCapture={handlePreviewCapture}
              onKeyDownCapture={handlePreviewKeyCapture}
              className={cn(
                'border-border bg-card overflow-hidden rounded-lg border shadow-sm',
                isStandard &&
                  allowSectionImage &&
                  sectionImageDisplayUrl &&
                  'lg:grid lg:grid-cols-2 lg:items-stretch'
              )}
            >
              {isStandard && allowSectionImage && sectionImageDisplayUrl ? (
                <div className="relative aspect-[16/10] w-full shrink-0 lg:aspect-auto lg:h-full lg:min-h-[240px]">
                  <img
                    key={sectionImagePreviewBust || sectionImageUrl}
                    src={sectionImageDisplayUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <div className="flex min-w-0 flex-col justify-center p-4 sm:p-6">
                <h3 className="text-primary mb-3 text-base font-bold tracking-tight sm:mb-4 sm:text-xl">
                  {previewHeading}
                </h3>
                <RichTextDisplay
                  content={previewBody}
                  className="px-0 py-0"
                  validPlaceholderKeys={validPlaceholderKeys}
                />
              </div>
            </div>
          )
        ) : (
          <>
            {allowSectionImage ? (
              <TemplateSectionImageField
                templateKey={template.templateKey}
                imageUrl={sectionImageUrl}
                previewBust={sectionImagePreviewBust}
                disabled={saving}
                onImageUrlChange={handleSectionImageUrlChange}
              />
            ) : null}
            <RichTextEditor
              ref={editorRef}
              content={content}
              onChange={setContent}
              fill
              minHeight="clamp(240px, 46dvh, 520px)"
              validPlaceholderKeys={validPlaceholderKeys}
              onImageUpload={isStandard ? handleInlineImageUpload : undefined}
            />
          </>
        )}
      </div>

      <PropertyTemplatePlaceholdersDialog
        open={placeholdersOpen}
        onOpenChange={setPlaceholdersOpen}
        lines={placeholderLines}
        sampleVars={PROPERTY_TEMPLATE_SAMPLE_VARS}
        onInsertToken={handleInsertPlaceholder}
      />

      {isCustom ? (
        <SendCustomTemplateDialog
          templateKey={template.templateKey}
          templateName={template.name}
          open={sendOpen}
          onOpenChange={setSendOpen}
        />
      ) : null}

      <ResponsiveModal
        open={resetOpen}
        onOpenChange={(open) => {
          setResetOpen(open);
          if (!open) {
            window.requestAnimationFrame(() => {
              document.body.style.removeProperty('pointer-events');
            });
          }
        }}
      >
        <ResponsiveModalContent className="sm:max-w-[28rem]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Reset to default?</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              Your saved copy will be replaced with the original default text.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalFooter className="gap-1">
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setResetOpen(false);
                setContent(template.defaultContent);
                handleSectionImageUrlChange(null);
                void onReset?.();
              }}
            >
              Reset
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            window.requestAnimationFrame(() => {
              document.body.style.removeProperty('pointer-events');
            });
          }
        }}
      >
        <ResponsiveModalContent className="sm:max-w-[28rem]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Delete template?</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <ResponsiveModalFooter className="gap-1">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDeleteOpen(false);
                void onDelete?.();
              }}
            >
              Delete
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}
