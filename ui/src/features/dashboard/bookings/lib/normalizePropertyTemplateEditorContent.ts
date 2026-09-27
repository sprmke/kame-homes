import { normalizeBlockLevelPlaceholdersInHtml } from '@/features/dashboard/bookings/lib/normalizeBlockLevelPlaceholders';
import { normalizeEmailCalloutPlaceholders } from '@/features/dashboard/bookings/lib/normalizeEmailCalloutPlaceholders';

type TemplateLike = {
  content: string;
  category: string;
  templateKey: string;
};

/**
 * Editor load path: split block-level tokens, and for email templates move /
 * insert callout placeholders so the WYSIWYG matches send/preview.
 *
 * Dirty checks must compare draft content against this string, not raw
 * `template.content` — otherwise load-time normalize always looks unsaved.
 */
export function normalizePropertyTemplateEditorContent(template: TemplateLike): string {
  let next = normalizeBlockLevelPlaceholdersInHtml(template.content);
  if (template.category === 'email') {
    next = normalizeEmailCalloutPlaceholders(next, template.templateKey, {
      ensureMissing: true,
    });
  }
  return next;
}

export function propertyTemplateEditorHasChanges(input: {
  content: string;
  sectionImageUrl: string | null;
  template: TemplateLike & { sectionImageUrl: string | null };
}): boolean {
  const baseline = normalizePropertyTemplateEditorContent(input.template);
  return input.content !== baseline || input.sectionImageUrl !== input.template.sectionImageUrl;
}
