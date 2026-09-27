import { describe, expect, it } from 'vitest';

import {
  normalizePropertyTemplateEditorContent,
  propertyTemplateEditorHasChanges,
} from '@/features/dashboard/bookings/lib/normalizePropertyTemplateEditorContent';

describe('normalizePropertyTemplateEditorContent', () => {
  it('inserts missing email callouts so baseline differs from raw stored HTML', () => {
    const template = {
      content: '<p>Good day,</p><p>Body</p>',
      category: 'email',
      templateKey: 'email-gaf-request',
    };
    const normalized = normalizePropertyTemplateEditorContent(template);
    expect(normalized).toContain('{{urgent_notice}}');
    expect(normalized).toContain('{{update_notice}}');
    expect(normalized).not.toBe(template.content);
  });

  it('does not mark dirty when draft matches the normalized baseline', () => {
    const template = {
      content: '<p>Good day,</p><p>Body</p>',
      category: 'email',
      templateKey: 'email-gaf-request',
      sectionImageUrl: null,
    };
    const content = normalizePropertyTemplateEditorContent(template);
    expect(
      propertyTemplateEditorHasChanges({
        content,
        sectionImageUrl: null,
        template,
      })
    ).toBe(false);
  });

  it('marks dirty when comparing draft to raw stored content without normalize', () => {
    const template = {
      content: '<p>Good day,</p><p>Body</p>',
      category: 'email',
      templateKey: 'email-gaf-request',
      sectionImageUrl: null,
    };
    // Simulates the old bug: draft was normalized on load, baseline was raw.
    const content = normalizePropertyTemplateEditorContent(template);
    expect(content !== template.content).toBe(true);
  });

  it('marks dirty only after a real content edit', () => {
    const template = {
      content: '<p>House rules</p>',
      category: 'standard',
      templateKey: 'house-rules',
      sectionImageUrl: null,
    };
    const baseline = normalizePropertyTemplateEditorContent(template);
    expect(
      propertyTemplateEditorHasChanges({
        content: baseline,
        sectionImageUrl: null,
        template,
      })
    ).toBe(false);
    expect(
      propertyTemplateEditorHasChanges({
        content: '<p>Edited</p>',
        sectionImageUrl: null,
        template,
      })
    ).toBe(true);
  });
});
