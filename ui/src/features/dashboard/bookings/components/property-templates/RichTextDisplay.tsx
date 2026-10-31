/**
 * Read-only rich text renderer for property templates. Kept separate from the
 * TipTap editor so chat surfaces (guest included) can render template bodies
 * without pulling the editor bundle.
 */

import { sanitizeRichTextHtml } from '@/lib/sanitizeHtml';
import { cn } from '@/lib/utils';

import {
  TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS,
  highlightPlaceholdersInHtml,
} from '@/features/dashboard/bookings/lib/templatePlaceholderHighlight';

export const PROPERTY_TEMPLATE_RICH_TEXT_CLASS = 'property-template-rich-text';

export const richTextStyles = `
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
