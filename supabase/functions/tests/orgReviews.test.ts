import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test(
  'list-org-reviews requires org.reviews:view and published-only received feed',
  async () => {
    const endpoint = await Deno.readTextFile(
      new URL('../list-org-reviews/index.ts', import.meta.url)
    );
    const shared = await Deno.readTextFile(new URL('../_shared/orgReviewList.ts', import.meta.url));
    assert(endpoint.includes("'org.reviews:view'"));
    assert(endpoint.includes('resolveOrgAccessContext'));
    assert(shared.includes(".eq('status', 'published')"));
    assertEquals(shared.includes('internal_note,'), false);
    assert(shared.includes('review_summary_for_properties'));
    assert(shared.includes('review_stats_by_property'));
  }
);

Deno.test('list-org-reviews limits org members to their assigned listings', async () => {
  const endpoint = await Deno.readTextFile(
    new URL('../list-org-reviews/index.ts', import.meta.url)
  );
  const shared = await Deno.readTextFile(new URL('../_shared/orgReviewList.ts', import.meta.url));
  assert(endpoint.includes('canListAllProperties'));
  assert(endpoint.includes('resolveAssignedListingIdsForOrgUser'));
  // The property filter can only narrow the visible set, never widen it.
  assert(endpoint.includes('visibleIds.filter('));
  assert(shared.includes(".in('property_id', visiblePropertyIds)"));
  assert(shared.includes(".in('id', scope.assignedPropertyIds)"));
});
