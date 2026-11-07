import { describe, expect, it } from 'vitest';

import { filterOrgProperties } from '@/features/dashboard/org/lib/orgPropertiesFilters';
import {
  lifecyclePresentation,
  resolvePropertyLifecycleState,
  stateHasPublicPage,
} from '@/features/dashboard/org/lib/propertyLifecycle';
import type { Property } from '@/features/dashboard/org/types';

function property(overrides: Partial<Property>): Property {
  return {
    id: 'property-1',
    organizationId: 'org-1',
    name: 'Azure 2604',
    slug: 'azure-2604',
    type: 'CONDO',
    status: 'ACTIVE',
    address: null,
    towerAndUnit: null,
    tower: null,
    unitNumber: null,
    residenceName: null,
    maxGuests: 4,
    settings: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('property lifecycle display', () => {
  it('maps every reason to a host-facing state', () => {
    expect(resolvePropertyLifecycleState({ status: 'ACTIVE', inactiveReason: null })).toBe('live');
    expect(resolvePropertyLifecycleState({ status: 'INACTIVE', inactiveReason: 'paused' })).toBe(
      'paused'
    );
    expect(
      resolvePropertyLifecycleState({ status: 'INACTIVE', inactiveReason: 'pending_verification' })
    ).toBe('pending_verification');
    expect(
      resolvePropertyLifecycleState({ status: 'INACTIVE', inactiveReason: 'contract_lapsed' })
    ).toBe('suspended');
    expect(resolvePropertyLifecycleState({ status: 'INACTIVE', inactiveReason: 'archived' })).toBe(
      'archived'
    );
    expect(resolvePropertyLifecycleState({ status: 'INACTIVE', inactiveReason: null })).toBe(
      'archived'
    );
  });

  it('labels each state without exposing internal reason values', () => {
    expect(lifecyclePresentation('live').label).toBe('Live');
    expect(lifecyclePresentation('paused').label).toBe('Paused');
    expect(lifecyclePresentation('suspended').label).toBe('Suspended');
    expect(lifecyclePresentation('archived').label).toBe('Archived');
    expect(lifecyclePresentation('pending_verification').label).toBe('Pending verification');
  });

  it('keeps a public page only for live and paused', () => {
    expect(stateHasPublicPage('live')).toBe(true);
    expect(stateHasPublicPage('paused')).toBe(true);
    expect(stateHasPublicPage('suspended')).toBe(false);
    expect(stateHasPublicPage('archived')).toBe(false);
    expect(stateHasPublicPage('pending_verification')).toBe(false);
  });
});

describe('org property list filters', () => {
  const live = property({ id: 'live', name: 'Live unit' });
  const paused = property({
    id: 'paused',
    name: 'Paused unit',
    inactiveReason: 'paused',
    status: 'INACTIVE',
  });
  const archived = property({
    id: 'archived',
    name: 'Archived unit',
    inactiveReason: 'archived',
    status: 'INACTIVE',
  });

  it('hides archived listings from "All status"', () => {
    const result = filterOrgProperties([live, paused, archived], {
      search: '',
      status: 'all',
      type: 'all',
    });
    expect(result.map((entry) => entry.id)).toEqual(['live', 'paused']);
  });

  it('shows archived listings when the filter asks for them', () => {
    const result = filterOrgProperties([live, paused, archived], {
      search: '',
      status: 'archived',
      type: 'all',
    });
    expect(result.map((entry) => entry.id)).toEqual(['archived']);
  });

  it('filters by lifecycle state, not raw status', () => {
    const suspended = property({
      id: 'suspended',
      inactiveReason: 'consideration_denied',
      status: 'INACTIVE',
    });
    const result = filterOrgProperties([live, paused, suspended], {
      search: '',
      status: 'suspended',
      type: 'all',
    });
    expect(result.map((entry) => entry.id)).toEqual(['suspended']);
  });
});
