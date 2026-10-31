import { describe, expect, it } from 'vitest';

import {
  canvasClosedHref,
  canvasOpenSearch,
  hrefWithChat,
  isCanvasOpen,
  parseAssistantScope,
  resolveScopedDashboardHref,
  withChatParam,
} from '@/features/dashboard/ai-assistant/lib/assistantScope';

describe('parseAssistantScope', () => {
  it('parses org, property and parking scopes', () => {
    expect(parseAssistantScope('/org/acme/bookings')).toEqual({
      kind: 'org',
      orgSlug: 'acme',
      rootPath: '/org/acme/dashboard',
    });
    expect(parseAssistantScope('/org/acme/property/loft/bookings/123')).toEqual({
      kind: 'property',
      orgSlug: 'acme',
      slug: 'loft',
      rootPath: '/org/acme/property/loft',
    });
    expect(parseAssistantScope('/org/acme/parking/p1')).toEqual({
      kind: 'parking',
      orgSlug: 'acme',
      slug: 'p1',
      rootPath: '/org/acme/parking/p1',
    });
  });

  it('returns null outside org routes', () => {
    expect(parseAssistantScope('/admin/orgs')).toBeNull();
    expect(parseAssistantScope('/')).toBeNull();
  });
});

describe('canvas + chat params', () => {
  it('canvas is open unless canvas=off', () => {
    expect(isCanvasOpen('')).toBe(true);
    expect(isCanvasOpen('?chat=abc')).toBe(true);
    expect(isCanvasOpen('?canvas=off')).toBe(false);
  });

  it('close goes to the scope root and keeps the chat', () => {
    expect(canvasClosedHref('/org/acme/property/loft/finance', 'c1')).toBe(
      '/org/acme/property/loft?chat=c1&canvas=off'
    );
    expect(canvasClosedHref('/org/acme/team', null)).toBe('/org/acme/dashboard?canvas=off');
  });

  it('reopening drops only the canvas param', () => {
    expect(canvasOpenSearch('?chat=c1&canvas=off&tab=x')).toBe('?chat=c1&tab=x');
    expect(canvasOpenSearch('?canvas=off')).toBe('');
  });

  it('withChatParam sets and clears the chat id', () => {
    expect(withChatParam('?tab=x', 'c1')).toBe('?tab=x&chat=c1');
    expect(withChatParam('?chat=c1', null)).toBe('');
  });

  it('hrefWithChat carries the conversation into in-app links', () => {
    expect(hrefWithChat('/org/a/property/b/finance?tab=expenses', 'c1')).toBe(
      '/org/a/property/b/finance?tab=expenses&chat=c1'
    );
    expect(hrefWithChat('/org/a/team#roles', 'c1')).toBe('/org/a/team?chat=c1#roles');
    expect(hrefWithChat('https://example.com', 'c1')).toBe('https://example.com');
    expect(hrefWithChat('/org/a/team', null)).toBe('/org/a/team');
  });
});

describe('resolveScopedDashboardHref', () => {
  it('rewrites flat attention hrefs under the current scope', () => {
    expect(
      resolveScopedDashboardHref('/bookings?status=PENDING_REVIEW', '/org/a/property/loft/finance')
    ).toBe('/org/a/property/loft/bookings?status=PENDING_REVIEW');
    expect(resolveScopedDashboardHref('/finance?from=x', '/org/a/parking/p1')).toBe(
      '/org/a/parking/p1/finance?from=x'
    );
    expect(resolveScopedDashboardHref('/bookings', '/org/a/dashboard')).toBe('/org/a/bookings');
  });

  it('leaves absolute and unknown paths alone', () => {
    expect(resolveScopedDashboardHref('/org/a/team', '/org/a/dashboard')).toBe('/org/a/team');
    expect(resolveScopedDashboardHref('/weird', '/org/a/dashboard')).toBe('/weird');
    expect(resolveScopedDashboardHref('/bookings', '/admin')).toBe('/bookings');
  });
});
