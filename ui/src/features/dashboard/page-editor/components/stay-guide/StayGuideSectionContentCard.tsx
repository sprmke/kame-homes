import { useCallback, useMemo, useRef, useState } from 'react';

import { Braces, ChevronDown, RotateCcw } from 'lucide-react';

import { extractLeadingSectionHeading } from '@/features/guest/stay-guide/lib/stayGuideContent';

import { PropertyTemplatePlaceholdersDialog } from '@/features/dashboard/bookings/components/property-templates/PropertyTemplatePlaceholdersDialog';
import {
  RichTextEditor,
  richTextChromeIconButtonClassName,
  type RichTextEditorHandle,
} from '@/features/dashboard/bookings/components/property-templates/RichTextEditor';
import { TemplateSectionImageField } from '@/features/dashboard/bookings/components/property-templates/TemplateSectionImageField';
import type { PropertyTemplateDto } from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import { useUploadPropertyTemplateAsset } from '@/features/dashboard/bookings/hooks/useUploadPropertyTemplateAsset';
import { normalizeBlockLevelPlaceholdersInHtml } from '@/features/dashboard/bookings/lib/normalizeBlockLevelPlaceholders';
import {
  applyPropertyTemplatePlaceholders,
  PROPERTY_TEMPLATE_SAMPLE_VARS,
} from '@/features/dashboard/bookings/lib/propertyTemplatePlaceholders';
import { buildValidPlaceholderKeySet } from '@/features/dashboard/bookings/lib/telegramPlaceholderGroups';
import { propertyPlaceholderLinesForTemplate } from '@/features/dashboard/bookings/lib/templatePlaceholderCatalog';
import { useRevealPreviewOnOpen } from '@/features/dashboard/page-editor/lib/pageEditorPreviewScroll';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type StayGuideSectionDraft = {
  content: string;
  sectionImageUrl: string | null;
  imageBust: number;
};

type Props = {
  template: PropertyTemplateDto;
  draft: StayGuideSectionDraft;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (next: StayGuideSectionDraft) => void;
  onResetToDefault: () => void;
  disabled?: boolean;
  /** When this card opens, scroll the live preview to this anchor. */
  previewAnchor?: string | null;
};

/** Compact accordion card: section image + WYSIWYG for Stay Guide Page Editor. */
export function StayGuideSectionContentCard({
  template,
  draft,
  open,
  onOpenChange,
  onDraftChange,
  onResetToDefault,
  disabled,
  previewAnchor,
}: Props) {
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [placeholdersOpen, setPlaceholdersOpen] = useState(false);
  const uploadTemplateAsset = useUploadPropertyTemplateAsset();
  useRevealPreviewOnOpen(open, previewAnchor ?? template.templateKey);

  const placeholderLines = useMemo(
    () => propertyPlaceholderLinesForTemplate(template.templateKey, 'standard'),
    [template.templateKey]
  );
  const validPlaceholderKeys = useMemo(
    () => buildValidPlaceholderKeySet(placeholderLines),
    [placeholderLines]
  );

  const previewHeading = useMemo(() => {
    const filled = applyPropertyTemplatePlaceholders(draft.content);
    const { heading } = extractLeadingSectionHeading(filled);
    return heading || template.name;
  }, [draft.content, template.name]);

  const handleInlineImageUpload = useCallback(
    async (file: File) => {
      const result = await uploadTemplateAsset.mutateAsync({
        assetType: 'inline_image',
        file,
      });
      return result.url;
    },
    [uploadTemplateAsset]
  );

  const handleInsertPlaceholder = useCallback((token: string) => {
    window.setTimeout(() => {
      editorRef.current?.insertToken(token);
    }, 0);
  }, []);

  const showPreviewHeading =
    previewHeading.trim().toLowerCase() !== template.name.trim().toLowerCase();

  return (
    <div className="border-border bg-background overflow-hidden rounded-lg border">
      <button
        type="button"
        className="hover:bg-muted/40 flex min-h-[44px] w-full items-center gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
          {template.name}
        </span>
        {showPreviewHeading ? (
          <span className="text-muted-foreground hidden max-w-[40%] truncate text-xs sm:inline">
            {previewHeading}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-border space-y-3 border-t px-3 py-3">
          <TemplateSectionImageField
            templateKey={template.templateKey}
            imageUrl={draft.sectionImageUrl}
            previewBust={draft.imageBust}
            disabled={disabled}
            onImageUrlChange={(url) =>
              onDraftChange({
                ...draft,
                sectionImageUrl: url,
                imageBust: url ? Date.now() : 0,
              })
            }
          />

          <div className="flex flex-wrap items-center justify-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className={cn(
                richTextChromeIconButtonClassName,
                'border-input bg-card hover:bg-accent sm:h-8 sm:w-auto sm:gap-1.5 sm:px-2.5'
              )}
              disabled={disabled}
              onClick={() => setPlaceholdersOpen(true)}
              aria-label="Placeholders"
            >
              <Braces className="size-3.5 shrink-0" aria-hidden />
              <span className="hidden text-xs font-semibold sm:inline">Placeholders</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className={cn(
                richTextChromeIconButtonClassName,
                'border-input bg-card hover:bg-accent sm:h-8 sm:w-auto sm:gap-1.5 sm:px-2.5'
              )}
              disabled={disabled}
              onClick={onResetToDefault}
              aria-label="Reset"
            >
              <RotateCcw className="size-3.5 shrink-0" aria-hidden />
              <span className="hidden text-xs font-semibold sm:inline">Reset</span>
            </Button>
          </div>

          <RichTextEditor
            ref={editorRef}
            content={draft.content}
            onChange={(content) => onDraftChange({ ...draft, content })}
            minHeight="200px"
            validPlaceholderKeys={validPlaceholderKeys}
            onImageUpload={handleInlineImageUpload}
          />

          <PropertyTemplatePlaceholdersDialog
            open={placeholdersOpen}
            onOpenChange={setPlaceholdersOpen}
            lines={placeholderLines}
            sampleVars={PROPERTY_TEMPLATE_SAMPLE_VARS}
            onInsertToken={handleInsertPlaceholder}
          />
        </div>
      ) : null}
    </div>
  );
}

export function draftFromTemplate(template: PropertyTemplateDto): StayGuideSectionDraft {
  return {
    content: normalizeBlockLevelPlaceholdersInHtml(template.content),
    sectionImageUrl: template.sectionImageUrl,
    imageBust: template.updatedAt ? Date.parse(template.updatedAt) || 0 : 0,
  };
}

export function isStayGuideSectionDraftDirty(
  draft: StayGuideSectionDraft,
  template: PropertyTemplateDto
): boolean {
  const baseline = normalizeBlockLevelPlaceholdersInHtml(template.content);
  return (
    draft.content !== baseline ||
    (draft.sectionImageUrl ?? null) !== (template.sectionImageUrl ?? null)
  );
}
