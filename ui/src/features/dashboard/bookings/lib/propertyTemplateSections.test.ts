import { describe, expect, it } from 'vitest';

import { iconForTemplateKey } from '@/features/dashboard/bookings/lib/propertyTemplateSections';

describe('iconForTemplateKey', () => {

  it('iconForTemplateKey is exported', () => {
    expect(typeof iconForTemplateKey).toBe('function');
  });

});
