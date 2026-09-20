import { useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';

import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { NodeSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo,
  Unlink,
} from 'lucide-react';

import {
  isBlockLevelPropertyPlaceholder,
  placeholderTokenForKey,
} from '@/features/dashboard/bookings/lib/templatePlaceholderCatalog';
import {
  TemplatePlaceholderHighlight,
  TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS,
  highlightPlaceholdersInHtml,
} from '@/features/dashboard/bookings/lib/templatePlaceholderHighlight';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { sanitizeRichTextHtml } from '@/lib/sanitizeHtml';
import { cn } from '@/lib/utils';

export const PROPERTY_TEMPLATE_RICH_TEXT_CLASS = 'property-template-rich-text';

/** Compact icon control for editor chrome / TipTap toolbar (32px visual, expanded phone hit). */
export const richTextChromeIconButtonClassName =
  'relative size-8 shrink-0 rounded-md before:absolute before:-inset-1.5 before:content-[""] sm:before:content-none';

const richTextStyles = `
  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} {
    min-height: var(--editor-min-height, auto);
    font-size: 0.875rem;
    line-height: 1.55;
    color: hsl(var(--foreground));
    background-color: hsl(var(--card));
  }

  @media (min-width: 640px) {
    .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} {
      font-size: 0.9375rem;
      line-height: 1.65;
    }
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS}:focus {
    outline: none;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} > * + * {
    margin-top: 0.65em;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} h1 {
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1.25;
    margin-top: 1rem;
    margin-bottom: 0.4rem;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} h2 {
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.3;
    margin-top: 0.9rem;
    margin-bottom: 0.35rem;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} h3 {
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.35;
    margin-top: 0.75rem;
    margin-bottom: 0.35rem;
  }

  @media (min-width: 640px) {
    .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} h1 {
      font-size: 1.5rem;
      line-height: 1.2;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} h2 {
      font-size: 1.25rem;
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
    }

    .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} h3 {
      font-size: 1.125rem;
      margin-top: 1rem;
      margin-bottom: 0.5rem;
    }
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} p {
    margin-bottom: 0.45rem;
    line-height: 1.55;
  }

  @media (min-width: 640px) {
    .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} p {
      margin-bottom: 0.5rem;
      line-height: 1.65;
    }
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} ul {
    list-style-type: disc;
    padding-left: 1.25rem;
    margin: 0.4rem 0;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} ol {
    list-style-type: decimal;
    padding-left: 1.25rem;
    margin: 0.4rem 0;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} li {
    display: list-item;
    margin: 0.15rem 0;
    line-height: 1.55;
  }

  @media (min-width: 640px) {
    .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} ul,
    .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} ol {
      padding-left: 1.5rem;
      margin: 0.5rem 0;
    }

    .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} li {
      margin: 0.25rem 0;
      line-height: 1.65;
    }
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} li p {
    margin: 0;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} ul ul,
  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} ol ol,
  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} ul ol,
  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} ol ul {
    margin: 0.25rem 0;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} ul ul {
    list-style-type: circle;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} ul ul ul {
    list-style-type: square;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} blockquote {
    border-left: 2px solid hsl(var(--border));
    padding-left: 0.875rem;
    margin: 0.75rem 0;
    font-style: italic;
    color: hsl(var(--muted-foreground));
  }

  @media (min-width: 640px) {
    .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} blockquote {
      padding-left: 1rem;
      margin: 1rem 0;
    }
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} strong {
    font-weight: 600;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} em {
    font-style: italic;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} a {
    color: hsl(var(--primary));
    text-decoration: underline;
    text-underline-offset: 4px;
    cursor: pointer;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} img {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
    margin: 0.75rem 0;
  }

  @media (min-width: 640px) {
    .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} img {
      margin: 1rem 0;
    }
  }

  .property-template-editor [data-resize-container] {
    display: inline-flex !important;
    width: fit-content;
    max-width: 100%;
    margin: 0.75rem 0;
    vertical-align: top;
  }

  @media (min-width: 640px) {
    .property-template-editor [data-resize-container] {
      margin: 1rem 0;
    }
  }

  .property-template-editor [data-resize-container].ProseMirror-selectednode,
  .property-template-editor [data-resize-container][data-resize-state='true'] {
    outline: none;
  }

  .property-template-editor [data-resize-wrapper] {
    position: relative;
    line-height: 0;
    max-width: 100%;
    border-radius: 0.5rem;
  }

  .property-template-editor [data-resize-wrapper] img {
    display: block;
    max-width: 100%;
    margin: 0;
    border-radius: 0.5rem;
    cursor: pointer;
  }

  .property-template-editor [data-resize-container].ProseMirror-selectednode [data-resize-wrapper],
  .property-template-editor [data-resize-container][data-resize-state='true'] [data-resize-wrapper] {
    box-shadow: 0 0 0 2px hsl(var(--primary));
  }

  .property-template-editor [data-resize-container].ProseMirror-selectednode [data-resize-wrapper] img,
  .property-template-editor [data-resize-container][data-resize-state='true'] [data-resize-wrapper] img {
    cursor: default;
  }

  .property-template-editor [data-resize-handle] {
    position: absolute;
    z-index: 5;
    opacity: 0;
    pointer-events: none;
    touch-action: none;
    transition: opacity 0.12s ease;
  }

  .property-template-editor [data-resize-container].ProseMirror-selectednode [data-resize-handle],
  .property-template-editor [data-resize-container][data-resize-state='true'] [data-resize-handle] {
    opacity: 1;
    pointer-events: auto;
  }

  .property-template-editor [data-resize-handle='bottom-right'] {
    right: -5px;
    bottom: -5px;
    width: 12px;
    height: 12px;
    border-radius: 9999px;
    background: hsl(var(--primary));
    border: 2px solid hsl(var(--background));
    box-shadow: 0 1px 4px hsl(240 6% 10% / 0.18);
    cursor: nwse-resize;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} code {
    background-color: hsl(var(--muted));
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.875em;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} hr {
    border: none;
    border-top: 1px solid hsl(var(--border));
    margin: 1.5rem 0;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin: 1rem 0;
    font-size: 0.875rem;
    border: 1px solid hsl(var(--border));
    border-radius: 0.75rem;
    overflow: hidden;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} table td,
  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} table th {
    padding: 0.625rem 0.875rem;
    border-bottom: 1px solid hsl(var(--border));
    vertical-align: top;
    line-height: 1.55;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} table tr:last-child td,
  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} table tr:last-child th {
    border-bottom: none;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} .section-label {
    margin: 1.25rem 0 0.5rem;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: hsl(var(--primary));
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} .cta-btn,
  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} a.cta-btn {
    display: inline-block;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    font-weight: 600;
    text-decoration: none;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} .${TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS} {
    border-radius: 0.125rem;
    background-color: hsl(var(--primary) / 0.15);
    color: hsl(var(--primary));
    font-weight: 500;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} strong .${TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS} {
    font-weight: 500;
  }

  .${PROPERTY_TEMPLATE_RICH_TEXT_CLASS} p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: hsl(var(--muted-foreground));
    pointer-events: none;
    height: 0;
  }
`;

const TEMPLATE_IMAGE_MAX_WIDTH = 560;

function insertTemplateImage(editor: Editor, url: string) {
  const img = new window.Image();
  img.onload = () => {
    const naturalWidth = img.naturalWidth || TEMPLATE_IMAGE_MAX_WIDTH;
    const naturalHeight = img.naturalHeight || TEMPLATE_IMAGE_MAX_WIDTH;
    const width = Math.min(naturalWidth, TEMPLATE_IMAGE_MAX_WIDTH);
    const height = Math.max(80, Math.round((naturalHeight / naturalWidth) * width));
    editor.chain().focus().setImage({ src: url, width, height }).run();
  };
  img.onerror = () => {
    editor
      .chain()
      .focus()
      .setImage({
        src: url,
        width: TEMPLATE_IMAGE_MAX_WIDTH,
        height: TEMPLATE_IMAGE_MAX_WIDTH,
      })
      .run();
  };
  img.src = url;
}

type RichTextEditorProps = {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  minHeight?: string;
  onImageUpload?: (file: File) => Promise<string>;
  /** When set, only matching {{tokens}} are highlighted in edit mode. */
  validPlaceholderKeys?: ReadonlySet<string>;
};

export type RichTextEditorHandle = {
  insertToken: (token: string) => void;
};

function ToolbarSeparator() {
  return <div className="bg-border mx-0.5 hidden h-4 w-px shrink-0 sm:block" aria-hidden />;
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(richTextChromeIconButtonClassName, isActive && 'bg-primary/10 text-primary')}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}

function ToolbarPopoverContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <PopoverContent
      align="start"
      sideOffset={8}
      className={cn('w-[min(calc(100vw-24px),22rem)] p-4', className)}
    >
      {children}
    </PopoverContent>
  );
}

function LinkPopover({ editor }: { editor: Editor }) {
  const setLink = useCallback(
    (url: string) => {
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        return;
      }

      const formattedUrl =
        url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;

      editor.chain().focus().extendMarkRange('link').setLink({ href: formattedUrl }).run();
    },
    [editor]
  );

  const currentLink = editor.getAttributes('link').href || '';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            richTextChromeIconButtonClassName,
            editor.isActive('link') && 'bg-primary/10 text-primary'
          )}
          aria-label="Link"
          title="Link"
        >
          <LinkIcon className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <ToolbarPopoverContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-link-url">URL</Label>
            <Input
              id="template-link-url"
              placeholder="https://example.com"
              defaultValue={currentLink}
              className="h-10"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setLink((event.target as HTMLInputElement).value);
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="sm"
              className="min-h-[44px] flex-1"
              onClick={(event) => {
                const input = (event.currentTarget.closest('.space-y-4')?.querySelector('input') ??
                  null) as HTMLInputElement | null;
                setLink(input?.value ?? '');
              }}
            >
              Apply
            </Button>
            {editor.isActive('link') ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] flex-1"
                onClick={() => editor.chain().focus().unsetLink().run()}
              >
                <Unlink className="mr-1.5 h-4 w-4" aria-hidden />
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </ToolbarPopoverContent>
    </Popover>
  );
}

function ImagePopover({
  editor,
  onImageUpload,
}: {
  editor: Editor;
  onImageUpload?: (file: File) => Promise<string>;
}) {
  const addImage = useCallback(
    (url: string) => {
      if (url) {
        insertTemplateImage(editor, url);
      }
    },
    [editor]
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (onImageUpload) {
        try {
          const url = await onImageUpload(file);
          addImage(url);
        } catch {
          return;
        }
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          addImage(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    },
    [addImage, onImageUpload]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={richTextChromeIconButtonClassName}
          aria-label="Image"
          title="Image"
        >
          <ImageIcon className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <ToolbarPopoverContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-image-file">Upload</Label>
            <Input
              id="template-image-file"
              type="file"
              accept="image/*"
              className="file:bg-muted h-10 cursor-pointer pb-10 file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium"
              onChange={handleFileChange}
            />
          </div>
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="border-border w-full border-t" />
            </div>
            <div className="relative flex justify-center text-[11px] font-medium uppercase tracking-wide">
              <span className="bg-popover text-muted-foreground px-3">Or</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="template-image-url">Image URL</Label>
              <Input
                id="template-image-url"
                placeholder="https://example.com/image.jpg"
                className="h-10"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    addImage((event.target as HTMLInputElement).value);
                  }
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="min-h-[44px] w-full"
              onClick={(event) => {
                const input = (event.currentTarget
                  .closest('.space-y-4')
                  ?.querySelector('#template-image-url') ?? null) as HTMLInputElement | null;
                addImage(input?.value ?? '');
              }}
            >
              Add image
            </Button>
          </div>
        </div>
      </ToolbarPopoverContent>
    </Popover>
  );
}

function Toolbar({
  editor,
  onImageUpload,
}: {
  editor: Editor;
  onImageUpload?: (file: File) => Promise<string>;
}) {
  return (
    <div className="border-border bg-card flex flex-wrap items-center gap-0 overflow-x-auto border-b px-1 py-0.5 sm:gap-0.5 sm:px-1.5 sm:py-1">
      <ToolbarButton
        label="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
      >
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
      >
        <Italic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
      >
        <UnderlineIcon className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
      >
        <Strikethrough className="size-3.5" />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        label="Paragraph"
        onClick={() => editor.chain().focus().setParagraph().run()}
        isActive={editor.isActive('paragraph')}
      >
        <Pilcrow className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
      >
        <Heading1 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
      >
        <Heading2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
      >
        <Heading3 className="size-3.5" />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        label="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
      >
        <List className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
      >
        <ListOrdered className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
      >
        <Quote className="size-3.5" />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        label="Align left"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
      >
        <AlignLeft className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Align center"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
      >
        <AlignCenter className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Align right"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
      >
        <AlignRight className="size-3.5" />
      </ToolbarButton>

      <ToolbarSeparator />

      <LinkPopover editor={editor} />
      <ImagePopover editor={editor} onImageUpload={onImageUpload} />

      <div className="hidden min-w-2 flex-1 sm:block" />

      <ToolbarButton
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo className="size-3.5" />
      </ToolbarButton>
    </div>
  );
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor(
    {
      content,
      onChange,
      placeholder = 'Enter content…',
      className,
      editable = true,
      minHeight = '280px',
      onImageUpload,
      validPlaceholderKeys,
    },
    ref
  ) {
    const editor = useEditor(
      {
        extensions: [
          StarterKit.configure({
            heading: { levels: [1, 2, 3] },
            bulletList: { keepMarks: true, keepAttributes: false },
            orderedList: { keepMarks: true, keepAttributes: false },
            link: { openOnClick: false },
          }),
          Placeholder.configure({
            placeholder,
            emptyEditorClass: 'is-editor-empty',
          }),
          TemplatePlaceholderHighlight.configure({
            validKeys: validPlaceholderKeys,
          }),
          Image.configure({
            inline: false,
            allowBase64: true,
            resize: {
              enabled: true,
              directions: ['bottom-right'],
              minWidth: 80,
              minHeight: 80,
              alwaysPreserveAspectRatio: true,
            },
          }),
          TextAlign.configure({ types: ['heading', 'paragraph'] }),
        ],
        content,
        editable,
        immediatelyRender: false,
        onUpdate: ({ editor: ed }) => {
          onChange(ed.getHTML());
        },
        editorProps: {
          attributes: {
            class: cn(PROPERTY_TEMPLATE_RICH_TEXT_CLASS, 'px-3 py-2.5 sm:px-4 sm:py-3'),
            style: `--editor-min-height: ${minHeight}`,
          },
          handleClickOn(view, _pos, node, nodePos) {
            if (node.type.name === 'image') {
              view.dispatch(
                view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos))
              );
              return true;
            }
            return false;
          },
        },
      },
      [placeholder, validPlaceholderKeys]
    );

    useEffect(() => {
      if (!editor) return;
      if (editor.getHTML() !== content) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    }, [content, editor]);

    useImperativeHandle(
      ref,
      () => ({
        insertToken: (token: string) => {
          if (!editor) return;
          const keyMatch = token.match(/^\{\{(\w+)\}\}$/);
          const key = keyMatch?.[1] ?? '';
          if (key && isBlockLevelPropertyPlaceholder(key)) {
            editor
              .chain()
              .focus()
              .insertContent(`<p>${placeholderTokenForKey(key)}</p>`)
              .run();
            return;
          }
          editor.chain().focus().insertContent(token).run();
        },
      }),
      [editor]
    );

    if (!editor) return null;

    return (
      <>
        <style>{richTextStyles}</style>
        <div
          className={cn(
            'border-border bg-card rounded-lg border',
            !editable && 'opacity-60',
            className
          )}
        >
          {editable ? <Toolbar editor={editor} onImageUpload={onImageUpload} /> : null}
          <div className="property-template-editor bg-card min-w-0 overflow-x-auto">
            <EditorContent editor={editor} />
          </div>
        </div>
      </>
    );
  }
);

export function RichTextDisplay({
  content,
  className,
  validPlaceholderKeys,
}: {
  content: string;
  className?: string;
  validPlaceholderKeys?: ReadonlySet<string>;
}) {
  const html = highlightPlaceholdersInHtml(content, validPlaceholderKeys);
  return (
    <>
      <style>{richTextStyles}</style>
      <div
        className={cn(PROPERTY_TEMPLATE_RICH_TEXT_CLASS, 'px-3 py-2.5 sm:px-4 sm:py-3', className)}
        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(html) }}
      />
    </>
  );
}
