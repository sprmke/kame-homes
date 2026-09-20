import * as React from 'react';

import { Braces, Eye, Pencil, RotateCcw, Save, Send, Trash2 } from 'lucide-react';

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
import {
  usePropertyTemplatePreview,
  type PropertyTemplateDto,
} from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import { useUploadPropertyTemplateAsset } from '@/features/dashboard/bookings/hooks/useUploadPropertyTemplateAsset';
import { normalizeBlockLevelPlaceholdersInHtml } from '@/features/dashboard/bookings/lib/normalizeBlockLevelPlaceholders';
import { normalizeEmailCalloutPlaceholders } from '@/features/dashboard/bookings/lib/normalizeEmailCalloutPlaceholders';
import {
  applyPropertyTemplatePlaceholders,
  PROPERTY_TEMPLATE_SAMPLE_VARS,
} from '@/features/dashboard/bookings/lib/propertyTemplatePlaceholders';
import { withStorageUrlCacheBust } from '@/features/dashboard/bookings/lib/storageUrls';
import { buildValidPlaceholderKeySet } from '@/features/dashboard/bookings/lib/telegramPlaceholderGroups';
import { propertyPlaceholderLinesForTemplate } from '@/features/dashboard/bookings/lib/templatePlaceholderCatalog';
import {
  attachTemplatePreviewActionBlocker,
  blockTemplatePreviewAction,
  blockTemplatePreviewKeydown,
} from '@/features/dashboard/bookings/lib/templatePreviewReadonly';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  template: PropertyTemplateDto;
  icon: React.ComponentType<{ className?: string }>;
  onSave: (input: { content: string; sectionImageUrl?: string | null }) => Promise<void>;
  onReset?: () => void;
  onDelete?: () => void;
  saving?: boolean;
  /** When false, hides the section image uploader (Stay Guide images live in Page Editor). */
  showSectionImage?: boolean;
  /** When false, content is preview-only (no edit/save/reset/delete). */
  canEdit?: boolean;
};

export function PropertyTemplateEditorCard({
  template,
  icon: Icon,
  onSave,
  onReset,
  onDelete,
  saving,
  showSectionImage = true,
  canEdit = true,
}: Props) {
  const [content, setContent] = React.useState(template.content);
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

  React.useEffect(() => {
    let next = normalizeBlockLevelPlaceholdersInHtml(template.content);
    if (template.category === 'email') {
      next = normalizeEmailCalloutPlaceholders(next, template.templateKey, {
        ensureMissing: true,
      });
    }
    setContent(next);
    setSectionImageUrl(template.sectionImageUrl);
    setSectionImagePreviewBust(template.updatedAt ? Date.parse(template.updatedAt) || 0 : 0);
  }, [
    template.content,
    template.templateKey,
    template.category,
    template.sectionImageUrl,
    template.updatedAt,
  ]);

  const handleSectionImageUrlChange = React.useCallback((url: string | null) => {
    setSectionImageUrl(url);
    setSectionImagePreviewBust(url ? Date.now() : 0);
  }, []);

  const sectionImageDisplayUrl = sectionImageUrl
    ? withStorageUrlCacheBust(sectionImageUrl, sectionImagePreviewBust || null)
    : null;

  const hasChanges = content !== template.content || sectionImageUrl !== template.sectionImageUrl;
  const isEmail = template.category === 'email';
  const isCustom = template.category === 'custom';
  const isStandard = template.category === 'standard';
  /** Email + custom saves need Starter+; standard templates are free. */
  const requiresStarterToPersist = isEmail || isCustom;
  const allowSectionImage = isStandard && showSectionImage;
  const uploadTemplateAsset = useUploadPropertyTemplateAsset();

  const openStarterUpgradeIfNeeded = React.useCallback((): boolean => {
    if (!requiresStarterToPersist || canUseCustomTemplates) return false;
    if (!customTemplatesLoading) openUpgradeModal('customTemplates');
    return true;
  }, [canUseCustomTemplates, customTemplatesLoading, openUpgradeModal, requiresStarterToPersist]);

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
    <Card id={`section-${template.templateKey}`} className="overflow-hidden">
      <CardHeader className="bg-muted/30 border-b pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              isEmail ? 'bg-blue-500/10' : 'bg-primary/10'
            )}
          >
            <Icon className={cn('h-5 w-5', isEmail ? 'text-blue-600' : 'text-primary')} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{template.name}</CardTitle>
              {isEmail || isCustom ? <TierBadge feature="customTemplates" /> : null}
              {hasChanges ? (
                <span className="inline-flex items-center rounded-md border border-amber-500/50 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  Unsaved
                </span>
              ) : null}
            </div>
            <CardDescription>
              {template.description ?? (isCustom ? 'Custom template for your property.' : null)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="flex flex-nowrap items-center justify-between gap-1.5 border-b px-2.5 py-1.5 sm:gap-2 sm:px-4 sm:py-2">
          <SegmentedControl
            value={activeTab}
            onChange={handleTabChange}
            options={EDITOR_VIEW_OPTIONS}
            size="dense"
            aria-label={`${template.name} view`}
            listClassName={cn(cardHeaderSegmentedListClassName, 'shrink-0')}
            triggerClassName={cn(cardHeaderSegmentedTriggerClassName, 'px-2 sm:px-2.5')}
          />
          <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1 sm:gap-1.5">
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
                {isCustom && !hasChanges ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className={editorChromeActionClassName}
                    onClick={() => setSendOpen(true)}
                    aria-label="Send to guest"
                    title="Send to guest"
                  >
                    <Send className="size-3.5 shrink-0" aria-hidden />
                    <span className="hidden text-xs font-semibold sm:inline">Send</span>
                  </Button>
                ) : null}
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
                {isCustom && onDelete ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className={cn(
                      editorChromeActionClassName,
                      'border-destructive/40 text-destructive hover:bg-destructive/10'
                    )}
                    onClick={() => setDeleteOpen(true)}
                    aria-label="Delete"
                    title="Delete"
                  >
                    <Trash2 className="size-3.5 shrink-0" aria-hidden />
                    <span className="hidden text-xs font-semibold sm:inline">Delete</span>
                  </Button>
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

        <div className="p-3 sm:p-4">
          <div className="rounded-lg">
            {activeTab === 'preview' ? (
              isEmail ? (
                previewPending || !previewHtml ? (
                  <div className="bg-muted/20 text-muted-foreground flex min-h-[280px] items-center justify-center rounded-lg border text-sm">
                    Loading preview…
                  </div>
                ) : (
                  <div className="bg-muted/20 overflow-x-auto rounded-lg border">
                    <iframe
                      ref={previewIframeRef}
                      title={`${template.name} preview`}
                      srcDoc={previewHtml}
                      className="h-[min(70dvh,640px)] w-full min-w-[320px] border-0 bg-white"
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
                  minHeight="280px"
                  validPlaceholderKeys={validPlaceholderKeys}
                  onImageUpload={isStandard ? handleInlineImageUpload : undefined}
                />
              </>
            )}
          </div>
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
      </CardContent>

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
    </Card>
  );
}
